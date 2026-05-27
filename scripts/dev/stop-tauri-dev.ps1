#requires -Version 5.1
$ErrorActionPreference = 'Stop'

$DevDir = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $DevDir '..\..')).Path
$RepoKey = $RepoRoot.ToLowerInvariant().Replace('\', '/')

function Test-ProjectCommandLine {
    param([string]$CommandLine)

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    $normalized = $CommandLine.ToLowerInvariant().Replace('\', '/')
    if ($normalized -notlike "*$RepoKey*") {
        return $false
    }

    return (
        $normalized -match 'tauri(\.exe)?(\s|$).*dev' -or
        $normalized -match 'npm(\.cmd)?(\s|$).*run(\s|$).*tauri(\s|$).*dev' -or
        $normalized -match 'vite(\.cmd)?(\s|$)' -or
        $normalized -match 'cargo(\.exe)?(\s|$).*run' -or
        $normalized -match 'tts-hub(\.exe)?'
    )
}

function Stop-PortListener {
    param([int]$Port)

    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    }
    catch {
        $pids = netstat -ano |
            Select-String ":$Port\s" |
            ForEach-Object {
                if ($_ -match '\sLISTENING\s+(\d+)\s*$') {
                    [int]$Matches[1]
                }
            } |
            Sort-Object -Unique
    }

    foreach ($procId in $pids) {
        if ($procId -le 0) { continue }
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

$stopped = $false

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { Test-ProjectCommandLine $_.CommandLine } |
    Sort-Object ProcessId -Descending |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

foreach ($name in @('tts-hub.exe')) {
    Get-Process -Name ($name -replace '\.exe$', '') -ErrorAction SilentlyContinue |
        ForEach-Object {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
}

foreach ($port in @(1420, 8765)) {
    $before = $null
    try {
        $before = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).Count
    }
    catch {
        $before = @(netstat -ano | Select-String ":$port\s").Count
    }

    if ($before -gt 0) {
        Stop-PortListener -Port $port
        $stopped = $true
    }
}

if (-not $stopped) {
    exit 1
}

exit 0
