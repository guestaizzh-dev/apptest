import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

const server = await createServer({ server: { middlewareMode: true, hmr: false } })
try {
  const { backendHttp, http, RequestError } = await server.ssrLoadModule('/src/services/http.ts')
  const { sessionToken, setSessionToken } = await server.ssrLoadModule('/src/services/session.ts')
  const { fetchCurrentUser, teacherLogin, requestLoginSmsCode } =
    await server.ssrLoadModule('/src/api/auth.ts')
  const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts')
  const { useTeachingStore } = await server.ssrLoadModule('/src/stores/teaching.ts')
  const { registerRouterGuards } = await server.ssrLoadModule('/src/router/guards.ts')
  const { createMockAdapter } = await server.ssrLoadModule('/src/mocks/teachingAdapter.ts')
  const { createRouteRegistry } = await server.ssrLoadModule('/src/router/registry.ts')
  const { safeLoginRedirect } = await server.ssrLoadModule('/src/utils/auth.ts')
  const { AxiosError } = await server.ssrLoadModule('axios')
  const user = {
    userId: 12,
    userName: '测试教师',
    loginAccount: 'teacher-test',
    phone: '13800000000',
    roles: [{ code: 'teacher', name: '教师' }],
  }
  const identity = { phone: user.phone, loginType: 'CODE', smsCode: '123456' }
  const passwordIdentity = { phone: user.phone, loginType: 'PASSWORD', password: ' pass123 ' }
  const { readRememberedLogin, saveRememberedLogin, clearRememberedLogin } =
    await server.ssrLoadModule('/src/services/loginPreferences.ts')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const savedValues = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => savedValues.get(key) ?? null,
      setItem: (key, value) => savedValues.set(key, value),
      removeItem: (key) => savedValues.delete(key),
    },
  })
  try {
    assert.equal(readRememberedLogin(), null, '首次登录不自动勾选记住登录')
    assert.equal(saveRememberedLogin(identity), true)
    assert.deepEqual(
      readRememberedLogin(),
      { phone: user.phone, loginType: 'CODE' },
      '仅恢复账号和登录方式',
    )
    assert.equal(savedValues.size, 1, '记住表单不应保存会话 Token')
    const storageKey = savedValues.keys().next().value
    assert.deepEqual(
      JSON.parse(savedValues.get(storageKey)),
      { phone: user.phone, loginType: 'CODE' },
      '不保存一次性验证码',
    )
    assert.equal(saveRememberedLogin(passwordIdentity), true)
    assert.deepEqual(
      JSON.parse(savedValues.get(storageKey)),
      { phone: user.phone, loginType: 'PASSWORD' },
      '不保存密码',
    )
    savedValues.set(storageKey, JSON.stringify({ phone: user.phone, smsCode: '123456' }))
    assert.deepEqual(
      readRememberedLogin(),
      { phone: user.phone, loginType: 'CODE' },
      '兼容原验证码登录记录',
    )
    assert.equal(JSON.parse(savedValues.get(storageKey)).smsCode, undefined, '迁移时移除旧验证码')
    assert.equal(clearRememberedLogin(), true)
    assert.equal(readRememberedLogin(), null, '取消记住后不再恢复登录信息')
    for (const corrupted of [
      '{',
      'null',
      '{}',
      '{"phone":123,"smsCode":"123456"}',
      '{"phone":"13800000000","loginType":"INVALID"}',
    ]) {
      savedValues.set(storageKey, corrupted)
      assert.equal(readRememberedLogin(), null, '损坏或错误类型的数据不应填入表单')
      assert.equal(savedValues.size, 0, '清理损坏的记忆记录')
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage unavailable')
      },
    })
    assert.equal(readRememberedLogin(), null)
    assert.equal(saveRememberedLogin(identity), false)
    assert.equal(clearRememberedLogin(), false, '浏览器禁用存储不能阻断登录流程')
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  }
  const calls = []
  let code = 200
  backendHttp.defaults.adapter = async (config) => {
    calls.push(config)
    return {
      data: {
        code,
        msg: code === 200 ? '成功' : '手机号或验证码校验失败',
        data:
          config.url === '/auth/teacher-login'
            ? { token: 'test-session', user }
            : config.url === '/auth/sms-code'
              ? { expireSeconds: 300, resendAfterSeconds: 60 }
              : user,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  http.defaults.adapter = createMockAdapter()
  const stores = createPinia()
  const auth = useAuthStore(stores)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'login', path: '/login', component: {}, meta: { public: true } },
      { name: 'home', path: '/', component: {} },
      { name: 'schedule', path: '/schedule', component: {} },
    ],
  })
  registerRouterGuards(router, stores)
  await router.push('/login?reason=forbidden')
  assert.equal(auth.errorMessage, '', 'URL 参数不能伪造接口认证错误')
  await router.push('/schedule?tab=records')
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(router.currentRoute.value.query.redirect, '/schedule?tab=records')
  assert.equal(calls.length, 0, '未登录时不请求业务或会话接口')
  assert.equal(useTeachingStore(stores).initialized, false)
  await auth.login(identity)
  assert.equal(calls[0].url, '/auth/teacher-login')
  assert.equal(calls[0].method, 'post')
  assert.deepEqual(JSON.parse(calls[0].data), identity)
  assert.equal(calls[0].headers.get('satoken'), undefined)
  assert.equal(auth.user.userName, '测试教师')
  await auth.login({ ...passwordIdentity, smsCode: '不应发送', userName: '不应发送' })
  assert.deepEqual(
    JSON.parse(calls.at(-1).data),
    passwordIdentity,
    '密码登录只发送密码，保留密码中的空格',
  )
  assert.equal(calls.at(-1).headers.get('satoken'), undefined)
  await teacherLogin({ ...identity, password: '不应发送' })
  assert.deepEqual(JSON.parse(calls.at(-1).data), identity, '验证码登录不发送密码')
  assert.deepEqual(await requestLoginSmsCode(user.phone), {
    expireSeconds: 300,
    resendAfterSeconds: 60,
  })
  assert.equal(calls.at(-1).url, '/auth/sms-code')
  assert.equal(calls.at(-1).method, 'post')
  assert.deepEqual(JSON.parse(calls.at(-1).data), { phone: user.phone })
  assert.equal(calls.at(-1).headers.get('satoken'), undefined, '发送验证码不携带旧会话')
  await router.push(safeLoginRedirect(router.currentRoute.value.query.redirect))
  assert.equal(router.currentRoute.value.name, 'schedule')
  await fetchCurrentUser()
  assert.equal(calls.at(-1).headers.get('satoken'), 'test-session')
  const restored = useAuthStore(createPinia())
  const beforeRestore = calls.length
  await Promise.all([restored.restoreSession(), restored.restoreSession()])
  assert.equal(calls.length - beforeRestore, 1, '刷新恢复会话的并发请求应去重')
  assert.equal(restored.authenticated, true)
  code = 401
  await assert.rejects(
    auth.login(identity),
    (error) => error instanceof RequestError && error.status === 401,
  )
  assert.equal(auth.errorMessage, '手机号或验证码校验失败', '登录失败展示接口原始提示')
  await assert.rejects(auth.login(passwordIdentity), (error) => error.status === 401)
  await assert.rejects(requestLoginSmsCode(user.phone), (error) => error.status === 401)
  assert.equal(sessionToken.value, 'test-session', '登录校验失败不能清掉另一个有效会话')
  await assert.rejects(fetchCurrentUser(), (error) => error.status === 401)
  assert.equal(sessionToken.value, '', 'HTTP 200 中的业务 401 也应清理会话')
  assert.equal(auth.errorMessage, '手机号或验证码校验失败', '业务 401 保留接口消息')
  setSessionToken('network-test')
  backendHttp.defaults.adapter = () => Promise.reject(new Error('network unavailable'))
  await assert.rejects(fetchCurrentUser(), /network unavailable/)
  assert.equal(sessionToken.value, 'network-test', '网络故障不能被当作登录过期')
  backendHttp.defaults.adapter = (config) =>
    Promise.reject(
      new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        data: { msg: '登录已过期' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      }),
    )
  await assert.rejects(
    fetchCurrentUser(),
    (error) => error.status === 401 && error.message === '登录已过期',
  )
  assert.equal(sessionToken.value, '')
  assert.equal(auth.errorMessage, '登录已过期', 'HTTP 401 跳转前保留接口消息')
  const failureStores = createPinia()
  const failedAuth = useAuthStore(failureStores)
  const failureRouter = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'login', path: '/login', component: {}, meta: { public: true } },
      { name: 'schedule', path: '/schedule', component: {} },
    ],
  })
  registerRouterGuards(failureRouter, failureStores)
  setSessionToken('restore-failure-test')
  backendHttp.defaults.adapter = async (config) => ({
    data: { code: 403, msg: '教师权限已停用，请联系学校管理员。' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  await failureRouter.push('/schedule?tab=records')
  assert.equal(failureRouter.currentRoute.value.name, 'login')
  assert.deepEqual(failureRouter.currentRoute.value.query, { redirect: '/schedule?tab=records' })
  assert.equal(failedAuth.errorMessage, '教师权限已停用，请联系学校管理员。')
  backendHttp.defaults.adapter = () => Promise.reject(new Error('会话服务暂时不可用'))
  await failureRouter.push('/schedule')
  assert.deepEqual(failureRouter.currentRoute.value.query, { redirect: '/schedule' })
  assert.equal(failedAuth.errorMessage, '会话服务暂时不可用', '恢复失败沿用真实错误')
  assert.equal(sessionToken.value, 'restore-failure-test', '恢复网络故障仍保留 Token')
  for (const unsafe of [
    'https://example.com',
    '//example.com',
    '/login',
    '/%2flogin',
    '/\\example.com',
    '/unknown',
    ['/', '/profile'],
  ])
    assert.equal(safeLoginRedirect(unsafe), '/')
  assert.equal(safeLoginRedirect('/classroom/7?from=home'), '/classroom/7?from=home')
  const registry = createRouteRegistry(router)
  assert.throws(
    () =>
      registry.replaceApplicationRoutes([
        { name: 'login', path: '/x', component: 'HomeView', meta: { title: '覆盖' } },
      ]),
    /无效/,
  )
  registry.clearApplicationRoutes()
  assert.equal(router.hasRoute('login'), true)
  backendHttp.defaults.adapter = async (config) => ({
    data: { code: 200 },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  setSessionToken('logout-test')
  await auth.logout()
  assert.equal(sessionToken.value, '')
  assert.equal(auth.user, null)
  assert.equal(auth.errorMessage, '', '主动退出不遗留接口错误提示')
  for (const invalid of [null, {}, { expireSeconds: 300, resendAfterSeconds: -1 }]) {
    backendHttp.defaults.adapter = async (config) => ({
      data: { code: 200, data: invalid },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    await assert.rejects(requestLoginSmsCode(user.phone), /验证码响应不完整/)
  }
  console.log(
    '通过：密码与验证码登录、凭证隔离、短信发送及响应校验、仅记住账号、旧记录迁移、损坏与禁用存储、接口错误提示与 URL 隔离、satoken 请求头、路由保护、会话恢复去重、业务与 HTTP 401、网络失败、站内回跳、退出会话。',
  )
} finally {
  await server.close()
}
