import type { ZegoExpressEngine } from 'zego-express-engine-webrtc'
import type {
  ZegoEvent,
  ZegoStreamList,
} from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web'
import {
  joinVideoClassroom,
  leaveVideoClassroom,
  requireBookingId,
  validateCredentials,
} from '@/api/rtc'
import { sessionToken } from '@/services/session'
import type {
  ClassroomAttendance,
  ClassroomCredentials,
  ClassroomSnapshot,
  RemoteParticipant,
} from '@/types/rtc'

type Engine = Pick<
  ZegoExpressEngine,
  | 'checkSystemRequirements'
  | 'createZegoStream'
  | 'destroyStream'
  | 'startPublishingStream'
  | 'stopPublishingStream'
  | 'startPlayingStream'
  | 'stopPlayingStream'
  | 'createRemoteStreamView'
  | 'mutePublishStreamVideo'
  | 'mutePublishStreamAudio'
  | 'loginRoom'
  | 'logoutRoom'
  | 'renewToken'
  | 'on'
  | 'off'
  | 'destroyEngine'
>
type LocalStream = Awaited<ReturnType<Engine['createZegoStream']>>
type RemoteView = ReturnType<Engine['createRemoteStreamView']>
interface RemoteEntry {
  participant: RemoteParticipant
  desired: boolean
  stream?: MediaStream
  view?: RemoteView
  element?: HTMLElement
}
interface Connection {
  active: boolean
  bookingId: number | string
  credentials: ClassroomCredentials
  engine: Engine
  local?: LocalStream
  localElement?: HTMLElement
  screen?: LocalStream
  teachingSource?: MediaStream
  screenElement?: HTMLElement
  screenTimer?: ReturnType<typeof setTimeout>
  shareGeneration: number
  remotes: Map<string, RemoteEntry>
  unsubscribe: (() => void)[]
  renewTimer?: ReturnType<typeof setTimeout>
  publishTimer?: ReturnType<typeof setTimeout>
  joinTimer?: ReturnType<typeof setTimeout>
  renewal?: Promise<void>
  publishing: boolean
  roomConnected: boolean
  token: string
}

interface ClassroomDependencies {
  credentials: (bookingId: number | string) => Promise<ClassroomCredentials>
  engine: (appId: number) => Promise<Engine>
  leave?: (bookingId: number | string, token: string) => Promise<ClassroomAttendance>
}
export interface ClassroomBoardLifecycle {
  initialize(engine: Engine, credentials: ClassroomCredentials): Promise<void>
  entered(): Promise<void>
  renew(token: string): void
  dispose(): Promise<void>
}

const defaults: ClassroomDependencies = {
  credentials: joinVideoClassroom,
  leave: leaveVideoClassroom,
  engine: async (appId) => {
    const { ZegoExpressEngine } = await import('zego-express-engine-webrtc')
    // SDK >= 3.7 自动获取接入地址；实例保持在普通变量中，不进入 Vue 深层响应式。
    return new ZegoExpressEngine(appId, '')
  },
}

export function initialClassroomSnapshot(): ClassroomSnapshot {
  return {
    phase: 'idle',
    message: '',
    roomId: '',
    videoEnabled: true,
    audioEnabled: true,
    speakerEnabled: true,
    sharing: false,
    shareBusy: false,
    participants: [],
    leaving: false,
    leaveError: '',
  }
}

function safely(action: () => unknown): void {
  try {
    action()
  } catch {
    /* 清理失败不能阻止其他设备和房间的释放。 */
  }
}

function explainError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return '摄像头或麦克风权限被拒绝，请在浏览器地址栏允许访问后重试。'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return '未找到摄像头或麦克风，请连接设备后重试。'
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return '设备无法使用，请关闭占用摄像头或麦克风的其他应用后重试。'
  return error instanceof Error ? error.message : '音视频连接失败，请检查设备和网络后重试。'
}

