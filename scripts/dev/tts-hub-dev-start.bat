@echo off
setlocal EnableExtensions
set "DEV_DIR=%~dp0"
set "ROOT=%DEV_DIR%..\.."
cd /d "%ROOT%"

if not exist "%ROOT%\package.json" (
  echo [TTS Hub] Nie znaleziono korzenia projektu: %ROOT%
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [TTS Hub] Brak npm w PATH. Zainstaluj Node.js i uruchom ponownie.
  pause
  exit /b 1
)

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo [TTS Hub] Dev juz dziala — API na http://127.0.0.1:8765
  pause
  exit /b 0
)

if not exist "%DEV_DIR%Uruchom TTS Hub (dev).lnk" (
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%DEV_DIR%create-shortcuts.ps1" >nul 2>&1
)

start "TTS Hub — dev" /D "%ROOT%" cmd /k npm run tauri dev
exit /b 0
