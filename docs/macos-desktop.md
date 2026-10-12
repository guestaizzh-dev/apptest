# macOS 教师端测试包

## GitHub Actions 验证

`.github/workflows/macos-test.yml` 通过手动运行，在 `macos-15-intel`（x64）和 `macos-15`（arm64）分别构建、进行 ad-hoc 临时签名，并验证架构与签名。流程解压本次生成的 ZIP，启动其中的实际应用，检查登录页、密码显示切换、空输入校验及线上 HTTPS 服务；此外运行已有的白板元素采集检查。测试截图、JSON 结果、签名信息和 ZIP 作为 Actions artifacts 保存 14 天。

GitHub 的临时签名用于测试，不是 Apple Developer ID 签名，也不包含公证；流程通过不代表下载到老师电脑后会通过 Gatekeeper。云端测试不覆盖真实摄像头、麦克风、操作系统权限授权和师生 ZEGO 通话。参见 [GitHub Mac runner 说明](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。

GitHub 测试仓库为 [guestaizzh-dev/apptest](https://github.com/guestaizzh-dev/apptest)，与原有 Gitee 仓库分开维护。可从 Actions 页面手动运行 `macOS build and smoke test`。流程不需要业务密码或 Apple 开发者凭据，打包明确使用 `--publish never`，只上传测试产物，不发布 GitHub Release。

Intel 使用 `x64`，M 系列使用 `arm64`。两者使用当前桌面页面和 `https://xueerguitu.com/api`，需要正式环境的教师账号。

## 本次云端验证结果

[Actions 第 5 次运行](https://github.com/guestaizzh-dev/apptest/actions/runs/38204826003)，测试提交 `2f588c00de43b5374394db346fa598bd8fe2f068`，Intel 和 M 系列均通过代码检查、线上 HTTPS 代理、原生构建、架构和 ad-hoc 签名检查、实际 ZIP 内应用启动、登录页交互及独立白板元素采集测试。登录页检查使用空输入，不提交真实教师登录凭据；线上检查覆盖健康接口和未登录时的 401 边界。

测试期间发现并修正 Mac/Windows 路径隔离断言差异、CI 自动发布 Release 引起的打包失败，以及白板测试对 Electron 下载目录的依赖。一次 Intel 请求收到非 JSON 响应，现对临时 502/503/504 网关错误最多请求三次，并在其他非 JSON 响应中记录接口、HTTP 状态和内容摘要；此处理只影响测试脚本，不改变客户端或线上服务。

Actions 产物包括两个架构的 ZIP 和 `test-results` 下的登录页截图、`launch.json`、`board-capture.json`、签名及架构记录。下载后交付文件名包含“云端验证版”，用于区别下文 Windows 生成的旧“未签名”包。

## 当前 Windows 构建

运行 `npm run desktop:build:mac:unsigned`。脚本需要 Node.js、Python 3.11 及以上、已安装的项目依赖和网络。

脚本按 [Electron 官方应用分发方式](https://www.electronjs.org/docs/latest/tutorial/application-distribution)，将业务 `app.asar` 装入官方 macOS 运行时。运行时版本与项目安装的 Electron 一致，下载文件使用同一官方 release 的 `SHASUMS256.txt` 校验。直接在 ZIP 内保留符号链接和 Unix 执行权限，避免 Windows 解压破坏 framework 链接。

产物在 `release/macos-online`，文件名包含架构及“未签名”。`verification.json` 记录 SHA256、最低系统版本和架构；打包后检查 ZIP 完整性、Mach-O CPU 类型、执行权限、framework 符号链接、业务资源及相机/麦克风用途说明。两个包内的业务资源一致，不包含测试账号、开发服务器或后端密钥。

## Windows 生成包的限制

Windows 脚本生成的“未签名” ZIP 未完成 Apple 签名或公证，不能替代上文在 Mac runner 原生构建并验证的“云端验证版”。云端验证版具备 ad-hoc 签名，仍没有 Apple Developer ID 签名或公证；两类产物均不能据此保证下载后的 Gatekeeper 放行，也没有真实 Mac 媒体设备和师生通话联调结果。正式分发前仍需完成证书签名、公证和实际课堂测试。

## Mac 本机构建与验证

`npm run desktop:build:mac` 使用 `electron-builder.mac.cjs` 分别构建两个架构的 ZIP。当前配置明确不做证书签名；有开发者证书后，需要调整 `mac.identity` 并按 [Electron 的签名与公证说明](https://www.electronjs.org/docs/latest/tutorial/code-signing)配置 Developer ID 和公证凭据。凭据不写入源码。

相机和麦克风用途已写入 Info.plist；首次上课按 macOS 提示授权，参见 [Electron 系统权限文档](https://www.electronjs.org/docs/latest/api/system-preferences)。屏幕共享还需要系统的屏幕录制权限。分别在 Intel 和 M 系列 Mac 上验证登录、课程、摄像头、麦克风、共享屏幕、白板同步及退出课堂，方可宣称对应平台实际可用。
