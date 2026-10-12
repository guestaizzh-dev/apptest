import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false } })
const credentials = {
  appId: 123,
  roomId: 'xrgt_b_42',
  userId: 't_7',
  streamId: 'xrgt_b_42_t_7',
  token: 'server-token',
  expiresIn: 900,
  serverTime: '2026-10-01T00:00:00Z',
  role: 'TEACHER',
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function media() {
  const track = {
    stops: 0,
    stop() {
      this.stops++
    },
  }
  return { track, getTracks: () => [track] }
}
function fakeEngine() {
  const handlers = new Map()
  const local = {
    ...media(),
    previews: 0,
    playVideo() {
      this.previews++
    },
    stopVideo() {},
  }
  const views = []
  const engine = {
    handlers,
    local,
    views,
    destroyed: 0,
    published: [],
    stopped: [],
    plays: [],
    stoppedPlays: [],
    logouts: [],
    renewals: [],
    mutes: [],
    on(name, callback) {
      handlers.set(name, callback)
    },
    off(name) {
      handlers.delete(name)
    },
    emit(name, ...args) {
      handlers.get(name)?.(...args)
    },
    checkSystemRequirements: async () => ({ webRTC: true }),
    createZegoStream: async () => local,
    destroyStream() {},
    loginRoom: async () => true,
    logoutRoom(roomId) {
      engine.logouts.push(roomId)
    },
    startPublishingStream(id) {
      engine.published.push(id)
      return true
    },
    stopPublishingStream(id) {
      engine.stopped.push(id)
    },
    startPlayingStream: async (id) => {
      engine.plays.push(id)
      return media()
    },
    stopPlayingStream(id) {
      engine.stoppedPlays.push(id)
    },
    createRemoteStreamView(stream) {
      const view = {
        stream,
        mounts: 0,
        muted: false,
        stopped: false,
        play(_, options) {
          this.mounts++
          this.muted = options.muted
        },
        stop() {
          this.stopped = true
        },
        setAudioMuted(muted) {
          this.muted = muted
          return true
        },
      }
      views.push(view)
      return view
    },
    mutePublishStreamVideo(_, muted) {
      engine.mutes.push(['video', muted])
      return true
    },
    mutePublishStreamAudio(_, muted) {
      engine.mutes.push(['audio', muted])
      return true
    },
    renewToken(token, roomId) {
      engine.renewals.push([token, roomId])
      return true
    },
    destroyEngine() {
      engine.destroyed++
    },
  }
  return engine
}
function remote(id = 'student-stream') {
  return { streamID: id, user: { userID: 's_8', userName: '测试学生' } }
}
const sessions = []
try {
  const { ClassroomSession } = await server.ssrLoadModule('/src/services/classroom.ts')
  const api = await server.ssrLoadModule('/src/api/rtc.ts')
  const { SuperBoardController } = await server.ssrLoadModule('/src/services/superboard.ts')
  const { backendHttp, http } = await server.ssrLoadModule('/src/services/http.ts')
  const { setSessionToken } = await server.ssrLoadModule('/src/services/session.ts')
  function setup(engine = fakeEngine(), fetch = async () => credentials, leave, board) {
    let state
    const session = new ClassroomSession(
      (value) => {
        state = value
      },
      {
        engine: async () => engine,
        credentials: fetch,
        leave,
      },
      board,
    )
    sessions.push(session)
    return { session, engine, state: () => state }
  }
  function publish(engine) {
    engine.emit('publisherStateUpdate', {
      streamID: credentials.streamId,
      state: 'PUBLISHING',
      errorCode: 0,
    })
  }

  // 入房与推流请求成功并不代表已连接，必须收到 SDK 发布成功事件。
  const normal = setup()
  const previewElement = {}
  normal.session.attachLocal(previewElement)
  await normal.session.connect(42, '老师')
  assert.equal(normal.state().phase, 'publishing')
  assert.deepEqual(normal.engine.published, [credentials.streamId])
  publish(normal.engine)
  assert.equal(normal.state().phase, 'connected')
  normal.session.attachLocal(previewElement)
  assert.equal(normal.engine.local.previews, 1, '状态刷新不能重复挂载本地预览')
  normal.session.toggleVideo()
  normal.session.toggleAudio()
  assert.deepEqual(normal.engine.mutes, [
    ['video', true],
    ['audio', true],
  ])
  assert.equal(normal.state().videoEnabled, false)
  normal.engine.emit('roomStreamUpdate', 'other-room', 'ADD', [remote()])
  assert.equal(normal.engine.plays.length, 0)
  normal.engine.emit('roomStreamUpdate', credentials.roomId, 'ADD', [
    { streamID: credentials.streamId, user: { userID: credentials.userId } },
    remote(),
    remote(),
    remote('student-2'),
  ])
  await flush()
  assert.deepEqual(normal.engine.plays, ['student-stream', 'student-2'])
  assert.equal(normal.state().participants.length, 2, '处理所有远端流并去重、自身不拉流')
  const remoteElement = {}
  normal.session.attachRemote('student-stream', remoteElement)
  normal.session.attachRemote('student-stream', remoteElement)
  assert.equal(normal.engine.views[0].mounts, 1)
  normal.session.toggleSpeaker()
  assert.equal(normal.engine.views[0].muted, true)
  normal.engine.emit('roomStateChanged', credentials.roomId, 'RECONNECTING', 0)
  assert.equal(normal.state().phase, 'reconnecting')
  normal.engine.emit('roomStateChanged', credentials.roomId, 'RECONNECTED', 0)
  assert.equal(normal.state().phase, 'connected')
  normal.engine.emit('roomStreamUpdate', credentials.roomId, 'DELETE', [remote()])
  assert.equal(normal.state().participants.length, 1)
  assert.equal(normal.engine.views[0].stream.track.stops, 1)
  normal.session.disconnect()
  assert.equal(normal.engine.local.track.stops, 1)
  assert.equal(normal.engine.handlers.size, 0)
  assert.equal(normal.engine.destroyed, 1)
  assert.deepEqual(normal.engine.logouts, [credentials.roomId])

  // DELETE 先于异步拉流完成，不能重新挂载已经离开的学生。
  const lateRemote = setup()
  const playing = deferred()
  lateRemote.engine.startPlayingStream = () => playing.promise
  await lateRemote.session.connect(42, '老师')
  lateRemote.engine.emit('roomStreamUpdate', credentials.roomId, 'ADD', [remote()])
  lateRemote.engine.emit('roomStreamUpdate', credentials.roomId, 'DELETE', [remote()])
  const lateMedia = media()
  playing.resolve(lateMedia)
  await flush()
  assert.equal(lateRemote.state().participants.length, 0)
  assert.equal(lateRemote.engine.views.length, 0)
  assert.equal(lateMedia.track.stops, 1)
  lateRemote.session.disconnect()

  // 同一学生在拉流完成前离开又加入，复用在途请求，避免旧请求停止新流。
  const readd = setup()
  const readding = deferred()
  let pullCount = 0
  readd.engine.startPlayingStream = () => {
    pullCount++
    return readding.promise
  }
  await readd.session.connect(42, '老师')
  readd.engine.emit('roomStreamUpdate', credentials.roomId, 'ADD', [remote()])
  readd.engine.emit('roomStreamUpdate', credentials.roomId, 'DELETE', [remote()])
  readd.engine.emit('roomStreamUpdate', credentials.roomId, 'ADD', [remote()])
  readding.resolve(media())
  await flush()
  assert.equal(pullCount, 1)
  assert.equal(readd.engine.views.length, 1)
  assert.equal(readd.state().participants.length, 1)
  readd.session.disconnect()

  // 在设备授权仍等待时退出；晚返回的摄像头轨道也必须释放。
  const permission = setup()
  const capturing = deferred()
  permission.engine.createZegoStream = () => capturing.promise
  const connecting = permission.session.connect(42, '老师')
  await flush()
  permission.session.disconnect()
  capturing.resolve(permission.engine.local)
  await connecting
  assert.equal(permission.engine.local.track.stops, 1)
  assert.equal(permission.engine.published.length, 0)
  assert.equal(permission.state().phase, 'idle')

  const login = setup()
  const loggingIn = deferred()
  login.engine.loginRoom = () => loggingIn.promise
  const logging = login.session.connect(42, '老师')
  await flush()
  login.session.disconnect()
  loggingIn.resolve(true)
  await logging
  assert.equal(login.engine.local.track.stops, 1)
  assert.equal(login.engine.published.length, 0)
  assert.equal(login.engine.logouts.length, 2, '在途登录晚完成后补充退出房间')

  // 在 Token/SDK 工厂等待时退出，不能创建一个遗留会话。
  const delayedCredentials = deferred()
  const tokenWait = setup(fakeEngine(), () => delayedCredentials.promise)
  const tokenConnecting = tokenWait.session.connect(42, '老师')
  tokenWait.session.disconnect()
  delayedCredentials.resolve(credentials)
  await tokenConnecting
  assert.equal(tokenWait.engine.published.length, 0)
  const delayedEngine = deferred()
  const factoryWait = setup()
  const factorySession = new ClassroomSession(() => {}, {
    credentials: async () => credentials,
    engine: () => delayedEngine.promise,
  })
  sessions.push(factorySession)
  const factoryConnecting = factorySession.connect(42, '老师')
  await flush()
  factorySession.disconnect()
  delayedEngine.resolve(factoryWait.engine)
  await factoryConnecting
  assert.equal(factoryWait.engine.destroyed, 1)

  // 定时器与 SDK 事件共享续期请求；验证固定房间/用户/流身份。
  let fetches = 0
  const renewal = deferred()
  const renewing = setup(fakeEngine(), () =>
    ++fetches === 1 ? Promise.resolve(credentials) : renewal.promise,
  )
  await renewing.session.connect(42, '老师')
  publish(renewing.engine)
  renewing.engine.emit('tokenWillExpire', credentials.roomId)
  renewing.engine.emit('tokenWillExpire', credentials.roomId)
  assert.equal(fetches, 2)
  renewal.resolve({ ...credentials, token: 'renewed-token' })
  await flush()
  assert.deepEqual(renewing.engine.renewals, [['renewed-token', credentials.roomId]])
  renewing.session.disconnect()

  const lateRenewal = deferred()
  let lateRenewFetches = 0
  const leftDuringRenewal = setup(fakeEngine(), () =>
    ++lateRenewFetches === 1 ? Promise.resolve(credentials) : lateRenewal.promise,
  )
  await leftDuringRenewal.session.connect(42, '老师')
  leftDuringRenewal.engine.emit('tokenWillExpire', credentials.roomId)
  leftDuringRenewal.session.disconnect()
  lateRenewal.resolve({ ...credentials, token: 'late-renewal' })
  await flush()
  assert.equal(leftDuringRenewal.state().phase, 'idle')
  assert.equal(leftDuringRenewal.engine.renewals.length, 0, '退出后的续期响应不能恢复已销毁房间')

  let mismatchedFetches = 0
  const mismatched = setup(fakeEngine(), async () =>
    ++mismatchedFetches === 1 ? credentials : { ...credentials, streamId: 'different-stream' },
  )
  await mismatched.session.connect(42, '老师')
  mismatched.engine.emit('tokenWillExpire', credentials.roomId)
  await flush()
  assert.equal(mismatched.state().phase, 'error')
  assert.match(mismatched.state().message, /身份/)
  assert.equal(mismatched.engine.local.track.stops, 1)
  assert.equal(mismatched.engine.renewals.length, 0)

  let failureFetches = 0
  const failing = setup(fakeEngine(), async () => {
    if (++failureFetches > 1) throw new Error('排课已关闭')
    return credentials
  })
  await failing.session.connect(42, '老师')
  failing.engine.emit('tokenWillExpire', credentials.roomId)
  await flush()
  assert.equal(failing.state().phase, 'error')
  assert.equal(failing.engine.destroyed, 1)

  const denied = setup()
  denied.engine.createZegoStream = async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
  }
  await denied.session.connect(42, '老师')
  assert.match(denied.state().message, /权限/)
  assert.equal(denied.engine.handlers.size, 0)
  denied.engine.createZegoStream = async () => denied.engine.local
  await denied.session.connect(42, '老师')
  publish(denied.engine)
  assert.equal(denied.state().phase, 'connected', '失败后可重新进入')
  denied.session.disconnect()

  const noPublish = setup()
  noPublish.engine.startPublishingStream = () => false
  await noPublish.session.connect(42, '老师')
  assert.equal(noPublish.state().phase, 'error')
  assert.equal(noPublish.engine.local.track.stops, 1)

  const invalidBooking = setup()
  await invalidBooking.session.connect(0, '老师')
  assert.equal(invalidBooking.state().phase, 'error')
  assert.equal(invalidBooking.engine.handlers.size, 0)

  // 离课提交与 SDK 清理同时执行；连续退出共享请求，重入必须等待旧 leave 完成。
  const attendance = {
    bookingId: '42',
    userId: credentials.userId,
    role: 'TEACHER',
    attendanceFlag: 1,
    attendanceSeconds: 1560,
    firstInTime: '2026-10-01 08:00:00',
    lastOutTime: '2026-10-01 08:26:00',
  }
  setSessionToken('attendance-session')
  const leaveResponse = deferred()
  const leaveCalls = []
  let recordJoins = 0
  const recorded = setup(
    fakeEngine(),
    async () => {
      recordJoins++
      return credentials
    },
    (id, token) => {
      leaveCalls.push([id, token])
      return leaveResponse.promise
    },
  )
  await recorded.session.connect(42, '老师')
  const exiting = recorded.session.disconnect()
  const repeatedExit = recorded.session.disconnect()
  assert.equal(exiting, repeatedExit)
  assert.equal(recorded.engine.local.track.stops, 1, '请求尚未返回时也必须释放设备')
  assert.equal(recorded.state().leaving, true)
  await flush()
  assert.deepEqual(leaveCalls, [[42, 'attendance-session']])
  const reentering = recorded.session.connect(42, '老师')
  await flush()
  assert.equal(recordJoins, 1, '迟到离课请求不能闭合下一次入房会话')
  leaveResponse.resolve(attendance)
  assert.deepEqual(await exiting, attendance)
  await reentering
  assert.equal(recordJoins, 2)
  await recorded.session.disconnect()
  assert.equal(leaveCalls.length, 2, '每次重新入房后重新记录退出')
  assert.deepEqual(recorded.state().attendance, attendance)
  await recorded.session.disconnect()
  assert.equal(leaveCalls.length, 2, '退出完成后重复清理不重复请求')

  let leaveAttempts = 0
  const failedRecord = setup(
    fakeEngine(),
    async () => credentials,
    async () => {
      if (++leaveAttempts === 1) throw new Error('离课服务暂不可用')
      return attendance
    },
  )
  await failedRecord.session.connect(42, '老师')
  await assert.rejects(failedRecord.session.disconnect(), /暂不可用/)
  assert.equal(failedRecord.engine.local.track.stops, 1)
  assert.match(failedRecord.state().leaveError, /离课记录提交失败/)
  assert.equal(failedRecord.state().leaving, false)
  assert.equal(failedRecord.state().attendance, undefined, '提交失败不伪造记录')
  await failedRecord.session.disconnect()
  assert.equal(leaveAttempts, 2)
  assert.equal(failedRecord.state().leaveError, '')
  assert.deepEqual(failedRecord.state().attendance, attendance)

  let unusedLeaves = 0
  const unused = setup(
    fakeEngine(),
    async () => credentials,
    async () => {
      unusedLeaves++
      return attendance
    },
  )
  await unused.session.disconnect()
  assert.equal(unusedLeaves, 0, '仅打开准备页面不产生入离课记录')
  const dropped = setup(
    fakeEngine(),
    async () => credentials,
    async () => attendance,
  )
  await dropped.session.connect(42, '老师')
  dropped.engine.emit('roomStateChanged', credentials.roomId, 'RECONNECT_FAILED', 1)
  await flush()
  assert.equal(dropped.state().phase, 'error')
  assert.deepEqual(dropped.state().attendance, attendance, '连接异常也尽力闭合教师会话')

  const lateLeave = deferred()
  const changedAccount = setup(
    fakeEngine(),
    async () => credentials,
    () => lateLeave.promise,
  )
  await changedAccount.session.connect(42, '老师')
  const oldExit = changedAccount.session.disconnect()
  await flush()
  setSessionToken('new-attendance-session')
  const authCleanup = changedAccount.session.disconnect()
  lateLeave.resolve(attendance)
  await Promise.all([oldExit, authCleanup])
  assert.equal(changedAccount.state().attendance, undefined, '旧教师离课结果不能显示在新会话')

  // RTC 与课程 mock 隔离：请求真实后端并携带登录 Token、教师角色。
  let requests = []
  setSessionToken('test-session')
  http.defaults.adapter = () => {
    throw new Error('RTC 不应走教学 mock 客户端')
  }
  backendHttp.defaults.adapter = async (config) => {
    requests.push(config)
    return {
      data: { code: 200, data: config.url.endsWith('/leave') ? attendance : credentials },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  assert.deepEqual(await api.joinVideoClassroom(42), credentials)
  await api.closeVideoClassroom(42)
  assert.deepEqual(await api.leaveVideoClassroom(42), attendance)
  assert.deepEqual(
    requests.map((request) => request.url),
    ['/zego/bookings/42/join', '/zego/bookings/42/close', '/zego/bookings/42/leave'],
  )
  assert.equal(requests[0].headers.get('satoken'), 'test-session')
  assert.equal(requests[0].headers.get('X-Active-Role'), 'teacher')
  assert.equal(requests[2].method, 'post')
  assert.equal(requests[2].data, undefined, '离课不上传客户端时间或自行计算的授课时长')
  assert.equal(requests[2].headers.get('satoken'), 'test-session')
  assert.equal(requests[2].headers.get('X-Active-Role'), 'teacher')
  await assert.rejects(api.joinVideoClassroom(-1), /排课/)
  assert.equal(requests.length, 3)
  const pinnedExit = api.leaveVideoClassroom(42)
  setSessionToken('replacement-session')
  await pinnedExit
  assert.equal(
    requests.at(-1).headers.get('satoken'),
    'test-session',
    'HTTP 拦截器不能把旧课堂离课请求换成新教师 Token',
  )
  await assert.rejects(api.leaveVideoClassroom(42, 'test-session'), /会话已变更/)
  backendHttp.defaults.adapter = async (config) => ({
    data: {
      code: 200,
      data: {
        ...attendance,
        attendanceFlag: 0,
        attendanceSeconds: 0,
        firstInTime: undefined,
        lastOutTime: undefined,
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  assert.deepEqual(await api.leaveVideoClassroom(42), {
    ...attendance,
    attendanceFlag: 0,
    attendanceSeconds: 0,
    firstInTime: null,
    lastOutTime: null,
  })
  backendHttp.defaults.adapter = async (config) => ({
    data: { code: 200, data: { ...attendance, bookingId: '43' } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  await assert.rejects(api.leaveVideoClassroom(42), /记录无效/)
  backendHttp.defaults.adapter = async (config) => ({
    data: { code: 403, msg: '不是该排课的授课教师' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  await assert.rejects(api.joinVideoClassroom(42), /授课教师/)
  await assert.rejects(api.leaveVideoClassroom(42), /授课教师/)
  assert.throws(() => api.validateCredentials({ ...credentials, token: '' }), /凭证/)
  assert.throws(() => api.validateCredentials({ ...credentials, roomId: 42 }), /凭证/)
  // 屏幕共享必须使用后端允许的第二路流，不影响老师摄像头与麦克风。
  const shareEngine = fakeEngine()
  let ended
  const screenTrack = {
    stops: 0,
    stop() {
      this.stops++
    },
    addEventListener(_, callback) {
      ended = callback
    },
  }
  const screen = {
    getTracks: () => [screenTrack],
    getVideoTracks: () => [screenTrack],
    playVideo() {},
    stopVideo() {},
  }
  shareEngine.createZegoStream = async (options) => (options?.screen ? screen : shareEngine.local)
  const shared = setup(shareEngine, async () => ({
    ...credentials,
    screenStreamId: credentials.streamId + '_screen',
  }))
  await shared.session.connect(42, '老师')
  publish(shareEngine)
  await shared.session.startSharing()
  assert.equal(shared.state().sharing, false, '开始请求不能假报共享成功')
  assert.equal(shared.state().shareBusy, true)
  assert.deepEqual(shareEngine.published, [credentials.streamId, credentials.streamId + '_screen'])
  shareEngine.emit('publisherStateUpdate', {
    streamID: credentials.streamId + '_screen',
    state: 'PUBLISHING',
    errorCode: 0,
  })
  assert.equal(shared.state().sharing, true)
  ended()
  assert.equal(shared.state().sharing, false)
  assert.equal(shared.state().phase, 'connected')
  assert.equal(screenTrack.stops, 1)
  assert.deepEqual(shareEngine.stopped, [credentials.streamId + '_screen'])
  const capture = deferred()
  shareEngine.createZegoStream = () => capture.promise
  const picking = shared.session.startSharing()
  shared.session.stopSharing()
  capture.resolve(screen)
  await picking
  assert.equal(shared.state().shareBusy, false)
  assert.equal(shareEngine.published.length, 2, '取消后迟到的采集结果不能重新推流')
  shareEngine.createZegoStream = async () => {
    throw new Error('cancelled')
  }
  await shared.session.startSharing()
  assert.equal(shared.state().phase, 'connected', '取消共享不能断开音视频')
  assert.equal(shared.state().shareBusy, false)
  assert.ok(shared.state().message.includes('未开始'))
  await shared.session.disconnect()
  const oldBackend = setup()
  await oldBackend.session.connect(42, '老师')
  publish(oldBackend.engine)
  await oldBackend.session.startSharing()
  assert.ok(oldBackend.state().message.includes('授权'))
  assert.equal(oldBackend.engine.published.length, 1)
  // 文档服务未开通：不能创建空课件或影响音视频；开通后同一入口可重试。
  let uploadState,
    fileViews = 0
  const uploadBoard = new SuperBoardController((value) => {
    uploadState = value
  }, 'upload-test')
  uploadBoard.initialized = true
  uploadBoard.state = { ...uploadBoard.state, ready: true }
  const loadedView = {
    getModel: () => ({ uniqueID: 'file-board', name: '测试课件' }),
    getCurrentPage: () => 1,
    getPageCount: () => 2,
    getThumbnailUrlList: () => ['page-1', 'page-2'],
  }
  uploadBoard.manager = {
    uploadFile: async () => {
      throw { code: 3130025, message: 'this app does not exist or its status is disabled' }
    },
    createFileView: async ({ fileID }) => {
      assert.equal(fileID, 'converted-file')
      fileViews++
    },
    getSuperBoardView: () => ({ getCurrentSuperBoardSubView: () => loadedView }),
    querySuperBoardSubViewList: async () => [loadedView.getModel()],
    unInit: async () => {},
  }
  const testFile = { name: 'lesson.pdf', size: 1024 }
  await uploadBoard.upload(testFile)
  assert.equal(fileViews, 0, '上传失败不得创建课件')
  assert.equal(uploadState.busy, false, '失败后必须允许重新操作')
  assert.equal(uploadState.ready, true, '文档未启用不能断开已连接的白板')
  assert.ok(uploadState.message.includes('未开通'))
  uploadBoard.manager.uploadFile = async () => 'converted-file'
  await uploadBoard.upload(testFile)
  assert.equal(fileViews, 1)
  assert.equal(uploadState.currentId, 'file-board')
  assert.equal(uploadState.pageCount, 2)
  assert.equal(uploadState.message, '')
  uploadBoard.manager.uploadFile = async () => ''
  await uploadBoard.upload(testFile)
  assert.equal(fileViews, 1, '没有转码 ID 不能创建空课件')
  assert.equal(uploadState.busy, false)
  await uploadBoard.dispose()

  // 白板命名不能重复或超过 SDK 字节上限。
  let namedState
  const namedBoard = new SuperBoardController((value) => {
    namedState = value
  }, 'named-board')
  const namedModels = [{ uniqueID: 'one', name: '课堂白板 1' }]
  namedBoard.initialized = true
  namedBoard.state = { ...namedBoard.state, ready: true, models: namedModels }
  const namedView = {
    ...loadedView,
    getModel: () => namedModels.at(-1),
  }
  namedBoard.manager = {
    createWhiteboardView: async ({ name }) => {
      namedModels.push({ uniqueID: String(namedModels.length), name })
    },
    querySuperBoardSubViewList: async () => [...namedModels],
    getSuperBoardView: () => ({ getCurrentSuperBoardSubView: () => namedView }),
    unInit: async () => {},
  }
  assert.equal(namedBoard.nextBoardName(), '课堂白板 2')
  await namedBoard.createBoard('  分数练习  ')
  assert.equal(namedModels.at(-1).name, '分数练习')
  const modelCount = namedModels.length
  await namedBoard.createBoard('分数练习')
  assert.equal(namedModels.length, modelCount)
  assert.ok(namedState.message.includes('同名'))
  await namedBoard.createBoard('中'.repeat(43))
  assert.equal(namedModels.length, modelCount)
  assert.equal(namedState.busy, false)
  await namedBoard.dispose()

  // 白板必须先初始化后登录房间；退出等待白板解绑，再销毁 Express。
  const sdkInitialization = deferred()
  let uninitialized = 0
  const sdkBoard = new SuperBoardController(() => {}, 'board-test')
  sdkBoard.manager = {
    unInit: async () => {
      uninitialized++
    },
  }
  sdkBoard.initialization = sdkInitialization.promise
  const sdkDispose = sdkBoard.dispose()
  await flush()
  assert.equal(uninitialized, 0, '不能在 SDK 初始化尚未返回时调用 unInit')
  const nextBoard = new SuperBoardController(() => {}, 'board-test-next')
  const nextInitialization = nextBoard.initialize({}, credentials)
  const nextDispose = nextBoard.dispose()
  sdkInitialization.resolve()
  await Promise.all([sdkDispose, nextInitialization, nextDispose])
  assert.equal(uninitialized, 1)
  assert.equal(nextBoard.manager, undefined, '排队时退出不能导入并恢复新的 SDK 实例')

  const boardOrder = []
  const boardInitializing = deferred()
  const boardDisposing = deferred()
  const boardEngine = fakeEngine()
  boardEngine.loginRoom = async () => {
    boardOrder.push('login')
    return true
  }
  const boardSession = setup(boardEngine, async () => credentials, undefined, {
    initialize: async () => {
      boardOrder.push('init')
      await boardInitializing.promise
    },
    entered: async () => {
      boardOrder.push('entered')
    },
    renew() {},
    dispose: () => boardDisposing.promise,
  })
  const boardConnecting = boardSession.session.connect(42, '老师')
  await flush()
  assert.deepEqual(boardOrder, ['init'])
  boardInitializing.resolve()
  await boardConnecting
  assert.deepEqual(boardOrder, ['init', 'login', 'entered'])
  await boardSession.session.disconnect()
  assert.equal(boardEngine.destroyed, 0, '白板未释放前不能销毁 Express')
  boardDisposing.resolve()
  await flush()
  assert.equal(boardEngine.destroyed, 1)

  // 官方白板快照的自定义流走原 screen 授权，退出立即释放源轨道。
  const mirrorEngine = fakeEngine()
  let customCapture
  mirrorEngine.createZegoStream = async (options) => {
    if (!options?.custom) return mirrorEngine.local
    customCapture = options
    return screen
  }
  const mirrored = setup(mirrorEngine, async () => ({
    ...credentials,
    screenStreamId: credentials.streamId + '_screen',
  }))
  await mirrored.session.connect(42, '老师')
  publish(mirrorEngine)
  const mirrorSource = { ...media(), getVideoTracks: () => [] }
  await mirrored.session.startSharing(mirrorSource)
  assert.equal(customCapture.custom.video.source, mirrorSource)
  assert.equal(mirrored.state().sharing, false, '自定义源也必须等待真实发布成功')
  await mirrored.session.disconnect()
  assert.equal(mirrorSource.track.stops, 1)
  const refusedSource = { ...media(), getVideoTracks: () => [] }
  await mirrored.session.startSharing(refusedSource)
  assert.equal(refusedSource.track.stops, 1, '未入课不得遗留快照轨道')
  console.log(
    'RTC 验证通过：join/leave/close 契约、发布状态、远端流竞态、续期去重、离课记录去重与失败重试、重入等待、会话隔离及设备释放。',
  )
} finally {
  await Promise.allSettled(sessions.map((session) => session.disconnect()))
  await server.close()
}
