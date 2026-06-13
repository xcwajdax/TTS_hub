# Usuwa artefakty buildu Tauri/Vite (cargo target, dist). Fail-open przy zablokowanych plikach.
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent

Write-Host "Czyszczenie artefaktow buildu w: $root"

Get-Process -Name 'tts-hub', 'tts_hub' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$dist = Join-Path $root 'dist'
if (Test-Path $dist) {
    Remove-Item -Recurse -Force $dist
    Write-Host "  usunieto dist/"
}

Push-Location (Join-Path $root 'src-tauri')
try {
    cargo clean 2>&1 | ForEach-Object { Write-Host "  $_" }
} finally {
    Pop-Location
}

Write-Host "Gotowe. Do dev: npm run tauri dev | do produkcji: npm run tauri build"
