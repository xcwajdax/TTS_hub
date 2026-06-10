#requires -Version 7.0
<#
  Instrukcja publikacji filmu promo (YouTube + landing).
  Nie uploaduje automatycznie — wymaga ręcznego wgrania lub YouTube API key.

  Uruchomienie:
    pwsh -File docs/promo/scripts/publish-promo.ps1
#>
$ErrorActionPreference = 'Stop'
$PromoRoot = Split-Path $PSScriptRoot -Parent
$VideoDir = Join-Path $PromoRoot 'video'
$ConfigPath = Join-Path $VideoDir 'publish-config.json'
$RepoRoot = Split-Path (Split-Path $PromoRoot -Parent) -Parent
$SiteJs = Join-Path (Split-Path $RepoRoot -Parent) 'TTS_hub_site' 'js' 'promo-video.js'

$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host '=== TTS Hub — publikacja filmu promo ===' -ForegroundColor Cyan
Write-Host ''

$files = @(
    (Join-Path $VideoDir 'promo-full-16x9.mp4')
    (Join-Path $VideoDir 'promo-social-9x16.mp4')
    (Join-Path $VideoDir 'promo-social-1x1.mp4')
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $size = [math]::Round((Get-Item $f).Length / 1MB, 2)
        Write-Host "  OK  $f ($size MB)"
    } else {
        Write-Host "  --  brak: $f" -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Rozdziały YouTube:' -ForegroundColor Cyan
Get-Content (Join-Path $VideoDir 'chapters-youtube.txt') | Write-Host

Write-Host ''
Write-Host @'
Kroki ręczne:
  1. Wgraj promo-full-16x9.mp4 na YouTube
  2. Wgraj promo-social-9x16.mp4 jako Short
  3. Skopiuj rozdziały z video/chapters-youtube.txt do opisu
  4. Ustaw full_video_id i short_video_id w video/publish-config.json
  5. Zaktualizuj TTS_hub_site/js/promo-video.js (youtubeFullId, youtubeShortId)
  6. Opublikuj landing z sekcją #film
'@

if (Test-Path $SiteJs) {
    Write-Host "Landing JS: $SiteJs"
}

Write-Host ''
Write-Host 'Opis YouTube — patrz docs/promo/scripts/promo-narration.md (sekcja Opis YouTube)'
