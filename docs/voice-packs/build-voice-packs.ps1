#requires -Version 7.0
<#
  Buduje pliki .ttshub-voice z manifest.json + opcjonalnej próbki audio.
  Uruchom z katalogu repo: pwsh -File docs/voice-packs/build-voice-packs.ps1
#>
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Dist = Join-Path $Root 'dist'
$Samples = Join-Path (Split-Path $Root -Parent) 'samples'

$PreviewMap = @{
    'google-kore-cieply-pl'   = 'google-kore.wav'
    'google-charon-formal-pl' = 'google-charon.wav'
    'google-puck-dialog-pl'   = 'google-kore.wav'
    'minimax-kobieta-pl'      = 'minimax-polish-female.mp3'
    'minimax-mezczyzna-pl'    = 'minimax-polish-male.mp3'
    'topkek-portfolio-brief-pl' = 'minimax-polish-male.mp3'
}

if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
New-Item -ItemType Directory -Path $Dist | Out-Null

Get-ChildItem -Path $Root -Directory | Where-Object { $_.Name -notin @('dist') } | ForEach-Object {
    $packDir = $_.FullName
    $manifestPath = Join-Path $packDir 'manifest.json'
    if (-not (Test-Path $manifestPath)) { return }

    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $packId = $manifest.id
    if (-not $packId) { throw "Brak id w $manifestPath" }

    $staging = Join-Path $env:TEMP "ttshub-voice-pack-$packId"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null

    Copy-Item $manifestPath (Join-Path $staging 'manifest.json')

    $previewFile = $PreviewMap[$packId]
    if ($previewFile) {
        $src = Join-Path $Samples $previewFile
        if (Test-Path $src) {
            $destName = if ($previewFile -like '*.mp3') { 'preview.mp3' } else { 'preview.wav' }
            Copy-Item $src (Join-Path $staging $destName)
        } else {
            Write-Warning "Brak próbki: $src (pack $packId)"
        }
    }

    $outFile = Join-Path $Dist "$packId.ttshub-voice"
    if (Test-Path $outFile) { Remove-Item $outFile -Force }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $outFile -Force
    Remove-Item $staging -Recurse -Force
    Write-Host "OK $outFile"
}

Write-Host "Gotowe: $(@(Get-ChildItem $Dist -Filter '*.ttshub-voice').Count) packów w $Dist"