/** 一个组件对应一个会话。通过会话标记隔离退出、重试与在途 SDK 请求。 */
export class ClassroomSession {
  private snapshot = initialClassroomSnapshot()
  private connection?: Connection
  private generation = 0
  private localElement?: HTMLElement
  private screenElement?: HTMLElement
  private remoteElements = new Map<string, HTMLElement>()
  private pendingLeave?: Connection
  private leaveRequest?: Promise<ClassroomAttendance | undefined>
  private attendanceToken?: string
  private boardCleanup?: Promise<void>

  constructor(
    private readonly changed: (snapshot: ClassroomSnapshot) => void,
    private readonly dependencies: ClassroomDependencies = defaults,
    private readonly board?: ClassroomBoardLifecycle,
  ) {}

  private update(patch: Partial<ClassroomSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.changed({ ...this.snapshot, participants: [...this.snapshot.participants] })
  }

  private current(connection: Connection): boolean {
    return connection.active && this.connection === connection
  }

  private listen<K extends keyof ZegoEvent>(
    connection: Connection,
    event: K,
    callback: ZegoEvent[K],
  ): void {
    connection.engine.on(event, callback)
    connection.unsubscribe.push(() => connection.engine.off(event, callback))
  }

  async connect(bookingId: number | string, userName: string): Promise<void> {
    const leaving = this.disconnect()
    const generation = this.generation
    const token = sessionToken.value
    let engine: Engine | undefined
    let connection: Connection | undefined
    try {
      // 旧离课请求完成前不能重新入房，避免迟到 leave 闭合新会话。
      await leaving
      await this.boardCleanup
      if (generation !== this.generation || token !== sessionToken.value) return
      this.update({ ...initialClassroomSnapshot(), phase: 'joining' })
      requireBookingId(bookingId)
      const credentials = validateCredentials(await this.dependencies.credentials(bookingId))
      const receivedAt = Date.now()
      if (generation !== this.generation) return
      engine = await this.dependencies.engine(credentials.appId)
      if (generation !== this.generation) {
        safely(() => engine!.destroyEngine())
        return
      }
      connection = {
        active: true,
        bookingId,
        credentials,
        engine,
        remotes: new Map(),
        unsubscribe: [],
        publishing: false,
        roomConnected: false,
        shareGeneration: 0,
        token,
      }
      this.connection = connection
      const joiningConnection = connection
      connection.joinTimer = setTimeout(() => {
        if (this.current(joiningConnection))
          this.fail(joiningConnection, new Error('课堂连接超时，请检查设备授权和网络后重试。'))
      }, 30000)
      this.update({ roomId: credentials.roomId, message: '正在检查浏览器音视频能力…' })
      this.registerEvents(connection)
      const capability = await engine.checkSystemRequirements('webRTC')
      if (!this.current(connection)) return
      if (capability.webRTC === false || capability.result === false)
        throw new Error('当前浏览器不支持实时音视频，请使用最新版 Chrome 或 Edge。')
      await this.board?.initialize(engine, credentials)
      if (!this.current(connection)) return
      this.update({ message: '正在等待摄像头与麦克风授权…' })
      const local = await engine.createZegoStream()
      if (!this.current(connection)) {
        this.destroyLocal(connection, local)
        return
      }
      connection.local = local
      this.attachLocal(this.localElement)
      this.update({ message: '正在登录课堂房间…' })
      const loggedIn = await engine.loginRoom(
        credentials.roomId,
        credentials.token,
        { userID: credentials.userId, userName },
        { userUpdate: true },
      )
      if (!this.current(connection)) {
        safely(() => engine!.logoutRoom(credentials.roomId))
        return
      }
      if (!loggedIn) throw new Error('加入课堂失败，请检查排课时间及教师权限。')
      connection.roomConnected = true
      clearTimeout(connection.joinTimer)
      void this.board?.entered()
      this.update({ phase: 'publishing', message: '' })
      this.scheduleRenewal(connection, credentials.expiresIn - (Date.now() - receivedAt) / 1000)
      const publishingConnection = connection
      connection.publishTimer = setTimeout(() => {
        if (this.current(publishingConnection) && !publishingConnection.publishing)
          this.fail(publishingConnection, new Error('音视频发布超时，请检查网络后重新连接。'))
      }, 20000)
      if (!engine.startPublishingStream(credentials.streamId, local))
        throw new Error('无法发布课堂音视频，请重试。')
    } catch (error) {
      if (generation !== this.generation) return
      if (connection) this.fail(connection, error)
      else {
        if (engine) safely(() => engine!.destroyEngine())
        this.update({ phase: 'error', message: explainError(error) })
      }
    }
  }

