"""Build unsigned Mac ZIPs without extracting Unix symlinks onto Windows."""

import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import stat
import struct
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release" / "macos-online"
NAME = "归途智学教师端"
BUNDLE = "com.xueerguitu.teacher.test"
VERSION = json.loads((ROOT / "node_modules/electron/package.json").read_text())["version"]
APP_VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
BASE = f"https://github.com/electron/electron/releases/download/v{VERSION}/"
CACHE = Path(os.environ.get("ELECTRON_CACHE", str(OUT / "runtime-cache")))
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)


def fetch(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "GuituZhixue-Packaging"}), timeout=60
    )


with fetch(BASE + "SHASUMS256.txt") as response:
    checksums = dict((line.split()[1].lstrip("*"), line.split()[0])
                     for line in response.read().decode().splitlines() if line.strip())


def runtime(arch):
    filename = f"electron-v{VERSION}-darwin-{arch}.zip"
    dest = CACHE / filename
    expected = checksums[filename]
    if not dest.exists() or hashlib.file_digest(dest.open("rb"), "sha256").hexdigest() != expected:
        partial = dest.with_suffix(".zip.partial")
        with fetch(BASE + filename) as source, partial.open("wb") as target:
            shutil.copyfileobj(source, target, 1024 * 1024)
        assert hashlib.file_digest(partial.open("rb"), "sha256").hexdigest() == expected, filename
        partial.replace(dest)
    print(f"Verified official Electron runtime: {arch}", flush=True)
    return arch, dest


stage = OUT / "app-stage"
stage.mkdir(exist_ok=True)
for directory in ("dist", "electron"):
    shutil.copytree(ROOT / directory, stage / directory, dirs_exist_ok=True)
(stage / "package.json").write_text(json.dumps({
    "name": "gui-er-xue-zhi-pc", "version": APP_VERSION,
    "main": "electron/main.cjs", "type": "module",
}, indent=2), encoding="utf-8")
assert "const apiOrigin = 'https://xueerguitu.com'" in (stage / "electron/main.cjs").read_text(encoding="utf-8")
asar_module = next((ROOT / "node_modules/.pnpm").glob("@electron+asar@*/node_modules/@electron/asar"))
asar = OUT / "app.asar"
subprocess.run([
    "node", "-e",
    "require(process.argv[1]).createPackage(process.argv[2],process.argv[3]).catch(e=>{console.error(e);process.exit(1)})",
    str(asar_module), str(stage), str(asar),
], check=True)
asar_hash = hashlib.file_digest(asar.open("rb"), "sha256").hexdigest()
png = (ROOT / "public/brand-logo.png").read_bytes()
assert struct.unpack(">II", png[16:24]) == (512, 512)
icon = b"icns" + struct.pack(">I", len(png) + 16) + b"ic09" + struct.pack(">I", len(png) + 8) + png


def add_file(archive, name, content):
    entry = zipfile.ZipInfo(name)
    entry.create_system = 3
    entry.external_attr = (stat.S_IFREG | 0o644) << 16
    entry.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(entry, content)


results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    runtimes = list(pool.map(runtime, ("x64", "arm64")))
for arch, source in runtimes:
    bundle = NAME + ".app/"
    dest = OUT / f"{NAME}-macOS-{arch}-线上测试版-未签名.zip"
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for entry in original.infolist():
            if not entry.filename.startswith("Electron.app/"):
                continue
            if "/_CodeSignature/" in entry.filename or entry.filename.endswith("/default_app.asar"):
                continue
            relative = entry.filename.removeprefix("Electron.app/")
            content = original.read(entry)
            if relative == "Contents/Info.plist":
                info = plistlib.loads(content)
                info.update({
                    "CFBundleDisplayName": NAME, "CFBundleName": NAME,
                    "CFBundleIdentifier": BUNDLE,
                    "CFBundleShortVersionString": APP_VERSION, "CFBundleVersion": APP_VERSION,
                    "CFBundleIconFile": "app.icns",
                    "LSApplicationCategoryType": "public.app-category.education",
                    "NSCameraUsageDescription": "课堂中使用摄像头，让学生看到老师的授课画面。",
                    "NSMicrophoneUsageDescription": "课堂中使用麦克风，与学生进行实时语音交流。",
                })
                # Only the loopback page uses HTTP; business traffic uses HTTPS.
                info["NSAppTransportSecurity"] = {"NSAllowsLocalNetworking": True}
                content = plistlib.dumps(info)
            elif relative.endswith("/Contents/Info.plist") and "Helper" in relative:
                info = plistlib.loads(content)
                info["CFBundleDisplayName"] = NAME + " " + info.get("CFBundleName", "Helper")
                info["CFBundleIdentifier"] = BUNDLE + "." + info["CFBundleIdentifier"].removeprefix("com.github.Electron.")
                content = plistlib.dumps(info)
            entry.filename = bundle + relative
            # Keep the runtime's Unix symlinks and executable permission bits.
            archive.writestr(entry, content)
        add_file(archive, bundle + "Contents/Resources/app.asar", asar.read_bytes())
        add_file(archive, bundle + "Contents/Resources/app.icns", icon)
        add_file(archive, "未签名测试包说明.txt", (
            f"{NAME} macOS {arch} 未签名测试包\n"
            "连接正式接口 https://xueerguitu.com/api，使用正式教师账号。\n"
            "尚未在 Mac 真机验证，未完成 Apple Developer ID 签名及公证。\n"
            "请交由具备 Mac 的开发人员签名、验证后再分发给老师。\n"
            "摄像头、麦克风及屏幕共享需按 macOS 提示授权。\n"
        ).encode("utf-8"))
    with zipfile.ZipFile(dest) as archive:
        assert archive.testzip() is None
        info = plistlib.loads(archive.read(bundle + "Contents/Info.plist"))
        executable = archive.getinfo(bundle + "Contents/MacOS/" + info["CFBundleExecutable"])
        binary = archive.read(executable)
        assert binary[:4] == b"\xcf\xfa\xed\xfe", "Expected a 64-bit Mach-O executable"
        assert struct.unpack("<I", binary[4:8])[0] == {"x64": 0x01000007, "arm64": 0x0100000C}[arch]
        assert (executable.external_attr >> 16) & 0o111, "Missing executable permissions"
        assert any(stat.S_ISLNK(i.external_attr >> 16) for i in archive.infolist()), "Missing framework symlinks"
        assert hashlib.sha256(archive.read(bundle + "Contents/Resources/app.asar")).hexdigest() == asar_hash
        assert info["NSCameraUsageDescription"] and info["NSMicrophoneUsageDescription"]
        results.append({"arch": arch, "file": str(dest), "bytes": dest.stat().st_size,
                        "sha256": hashlib.file_digest(dest.open("rb"), "sha256").hexdigest(),
                        "minimumMacOS": info.get("LSMinimumSystemVersion"), "signed": False,
                        "runtimeSha256": checksums[source.name], "asarSha256": asar_hash})
    print(f"Built and verified unsigned package: {arch}", flush=True)
(OUT / "verification.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)
