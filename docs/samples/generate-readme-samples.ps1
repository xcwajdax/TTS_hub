#requires -Version 7.0
<#
  Generuje próbki README (ten sam tekst, różne głosy) przez TTS Hub API.
  Wymaga: aplikacja uruchomiona, http://127.0.0.1:8765
#>
$ErrorActionPreference = 'Stop'
$ApiBase = 'http://127.0.0.1:8765'
$OutDir = $PSScriptRoot
$DemoText = @'
TTS Hub zamienia tekst na mowę na Twoim komputerze. Słuchasz właśnie tej samej próbki w kilku głosach. Wybierz provider i głos w ustawieniach albo przez lokalne API.
'@.Trim()

$samples = @(
    @{ file = 'minimax-polish-female.mp3'; provider = 'minimax'; model = 'speech-2.8-hd'; voice = 'Polish_female_1_sample1'; language = 'pl'; format = 'mp3' }
    @{ file = 'minimax-polish-male.mp3'; provider = 'minimax'; model = 'speech-2.8-hd'; voice = 'Polish_male_1_sample4'; language = 'pl'; format = 'mp3' }
    @{ file = 'google-kore.wav'; provider = 'google'; model = 'gemini-2.5-flash-preview-tts'; voice = 'Kore'; style = 'Powiedz spokojnie po polsku:'; format = 'wav' }
    @{ file = 'google-charon.wav'; provider = 'google'; model = 'gemini-2.5-flash-preview-tts'; voice = 'Charon'; style = 'Powiedz spokojnie po polsku:'; format = 'wav' }
)

foreach ($s in $samples) {
    Write-Host "Generating $($s.file) ..."
    $body = @{
        text     = $DemoText
        provider = $s.provider
        model    = $s.model
        voice    = $s.voice
        format   = $s.format
        source   = 'http'
    }
    if ($s.language) { $body['language'] = $s.language }
    if ($s.style) { $body['style'] = $s.style }
    $json = $body | ConvertTo-Json -Compress
    $gen = Invoke-RestMethod -Uri "$ApiBase/generate?wait=true" -Method Post -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 120
    if ($gen.status -ne 'done') {
        throw "Job $($gen.id) ended as $($gen.status): $($gen.error)"
    }
    $src = $gen.file_path
    if (-not (Test-Path $src)) { throw "Missing file: $src" }
    $dest = Join-Path $OutDir $s.file
    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "  -> $dest"
}

Write-Host 'Done.'