  private registerEvents(connection: Connection): void {
    this.listen(connection, 'roomStreamUpdate', (roomId, type, streams) => {
      if (!this.current(connection) || roomId !== connection.credentials.roomId) return
      for (const stream of streams) {
        if (stream.user.userID === connection.credentials.userId) continue
        if (type === 'ADD') void this.addRemote(connection, stream)
        else this.removeRemote(connection, stream.streamID)
      }
    })
    this.listen(connection, 'publisherStateUpdate', (result) => {
      if (this.current(connection) && result.streamID === connection.credentials.screenStreamId) {
        if (!connection.screen) return
        if (result.errorCode || result.state === 'NO_PUBLISH') {
          this.stopScreen(connection)
          this.update({ message: '共享发布失败，请检查网络并重新共享。' })
        } else if (result.state === 'PUBLISHING') {
          clearTimeout(connection.screenTimer)
          this.update({ sharing: true, shareBusy: false, message: '' })
        }
        return
      }
      if (!this.current(connection) || result.streamID !== connection.credentials.streamId) return
      if (result.errorCode || result.state === 'NO_PUBLISH') {
        this.fail(connection, new Error(`课堂音视频发布中断（${result.errorCode}），请重新连接。`))
      } else if (result.state === 'PUBLISHING') {
        connection.publishing = true
        clearTimeout(connection.publishTimer)
        if (connection.roomConnected) this.update({ phase: 'connected', message: '' })
      }
    })
    this.listen(connection, 'screenSharingEnded', (stream) => {
      if (this.current(connection) && connection.screen?.stream === stream)
        this.stopScreen(connection)
    })
    this.listen(connection, 'roomStateChanged', (roomId, reason, errorCode) => {
      if (!this.current(connection) || roomId !== connection.credentials.roomId) return
      if (reason === 'RECONNECTING') {
        connection.roomConnected = false
        this.update({ phase: 'reconnecting', message: '网络中断，正在尝试恢复连接…' })
      } else if (reason === 'RECONNECTED' || reason === 'LOGINED') {
        connection.roomConnected = true
        if (connection.publishing) this.update({ phase: 'connected', message: '' })
      } else if (['LOGIN_FAILED', 'RECONNECT_FAILED', 'KICKOUT', 'LOGOUT'].includes(reason)) {
        this.fail(connection, new Error(`课堂连接已断开（${errorCode}），请重新进入。`))
      }
    })
    this.listen(connection, 'tokenWillExpire', (roomId) => {
      if (this.current(connection) && roomId === connection.credentials.roomId)
        void this.renew(connection)
    })
    this.listen(connection, 'playerStateUpdate', (result) => {
      if (!this.current(connection)) return
      const entry = connection.remotes.get(result.streamID)
      if (!entry?.desired) return
      entry.participant.playing = result.state === 'PLAYING' && !result.errorCode
      this.syncParticipants(connection)
      if (result.errorCode)
        this.update({ message: `学生音视频连接异常（${result.errorCode}），可重新连接课堂。` })
    })
  }

  private scheduleRenewal(connection: Connection, expiresIn: number): void {
    clearTimeout(connection.renewTimer)
    connection.renewTimer = setTimeout(
      () => void this.renew(connection),
      Math.max(1000, (expiresIn - Math.min(60, expiresIn / 2)) * 1000),
    )
  }

