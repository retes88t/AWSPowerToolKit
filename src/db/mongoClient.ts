// Thin fetch wrapper around the dev-only Mongo proxy exposed by `mongoDevProxy`
// in vite.config.ts (routes documented there: /mongo-proxy/verify|databases|collections|query).
// This module owns the only `fetch(...)` calls to that proxy; higher-level logic
// (src/db/mongoService.ts) should call the functions here instead of hitting
// `fetch` directly, so the request/response shapes stay in one place.
//
// Like the SQS dev proxy, this only exists under `npm run dev` — in a production
// build (GitHub Pages) there is no backend, so these calls will fail with a
// network error. Callers are expected to handle that gracefully.

const MONGO_PROXY_BASE = '/mongo-proxy'

/** Mirrors the `connection` shape expected by `mongoDevProxy` in vite.config.ts. */
export interface MongoProxyConnectionInput {
  id: string
  connectionString?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
}

export interface MongoProxyQueryOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
}

interface MongoProxyRequestBody {
  connection: MongoProxyConnectionInput
  database?: string
  collection?: string
  filter?: Record<string, unknown>
  options?: MongoProxyQueryOptions
}

type MongoProxyAction = 'verify' | 'databases' | 'collections' | 'query'

async function postToMongoProxy<T>(action: MongoProxyAction, body: MongoProxyRequestBody): Promise<T> {
  const res = await fetch(`${MONGO_PROXY_BASE}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Mongo proxy error (${action}): ${text}`)
  }

  return (await res.json()) as T
}

export function verifyConnection(connection: MongoProxyConnectionInput): Promise<{ ok: true }> {
  return postToMongoProxy('verify', { connection })
}

export function fetchDatabases(connection: MongoProxyConnectionInput): Promise<{ databases: string[] }> {
  return postToMongoProxy('databases', { connection })
}

export function fetchCollections(
  connection: MongoProxyConnectionInput,
  database: string,
): Promise<{ collections: string[] }> {
  return postToMongoProxy('collections', { connection, database })
}

export function fetchQuery(
  connection: MongoProxyConnectionInput,
  database: string,
  collection: string,
  filter?: Record<string, unknown>,
  options?: MongoProxyQueryOptions,
): Promise<{ documents: unknown[] }> {
  return postToMongoProxy('query', { connection, database, collection, filter, options })
}
