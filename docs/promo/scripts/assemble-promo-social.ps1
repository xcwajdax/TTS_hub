#requires -Version 7.0
<#
  Montaż wersji social (9:16 + opcjonalnie 1:1) z audio + storyboard.
  Wymaga: ffmpeg, ffprobe w PATH.

  Uruchomienie:
    pwsh -File docs/promo/scripts/assemble-promo-social.ps1
    pwsh -File docs/promo/scripts/assemble-promo-social.ps1 -WithSquare
#>
param(
    [switch]$WithSquare,
    [double]$HandoffGapSec = 0.3
)

$ErrorActionPreference = 'Stop'
$PromoRoot = Split-Path $PSScriptRoot -Parent
$AudioDir = Join-Path $PromoRoot 'audio/social'
$StoryDir = Join-Path $PromoRoot 'storyboard/social'
$VideoDir = Join-Path $PromoRoot 'video'
$WorkDir = Join-Path $VideoDir 'work-social'
$Out916 = Join-Path $VideoDir 'promo-social-9x16.mp4'
$Out11 = Join-Path $VideoDir 'promo-social-1x1.mp4'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg wymagany w PATH' }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'ffprobe wymagany w PATH' }

$segments = @(
    @{ audio = '00-hook-lektor.wav'; image = '00-hook.png'; label = 'Hook' }
    @{ audio = '01-tworca.wav'; image = '01-tworca.png'; label = 'Twórca' }
    @{ audio = '02-developer.wav'; image = '02-developer.png'; label = 'Developer' }
    @{ audio = '03-cursor.wav'; image = '03-cursor.png'; label = 'Cursor' }
    @{ audio = '04-cta-lektor.wav'; image = '04-cta.png'; label = 'CTA' }
)

function Get-AudioDuration {
    param([string]$Path)
    $out = & ffprobe -v error -show_entries format=duration -of csv=p=0 $Path 2>$null
    return [double]$out.Trim()
}

function New-PlaceholderPng {
    param([string]$Path, [string]$Text, [int]$W, [int]$H)
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    & ffmpeg -y -f lavfi -i "color=c=0x0f1115:s=${W}x${H}:d=1" -frames:v 1 $Path 2>$null
    if ($LASTEXITCODE -ne 0) { throw "placeholder png failed: $Path" }
}

function New-Clip {
    param(
        [string]$Image,
        [string]$Audio,
        [string]$OutClip,
        [int]$W = 1080,
        [int]$H = 1920
    )

    if (-not (Test-Path $Image)) {
        New-PlaceholderPng -Path $Image -Text (Split-Path $OutClip -Leaf) -W $W -H $H
    }

    $dur = Get-AudioDuration $Audio
    $totalDur = $dur + $HandoffGapSec

    & ffmpeg -y `
        -loop 1 -i $Image `
        -i $Audio `
        -c:v libx264 -tune stillimage -pix_fmt yuv420p `
        -c:a aac -b:a 192k `
        -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=yuv420p" `
        -t $totalDur -shortest `
        $OutClip 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) { throw "ffmpeg clip failed: $OutClip" }
}

New-Item -ItemType Directory -Force -Path $WorkDir, $VideoDir | Out-Null

$clips = @()
$i = 0
foreach ($seg in $segments) {
    $audioPath = Join-Path $AudioDir $seg.audio
    if (-not (Test-Path $audioPath)) {
        throw "Brak audio: $audioPath — uruchom generate-promo-audio.ps1"
    }
    $imagePath = Join-Path $StoryDir $seg.image
    $clipPath = Join-Path $WorkDir ("clip_{0:D2}.mp4" -f $i)
    Write-Host "Clip: $($seg.label)"
    New-Clip -Image $imagePath -Audio $audioPath -OutClip $clipPath -W 1080 -H 1920
    $clips += $clipPath
    $i++
}

$concatList = Join-Path $WorkDir 'concat.txt'
($clips | ForEach-Object { "file '$($_.Replace('\', '/'))'" }) -join "`n" | Set-Content $concatList -Encoding UTF8

Write-Host "Łączenie → $Out916"
& ffmpeg -y -f concat -safe 0 -i $concatList -c copy $Out916 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'concat failed' }

Write-Host "Gotowe: $Out916"

if ($WithSquare) {
    Write-Host "Crop 1:1 → $Out11"
    & ffmpeg -y -i $Out916 -vf 'crop=1080:1080:0:420' -c:a copy $Out11 2>&1 | Out-Null
    Write-Host "Gotowe: $Out11"
}

Write-Host @"

Następne kroki:
  • Podmień storyboard PNG na nagrania OBS (capture/CHECKLIST.md)
  • Dodaj muzykę lo-fi i SFX whoosh w edytorze (opcjonalnie)
  • Opublikuj: docs/promo/video/publish-config.json
"@
