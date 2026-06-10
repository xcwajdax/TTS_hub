#requires -Version 7.0
<#
  Generuje pliki audio lektorów promo przez TTS Hub HTTP API.
  Wymaga: TTS Hub uruchomiony (http://127.0.0.1:8765)

  Uruchomienie:
    pwsh -File docs/promo/scripts/generate-promo-audio.ps1
    pwsh -File docs/promo/scripts/generate-promo-audio.ps1 -Variant social
    pwsh -File docs/promo/scripts/generate-promo-audio.ps1 -Variant full
    pwsh -File docs/promo/scripts/generate-promo-audio.ps1 -SkipExisting
#>
param(
    [ValidateSet('all', 'social', 'full')]
    [string]$Variant = 'all',
    [switch]$SkipExisting
)

$ErrorActionPreference = 'Stop'
$ApiBase = 'http://127.0.0.1:8765'
$PromoRoot = Split-Path $PSScriptRoot -Parent
$ManifestPath = Join-Path $PromoRoot 'audio/segments.json'

if (-not (Test-Path $ManifestPath)) { throw "Brak manifestu: $ManifestPath" }

try {
    $null = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 5
} catch {
    throw "TTS Hub API niedostępne ($ApiBase). Uruchom aplikację i spróbuj ponownie."
}

$manifest = Get-Content $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

function Invoke-PromoGenerate {
    param([object]$Segment, [string]$OutDir)

    $dest = Join-Path $OutDir $Segment.file
    if ($SkipExisting -and (Test-Path $dest)) {
        Write-Host "  skip (exists): $($Segment.file)"
        return $dest
    }

    $body = @{
        text     = $Segment.text
        provider = $Segment.provider
        model    = $Segment.model
        voice    = $Segment.voice
        format   = 'wav'
        source   = 'promo'
    }
    if ($Segment.language) { $body['language'] = $Segment.language }
    if ($Segment.style) { $body['style'] = $Segment.style }
    if ($Segment.minimax_speed) { $body['minimax_speed'] = $Segment.minimax_speed }
    if ($Segment.minimax_vol) { $body['minimax_vol'] = $Segment.minimax_vol }
    if ($Segment.minimax_pitch) { $body['minimax_pitch'] = $Segment.minimax_pitch }

    Write-Host "Generating $($Segment.file) [$($Segment.persona)]…"
    $json = $body | ConvertTo-Json -Compress
    $gen = Invoke-RestMethod -Uri "$ApiBase/generate?wait=true" -Method Post `
        -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 180

    if ($gen.status -ne 'done') {
        throw "Job $($gen.id) → $($gen.status): $($gen.error)"
    }
    if (-not (Test-Path $gen.file_path)) { throw "Brak pliku: $($gen.file_path)" }

    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Copy-Item -Path $gen.file_path -Destination $dest -Force
    Write-Host "  -> $dest"
    return $dest
}

$variants = switch ($Variant) {
    'social' { @('social') }
    'full' { @('full') }
    default { @('social', 'full') }
}

foreach ($v in $variants) {
    $outDir = Join-Path $PromoRoot "audio/$v"
    Write-Host "`n=== $v ==="
    foreach ($seg in $manifest.$v) {
        Invoke-PromoGenerate -Segment $seg -OutDir $outDir
    }
}

Write-Host "`nDone. Mastering: pwsh -File docs/promo/scripts/master-promo-audio.ps1"