  private renew(connection: Connection): Promise<void> {
    if (!this.current(connection)) return Promise.resolve()
    if (connection.renewal) return connection.renewal
    connection.renewal = this.dependencies
      .credentials(connection.bookingId)
      .then((credentials) => {
        if (!this.current(connection)) return
        validateCredentials(credentials)
        for (const key of ['appId', 'roomId', 'userId', 'streamId', 'screenStreamId'] as const) {
          if (credentials[key] !== connection.credentials[key])
            throw new Error('课堂身份发生变化，请重新进入课堂。')
        }
        if (!connection.engine.renewToken(credentials.token, credentials.roomId))
          throw new Error('课堂授权续期失败，请重新进入。')
        connection.credentials = credentials
        this.board?.renew(credentials.token)
        this.scheduleRenewal(connection, credentials.expiresIn)
      })
      .catch((error: unknown) => {
        if (this.current(connection)) this.fail(connection, error)
      })
      .finally(() => {
        connection.renewal = undefined
      })
    return connection.renewal
  }

  private syncParticipants(connection: Connection): void {
    this.update({
      participants: [...connection.remotes.values()]
        .filter((entry) => entry.desired)
        .map((entry) => ({ ...entry.participant })),
    })
  }

  private async addRemote(connection: Connection, stream: ZegoStreamList): Promise<void> {
    const existing = connection.remotes.get(stream.streamID)
    if (existing) {
      existing.desired = true
      this.syncParticipants(connection)
      return
    }
    const entry: RemoteEntry = {
      desired: true,
      participant: {
        streamId: stream.streamID,
        userId: stream.user.userID,
        userName: stream.user.userName || '学生',
        playing: false,
      },
    }
    connection.remotes.set(stream.streamID, entry)
    this.syncParticipants(connection)
    try {
      const media = await connection.engine.startPlayingStream(stream.streamID)
      entry.stream = media
      if (!this.current(connection) || !entry.desired) {
        this.disposeRemote(connection, stream.streamID, entry)
        return
      }
      entry.view = connection.engine.createRemoteStreamView(media)
      this.attachRemote(stream.streamID, this.remoteElements.get(stream.streamID))
    } catch (error) {
      this.disposeRemote(connection, stream.streamID, entry)
      if (this.current(connection) && entry.desired)
        this.update({ message: `学生画面加载失败：${explainError(error)}` })
    }
  }

  private removeRemote(connection: Connection, streamId: string): void {
    const entry = connection.remotes.get(streamId)
    if (!entry) return
    entry.desired = false
    // 尚在拉流的请求保留标记，避免 DELETE/ADD 导致旧请求停止新流。
    if (entry.stream) this.disposeRemote(connection, streamId, entry)
    else this.syncParticipants(connection)
  }

  private disposeRemote(connection: Connection, streamId: string, entry: RemoteEntry): void {
    safely(() => entry.view?.stop())
    safely(() => connection.engine.stopPlayingStream(streamId))
    entry.stream?.getTracks().forEach((track) => safely(() => track.stop()))
    if (connection.remotes.get(streamId) === entry) connection.remotes.delete(streamId)
    if (this.current(connection)) this.syncParticipants(connection)
  }

  attachLocal(element?: HTMLElement): void {
    this.localElement = element
    const connection = this.connection
    if (!connection?.local || connection.localElement === element) return
    connection.localElement = element
    if (element)
      connection.local.playVideo(element, {
        mirror: true,
        objectFit: 'cover',
        enableAutoplayDialog: true,
      })
  }

  attachRemote(streamId: string, element?: HTMLElement): void {
    if (element) this.remoteElements.set(streamId, element)
    else this.remoteElements.delete(streamId)
    const entry = this.connection?.remotes.get(streamId)
    if (!entry?.view || entry.element === element) return
    entry.element = element
    if (element)
      entry.view.play(element, {
        objectFit: 'cover',
        muted: !this.snapshot.speakerEnabled,
        enableAutoplayDialog: true,
      })
  }

  attachScreen(element?: HTMLElement): void {
    this.screenElement = element
    const connection = this.connection
    if (!connection?.screen || connection.screenElement === element) return
    connection.screenElement = element
    if (element) connection.screen.playVideo(element, { mirror: false, objectFit: 'contain' })
  }

