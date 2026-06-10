#requires -Version 7.0
<#
  Komendy demo API do nagrania w terminalu (Developer segment).
  Uruchom z działającym TTS Hub.
#>
$Api = 'http://127.0.0.1:8765'

Write-Host '=== TTS Hub API demo (nagraj ten terminal) ===' -ForegroundColor Cyan
Write-Host "curl $Api/health`n"
Invoke-RestMethod "$Api/health" | ConvertTo-Json

Write-Host "`ncurl -X POST $Api/generate ...`n"
$body = @{
    text     = 'TTS Hub — demo API dla filmu promocyjnego.'
    provider = 'google'
    model    = 'gemini-2.5-flash-preview-tts'
    voice    = 'Charon'
    format   = 'wav'
    source   = 'promo'
} | ConvertTo-Json -Compress

Write-Host $body
$gen = Invoke-RestMethod -Uri "$Api/generate?wait=true" -Method Post `
    -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 120
$gen | ConvertTo-Json -Depth 4
