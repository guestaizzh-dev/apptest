const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs/promises')
const path = require('node:path')

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function createAppServer(dist, apiOrigin) {
  const root = path.resolve(dist)
  const target = new URL(apiOrigin)
  const upstreamClient = target.protocol === 'https:' ? https : http
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`)
      if (url.host !== req.headers.host) {
        res.writeHead(400).end()
        return
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const proxy = upstreamClient.request(
          {
            hostname: target.hostname,
            port: target.port,
            method: req.method,
            path: url.pathname + url.search,
            headers: { ...req.headers, host: target.host },
          },
          (upstream) => {
            const headers = { ...upstream.headers }
            for (const key of Object.keys(headers))
              if (key.startsWith('access-control-')) delete headers[key]
            res.writeHead(upstream.statusCode, headers)
            upstream.pipe(res)
          },
        )
        proxy.setTimeout(20000, () => proxy.destroy(new Error('后端连接超时')))
        proxy.on('error', () => {
          if (!res.headersSent)
            res
              .writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
              .end(
                JSON.stringify({
                  code: 502,
                  msg: '无法连接教学服务，请检查网络后重试。',
                }),
              )
          else res.destroy()
        })
        res.on('close', () => proxy.destroy())
        req.pipe(proxy)
        return
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405).end()
        return
      }
      let file = path.resolve(root, '.' + decodeURIComponent(url.pathname))
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403).end()
        return
      }
      if (file === root || !path.extname(file)) file = path.join(root, 'index.html')
      const data = await fs.readFile(file)
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 400).end()
    }
  })
}
module.exports = { createAppServer }
