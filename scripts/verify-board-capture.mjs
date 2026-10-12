import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'vite'
const { createBoardCaptureGate } = createRequire(import.meta.url)('../electron/board-capture.cjs')

let now = 0
const frame = { url: 'http://127.0.0.1:18376/classroom/42', isDestroyed: () => false }
const window = { isDestroyed: () => false, webContents: { mainFrame: frame } }
const gate = createBoardCaptureGate(
  () => window,
  (url) => new URL(url).origin === 'http://127.0.0.1:18376',
  () => now,
)
const event = { sender: window.webContents, senderFrame: frame }
const request = { frame, userGesture: true, videoRequested: true, audioRequested: false }
gate.prepare(event)
assert.equal(gate.consume(request), true)
assert.equal(gate.consume(request), false, '授权只能消费一次')
gate.prepare(event)
now = 5001
assert.equal(gate.consume(request), false, '过期授权不能采集')
gate.prepare(event)
assert.equal(gate.consume({ ...request, audioRequested: true }), false)
gate.prepare(event)
assert.equal(gate.consume({ ...request, userGesture: false }), false)
gate.prepare(event)
gate.cancel(event)
assert.equal(gate.consume(request), false)
const child = { ...frame }
assert.throws(() => gate.prepare({ ...event, senderFrame: child }), /仅允许/)
frame.url = 'http://127.0.0.1:18376/profile'
assert.throws(() => gate.prepare(event), /仅允许/)
frame.url = 'https://example.com/classroom/42'
assert.throws(() => gate.prepare(event), /仅允许/)

const server = await createServer({ server: { middlewareMode: true, hmr: false } })
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
try {
  const { captureBoard } = await server.ssrLoadModule('/src/services/board-capture.ts')
  const { SuperBoardController } = await server.ssrLoadModule('/src/services/superboard.ts')
  const element = { isConnected: true, clientWidth: 800, clientHeight: 450 }
  const order = []
  let stopping = 0
  const track = {
    readyState: 'live',
    restrictTo: async (target) => {
      assert.equal(target, element)
      order.push('restricted')
    },
    stop: () => stopping++,
  }
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] }
  globalThis.window = {
    RestrictionTarget: { fromElement: async (value) => value },
    classroomCapture: {
      prepare: async () => order.push('prepared'),
      cancel: async () => order.push('cancelled'),
    },
  }
  globalThis.document = { getElementById: () => element }
  const mediaDevices = {
    getDisplayMedia: async (options) => {
      assert.equal(options.audio, false, '教学流不得重复采集音频')
      assert.equal(options.video.frameRate.max, 15)
      order.push('captured')
      return stream
    },
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices } })
  assert.equal(await captureBoard(element), stream)
  assert.deepEqual(order, ['prepared', 'captured', 'restricted', 'cancelled'])
  assert.equal(track.contentHint, 'detail')
  track.restrictTo = async () => {
    throw new Error('restriction failed')
  }
  await assert.rejects(captureBoard(element), /restriction failed/)
  assert.equal(stopping, 1, '裁剪失败必须停止整页采集，不能发给学生')
  track.restrictTo = undefined
  await assert.rejects(captureBoard(element), /标签页/)
  assert.equal(stopping, 2)
  globalThis.window.RestrictionTarget = undefined
  const prior = order.length
  await assert.rejects(captureBoard(element), /不支持/)
  assert.equal(order.length, prior, '不支持时不得请求采集权限')
  globalThis.window.RestrictionTarget = { fromElement: async (value) => value }
  track.restrictTo = async () => {}
  const board = new SuperBoardController(() => {}, 'test-board')
  board.initialized = true
  board.manager = { getSuperBoardView: () => ({ getCurrentSuperBoardSubView: () => ({}) }) }
  let resolveCapture
  mediaDevices.getDisplayMedia = () =>
    new Promise((resolve) => {
      resolveCapture = resolve
    })
  const pending = board.createMirror()
  await new Promise((resolve) => setImmediate(resolve))
  board.stopMirror()
  resolveCapture(stream)
  await assert.rejects(pending, /已取消/)
  assert.equal(stopping, 3, '退出期间迟到的采集结果必须释放')
  mediaDevices.getDisplayMedia = async () => stream
  await board.createMirror()
  board.stopMirror()
  assert.equal(stopping, 4, '停止同步必须释放原生视频轨道')
  // 验证真实创建调用：初始白板与命名白板均应使用当前授课区比例。
  const created = []
  let models = []
  const fittedBoard = new SuperBoardController(() => {}, 'test-board')
  fittedBoard.initialized = true
  fittedBoard.manager = {
    querySuperBoardSubViewList: async () => models,
    createWhiteboardView: async (config) => {
      created.push(config)
      models = [{ uniqueID: String(created.length), name: config.name, fileID: '' }]
    },
    getSuperBoardView: () => ({
      getCurrentSuperBoardSubView: () => null,
      switchSuperBoardSubView: async () => true,
    }),
  }
  element.clientWidth = 1451
  element.clientHeight = 698
  await fittedBoard.entered()
  const fittedWidth = (created[0].perPageWidth * element.clientHeight) / created[0].perPageHeight
  assert.ok(
    Math.abs(fittedWidth - element.clientWidth) < 1,
    '宽窗口可写区域必须铺满，不能保留 16:9 留白',
  )
  element.clientWidth = 1654
  assert.equal(await fittedBoard.createBoard('抽屉收起后的白板'), true)
  assert.ok(
    Math.abs(
      (created[1].perPageWidth * element.clientHeight) / created[1].perPageHeight -
        element.clientWidth,
    ) < 1,
  )
  await fittedBoard.entered()
  assert.equal(created.length, 2, '重新入课不得替换已有白板或删除笔迹')
  element.clientHeight = 0
  assert.equal(await fittedBoard.createBoard('隐藏容器白板'), true)
  assert.equal(created[2].perPageWidth, 1600, '容器隐藏时必须使用有效默认尺寸')
  assert.ok(
    created.every((config) => config.pageCount === 6 && Number.isInteger(config.perPageWidth)),
  )
  console.log(
    'PASS: single-use trusted capture; element restriction before publish; failures and late cancellation release tracks; no audio capture.',
  )
} finally {
  globalThis.window = originalWindow
  globalThis.document = originalDocument
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globalThis.navigator
  await server.close()
}
