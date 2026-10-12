// 用项目自带 Electron 执行；不登录业务、不访问摄像头麦克风、不进入 ZEGO 房间。
const { app, BrowserWindow, session, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createBoardCaptureGate } = require('../electron/board-capture.cjs')
const resultPath = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9)
app.disableHardwareAcceleration()
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-capture-check-')))
let server, window, observations
function finish(result, code) {
  if (resultPath) fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  server?.close()
  window?.destroy()
  app.exit(code)
}
const timeout = setTimeout(() => finish({ error: 'native capture timed out' }, 1), 45000)
app
  .whenReady()
  .then(async () => {
    server = http.createServer((req, res) =>
      res.end(`<html><body style="margin:0;background:#d00">
    <div id="board" style="width:640px;height:360px;background:white;isolation:isolate;overflow:hidden"><canvas id="ink" width="640" height="360"></canvas></div>
    <div style="position:absolute;top:0;left:0;z-index:9;width:100px;height:100px;background:red">不能被采集的工具菜单</div>
    <script>let n=0;function paint(){const c=document.getElementById('ink').getContext('2d');c.fillStyle='white';c.fillRect(0,0,640,360);c.fillStyle='#135c31';c.fillRect(n++%500,140,100,100);requestAnimationFrame(paint)}paint()</script></body></html>`),
    )
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const gate = createBoardCaptureGate(
      () => window,
      (url) => new URL(url).origin === origin,
    )
    ipcMain.handle('classroom:prepare-board-capture', (event) => gate.prepare(event))
    ipcMain.handle('classroom:cancel-board-capture', (event) => gate.cancel(event))
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) =>
      callback(['display-capture', 'media'].includes(permission)),
    )
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) =>
      callback(gate.consume(request) ? { video: request.frame } : {}),
    )
    window = new BrowserWindow({
      width: 1000,
      height: 700,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        preload: path.join(__dirname, '../electron/preload.cjs'),
      },
    })
    await window.loadURL(origin + '/classroom/42')
    const result = await window.webContents.executeJavaScript(
      `(async () => {
    const board = document.getElementById('board');
    const target = await RestrictionTarget.fromElement(board);
    await window.classroomCapture.prepare();
    const stream = await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:15}},audio:false,preferCurrentTab:true});
    await window.classroomCapture.cancel();
    const track = stream.getVideoTracks()[0];
    await track.restrictTo(target);
    const video = document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();
    let frames=0,running=true;const sample=[];
    function tick(){frames++;if(running)video.requestVideoFrameCallback(tick)}video.requestVideoFrameCallback(tick);
    await new Promise(resolve=>setTimeout(resolve,2200));
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);
    const pixel=Array.from(ctx.getImageData(0,0,1,1).data);
    const initial={width:video.videoWidth,height:video.videoHeight};
    board.style.width='480px';board.style.height='270px';
    await new Promise(resolve=>setTimeout(resolve,1000));
    const resized={width:video.videoWidth,height:video.videoHeight};
    running=false;
    const result={frames,pixel,initial,resized,settings:track.getSettings(),audioTracks:stream.getAudioTracks().length};
    stream.getTracks().forEach(track=>track.stop());result.ended=track.readyState;video.srcObject=null;return result;
  })()`,
      true,
    )
    observations = result
    assert.ok(result.frames >= 24, '动态画面应超过快照方案的每秒两帧')
    assert.deepEqual(result.pixel, [255, 255, 255, 255], '覆盖白板的红色菜单不得进入采集流')
    assert.ok(result.resized.width < result.initial.width, '裁剪区域应跟随白板尺寸变化')
    assert.equal(result.audioTracks, 0)
    assert.equal(result.ended, 'ended')
    clearTimeout(timeout)
    finish({ passed: true, ...result }, 0)
  })
  .catch((error) => {
    clearTimeout(timeout)
    finish({ error: error.message, stack: error.stack, observations }, 1)
  })
