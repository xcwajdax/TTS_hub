@echo off
setlocal EnableExtensions
set "DEV_DIR=%~dp0"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%DEV_DIR%stop-tauri-dev.ps1"
set "RC=%ERRORLEVEL%"

if "%RC%"=="0" (
  echo [TTS Hub] Dev zatrzymany.
) else (
  echo [TTS Hub] Nie znaleziono procesow dev albo wystapil blad (kod %RC%^).
)

timeout /t 3 >nul
exit /b %RC%
