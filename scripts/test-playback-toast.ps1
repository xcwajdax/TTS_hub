# Szybka weryfikacja Playback Toast — uruchom gdy TTS Hub gra audio w tle.
# Użycie: .\scripts\test-playback-toast.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== TTS Hub — test Playback Toast ===" -ForegroundColor Cyan
Write-Host ""

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 5
    if (-not $health.ok) { throw "API health failed" }
    Write-Host "[OK] API: http://127.0.0.1:8765" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] API niedostępne — uruchom: npm run tauri dev" -ForegroundColor Red
    exit 1
}

$proc = Get-Process -Name "tts-hub" -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "[OK] Proces tts-hub.exe (PID $($proc.Id))" -ForegroundColor Green
} else {
    Write-Host "[WARN] Brak procesu tts-hub.exe" -ForegroundColor Yellow
}

$history = Invoke-RestMethod -Uri "http://127.0.0.1:8765/history?scope=session" -TimeoutSec 15
$done = @($history | Where-Object { $_.status -eq "done" })
Write-Host "[OK] Historia sesji: $($history.Count) wpisów, $($done.Count) gotowych do odtwarzania" -ForegroundColor Green
Write-Host ""

Write-Host "Checklist (wykonaj w aplikacji):" -ForegroundColor Cyan
Write-Host "  1. Odtwórz dowolną generację z panelu historii (▶)"
Write-Host "  2. ZMINIMALIZUJ okno TTS Hub LUB alt-tab do innej aplikacji"
Write-Host "     → popup playback-toast w prawym dolnym rogu"
Write-Host "  3. Sprawdź: avatar profilu, etykietę źródła, aurę, czas"
Write-Host "  4. Pauza / wznów / restart (↺) / suwak głośności"
Write-Host "  5. Archiwizuj — przycisk znika, wpis w archiwum"
Write-Host "  6. Przypomnij → 5 min — audio stop, popup znika"
Write-Host "  7. Schowaj — popup nie wraca dla tej samej generacji"
Write-Host "  8. Przywróć focus na main — popup znika"
Write-Host ""
Write-Host "Tip: minimalizacja main działa tak samo jak alt-tab dla popupu." -ForegroundColor DarkGray
