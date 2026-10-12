type CaptureTarget = object
type BoardTrack = MediaStreamTrack & {
  restrictTo(target: CaptureTarget): Promise<void>
}
type CaptureWindow = Window & {
  RestrictionTarget?: { fromElement(element: Element): Promise<CaptureTarget> }
}

/** 先限制到白板元素，再交给 ZEGO；失败时绝不发送整页或桌面画面。 */
export async function captureBoard(element: HTMLElement): Promise<MediaStream> {
  const targetAPI = (window as CaptureWindow).RestrictionTarget
  if (!targetAPI?.fromElement || !navigator.mediaDevices?.getDisplayMedia)
    throw new Error('当前客户端不支持白板直接采集，请更新 Windows 客户端或使用共享教学窗口。')
  if (!element.isConnected || !element.clientWidth || !element.clientHeight)
    throw new Error('请先打开白板，再开始授课同步。')

  const target = await targetAPI.fromElement(element)
  let stream: MediaStream | undefined
  try {
    await window.classroomCapture?.prepare()
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 15 }, width: { max: 1920 }, height: { max: 1080 } },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as DisplayMediaStreamOptions)
    const track = stream.getVideoTracks()[0] as BoardTrack | undefined
    if (!track?.restrictTo)
      throw new Error('请使用新版 Windows 客户端；浏览器授课请选择当前课堂标签页。')
    await track.restrictTo(target)
    if (!element.isConnected || track.readyState !== 'live')
      throw new Error('白板采集已结束，请重新开始同步。')
    track.contentHint = 'detail'
    return stream
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop())
    if (error instanceof DOMException && error.name === 'NotAllowedError')
      throw new Error('白板同步已取消或未获得采集权限，请重新点击同步。')
    throw error
  } finally {
    await window.classroomCapture?.cancel().catch(() => {})
  }
}
