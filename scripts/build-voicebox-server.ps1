# Build voicebox-server PyInstaller sidecar for TTS Hub (Windows)

param(
    [switch]$SkipPip
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$backendRoot = Join-Path $repoRoot "voicebox-backend"
$backendDir = Join-Path $backendRoot "backend"
$binariesDir = Join-Path $repoRoot "src-tauri\binaries"
$venvPython = Join-Path $backendRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating venv..." -ForegroundColor Cyan
    python -m venv (Join-Path $backendRoot ".venv")
}

if (-not $SkipPip) {
    Write-Host "Installing backend requirements (may take a while)..." -ForegroundColor Cyan
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")
    & $venvPython -m pip install pyinstaller
}

$env:PYTHONPATH = $backendRoot
Push-Location $backendDir
try {
    Write-Host "Running PyInstaller build_binary.py..." -ForegroundColor Cyan
    & $venvPython build_binary.py
} finally {
    Pop-Location
}

$hostTuple = (rustc --print host-tuple 2>$null)
if (-not $hostTuple) { $hostTuple = "x86_64-pc-windows-msvc" }

New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null

$distExe = Join-Path $backendDir "dist\voicebox-server.exe"
if (-not (Test-Path $distExe)) {
    throw "Build failed: $distExe not found"
}

$targetName = "voicebox-server-$hostTuple.exe"
Copy-Item -Force $distExe (Join-Path $binariesDir $targetName)
Write-Host "Built $(Join-Path $binariesDir $targetName)" -ForegroundColor Green