  async startSharing(source?: MediaStream): Promise<void> {
    const connection = this.connection
    if (
      !connection?.local ||
      !connection.publishing ||
      !connection.roomConnected ||
      this.snapshot.shareBusy ||
      connection.screen
    ) {
      source?.getTracks().forEach((track) => track.stop())
      return
    }
    if (!connection.credentials.screenStreamId) {
      source?.getTracks().forEach((track) => track.stop())
      this.update({ message: '当前后端尚未提供屏幕共享授权，请更新后端并重新进入课堂。' })
      return
    }
    const generation = ++connection.shareGeneration
    connection.teachingSource = source
    source?.getVideoTracks()[0]?.addEventListener(
      'ended',
      () => {
        if (this.current(connection) && generation === connection.shareGeneration)
          this.stopScreen(connection)
      },
      { once: true },
    )
    this.update({ shareBusy: true, message: '' })
    try {
      // 仅共享视频；老师的声音继续由摄像头流中的麦克风发送，避免双重回声。
      const screen = await connection.engine.createZegoStream(
        source
          ? {
              custom: { video: { source, optimizationMode: 'detail' } },
              videoBitrate: 1800,
            }
          : {
              screen: {
                video: { quality: 3, frameRate: 15, optimizationMode: 'detail' },
                audio: false,
              },
            },
      )
      if (!this.current(connection) || generation !== connection.shareGeneration) {
        this.destroyLocal(connection, screen)
        return
      }
      connection.screen = screen
      this.attachScreen(this.screenElement)
      screen.getVideoTracks()[0]?.addEventListener(
        'ended',
        () => {
          if (this.current(connection) && connection.screen === screen) this.stopScreen(connection)
        },
        { once: true },
      )
      connection.screenTimer = setTimeout(() => {
        if (this.current(connection) && connection.screen === screen && !this.snapshot.sharing) {
          this.stopScreen(connection)
          this.update({ message: '共享发布超时，请检查网络后重试。' })
        }
      }, 20000)
      if (!connection.engine.startPublishingStream(connection.credentials.screenStreamId, screen))
        throw new Error('无法发布共享内容，请重试。')
    } catch (error) {
      if (!this.current(connection) || generation !== connection.shareGeneration) return
      this.stopScreen(connection)
      this.update({
        message: source
          ? `白板授课同步未开始：${explainError(error)}`
          : '屏幕共享未开始。请重新选择需要共享的窗口，并允许浏览器共享。',
      })
    }
  }

  stopSharing(): void {
    if (this.connection) this.stopScreen(this.connection)
  }

  private stopScreen(connection: Connection): void {
    connection.shareGeneration++
    clearTimeout(connection.screenTimer)
    const screen = connection.screen
    connection.screen = undefined
    connection.screenElement = undefined
    connection.teachingSource?.getTracks().forEach((track) => safely(() => track.stop()))
    connection.teachingSource = undefined
    if (screen) {
      safely(() => connection.engine.stopPublishingStream(connection.credentials.screenStreamId!))
      this.destroyLocal(connection, screen)
    }
    if (this.current(connection)) this.update({ sharing: false, shareBusy: false })
  }

  toggleVideo(): void {
    const connection = this.connection
    if (!connection?.local) return
    const enabled = !this.snapshot.videoEnabled
    if (connection.engine.mutePublishStreamVideo(connection.local, !enabled, false))
      this.update({ videoEnabled: enabled })
    else this.update({ message: '视频发送切换失败，请重试。' })
  }

  toggleAudio(): void {
    const connection = this.connection
    if (!connection?.local) return
    const enabled = !this.snapshot.audioEnabled
    if (connection.engine.mutePublishStreamAudio(connection.local, !enabled))
      this.update({ audioEnabled: enabled })
    else this.update({ message: '麦克风静音切换失败，请重试。' })
  }

