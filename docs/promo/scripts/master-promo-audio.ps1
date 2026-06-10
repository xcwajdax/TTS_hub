#requires -Version 7.0
<#
  Normalizuje głośność plików promo do ~-14 LUFS (ffmpeg loudnorm).
  Wymaga: ffmpeg w PATH.

  Uruchomienie:
    pwsh -File docs/promo/scripts/master-promo-audio.ps1
#>
param(
    [ValidateSet('all', 'social', 'full')]
    [string]$Variant = 'all'
)

$ErrorActionPreference = 'Stop'
$PromoRoot = Split-Path $PSScriptRoot -Parent

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw 'ffmpeg nie znaleziony w PATH. Zainstaluj ffmpeg i powtórz.'
}

function Master-File {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Warning "Pominięto (brak pliku): $Path"
        return
    }

    $dir = Split-Path $Path -Parent
    $name = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    $ext = [System.IO.Path]::GetExtension($Path)
    $tmp = Join-Path $dir "$name.master$ext"

    Write-Host "Mastering: $Path"
    $args = @(
        '-y', '-i', $Path,
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
        '-ar', '48000',
        $tmp
    )
    & ffmpeg @args 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $Path" }

    Move-Item -Force $tmp $Path
    Write-Host "  -> OK (-14 LUFS target)"
}

$variants = switch ($Variant) {
    'social' { @('social') }
    'full' { @('full') }
    default { @('social', 'full') }
}

foreach ($v in $variants) {
    $dir = Join-Path $PromoRoot "audio/$v"
    if (-not (Test-Path $dir)) {
        Write-Warning "Brak katalogu: $dir (najpierw generate-promo-audio.ps1)"
        continue
    }
    Get-ChildItem $dir -Filter '*.wav' | ForEach-Object { Master-File $_.FullName }
}

Write-Host 'Done.'
