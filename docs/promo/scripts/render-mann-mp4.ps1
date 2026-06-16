#requires -Version 7.0
<#
.SYNOPSIS
  Renders WhatsApp-style MP4 (720x720) from Mann explainer MP3 — mirrors TTS Hub share export.
#>
param(
    [string]$AudioPath,
    [string]$DestPath
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$Cover = Join-Path $Root 'src-tauri\icons\128x128.png'

if (-not (Test-Path $AudioPath)) { throw "Brak audio: $AudioPath" }
if (-not (Test-Path $Cover)) { throw "Brak okładki: $Cover" }

$destDir = Split-Path $DestPath -Parent
if ($destDir -and -not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$filter = '[0:v]scale=380:380:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:(oh-ih)/2+40:color=0x12141a,format=yuv420p[v]'

& ffmpeg -y -loglevel warning `
    -loop 1 -i $Cover `
    -i $AudioPath `
    -filter_complex $filter `
    -map '[v]' -map 1:a `
    -c:v libx264 -tune stillimage -pix_fmt yuv420p `
    -c:a aac -b:a 128k -shortest `
    $DestPath

if (-not (Test-Path $DestPath)) { throw "ffmpeg nie utworzył: $DestPath" }
Write-Host "OK $DestPath"
