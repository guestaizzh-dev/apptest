import type { ZegoSuperBoardManager, ZegoSuperBoardSubViewModel } from 'zego-superboard-web'
import type { ClassroomBoardLifecycle } from '@/services/classroom'
import { captureBoard } from '@/services/board-capture'
// SDK 是单例，路由切换后的新组件同样必须等待上一实例清理。
let pendingDisposal: Promise<void> | undefined
export interface BoardState {
  ready: boolean
  busy: boolean
  message: string
  models: ZegoSuperBoardSubViewModel[]
  currentId: string
  page: number
  pageCount: number
  thumbnails: string[]
}
export const initialBoardState = (): BoardState => ({
  ready: false,
  busy: false,
  message: '',
  models: [],
  currentId: '',
  page: 1,
  pageCount: 0,
  thumbnails: [],
})
/** 只管理官方 SuperBoard 生命周期；绘制、文档与同步交给 SDK。 */
export class SuperBoardController implements ClassroomBoardLifecycle {
  manager?: ZegoSuperBoardManager
  private generation = 0
  private initialized = false
  private disposal?: Promise<void>
  private initialization?: Promise<void>
  private mirrorGeneration = 0
  private mirror?: MediaStream
  private state = initialBoardState()
  constructor(
    private readonly changed: (state: BoardState) => void,
    private readonly parentId: string,
  ) {}
  private update(patch: Partial<BoardState>) {
    this.state = { ...this.state, ...patch }
    this.changed({ ...this.state })
  }
  private error(error: unknown) {
    const detail =
      error && typeof error === 'object'
        ? 'message' in error
          ? String(error.message)
          : 'msg' in error
            ? String(error.msg)
            : ''
        : ''
    const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0
    const docsDisabled =
      code === 3130025 || /this app does not exist or its status is disabled/i.test(detail)
    this.update({
      message: docsDisabled
        ? '课件上传服务未开通或已停用，请联系管理员。可先使用“共享教学窗口”授课。'
        : detail || 'ZEGO 白板操作失败，请检查服务开通及网络。',
    })
  }
  async initialize(...[engine, credentials]: Parameters<ClassroomBoardLifecycle['initialize']>) {
    const generation = ++this.generation
    await pendingDisposal
    if (generation !== this.generation) return
    this.initialization = this.initializeManager(engine, credentials, generation)
    await this.initialization
  }
  private async initializeManager(
    engine: Parameters<ClassroomBoardLifecycle['initialize']>[0],
    credentials: Parameters<ClassroomBoardLifecycle['initialize']>[1],
    generation: number,
  ) {
    this.update({ ...initialBoardState(), busy: true, message: '正在连接 ZEGO 白板…' })
    try {
      const { ZegoSuperBoardManager } = await import('zego-superboard-web')
      if (generation !== this.generation) return
      const manager = ZegoSuperBoardManager.getInstance()
      this.manager = manager
      const result = await manager.init(engine, {
        parentDomID: this.parentId,
        appID: credentials.appId,
        userID: credentials.userId,
        token: credentials.token,
        isTestEnv: false,
      })
      if (generation !== this.generation) return
      if (!result) throw new Error('ZEGO 白板初始化失败，请确认文件共享服务已开通。')
      this.initialized = true
      manager.on('error', (data) => {
        if (generation === this.generation) this.error(data)
      })
      manager.on('superBoardSubViewScrollChanged', () => {
        if (generation === this.generation) this.refresh()
      })
      manager.on('remoteSuperBoardSubViewSwitched', () => {
        if (generation === this.generation) this.refresh()
      })
      manager.on('remoteSuperBoardSubViewAdded', () => {
        if (generation === this.generation)
          void this.refreshModels().catch((error) => this.error(error))
      })
      manager.on('remoteSuperBoardSubViewRemoved', () => {
        if (generation === this.generation)
          void this.refreshModels().catch((error) => this.error(error))
      })
      manager.setBrushColor('#ff4e35')
      manager.setBrushSize(6)
      manager.setToolType(32)
    } catch (error) {
      if (generation === this.generation) {
        this.error(error)
        this.update({ busy: false })
      }
    }
  }
  async entered() {
    if (!this.initialized || !this.manager) return
    const generation = this.generation
    try {
      await this.refreshModels()
      if (generation !== this.generation) return
      if (!this.state.models.length)
        await this.manager.createWhiteboardView({
          name: this.nextBoardName(),
          ...this.whiteboardSize(),
          pageCount: 6,
        })
      else {
        const switched = await this.manager
          .getSuperBoardView()
          .switchSuperBoardSubView(this.state.models[0]!.uniqueID)
        if (!switched) throw new Error('ZEGO 白板恢复失败，请重新进入课堂。')
      }
      if (generation !== this.generation) return
      await this.refreshModels()
      this.update({ ready: true, busy: false, message: '' })
      this.refresh()
    } catch (error) {
      if (generation === this.generation) {
        this.error(error)
        this.update({ ready: false, busy: false })
      }
    }
  }
  current() {
    return this.initialized
      ? this.manager?.getSuperBoardView().getCurrentSuperBoardSubView()
      : undefined
  }
  refresh() {
    const view = this.current()
    if (!view) return
    this.update({
      currentId: view.getModel().uniqueID,
      page: view.getCurrentPage(),
      pageCount: view.getPageCount(),
      thumbnails: view.getThumbnailUrlList(),
    })
  }
  private async refreshModels() {
    const generation = this.generation
    const models = await this.manager!.querySuperBoardSubViewList()
    if (generation === this.generation) {
      this.update({ models })
      this.refresh()
    }
  }
  async command(action: () => unknown | Promise<unknown>) {
    if (!this.state.ready || this.state.busy) return
    const generation = this.generation
    this.update({ busy: true, message: '' })
    try {
      const result = await action()
      if (result === false) throw new Error('ZEGO 未接受此操作，请稍后重试。')
      if (generation === this.generation) {
        await this.refreshModels()
        this.refresh()
      }
    } catch (error) {
      if (generation === this.generation) this.error(error)
    } finally {
      if (generation === this.generation) this.update({ busy: false })
    }
  }
  nextBoardName() {
    let number = 1
    const names = new Set(this.state.models.map((model) => model.name))
    while (names.has(`课堂白板 ${number}`)) number++
    return `课堂白板 ${number}`
  }
  private whiteboardSize() {
    const parent =
      typeof document === 'undefined' ? undefined : document.getElementById(this.parentId)
    // 创建时使用可见授课区比例，避免固定 16:9 在宽窗口中留下不可书写的两侧。
    const ratio =
      parent && parent.clientWidth > 0 && parent.clientHeight > 0
        ? parent.clientWidth / parent.clientHeight
        : 16 / 9
    return { perPageWidth: Math.max(1, Math.round(900 * ratio)), perPageHeight: 900 }
  }
  async createBoard(input: string) {
    const name = input.trim()
    let created = false
    await this.command(async () => {
      if (!name || new TextEncoder().encode(name).length > 128)
        throw new Error('请输入白板名称，长度不超过 128 字节（中文约 42 字）。')
      if (this.state.models.some((model) => model.name === name))
        throw new Error('已有同名白板或课件，请换一个名称。')
      await this.manager!.createWhiteboardView({
        name,
        ...this.whiteboardSize(),
        pageCount: 6,
      })
      created = true
    })
    return created
  }
  async upload(file: File) {
    if (
      !/\.(pptx?|pdf|docx?|xlsx?|png|jpe?g|bmp|txt)$/i.test(file.name) ||
      file.size === 0 ||
      file.size > 50 * 1024 * 1024
    ) {
      this.error(new Error('请选取50MB以内的 PPT/PPTX、PDF、Office文档或图片。'))
      return
    }
    await this.command(async () => {
      const generation = this.generation
      this.update({ message: '课件上传与转码中，请稍候…' })
      const fileID = await this.manager!.uploadFile(
        file,
        3,
        () => {
          if (generation === this.generation) this.update({ message: '课件上传与转码中，请稍候…' })
        },
        { renderImgType: 1 },
      )
      if (generation !== this.generation) return
      if (!fileID) throw new Error('课件转码未返回文件编号，请重新上传。')
      await this.manager!.createFileView({ fileID })
      this.update({ message: '' })
    })
  }
  renew(token: string) {
    if (this.initialized && !this.manager?.renewToken(token)) {
      this.stopMirror()
      this.update({ ready: false, busy: false })
      throw new Error('ZEGO 白板凭证续期失败，请重新进入课堂。')
    }
  }
  async dispose() {
    this.generation++
    this.stopMirror()
    this.initialized = false
    this.update(initialBoardState())
    const initialization = this.initialization
    const previousDisposal = pendingDisposal
    this.disposal = (async () => {
      await previousDisposal
      await initialization
      const manager = this.manager
      this.manager = undefined
      if (manager) await manager.unInit()
    })().catch(() => {})
    pendingDisposal = this.disposal
    await this.disposal
  }
  /** 直接采集白板元素；手机继续播放既有 ZEGO 教学流。 */
  async createMirror(): Promise<MediaStream> {
    this.stopMirror()
    const mirrorGeneration = this.mirrorGeneration
    const generation = this.generation
    const element = document.getElementById(this.parentId)
    if (!this.current() || !element) throw new Error('请先连接并打开 ZEGO 白板。')
    const stream = await captureBoard(element)
    if (generation !== this.generation || mirrorGeneration !== this.mirrorGeneration) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('白板同步已取消。')
    }
    this.mirror = stream
    return stream
  }
  stopMirror() {
    this.mirrorGeneration++
    this.mirror?.getTracks().forEach((track) => track.stop())
    this.mirror = undefined
  }
}
