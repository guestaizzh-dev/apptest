import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const { createAppServer } = createRequire(import.meta.url)('../electron/server.cjs')
const root = await mkdtemp(join(tmpdir(), 'teacher-desktop-'))
const backend = http.createServer((req, res) => {
  let data = ''
  req.on('data', (chunk) => {
    data += chunk
  })
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ method: req.method, path: req.url, token: req.headers.satoken, data }))
  })
})
let server
try {
  await writeFile(join(root, 'index.html'), 'desktop-page')
  await writeFile(join(root, 'main.js'), '/* asset */')
  await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve))
  server = createAppServer(root, `http://127.0.0.1:${backend.address().port}`)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  assert.equal(
    await (await fetch(origin + '/classroom/42')).text(),
    'desktop-page',
    '客户端独立支持历史路由',
  )
  assert.equal(
    (await fetch(origin + '/main.js')).headers.get('content-type'),
    'text/javascript; charset=utf-8',
  )
  assert.equal((await fetch(origin + '/missing.png')).status, 404)
  assert.equal(
    (await fetch(origin + '/..%5cpackage.json')).status,
    403,
    'Windows 路径不能越过资源目录',
  )
  const response = await fetch(origin + '/api/auth/teacher-login?test=1', {
    method: 'POST',
    headers: { satoken: 'test-token', 'Content-Type': 'application/json' },
    body: '{"test":true}',
  })
  assert.equal(response.headers.get('access-control-allow-origin'), null)
  assert.deepEqual(await response.json(), {
    method: 'POST',
    path: '/api/auth/teacher-login?test=1',
    token: 'test-token',
    data: '{"test":true}',
  })
  await new Promise((resolve) => backend.close(resolve))
  const unavailable = await fetch(origin + '/api/health')
  assert.equal(unavailable.status, 502)
  assert.equal((await unavailable.json()).code, 502)
  console.log(
    'PASS: desktop SPA/assets, local API proxy, auth/body forwarding, resource isolation and backend failure.',
  )
  if (process.argv.includes('--online')) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    server = createAppServer(root, 'https://xueerguitu.com')
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const online = `http://127.0.0.1:${server.address().port}`
    const health = await fetch(online + '/api/actuator/health')
    assert.equal(health.status, 200)
    assert.equal((await health.json()).status, 'UP')
    const unauthorized = await fetch(online + '/api/teacher/courses')
    assert.equal((await unauthorized.json()).code, 401, '线上课程接口仍要求教师登录')
    console.log('PASS: production HTTPS proxy, service health and teacher authentication boundary.')
  }
} finally {
  server?.closeAllConnections()
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()))
  backend.closeAllConnections()
  if (backend.listening) await new Promise((resolve) => backend.close(resolve))
  await rm(root, { recursive: true, force: true })
}
