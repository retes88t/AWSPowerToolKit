import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/SQSExplorer/',
  plugins: [react(), tailwindcss(), sqsDevProxy()],
})
