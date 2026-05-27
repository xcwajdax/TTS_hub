#requires -Version 5.1
$ErrorActionPreference = 'Stop'

$DevDir = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $DevDir '..\..')).Path
$IconPath = Join-Path $RepoRoot 'src-tauri\icons\icon.ico'

if (-not (Test-Path $IconPath)) {
    throw "Brak ikony: $IconPath"
}

function New-DevShortcut {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$BatFile
    )

    $targetBat = Join-Path $DevDir $BatFile
    if (-not (Test-Path $targetBat)) {
        throw "Brak pliku BAT: $targetBat"
    }

    $shortcutPath = Join-Path $DevDir "$Name.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetBat
    $shortcut.WorkingDirectory = $DevDir
    $shortcut.IconLocation = "$IconPath,0"
    $shortcut.Description = $Name
    $shortcut.Save()

    Write-Host "Utworzono: $shortcutPath"
}

New-DevShortcut -Name 'Uruchom TTS Hub (dev)' -BatFile 'tts-hub-dev-start.bat'
New-DevShortcut -Name 'Zatrzymaj TTS Hub (dev)' -BatFile 'tts-hub-dev-stop.bat'
