# PyInstaller sidecar for release builds

Tauri expects platform-suffixed binaries here, e.g.:

- `voicebox-server-x86_64-pc-windows-msvc.exe` (Windows x64)
- `voicebox-server-x86_64-unknown-linux-gnu` (Linux)
- `voicebox-server-aarch64-apple-darwin` (macOS Apple Silicon)

## Build (Windows)

```powershell
pwsh -File scripts/build-voicebox-server.ps1
```

Requires Python 3.11+, ~30+ min first time (PyTorch + PyInstaller). Output is copied into this folder.

## Dev

`tauri dev` uses Python from `voicebox-backend/.venv` when `voicebox_server_mode` is `bundled` — no binary required here.

## Git

Binaries are large and **gitignored**. CI/release pipeline must run the build script before `npm run tauri build`.
