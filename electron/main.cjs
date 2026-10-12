const { app, BrowserWindow, session, desktopCapturer, dialog, shell, ipcMain } = require('electron')
const path = require('node:path')
const { createAppServer } = require('./server.cjs')
const { createBoardCaptureGate } = require('./board-capture.cjs')

// 当前测试电脑的 Electron GPU 进程崩溃，软件渲染保证客户端能正常显示。
if (process.platform === 'win32') app.disableHardwareAcceleration()

const origin = 'http://127.0.0.1:18376'
const apiOrigin = 'https://xueerguitu.com'
let window, server
const trusted = (url) => {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}
const boardCapture = createBoardCaptureGate(() => window, trusted)

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })
  app
    .whenReady()
    .then(async () => {
      console.log('Teacher desktop: starting local server')
      server = createAppServer(path.join(__dirname, '..', 'dist'), apiOrigin)
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(18376, '127.0.0.1', resolve)
      })
      console.log('Teacher desktop: local server ready')
      const allowed = new Set(['media', 'display-capture', 'fullscreen'])
      session.defaultSession.setPermissionRequestHandler(
        (contents, permission, callback, details) =>
          callback(allowed.has(permission) && trusted(details.requestingUrl || contents.getURL())),
      )
      session.defaultSession.setPermissionCheckHandler(
        (contents, permission, requestingOrigin) =>
          allowed.has(permission) && trusted(requestingOrigin || contents?.getURL()),
      )
      ipcMain.handle('classroom:prepare-board-capture', (event) => boardCapture.prepare(event))
      ipcMain.handle('classroom:cancel-board-capture', (event) => boardCapture.cancel(event))
      session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
          if (!request.frame || !trusted(request.frame.url) || !window || window.isDestroyed()) {
            callback({})
            return
          }
          if (boardCapture.consume(request)) {
            callback({ video: request.frame })
            return
          }
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 },
          })
          const { response } = await dialog.showMessageBox(window, {
            type: 'question',
            title: '选择授课共享画面',
            message: '请选择要共享的屏幕或窗口',
            detail: '老师的声音仍由麦克风发送，共享画面不重复采集声音。',
            buttons: ['取消', ...sources.map((source) => source.name)],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
          callback(response > 0 && sources[response - 1] ? { video: sources[response - 1] } : {})
        } catch {
          callback({})
        }
      })
      console.log('Teacher desktop: media handlers ready')
      window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1000,
        minHeight: 650,
        title: '归途智学 · 教师端',
        icon: path.join(__dirname, '..', 'dist', 'favicon.ico'),
        backgroundColor: '#fffaf5',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          backgroundThrottling: false,
          preload: path.join(__dirname, 'preload.cjs'),
        },
      })
      window.setMenu(null)
      console.log('Teacher desktop: window created')
      window.webContents.on('page-title-updated', (event) => {
        event.preventDefault()
        window.setTitle('归途智学 · 教师端')
      })
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url)
        return { action: 'deny' }
      })
      window.webContents.on('will-navigate', (event, url) => {
        if (!trusted(url)) event.preventDefault()
      })
      window.show()
      await window.loadURL(origin)
      window.show()
      console.log('Teacher desktop: page loaded')
    })
    .catch((error) => {
      dialog.showErrorBox('教师端启动失败', error.message)
      app.quit()
    })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => server?.close())
}
