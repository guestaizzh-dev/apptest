const { build } = require('./package.json')

module.exports = {
  ...build,
  extends: null,
  electronDist: undefined,
  directories: { output: 'release/macos-online' },
  mac: {
    target: ['zip'],
    category: 'public.app-category.education',
    icon: 'public/brand-logo.png',
    identity: null,
    artifactName: '归途智学教师端-macOS-${arch}-线上测试版.zip',
    extendInfo: {
      NSCameraUsageDescription: '课堂中使用摄像头，让学生看到老师的授课画面。',
      NSMicrophoneUsageDescription: '课堂中使用麦克风，与学生进行实时语音交流。',
    },
  },
}
