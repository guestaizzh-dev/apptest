// 白板采集只允许本机课堂主页面，并且每次授权只能消费一次。
function createBoardCaptureGate(getWindow, trusted, now = Date.now) {
  let pending
  const valid = (frame) => {
    const window = getWindow()
    return (
      window &&
      !window.isDestroyed() &&
      frame &&
      !frame.isDestroyed() &&
      frame === window.webContents.mainFrame &&
      trusted(frame.url) &&
      /^\/classroom\/\d+\/?$/.test(new URL(frame.url).pathname)
    )
  }
  return {
    prepare(event) {
      if (!valid(event.senderFrame) || event.sender !== getWindow().webContents)
        throw new Error('仅允许当前课堂采集白板。')
      pending = { frame: event.senderFrame, expires: now() + 5000 }
    },
    cancel(event) {
      if (pending?.frame === event.senderFrame) pending = undefined
    },
    consume(request) {
      const grant = pending
      pending = undefined
      return Boolean(
        grant &&
        grant.frame === request.frame &&
        grant.expires > now() &&
        valid(request.frame) &&
        request.userGesture &&
        request.videoRequested &&
        !request.audioRequested,
      )
    },
  }
}
module.exports = { createBoardCaptureGate }
