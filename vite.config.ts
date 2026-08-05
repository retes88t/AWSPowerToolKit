import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { MongoClient } from 'mongodb'

// Amazon SQS does not send CORS headers, so a browser can't call it directly.
// This dev-only middleware re-signs nothing (the AWS SDK already signed the
// request against the real sqs.<region>.amazonaws.com host before it gets
// here — see src/aws/sqsClient.ts) and simply forwards the already-signed
// request bytes to AWS, then streams the response back same-origin so the
// browser never performs a cross-origin request in the first place.
function sqsDevProxy(): Plugin {
  return {
    name: 'sqs-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/aws-proxy', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://internal')
          const segments = url.pathname.split('/').filter(Boolean)
          const region = segments.shift()
          if (!region) {
            res.statusCode = 400
            res.end('Missing region segment, expected /aws-proxy/<region>/...')
            return
          }

          const targetPath = '/' + segments.join('/') + url.search
          const targetUrl = `https://sqs.${region}.amazonaws.com${targetPath}`

          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (!value) continue
            if (['host', 'connection', 'content-length'].includes(key.toLowerCase())) continue
            headers.set(key, Array.isArray(value) ? value.join(',') : value)
          }

          const upstream = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            if (['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return
            res.setHeader(key, value)
          })
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (err) {
          res.statusCode = 502
          res.end(`SQS dev proxy error: ${(err as Error).message}`)
        }
      })
    },
  }
}

// Mirrors src/types/mongoConnection.ts's MongoConnection, kept local (rather than
// imported from src/) so this dev-only Node-side plugin doesn't depend on the
// frontend's type graph. Keep the two shapes in sync if either changes.
interface MongoConnectionInput {
  id: string
  connectionString?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
}

function buildMongoUri(connection: MongoConnectionInput): string {
  if (connection.connectionString) return connection.connectionString

  const auth =
    connection.username || connection.password
      ? `${encodeURIComponent(connection.username ?? '')}:${encodeURIComponent(connection.password ?? '')}@`
      : ''
  const host = connection.host || 'localhost'
  const port = connection.port ? `:${connection.port}` : ''
  const database = connection.database ? `/${connection.database}` : ''
  return `mongodb://${auth}${host}${port}${database}`
}

// MongoClient instances are cached per connection so repeated requests from the
// same saved connection reuse the underlying socket pool instead of reconnecting
// on every call (same spirit as clientCache in src/aws/sqsService.ts).
const mongoClientCache = new Map<string, MongoClient>()

async function getMongoClient(connection: MongoConnectionInput): Promise<MongoClient> {
  const uri = buildMongoUri(connection)
  const cacheKey = `${connection.id}:${uri}`
  const cached = mongoClientCache.get(cacheKey)
  if (cached) return cached

  const client = new MongoClient(uri)
  try {
    await client.connect()
  } catch (err) {
    await client.close().catch(() => {})
    throw err
  }
  mongoClientCache.set(cacheKey, client)
  return client
}

// JSON.stringify already renders BSON ObjectId/Date values sensibly (ObjectId
// has a toJSON() returning its hex string, Date serializes to an ISO string),
// so a stringify/parse round-trip is enough to produce a plain JSON-safe value
// without pulling in bson's EJSON for this dev-only endpoint.
function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface MongoProxyRequestBody {
  connection: MongoConnectionInput
  database?: string
  collection?: string
  filter?: Record<string, unknown>
  options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }
}

// Dev-only proxy for the Database (Mongo/DocumentDB) module. There is no
// backend in production (GitHub Pages is static hosting), so this plugin only
// runs under `npm run dev` — the frontend (src/db/mongoClient.ts, added in a
// later task) must degrade gracefully when it's not reachable. Unlike SQS,
// this isn't a signed-request passthrough: the real `mongodb` driver runs here
// in Node and talks to the actual database, since the driver's wire protocol
// can't run in a browser at all (not just a CORS issue).
//
// Routes (all POST, JSON body of shape MongoProxyRequestBody):
//   /mongo-proxy/verify      -> { ok: true }
//   /mongo-proxy/databases   -> { databases: string[] }
//   /mongo-proxy/collections -> { collections: string[] }  (requires `database`)
//   /mongo-proxy/query       -> { documents: unknown[] }   (requires `database` + `collection`)
function mongoDevProxy(): Plugin {
  return {
    name: 'mongo-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/mongo-proxy', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://internal')
          const action = url.pathname.split('/').filter(Boolean)[0]

          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Only POST is supported on /mongo-proxy/...')
            return
          }

          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf-8')
          const body = (raw ? JSON.parse(raw) : {}) as MongoProxyRequestBody

          if (!body.connection) {
            res.statusCode = 400
            res.end('Missing "connection" in request body')
            return
          }

          const knownActions = ['verify', 'databases', 'collections', 'query']
          if (!action || !knownActions.includes(action)) {
            res.statusCode = 404
            res.end(`Unknown mongo-proxy action "${action}", expected one of ${knownActions.join('/')}`)
            return
          }

          // Only connect once the action itself is known valid, so a typo'd
          // route fails fast instead of waiting out Mongo's connection/server
          // selection timeout for nothing.
          const client = await getMongoClient(body.connection)

          let payload: unknown
          switch (action) {
            case 'verify': {
              await client.db().command({ ping: 1 })
              payload = { ok: true }
              break
            }
            case 'databases': {
              const { databases } = await client.db().admin().listDatabases()
              payload = { databases: databases.map((d) => d.name) }
              break
            }
            case 'collections': {
              if (!body.database) throw new Error('Missing "database" for /mongo-proxy/collections')
              const collections = await client.db(body.database).listCollections().toArray()
              payload = { collections: collections.map((c) => c.name) }
              break
            }
            case 'query': {
              if (!body.database || !body.collection) {
                throw new Error('Missing "database" and/or "collection" for /mongo-proxy/query')
              }
              const cursor = client
                .db(body.database)
                .collection(body.collection)
                .find(body.filter ?? {}, {
                  limit: body.options?.limit,
                  skip: body.options?.skip,
                  sort: body.options?.sort,
                })
              const documents = await cursor.toArray()
              payload = { documents: toJsonSafe(documents) }
              break
            }
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        } catch (err) {
          res.statusCode = 502
          res.end(`Mongo dev proxy error: ${(err as Error).message}`)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/AWSPowerToolKit/',
  plugins: [react(), tailwindcss(), sqsDevProxy(), mongoDevProxy()],
})
