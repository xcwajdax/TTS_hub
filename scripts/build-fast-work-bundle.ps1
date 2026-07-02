# Builds Fast Work binary and copies release artifacts into src-tauri/resources/fast-work/
# for bundling with the main TTS Hub installer (export portable from profile menu).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Building Fast Work frontend..."
npm run build:fast-work
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Building Fast Work Tauri binary..."
npm run tauri build -- --config src-tauri/tauri.fast-work.conf.json -- --no-default-features --features fast-work
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$bundleRoot = Join-Path $Root "src-tauri\target\release\bundle"
$dest = Join-Path $Root "src-tauri\resources\fast-work"

if (-not (Test-Path $bundleRoot)) {
    Write-Error "Bundle folder not found: $bundleRoot"
}

# Prefer NSIS/portable folder layout on Windows
$candidates = @(
    (Join-Path $bundleRoot "nsis\TTS Hub Fast Work"),
    (Join-Path $bundleRoot "msi\TTS Hub Fast Work"),
    (Join-Path $bundleRoot "appimage\TTS Hub Fast Work.AppDir"),
    (Join-Path $bundleRoot "macos\TTS Hub Fast Work.app")
)

$source = $null
foreach ($c in $candidates) {
    if (Test-Path $c) {
        $source = $c
        break
    }
}

if (-not $source) {
    # Fallback: copy exe + adjacent dlls from target/release
    $exe = Join-Path $Root "src-tauri\target\release\tts-hub-fast-work.exe"
    if (-not (Test-Path $exe)) {
        $exe = Join-Path $Root "src-tauri\target\release\TTS Hub Fast Work.exe"
    }
    if (-not (Test-Path $exe)) {
        $exe = Get-ChildItem -Path (Join-Path $Root "src-tauri\target\release") -Filter "*Fast Work*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $exe -or -not (Test-Path $exe)) {
        Write-Error "Could not locate Fast Work release exe under src-tauri/target/release"
    }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path $exe -Destination (Join-Path $dest (Split-Path -Leaf $exe)) -Force
    Write-Host "Copied $exe -> $dest"
    exit 0
}

Write-Host "Copying bundle from $source -> $dest"
if (Test-Path $dest) {
    Get-ChildItem $dest -Exclude "README.md" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

Copy-Item -Path (Join-Path $source "*") -Destination $dest -Recurse -Force
Write-Host "Fast Work bundle ready in $dest"
