# Uruchamia TTS Hub z czystym profilem użytkownika (jak pierwszy start).
# Nie używa Dockera — Tauri to natywne okno; izolujemy dane przez osobny APPDATA.
#
# Użycie:
#   pwsh -File scripts/dev/fresh-onboarding.ps1
#   pwsh -File scripts/dev/fresh-onboarding.ps1 -Reset   # usuń poprzedni profil testowy
#   pwsh -File scripts/dev/fresh-onboarding.ps1 -Keep    # nie usuwaj profilu przy starcie

param(
    [switch]$Reset,
    [switch]$Keep
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ProfileParent = Join-Path $env:TEMP "tts-hub-onboarding-preview"
$ProfileAppData = Join-Path $ProfileParent "Roaming"
$HubData = Join-Path $ProfileAppData "TTS_hub"

if ($Reset -and (Test-Path $ProfileParent)) {
    Remove-Item -LiteralPath $ProfileParent -Recurse -Force
    Write-Host "Usunięto profil testowy: $ProfileParent"
}

if (-not $Keep -and (Test-Path $HubData)) {
    Remove-Item -LiteralPath $HubData -Recurse -Force
    Write-Host "Wyczyszczono dane TTS Hub w profilu testowym."
}

New-Item -ItemType Directory -Force -Path $ProfileAppData | Out-Null

Write-Host ""
Write-Host "Profil testowy (pierwszy start):" -ForegroundColor Cyan
Write-Host "  APPDATA = $ProfileAppData"
Write-Host "  Dane    = $HubData"
Write-Host ""
Write-Host "Oczekiwany flow onboardingu:"
Write-Host "  1. Modal „Witaj w TTS Hub”"
Write-Host "  2. Quick Setup (overlay)"
Write-Host "  3. Tour widoku TTS (driver.js)"
Write-Host "  4. Podsumowanie README"
Write-Host ""
Write-Host "Uruchamiam: npm run tauri dev" -ForegroundColor Yellow
Write-Host ""

$env:APPDATA = $ProfileAppData
Push-Location $RepoRoot
try {
    npm run tauri dev
} finally {
    Pop-Location
}
