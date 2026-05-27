#requires -Version 7.0
<#
.SYNOPSIS
  Re-creates the Robert Makłowicz MiniMax voice clone from maklowicz_28s.mp3.

.EXAMPLE
  pwsh -File scripts/dev/clone-maklowicz.ps1
#>
param(
    [string]$SourcePath = "",
    [string]$VoiceId = "robert_maklowicz",
    [string]$Name = "Robert Maklowicz",
    [string]$Model = "minimax:speech-2.8-hd",
    [string]$ApiBase = "http://127.0.0.1:8765"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Read-EnvKey {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    foreach ($line in Get-Content -LiteralPath $Path -Encoding utf8) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+)\s*$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Invoke-MinimaxCloneDirect {
    param(
        [string]$ApiKey,
        [string]$SourcePath,
        [string]$VoiceId,
        [string]$Model,
        [string]$PreviewText
    )
    $modelId = $Model -replace '^minimax:', ''
    $fileName = [System.IO.Path]::GetFileName($SourcePath)
    $bytes = [System.IO.File]::ReadAllBytes($SourcePath)

    $uploadUri = "https://api.minimax.io/v1/files/upload"
    $boundary = [Guid]::NewGuid().ToString()
    $crlf = "`r`n"
    $bodyStream = [System.IO.MemoryStream]::new()
    $writer = [System.IO.StreamWriter]::new($bodyStream, [System.Text.Encoding]::UTF8)
    $writer.NewLine = "`r`n"
    $writer.Write("--$boundary")
    $writer.WriteLine($crlf + 'Content-Disposition: form-data; name="purpose"' + $crlf)
    $writer.WriteLine("voice_clone")
    $writer.Write("--$boundary")
    $writer.WriteLine($crlf + "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"" + $crlf)
    $writer.WriteLine("Content-Type: audio/mpeg" + $crlf)
    $writer.Flush()
    $bodyStream.Write($bytes, 0, $bytes.Length)
    $writer.Write($crlf)
    $writer.Write("--$boundary--")
    $writer.Flush()
    $uploadBody = $bodyStream.ToArray()
    $writer.Dispose()
    $bodyStream.Dispose()

    $upload = Invoke-RestMethod -Uri $uploadUri -Method Post `
        -Headers @{ Authorization = "Bearer $ApiKey" } `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $uploadBody -TimeoutSec 120
    $fileId = $upload.file.file_id
    if (-not $fileId) { throw "Brak file_id w odpowiedzi upload" }

    $cloneBody = @{
        file_id  = $fileId
        voice_id = $VoiceId
        text     = $PreviewText
        model    = $modelId
    } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "https://api.minimax.io/v1/voice_clone" -Method Post `
        -Headers @{
            Authorization  = "Bearer $ApiKey"
            "Content-Type" = "application/json; charset=utf-8"
        } `
        -Body $cloneBody -TimeoutSec 600 | Out-Null
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if (-not $SourcePath) {
    $SourcePath = Join-Path $RepoRoot "maklowicz_28s.mp3"
}
if (-not (Test-Path -LiteralPath $SourcePath)) {
    $alt = Join-Path $RepoRoot "maklowicz_raw.mp3"
    if (Test-Path -LiteralPath $alt) {
        $SourcePath = $alt
        Write-Host "Używam: maklowicz_raw.mp3"
    } else {
        throw "Brak maklowicz_28s.mp3 / maklowicz_raw.mp3 w $RepoRoot"
    }
}
$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$preview = "Szanowni państwo, witam w kolejnym odcinku kulinarnej podróży."

Write-Host "Klonowanie: $Name ($VoiceId)"
Write-Host "Źródło: $SourcePath"
Write-Host "Model: $Model"

$hubBody = @{
    source_path  = $SourcePath
    voice_id     = $VoiceId
    name         = $Name
    model        = $Model
    preview_text = $preview
} | ConvertTo-Json -Compress

$hubUp = $false
try {
    $health = Invoke-RestMethod -Uri "$ApiBase/health" -TimeoutSec 3
    $hubUp = [bool]$health.ok
} catch { $hubUp = $false }

if ($hubUp) {
    try {
        $result = Invoke-RestMethod -Uri "$ApiBase/minimax/clone-voice" -Method Post `
            -ContentType "application/json; charset=utf-8" -Body $hubBody -TimeoutSec 600
        Write-Host "Gotowe (TTS Hub): voice_id=$($result.voice_id)"
        exit 0
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -ne 404) {
            $msg = $_.ErrorDetails.Message
            if (-not $msg) { $msg = $_.Exception.Message }
            throw "TTS Hub clone failed: $msg"
        }
        Write-Host "Endpoint /minimax/clone-voice niedostępny — zrestartuj dev lub fallback MiniMax API…"
    }
}

$envPath = Join-Path $RepoRoot "studios.env"
$apiKey = Read-EnvKey -Path $envPath -Key "MINIMAX_API_KEY"
if (-not $apiKey) {
    throw @"
Brak MINIMAX_API_KEY w studios.env (fallback API).

Zrób klon w aplikacji TTS Hub:
  1. Zrestartuj dev (tts-hub-dev-start.bat) po aktualizacji kodu.
  2. MiniMax → „Stwórz głos” → plik: maklowicz_28s.mp3
  3. voice_id: $VoiceId, nazwa: $Name, model: Speech 2.8 HD
  4. „Synchronizuj głosy z API” → wybierz głos w Integracji Cursor.
"@
}

Write-Host "Klonowanie bezpośrednio przez MiniMax API…"
Invoke-MinimaxCloneDirect -ApiKey $apiKey -SourcePath $SourcePath -VoiceId $VoiceId -Model $Model -PreviewText $preview
Write-Host "Gotowe na koncie MiniMax: $VoiceId"
Write-Host "W TTS Hub: Synchronizuj głosy z API, wybierz „$Name”, Integracja Cursor → ten sam głos."

if ($hubUp) {
    try {
        Invoke-RestMethod -Uri "$ApiBase/minimax/sync-voices" -Method Post -TimeoutSec 60 | Out-Null
        Write-Host "Lista głosów zsynchronizowana w aplikacji."
    } catch {
        Write-Host "Kliknij ręcznie: Synchronizuj głosy z API"
    }
}
