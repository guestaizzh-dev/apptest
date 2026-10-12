import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

const server = await createServer({ server: { middlewareMode: true, hmr: false } })
try {
  const { backendHttp } = await server.ssrLoadModule('/src/services/http.ts')
  const { setSessionToken } = await server.ssrLoadModule('/src/services/session.ts')
  const { fetchTeachingRange, fetchOwnedLesson } =
    await server.ssrLoadModule('/src/api/teaching.ts')
  const { useTeachingStore } = await server.ssrLoadModule('/src/stores/teaching.ts')
  const { calendarEvents, clipCalendarTime, slotStatus, toTeacherLesson } =
    await server.ssrLoadModule('/src/utils/teacherSchedule.ts')
  const { canEnter, matchesLessonQuery } = await server.ssrLoadModule('/src/utils/lesson.ts')
  const { registerRouterGuards } = await server.ssrLoadModule('/src/router/guards.ts')
  const { requireBookingId, joinVideoClassroom } = await server.ssrLoadModule('/src/api/rtc.ts')
  const id = '9007199254740993123'
  const rows = [
    {
      bookingId: id,
      scheduleId: '88',
      bookingStatus: 1,
      childName: '测试学生',
      courseSubject: '数学',
      courseGrade: '七年级',
      classStartTime: '2026-10-01 08:00:00',
      classEndTime: '2026-10-01 09:00:00',
      hasCourseReport: false,
      hasClassFeedback: true,
    },
    {
      bookingId: '22',
      scheduleId: '89',
      bookingStatus: 4,
      classStartTime: '2026-10-02 20:00:00',
      classEndTime: '2026-10-02 21:00:00',
    },
    {
      bookingId: '23',
      scheduleId: '90',
      bookingStatus: 3,
      classStartTime: '2026-10-03 20:00:00',
      classEndTime: '2026-10-03 21:00:00',
    },
    {
      bookingId: '24',
      scheduleId: '91',
      bookingStatus: 0,
      classStartTime: '2026-09-27 23:30:00',
      classEndTime: '2026-09-28 00:30:00',
    },
  ]
  const weekSlots = [
    {
      scheduleId: '88',
      bookingId: id,
      status: '2',
      startTime: rows[0].classStartTime,
      endTime: rows[0].classEndTime,
      bookVersion: '人教版',
      remark: '不应传递的内部信息',
    },
    {
      scheduleId: '91',
      bookingId: '24',
      status: '1',
      startTime: rows[3].classStartTime,
      endTime: rows[3].classEndTime,
    },
    {
      scheduleId: '101',
      status: '0',
      startTime: '2026-10-01 07:00:00',
      endTime: '2026-10-01 08:00:00',
    },
    {
      scheduleId: '102',
      status: '3',
      startTime: '2026-10-01 10:00:00',
      endTime: '2026-10-01 11:00:00',
    },
  ]
  const range = { from: '2026-09-28', to: '2026-10-04', weekStart: '2026-09-28' }
  const response = (config, data, code = 200) => ({
    data: { code, data },
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
  })
  const calls = []
  function adapter(config) {
    calls.push(config)
    if (config.url === '/teacher/schedules/week')
      return Promise.resolve(response(config, weekSlots))
    if (config.url === '/teacher/courses') {
      // 模拟服务端将 pageSize 限为 2，必须继续分页。
      const pageNum = config.params.pageNum
      return Promise.resolve(
        response(config, {
          total: rows.length,
          rows: rows.slice((pageNum - 1) * 2, pageNum * 2),
          pageNum,
          pageSize: 2,
        }),
      )
    }
    throw new Error(`不应调用 ${config.url}`)
  }
  backendHttp.defaults.adapter = adapter
  setSessionToken('schedule-test')
  const result = await fetchTeachingRange(range)
  assert.equal(result.lessons.length, 4)
  assert.equal(result.slots.length, 4)
  assert.equal(calls.filter((call) => call.url === '/teacher/courses').length, 2)
  assert.equal(calls[0].params.weekStart, '2026-09-28')
  assert.equal(calls[1].params.dateStart, '2026-09-27', '跨午夜必须包含上一日开始的课')
  for (const call of calls) {
    assert.equal(call.headers.get('satoken'), 'schedule-test')
    assert.equal(call.headers.get('X-Active-Role'), 'teacher')
    assert.equal('teacherId' in call.params, false)
  }
  const lesson = result.lessons.find((item) => item.id === id)
  assert.equal(lesson.bookingId, id)
  assert.equal(lesson.status, 'scheduled')
  assert.equal(lesson.bookVersion, '人教版')
  assert.equal(lesson.hasClassFeedback, true)
  assert.equal(lesson.duration, undefined, '无真实出勤数据不可造时长')
  assert.equal('remark' in result.slots[0], false)
  assert.equal(canEnter(lesson), true, '已建课可打开准备页面')
  assert.equal(canEnter(result.lessons.find((item) => item.id === '22')), false)
  assert.equal(canEnter(result.lessons.find((item) => item.id === '23')), false)
  assert.equal(canEnter({ ...lesson, endTime: null }), false)
  assert.equal(canEnter({ ...lesson, endTime: '2026-10-01 07:00:00' }), false)
  assert.equal(canEnter({ ...lesson, roomClosed: true }), false)
  assert.equal(matchesLessonQuery(lesson, { keyword: '七年级', status: 'scheduled' }), true)
  assert.equal(matchesLessonQuery(lesson, { keyword: '', status: 'completed' }), false)
  const unknown = toTeacherLesson({
    bookingId: '1',
    bookingStatus: 2,
    studentName: '待补充',
    subject: '',
    grade: '',
    startTime: null,
    endTime: null,
  })
  assert.equal(unknown.status, 'unknown')
  assert.equal(canEnter(unknown), false)
  assert.equal(slotStatus(result.slots[2]), '空闲可约')
  const dayEvents = calendarEvents(result.lessons, result.slots, '2026-10-01')
  assert.equal(dayEvents.length, 3, '已绑定时段不重复展示为课程')
  assert.equal(dayEvents[0].start, 420, '上午时段完整保留')
  assert.equal(dayEvents[1].lesson.id, id)
  assert.deepEqual(clipCalendarTime(rows[3].classStartTime, rows[3].classEndTime, '2026-09-28'), {
    start: 0,
    end: 30,
  })
  assert.equal(
    clipCalendarTime('2026-10-01 23:00:00', '2026-10-02 00:00:00', '2026-10-02'),
    undefined,
  )
  assert.equal(
    clipCalendarTime('2026-02-30 23:00:00', '2026-03-01 00:00:00', '2026-02-30'),
    undefined,
  )
  const overlap = calendarEvents(
    [
      { ...lesson, id: 'a', startTime: '2026-10-01 08:00:00', endTime: '2026-10-01 09:00:00' },
      { ...lesson, id: 'b', startTime: '2026-10-01 08:30:00', endTime: '2026-10-01 09:30:00' },
      { ...lesson, id: 'c', startTime: '2026-10-01 09:00:00', endTime: '2026-10-01 10:00:00' },
      { ...lesson, id: 'd', startTime: '2026-10-01 10:00:00', endTime: '2026-10-01 11:00:00' },
    ],
    [],
    '2026-10-01',
  )
  assert.deepEqual(
    overlap.map((item) => [item.lane, item.lanes]),
    [
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ],
  )

  const store = useTeachingStore(createPinia())
  calls.length = 0
  await Promise.all([store.loadRange(range), store.loadRange(range)])
  assert.equal(calls.length, 3, '同范围并发加载去重')
  assert.deepEqual(store.weekSummary('2026-10-01'), { total: 3, completed: 1, pending: 1 })
  assert.equal(store.getLesson(id).bookingId, id)
  store.markRoomClosed(id)
  assert.equal(canEnter(store.getLesson(id)), false)
  await store.loadRange(range, true)
  assert.equal(store.getLesson(id).roomClosed, true, '刷新不能抹去本会话已关闭的房间')
  assert.equal(store.getLesson(id).status, 'scheduled', '关闭房间不伪造课程完成')
  calls.length = 0
  await fetchOwnedLesson(id)
  assert.equal(calls[0].params.dateStart, undefined, '直接打开课堂按当前教师全量列表查找')
  assert.equal(await fetchOwnedLesson('999999'), undefined)

  // 请求切换/退出时，不允许迟到结果恢复旧周或旧教师数据。
  let release
  backendHttp.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(response(config, { total: 1, rows: [rows[0]], pageNum: 1, pageSize: 100 }))
    })
  const late = store.loadRange({ from: '2026-10-01', to: '2026-10-01' }, true)
  while (!release) await new Promise((resolve) => setTimeout(resolve, 0))
  const releaseOld = release
  backendHttp.defaults.adapter = (config) =>
    Promise.resolve(response(config, { total: 0, rows: [], pageNum: 1, pageSize: 100 }))
  await store.loadRange({ from: '2026-10-02', to: '2026-10-02' })
  releaseOld()
  await late
  assert.equal(store.lessons.length, 0)
  assert.equal(store.initialized, true)
  release = undefined
  backendHttp.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(response(config, { total: 1, rows: [rows[0]], pageNum: 1, pageSize: 100 }))
    })
  const oldSession = store.loadRange({ from: '2026-10-01', to: '2026-10-01' })
  while (!release) await new Promise((resolve) => setTimeout(resolve, 0))
  setSessionToken('new-teacher')
  release()
  await oldSession
  assert.equal(store.lessons.length, 0)
  assert.equal(store.getLesson(id), undefined)
  assert.equal(store.initialized, false)
  backendHttp.defaults.adapter = () => Promise.reject(new Error('课表暂不可用'))
  await assert.rejects(store.loadRange(range), /课表暂不可用/)
  assert.equal(store.errorMessage, '课表暂不可用')
  assert.equal(store.loading, false)
  backendHttp.defaults.adapter = adapter
  await store.loadRange(range)
  assert.equal(store.initialized, true)
  backendHttp.defaults.adapter = (config) => Promise.resolve(response(config, {}))
  await assert.rejects(fetchTeachingRange(range), /周课表响应格式/)

  // 大整数 ID 原样进入真实 ZEGO 地址；数字精度已丢失的 ID 拒绝入房。
  requireBookingId(id)
  assert.throws(() => requireBookingId(Number(id)), /排课 ID/)
  assert.throws(() => requireBookingId('../22'), /排课 ID/)
  backendHttp.defaults.adapter = (config) => {
    assert.equal(config.url, `/zego/bookings/${id}/join`)
    return Promise.resolve(
      response(config, {
        appId: 1,
        roomId: 'r',
        userId: 'teacher',
        streamId: 'exact-backend-stream',
        token: 't',
        expiresIn: 600,
        serverTime: 1,
        role: 'TEACHER',
      }),
    )
  }
  await joinVideoClassroom(id)

  const user = { userId: 1, userName: '测试教师', roles: [{ code: 'teacher', name: '教师' }] }
  backendHttp.defaults.adapter = (config) =>
    config.url === '/auth/me' ? Promise.resolve(response(config, user)) : adapter(config)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'login', path: '/login', component: {} },
      { name: 'schedule', path: '/schedule', component: {} },
      { name: 'classroom', path: '/classroom/:id', component: {} },
    ],
  })
  const routeStores = createPinia()
  registerRouterGuards(router, routeStores)
  await router.push(`/classroom/${id}`)
  assert.equal(router.currentRoute.value.name, 'classroom')
  assert.equal(useTeachingStore(routeStores).getLesson(id).bookingId, id)
  await router.push('/classroom/23')
  assert.equal(router.currentRoute.value.name, 'schedule', '取消课程不能打开课堂')
  await router.push('/classroom/999999')
  assert.equal(router.currentRoute.value.name, 'schedule', '未拥有的排课不能打开课堂')
  setSessionToken('')
  console.log(
    '通过：真实课表接口契约、分页、状态、跨日与重叠排课、范围去重/切换/失败重试、会话隔离、课堂所属校验和大整数 ID。',
  )
} finally {
  await server.close()
}
