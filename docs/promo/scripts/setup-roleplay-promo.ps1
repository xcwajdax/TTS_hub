#requires -Version 7.0
<#
  Importuje profile głosów promo i zakłada projekt Roleplay w SQLite.
  Wymaga: TTS Hub ZAMKNIĘTY (pliki nie są blokowane).

  Uruchomienie:
    pwsh -File docs/promo/scripts/setup-roleplay-promo.ps1
#>
$ErrorActionPreference = 'Stop'

$Root = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$PromoDir = Join-Path $Root 'docs/promo'
$ProfilesFile = Join-Path $PromoDir 'roleplay/voice-profiles.json'
$ProjectFile = Join-Path $PromoDir 'roleplay/promo-project.json'

$AppDataRoot = Join-Path $env:APPDATA 'TTS_hub'
$SettingsPath = Join-Path $AppDataRoot 'settings.json'
$DbPath = Join-Path $AppDataRoot 'history.db'

if (-not (Test-Path $ProfilesFile)) { throw "Brak pliku: $ProfilesFile" }
if (-not (Test-Path $ProjectFile)) { throw "Brak pliku: $ProjectFile" }

function Merge-VoiceProfiles {
    param([string]$SettingsPath, [object[]]$NewProfiles)

    $settings = if (Test-Path $SettingsPath) {
        Get-Content $SettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } else {
        [PSCustomObject]@{ voice_profiles = @() }
    }

    if ($null -eq $settings.voice_profiles) {
        $settings | Add-Member -NotePropertyName voice_profiles -NotePropertyValue @()
    }

    $existing = @($settings.voice_profiles)
    $ids = [System.Collections.Generic.HashSet[string]]::new([string[]]($existing | ForEach-Object { $_.id }))

    $added = 0
    foreach ($p in $NewProfiles) {
        if ($ids.Add($p.id)) {
            $existing += $p
            $added++
        }
    }

    $settings.voice_profiles = $existing
    $json = $settings | ConvertTo-Json -Depth 20 -Compress:$false
    New-Item -ItemType Directory -Force -Path (Split-Path $SettingsPath -Parent) | Out-Null
    [System.IO.File]::WriteAllText($SettingsPath, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "Profile głosów: dodano $added nowych → $SettingsPath"
}

$profileData = Get-Content $ProfilesFile -Raw -Encoding UTF8 | ConvertFrom-Json
Merge-VoiceProfiles -SettingsPath $SettingsPath -NewProfiles $profileData.profiles

$seedScript = Join-Path $PSScriptRoot 'setup-roleplay-promo.mjs'
if (-not (Test-Path $seedScript)) { throw "Brak: $seedScript" }

Write-Host "Seed projektu Roleplay → $DbPath"
node $seedScript --db $DbPath --project $ProjectFile

Write-Host @"

Gotowe. Następne kroki:
  1. Uruchom TTS Hub
  2. Roleplay → „Film promocyjny TTS Hub”
  3. Podsumowanie → Generuj wszystko

Alternatywa audio bez Roleplay:
  pwsh -File docs/promo/scripts/generate-promo-audio.ps1
"@
