#!/usr/bin/env node

/**
 * On Windows, cargo cannot overwrite src-tauri/target/debug/tts-hub.exe while a
 * leftover `tauri dev` instance is still running (os error 5). Kill only that
 * debug binary — never the installed TTS Hub from AppData.
 */

import { execFileSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

if (process.platform !== "win32") {
  process.exit(0);
}

const debugExe = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src-tauri",
  "target",
  "debug",
  "tts-hub.exe",
);

const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$debugExe = ${JSON.stringify(debugExe)}
$debugNorm = $debugExe.ToLowerInvariant()
$killed = $false

function Stop-CargoAncestors([int]$ProcessId) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
  while ($current -and $current.Name -match '^cargo(\\.exe)?$') {
    $parentId = $current.ParentProcessId
    Stop-Process -Id $current.ProcessId -Force
    $script:killed = $true
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId"
  }
}

Get-CimInstance Win32_Process -Filter "Name='tts-hub.exe'" | ForEach-Object {
  $path = [string]$_.ExecutablePath
  $cmd = [string]$_.CommandLine
  $pathNorm = $path.ToLowerInvariant()
  $isInstalled = $pathNorm -like '*\\appdata\\local\\tts hub\\tts-hub.exe'
  $isDebug = (-not $isInstalled) -and (
    $pathNorm -eq $debugNorm -or
    $pathNorm.EndsWith('\\src-tauri\\target\\debug\\tts-hub.exe') -or
    $cmd -match 'target\\\\debug\\\\tts-hub\\.exe'
  )
  if (-not $isDebug) { return }
  $parentId = $_.ParentProcessId
  Stop-Process -Id $_.ProcessId -Force
  $killed = $true
  Stop-CargoAncestors $parentId
}

if ($killed) {
  Start-Sleep -Milliseconds 400
  Write-Host "Unlocked leftover debug tts-hub.exe"
}
`;

try {
  execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", ps], {
    stdio: "inherit",
  });
} catch {
  // Fail-open: a leftover lock still surfaces as cargo os error 5.
}