  toggleSpeaker(): void {
    const enabled = !this.snapshot.speakerEnabled
    let succeeded = true
    for (const entry of this.connection?.remotes.values() ?? []) {
      if (entry.view && !entry.view.setAudioMuted(!enabled)) succeeded = false
    }
    if (!succeeded) {
      for (const entry of this.connection?.remotes.values() ?? [])
        entry.view?.setAudioMuted(!this.snapshot.speakerEnabled)
      this.update({ message: '扬声器切换失败，请重试。' })
      return
    }
    this.update({ speakerEnabled: enabled })
  }

  private destroyLocal(connection: Connection, local: LocalStream): void {
    const tracks = local.getTracks()
    safely(() => local.stopVideo())
    safely(() => connection.engine.destroyStream(local))
    tracks.forEach((track) => safely(() => track.stop()))
  }

  private cleanup(connection: Connection): void {
    connection.active = false
    const boardDisposal = this.board?.dispose().catch(() => {})
    this.stopScreen(connection)
    clearTimeout(connection.renewTimer)
    clearTimeout(connection.publishTimer)
    clearTimeout(connection.joinTimer)
    connection.unsubscribe.forEach((unsubscribe) => safely(unsubscribe))
    safely(() => connection.engine.stopPublishingStream(connection.credentials.streamId))
    if (connection.local) this.destroyLocal(connection, connection.local)
    for (const [streamId, entry] of connection.remotes)
      this.disposeRemote(connection, streamId, entry)
    const releaseEngine = () => {
      safely(() => connection.engine.logoutRoom(connection.credentials.roomId))
      safely(() => connection.engine.destroyEngine())
    }
    // SuperBoard 先释放它对 Express 的监听，再销毁音视频实例。
    if (boardDisposal) this.boardCleanup = boardDisposal.then(releaseEngine)
    else releaseEngine()
    this.remoteElements.clear()
  }

  private fail(connection: Connection, error: unknown): void {
    if (!this.current(connection)) return
    this.connection = undefined
    this.cleanup(connection)
    this.update({
      phase: 'error',
      message: explainError(error),
      participants: [],
      sharing: false,
      shareBusy: false,
    })
    this.pendingLeave = connection
    void this.reportLeave().catch(() => {
      /* leaveError 单独显示，不覆盖连接错误。 */
    })
  }

  disconnect(): Promise<ClassroomAttendance | undefined> {
    this.generation++
    const connection = this.connection
    this.connection = undefined
    if (connection) {
      this.cleanup(connection)
      this.pendingLeave = connection
    }
    this.update({
      ...initialClassroomSnapshot(),
      attendance:
        this.attendanceToken === sessionToken.value ? this.snapshot.attendance : undefined,
    })
    return this.reportLeave()
  }

  private reportLeave(): Promise<ClassroomAttendance | undefined> {
    if (this.leaveRequest) {
      this.update({ leaving: true })
      return this.leaveRequest
    }
    const connection = this.pendingLeave
    if (!connection) return Promise.resolve(this.snapshot.attendance)
    if (!this.dependencies.leave || connection.token !== sessionToken.value) {
      this.pendingLeave = undefined
      return Promise.resolve(undefined)
    }
    this.update({ leaving: true, leaveError: '' })
    const request = Promise.resolve()
      .then(() => this.dependencies.leave!(connection.bookingId, connection.token))
      .then((attendance) => {
        if (attendance.userId !== connection.credentials.userId)
          throw new Error('离课响应的教师身份不一致。')
        if (connection.token === sessionToken.value) {
          this.attendanceToken = connection.token
          this.update({ attendance })
        }
        if (this.pendingLeave === connection) this.pendingLeave = undefined
        return attendance
      })
      .catch((error: unknown) => {
        if (connection.token !== sessionToken.value) {
          if (this.pendingLeave === connection) this.pendingLeave = undefined
          return undefined
        }
        this.update({ leaveError: `离课记录提交失败：${explainError(error)}` })
        throw error
      })
      .finally(() => {
        if (this.leaveRequest === request) {
          this.leaveRequest = undefined
          this.update({ leaving: false })
        }
      })
    this.leaveRequest = request
    return request
  }
}
