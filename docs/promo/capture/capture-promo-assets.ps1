#requires -Version 7.0
<#
  Fallback capture bez Playwright — kopiuje poster i tworzy storyboard PNG (ffmpeg).
  Do pełnych zrzutów UI użyj capture-promo-assets.mjs (npm run dev + playwright).

  pwsh -File docs/promo/capture/capture-promo-assets.ps1
#>
$ErrorActionPreference = 'Stop'
$PromoRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path (Split-Path $PromoRoot -Parent) -Parent
$SitePoster = Join-Path (Split-Path $RepoRoot -Parent) 'TTS_hub_site' 'assets' 'promo-poster.svg'

$socialDir = Join-Path $PromoRoot 'storyboard/social'
$fullDir = Join-Path $PromoRoot 'storyboard/full'
New-Item -ItemType Directory -Force -Path $socialDir, $fullDir | Out-Null

function New-BgPng {
    param([string]$Path, [int]$W, [int]$H)
    & ffmpeg -y -f lavfi -i "color=c=0x0f1115:s=${W}x${H}:d=1" -frames:v 1 $Path 2>$null
}

$maps = @(
    @{ dir = $socialDir; files = @('00-hook.png','01-tworca.png','02-developer.png','03-cursor.png','04-cta.png'); w = 1080; h = 1920 }
    @{ dir = $fullDir; files = @('00-intro.png','01-tworca.png','02-developer.png','03-cursor.png','04-cta.png'); w = 1920; h = 1080 }
)

foreach ($m in $maps) {
    foreach ($f in $m.files) {
        $out = Join-Path $m.dir $f
        New-BgPng -Path $out -W $m.w -H $m.h
        Write-Host "  -> $out"
    }
}

Write-Host 'Storyboard placeholders gotowe. Podmień PNG po nagraniu OBS (CHECKLIST.md).'
