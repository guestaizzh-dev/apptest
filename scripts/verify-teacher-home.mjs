import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

const server = await createServer({ server: { middlewareMode: true, hmr: false } })
try {
  const { backendHttp, http } = await server.ssrLoadModule('/src/services/http.ts')
  const { sessionToken, setSessionToken } = await server.ssrLoadModule('/src/services/session.ts')
  const { teacherLogin, fetchCurrentUser } = await server.ssrLoadModule('/src/api/auth.ts')
  const api = await server.ssrLoadModule('/src/api/teacherHome.ts')
  const helpers = await server.ssrLoadModule('/src/utils/teacherHome.ts')
  const { useTeacherHomeStore } = await server.ssrLoadModule('/src/stores/teacherHome.ts')
  const { useTeachingStore } = await server.ssrLoadModule('/src/stores/teaching.ts')
  const { registerRouterGuards } = await server.ssrLoadModule('/src/router/guards.ts')
  const user = { userId: '12', userName: '教师', roles: [{ code: 'teacher', name: '教师' }] }
  const response = (config, data) => ({
    data: { code: 200, data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const row = (id, overrides = {}) => ({
    bookingId: id,
    courseSubject: '数学',
    courseGrade: '初二',
    childName: '测试学员',
    classStartTime: '2026-10-01 14:00:00',
    classEndTime: '2026-10-01 14:50:00',
    bookingStatus: 1,
    hasCourseReport: false,
    hasClassFeedback: true,
    ...overrides,
  })
  const query = { dateStart: '2026-09-28', dateEnd: '2026-10-04' }
  let calls = []
  setSessionToken('existing-session')
  backendHttp.defaults.adapter = async (config) => {
    calls.push(config)
    return response(config, { token: 'new-session', user })
  }
  const result = await teacherLogin({
    phone: '13800000000',
    loginType: 'CODE',
    smsCode: '123456',
    userName: '不应发送',
  })
  assert.equal(result.token, 'new-session')
  assert.equal(calls[0].url, '/auth/teacher-login')
  assert.equal(calls[0].headers.get('satoken'), undefined, '新登录不携带旧 Token')
  assert.deepEqual(JSON.parse(calls[0].data), {
    phone: '13800000000',
    loginType: 'CODE',
    smsCode: '123456',
  })
  backendHttp.defaults.adapter = async (config) =>
    response(config, { token: 'bad', user: { ...user, roles: [{ code: 'student' }] } })
  await assert.rejects(
    teacherLogin({ phone: '13800000000', loginType: 'CODE', smsCode: '123456' }),
    /教师角色/,
  )
  assert.equal(sessionToken.value, 'existing-session')
  for (const code of [40101, 40102]) {
    setSessionToken('expired-session')
    backendHttp.defaults.adapter = async (config) => ({
      ...response(config, {}),
      data: { code, msg: '登录失效' },
    })
    await assert.rejects(fetchCurrentUser(), /登录失效/)
    assert.equal(sessionToken.value, '')
  }

  setSessionToken('teacher-session')
  calls = []
  http.defaults.adapter = () => {
    throw new Error('首页不能读取 mock overview')
  }
  backendHttp.defaults.adapter = async (config) => {
    calls.push(config)
    const rows =
      config.params.pageNum === 1
        ? [row(2, { classStartTime: '2026-10-02 14:00:00', bookingStatus: 4 }), row(1)]
        : [
            row('9007199254740993', {
              childName: null,
              customerName: '试听孩子',
              hasCourseReport: null,
            }),
          ]
    return response(config, { total: 3, rows, pageNum: config.params.pageNum, pageSize: 2 })
  }
  const courses = await api.fetchTeacherCourses(query)
  assert.equal(calls.length, 2, '拉完全部分页，后端缩小 pageSize 时仍可继续')
  assert.equal(courses.length, 3)
  assert.deepEqual(
    courses.map((course) => course.bookingId),
    ['1', '9007199254740993', '2'],
  )
  assert.equal(courses[1].studentName, '试听孩子')
  assert.equal(courses[1].hasCourseReport, null)
  assert.equal(calls[0].url, '/teacher/courses')
  assert.equal(calls[0].headers.get('satoken'), 'teacher-session')
  assert.equal(calls[0].headers.get('X-Active-Role'), 'teacher')
  assert.equal('teacherId' in calls[0].params, false)
  assert.equal('orderByColumn' in calls[0].params, false)
  assert.equal(helpers.shanghaiClock(Date.parse('2026-09-30T16:30:00Z')).date, '2026-10-01')
  assert.equal(helpers.normalizeTeacherTime('2026-10-01 14:00:00'), '2026-10-01 14:00:00')
  assert.equal(helpers.normalizeTeacherTime('2026-02-30 14:00:00'), null)
  assert.equal(helpers.normalizeTeacherTime(null), null)
  const summary = helpers.summarizeTeacherHome(courses, '2026-10-01')
  assert.equal(summary.today.length, 2)
  assert.equal(summary.todayPending, 2)
  assert.equal(summary.weeklyCompleted, 1)
  assert.equal(summary.weeklyTotal, 3)
  assert.equal('actualMinutes' in summary, false, '不得把计划时间推算为实际出勤时长')
  assert.equal(helpers.teacherCourseStatus(courses[0]).text, '已建课', '不得把已建课当作实时上课中')
  assert.deepEqual(helpers.homeDateRanges('2026-10-01').week, query)

  backendHttp.defaults.adapter = async (config) =>
    response(config, {
      total: 3,
      rows: config.params.pageNum === 1 ? [row(1)] : [],
      pageNum: config.params.pageNum,
      pageSize: 1,
    })
  await assert.rejects(api.fetchTeacherCourses(query), /不完整/)
  backendHttp.defaults.adapter = async (config) =>
    response(config, {
      total: 3,
      rows: [row(1)],
      pageNum: config.params.pageNum,
      pageSize: 1,
    })
  await assert.rejects(api.fetchTeacherCourses(query), /不完整/)
  backendHttp.defaults.adapter = async (config) =>
    response(config, {
      total: 3,
      rows: [row(config.params.pageNum)],
      pageNum: 1,
      pageSize: 1,
    })
  await assert.rejects(api.fetchTeacherCourses(query), /分页信息/)
  backendHttp.defaults.adapter = async (config) =>
    response(config, {
      total: 1,
      rows: [row(Number.MAX_SAFE_INTEGER + 1)],
      pageNum: 1,
      pageSize: 100,
    })
  await assert.rejects(api.fetchTeacherCourses(query), /精度/)

  // 首页路由无需旧 overview；恢复登录后直接呈现首页自己的加载状态。
  const stores = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'home', path: '/', component: {} },
      { name: 'login', path: '/login', component: {}, meta: { public: true } },
    ],
  })
  backendHttp.defaults.adapter = async (config) => response(config, user)
  registerRouterGuards(router, stores)
  await router.push('/')
  assert.equal(router.currentRoute.value.name, 'home')
  assert.equal(useTeachingStore(stores).initialized, false)

  const home = useTeacherHomeStore(stores)
  const callsForHome = []
  backendHttp.defaults.adapter = async (config) => {
    callsForHome.push(config)
    return response(config, { total: 0, rows: [], pageNum: config.params.pageNum, pageSize: 100 })
  }
  await Promise.all([home.load(), home.load()])
  assert.equal(callsForHome.length, 3, '首页三类查询的并发初始化去重')
  assert.equal(home.initialized, true)
  assert.equal(home.summary.today.length, 0, '成功空结果展示真实空态')
  assert.equal(callsForHome.filter((config) => config.params.bookingStatus === 4).length, 1)
  assert.equal(callsForHome[0].params.dateStart, helpers.homeDateRanges(home.date).week.dateStart)
  backendHttp.defaults.adapter = () => Promise.reject(new Error('network unavailable'))
  await assert.rejects(home.load(true), /network unavailable/)
  assert.match(home.errorMessage, /network unavailable/)
  assert.equal(home.loading, false)

  // 退出期间的在途响应即使迟到，也不得恢复旧教师数据。
  const pending = []
  backendHttp.defaults.adapter = (config) =>
    new Promise((resolve) =>
      pending.push(() =>
        resolve(
          response(config, {
            total: 1,
            rows: [row(1)],
            pageNum: config.params.pageNum,
            pageSize: 100,
          }),
        ),
      ),
    )
  const loading = home.load(true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(pending.length, 3)
  setSessionToken('another-teacher')
  pending.forEach((release) => release())
  await loading
  assert.equal(home.initialized, false)
  assert.equal(home.data.weekCourses.length, 0)
  assert.equal(home.errorMessage, '')
  home.$dispose()
  console.log(
    '通过：教师手机号登录、角色校验、首页真实请求、全量分页、上海日期、缺失值、无虚构时长、失败重试与旧会话隔离。',
  )
} finally {
  await server.close()
}
