// CI uses Playwright from an isolated tools directory; no browser download is needed.
const { _electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

async function main() {
  const executablePath = process.argv[2]
  assert.ok(executablePath, 'Provide the packaged Electron executable path')
  const output = path.resolve(process.argv[3] || 'release/macos-online/test-results')
  await fs.mkdir(output, { recursive: true })
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-smoke-'))
  let application
  let page
  const errors = []
  try {
    application = await _electron.launch({
      executablePath,
      args: [`--user-data-dir=${userData}`],
      timeout: 60000,
    })
    page = await application.firstWindow({ timeout: 60000 })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.locator('#phone').waitFor({ state: 'visible', timeout: 30000 })
    assert.equal(new URL(page.url()).origin, 'http://127.0.0.1:18376')
    assert.equal(await page.getByRole('heading', { name: '登录教师工作台' }).count(), 1)
    assert.equal(await page.locator('#password').getAttribute('type'), 'password')
    await page.getByRole('button', { name: '显示密码', exact: true }).click()
    assert.equal(await page.locator('#password').getAttribute('type'), 'text')
    await page.getByRole('button', { name: '登录工作台', exact: true }).click()
    assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true')
    const backend = await page.evaluate(async () => {
      const health = await (await fetch('/api/actuator/health')).json()
      const courses = await (await fetch('/api/teacher/courses')).json()
      return { health: health.status, unauthenticatedCode: courses.code }
    })
    assert.deepEqual(backend, { health: 'UP', unauthenticatedCode: 401 })
    assert.deepEqual(errors, [], 'Login page must not report uncaught JavaScript errors')
    await page.screenshot({ path: path.join(output, 'login.png') })
    await fs.writeFile(
      path.join(output, 'launch.json'),
      JSON.stringify(
        { passed: true, platform: process.platform, arch: process.arch, backend, errors },
        null,
        2,
      ),
    )
    console.log('PASS: packaged app launch, login UI, validation and production HTTPS proxy.')
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    await fs.writeFile(
      path.join(output, 'launch.json'),
      JSON.stringify({ passed: false, error: error.message, errors }, null, 2),
    )
    throw error
  } finally {
    await application?.close()
    await fs.rm(userData, { recursive: true, force: true })
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
