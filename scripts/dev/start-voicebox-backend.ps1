# Start forked Voicebox backend for local dev (Python venv required).
# Run from repo root after: cd voicebox-backend && python -m venv .venv && pip install -r backend/requirements.txt

param(
    [int]$Port = 17493,
    [string]$Host = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backendRoot = Join-Path $repoRoot "voicebox-backend"
$venvPython = Join-Path $backendRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Error "Missing venv at voicebox-backend/.venv — run: cd voicebox-backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r backend/requirements.txt"
}

$env:PYTHONPATH = $backendRoot
Write-Host "Starting Voicebox backend on http://${Host}:${Port} ..." -ForegroundColor Cyan
& $venvPython -m backend.main --host $Host --port $Port
