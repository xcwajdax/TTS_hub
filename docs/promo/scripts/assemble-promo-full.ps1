#requires -Version 7.0
<#
  Montaż pełnej wersji 16:9 z audio + storyboard + plik rozdziałów YouTube.
  Wymaga: ffmpeg, ffprobe w PATH.

  Uruchomienie:
    pwsh -File docs/promo/scripts/assemble-promo-full.ps1
#>
param(
    [double]$HandoffGapSec = 0.35
)

$ErrorActionPreference = 'Stop'
$PromoRoot = Split-Path $PSScriptRoot -Parent
$AudioDir = Join-Path $PromoRoot 'audio/full'
$StoryDir = Join-Path $PromoRoot 'storyboard/full'
$VideoDir = Join-Path $PromoRoot 'video'
$WorkDir = Join-Path $VideoDir 'work-full'
$Out169 = Join-Path $VideoDir 'promo-full-16x9.mp4'
$ChaptersFile = Join-Path $VideoDir 'chapters-youtube.txt'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg wymagany w PATH' }

$segments = @(
    @{ audio = '00-intro-lektor.wav'; image = '00-intro.png'; label = 'Intro'; chapter = '0:00 Intro' }
    @{ audio = '01-tworca.wav'; image = '01-tworca.png'; label = 'Twórca'; chapter = '0:20 Twórca treści' }
    @{ audio = '02-developer.wav'; image = '02-developer.png'; label = 'Developer'; chapter = '1:10 Developer i API' }
    @{ audio = '03-cursor.wav'; image = '03-cursor.png'; label = 'Cursor'; chapter = '2:00 Integracja Cursor' }
    @{ audio = '04-cta-lektor.wav'; image = '04-cta.png'; label = 'Pobierz'; chapter = '2:45 Pobierz TTS Hub' }
)

function Get-AudioDuration {
    param([string]$Path)
    $out = & ffprobe -v error -show_entries format=duration -of csv=p=0 $Path 2>$null
    return [double]$out.Trim()
}

function New-PlaceholderPng {
    param([string]$Path, [string]$Text)
    New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
    & ffmpeg -y -f lavfi -i 'color=c=0x0f1115:s=1920x1080:d=1' -frames:v 1 $Path 2>$null
    if ($LASTEXITCODE -ne 0) { throw "placeholder png failed: $Path" }
}

function New-Clip {
    param([string]$Image, [string]$Audio, [string]$OutClip)

    if (-not (Test-Path $Image)) {
        New-PlaceholderPng -Path $Image -Text (Split-Path $OutClip -Leaf)
    }

    $dur = Get-AudioDuration $Audio
    $totalDur = $dur + $HandoffGapSec

    & ffmpeg -y `
        -loop 1 -i $Image `
        -i $Audio `
        -c:v libx264 -tune stillimage -pix_fmt yuv420p `
        -c:a aac -b:a 192k `
        -vf 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p' `
        -t $totalDur -shortest `
        $OutClip 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) { throw "ffmpeg clip failed: $OutClip" }
}

New-Item -ItemType Directory -Force -Path $WorkDir, $VideoDir | Out-Null

$clips = @()
$chapterLines = @()
$cursorSec = 0.0
$i = 0

foreach ($seg in $segments) {
    $audioPath = Join-Path $AudioDir $seg.audio
    if (-not (Test-Path $audioPath)) {
        throw "Brak audio: $audioPath — uruchom generate-promo-audio.ps1 -Variant full"
    }

    $mins = [math]::Floor($cursorSec / 60)
    $secs = [math]::Floor($cursorSec % 60)
    $ts = '{0}:{1}' -f $mins, $secs.ToString('00')
    $chapterTitle = ($seg.chapter -replace '^\d+:\d+\s*', '')
    $chapterLines += "$ts $chapterTitle"

    $imagePath = Join-Path $StoryDir $seg.image
    $clipPath = Join-Path $WorkDir ("clip_{0:D2}.mp4" -f $i)
    Write-Host "Clip: $($seg.label) @ $ts"
    New-Clip -Image $imagePath -Audio $audioPath -OutClip $clipPath
    $clips += $clipPath
    $cursorSec += (Get-AudioDuration $audioPath) + $HandoffGapSec
    $i++
}

$concatList = Join-Path $WorkDir 'concat.txt'
($clips | ForEach-Object { "file '$($_.Replace('\', '/'))'" }) -join "`n" | Set-Content $concatList -Encoding UTF8

Write-Host "Łączenie → $Out169"
& ffmpeg -y -f concat -safe 0 -i $concatList -c copy $Out169 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'concat failed' }

@(
    '# Rozdziały YouTube — wklej do opisu filmu (linie zaczynające się od timestampu)',
    '',
    ($chapterLines -join "`n"),
    '',
    '# Lub zaimportuj w YouTube Studio → Rozdziały',
    ''
) | Set-Content $ChaptersFile -Encoding UTF8

Write-Host "Gotowe:"
Write-Host "  Wideo: $Out169"
Write-Host "  Rozdziały: $ChaptersFile"
Write-Host "  Czas łącznie: ~$([math]::Round($cursorSec, 1)) s"
