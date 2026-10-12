# macOS 教师端测试包

## GitHub Actions 验证

`.github/workflows/macos-test.yml` 通过手动运行，在 `macos-15-intel`（x64）和 `macos-15`（arm64）分别构建、进行 ad-hoc 临时签名，并验证架构与签名。流程解压本次生成的 ZIP，启动其中的实际应用，检查登录页、密码显示切换、空输入校验及线上 HTTPS 服务；此外运行已有的白板元素采集检查。测试截图、JSON 结果、签名信息和 ZIP 作为 Actions artifacts 保存 14 天。

GitHub 的临时签名用于测试，不是 Apple Developer ID 签名，也不包含公证；流程通过不代表下载到老师电脑后会通过 Gatekeeper。云端测试不覆盖真实摄像头、麦克风、操作系统权限授权和师生 ZEGO 通话。参见 [GitHub Mac runner 说明](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。

GitHub 测试仓库为 [guestaizzh-dev/apptest](https://github.com/guestaizzh-dev/apptest)，与原有 Gitee 仓库分开维护。可从 Actions 页面手动运行 `macOS build and smoke test`。流程不需要业务密码或 Apple 开发者凭据，打包明确使用 `--publish never`，只上传测试产物，不发布 GitHub Release。

Intel 使用 `x64`，M 系列使用 `arm64`。两者使用当前桌面页面和 `https://xueerguitu.com/api`，需要正式环境的教师账号。

## 当前 Windows 构建

运行 `npm run desktop:build:mac:unsigned`。脚本需要 Node.js、Python 3.11 及以上、已安装的项目依赖和网络。

脚本按 [Electron 官方应用分发方式](https://www.electronjs.org/docs/latest/tutorial/application-distribution)，将业务 `app.asar` 装入官方 macOS 运行时。运行时版本与项目安装的 Electron 一致，下载文件使用同一官方 release 的 `SHASUMS256.txt` 校验。直接在 ZIP 内保留符号链接和 Unix 执行权限，避免 Windows 解压破坏 framework 链接。

产物在 `release/macos-online`，文件名包含架构及“未签名”。`verification.json` 记录 SHA256、最低系统版本和架构；打包后检查 ZIP 完整性、Mach-O CPU 类型、执行权限、framework 符号链接、业务资源及相机/麦克风用途说明。两个包内的业务资源一致，不包含测试账号、开发服务器或后端密钥。

## 交付限制

当前没有 Mac 和 Apple Developer ID 证书。这两个 ZIP 是未签名构建产物，未完成 Apple 公证，也未经过 Mac 真机启动验证；不能视为已经能够直接交付老师使用的正式安装包。macOS 可能阻止启动，尤其需要在 Apple Silicon 上完成有效签名验证。请由具备 Mac 的开发人员签名并验证后再分发，不以关闭系统安全检查作为交付方案。

## Mac 本机构建与验证

`npm run desktop:build:mac` 使用 `electron-builder.mac.cjs` 分别构建两个架构的 ZIP。当前配置明确不做证书签名；有开发者证书后，需要调整 `mac.identity` 并按 [Electron 的签名与公证说明](https://www.electronjs.org/docs/latest/tutorial/code-signing)配置 Developer ID 和公证凭据。凭据不写入源码。

相机和麦克风用途已写入 Info.plist；首次上课按 macOS 提示授权，参见 [Electron 系统权限文档](https://www.electronjs.org/docs/latest/api/system-preferences)。屏幕共享还需要系统的屏幕录制权限。分别在 Intel 和 M 系列 Mac 上验证登录、课程、摄像头、麦克风、共享屏幕、白板同步及退出课堂，方可宣称对应平台实际可用。
