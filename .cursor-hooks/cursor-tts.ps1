#requires -Version 7.0
<#
.SYNOPSIS
  Cursor hook bridging Cursor Agent responses to TTS Hub.

.DESCRIPTION
  Two phases:
    - capture: persists raw agent response per conversation_id (afterAgentResponse hook)
    - speak:   on stop/completed, extracts a Polish summary and asks TTS Hub to synthesize
               and autoplay it (POST /generate).

  Designed to fail-open: if TTS Hub HTTP API is unreachable or any error occurs,
  the hook exits 0 so Cursor never blocks.

.PARAMETER Phase
  'capture' or 'speak'.
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('capture', 'speak')]
    [string]$Phase
)

# Force UTF-8 stdin so polish characters survive (PS 5.1 corrupts; PS 7+ honors this).
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$ApiBase   = 'http://127.0.0.1:8765'
$WorkDir   = Join-Path $env:TEMP 'cursor-tts'
$LogFile   = Join-Path $WorkDir 'cursor-tts.log'
$LogMaxKB  = 1024

if (-not (Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

function Write-HookLog {
    param(
        [string]$Phase,
        [string]$ConvId = '',
        [string]$Status = 'ok',
        [int]$DurationMs = 0,
        [string]$Reason = ''
    )
    try {
        if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length / 1KB) -gt $LogMaxKB) {
            $bak = "$LogFile.1"
            if (Test-Path $bak) { Remove-Item $bak -Force -ErrorAction SilentlyContinue }
            Move-Item -Path $LogFile -Destination $bak -Force -ErrorAction SilentlyContinue
        }
        $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
        $convShort = if ($ConvId.Length -gt 12) { $ConvId.Substring(0, 12) } else { $ConvId }
        $line = "$ts | $Phase | $convShort | $Status | ${DurationMs}ms | $Reason"
        Add-Content -Path $LogFile -Value $line -Encoding utf8
    } catch {
        # Swallow logging errors silently
    }
}

function Read-StdinJson {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }
    try { return $raw | ConvertFrom-Json } catch { return $null }
}

function Write-AtomicFile {
    param([string]$Path, [string]$Content)
    $tmp = "$Path.tmp"
    Set-Content -Path $tmp -Value $Content -Encoding utf8 -NoNewline
    Move-Item -Path $tmp -Destination $Path -Force
}

function Get-ConversationId {
    param($Payload)
    if ($null -eq $Payload) { return 'unknown' }
    foreach ($prop in 'conversation_id', 'conversationId', 'conversation', 'thread_id', 'threadId') {
        $v = $Payload.PSObject.Properties[$prop]
        if ($v -and -not [string]::IsNullOrWhiteSpace($v.Value)) {
            return [string]$v.Value
        }
    }
    return 'default'
}

function Get-TextFromPayload {
    param($Payload)
    if ($null -eq $Payload) { return '' }
    foreach ($prop in 'text', 'response', 'content', 'message') {
        $v = $Payload.PSObject.Properties[$prop]
        if ($v -and $v.Value) {
            return [string]$v.Value
        }
    }
    return ''
}

function Get-CursorConfig {
    try {
        return Invoke-RestMethod -Uri "$ApiBase/cursor/config" -TimeoutSec 2 -ErrorAction Stop
    } catch {
        return $null
    }
}

function Extract-Summary {
    param(
        [string]$Text,
        [int]$MaxSentences = 10,
        [bool]$UseMarkers = $true
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }

    if ($UseMarkers) {
        $m = [regex]::Match($Text, '(?s)<!--\s*tts-summary\s*-->(.*?)<!--\s*/tts-summary\s*-->')
        if ($m.Success) {
            return ($m.Groups[1].Value).Trim()
        }
    }

    # Strip fenced code blocks (```...```).
    $stripped = [regex]::Replace($Text, '(?s)```.*?```', ' ')
    # Strip inline backticks `code`.
    $stripped = [regex]::Replace($stripped, '`[^`]*`', ' ')
    # Strip markdown headings markers.
    $stripped = [regex]::Replace($stripped, '(?m)^#+\s*', '')

    # Take last non-empty paragraph.
    $paras = $stripped -split "(\r?\n){2,}" | Where-Object { $_ -and $_.Trim() }
    if ($paras.Count -eq 0) { return '' }
    $candidate = ($paras[-1]).Trim()

    # Sentence split with simple abbreviation guard for Polish.
    $abbrev = @('np\.','tj\.','tzn\.','dr\.','itp\.','itd\.','m\.in\.','dot\.','tzw\.','prof\.','mgr\.','św\.','św.')
    $placeholder = [char]0xE000
    foreach ($a in $abbrev) {
        $candidate = [regex]::Replace($candidate, $a, { param($m) $m.Value -replace '\.', $placeholder })
    }
    $sentences = [regex]::Split($candidate, '(?<=[\.\!\?])\s+') |
        ForEach-Object { ($_ -replace $placeholder, '.').Trim() } |
        Where-Object { $_ }
    if ($sentences.Count -eq 0) { return $candidate.Trim() }
    if ($sentences.Count -gt $MaxSentences) {
        $sentences = $sentences[-$MaxSentences..-1]
    }
    return ($sentences -join ' ').Trim()
}

function Get-Sha1 {
    param([string]$Value)
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
        return ($sha1.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
    } finally {
        $sha1.Dispose()
    }
}

function Phase-Capture {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $payload = Read-StdinJson
    $convId = Get-ConversationId $payload
    $text = Get-TextFromPayload $payload
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-HookLog -Phase 'capture' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'empty_text'
        return
    }
    $file = Join-Path $WorkDir ("{0}.txt" -f ($convId -replace '[^A-Za-z0-9_\-]', '_'))
    Write-AtomicFile -Path $file -Content $text
    Write-HookLog -Phase 'capture' -ConvId $convId -Status 'ok' -DurationMs $sw.ElapsedMilliseconds -Reason "$($text.Length)chars"
}

function Phase-Speak {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $payload = Read-StdinJson
    $convId = Get-ConversationId $payload

    $status = ''
    if ($payload -and $payload.PSObject.Properties['status']) {
        $status = [string]$payload.status
    }
    if ($status -and $status -ne 'completed') {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason "status=$status"
        return
    }

    # Load captured text (preferred) or fallback to payload text.
    $file = Join-Path $WorkDir ("{0}.txt" -f ($convId -replace '[^A-Za-z0-9_\-]', '_'))
    $rawText = ''
    if (Test-Path $file) {
        $rawText = Get-Content -Path $file -Raw -Encoding utf8
    } else {
        $rawText = Get-TextFromPayload $payload
    }
    if ([string]::IsNullOrWhiteSpace($rawText)) {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'no_text'
        return
    }

    $cfg = Get-CursorConfig
    if (-not $cfg) {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'api_down'
        return
    }
    if (-not $cfg.enabled) {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'disabled'
        return
    }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($cfg.dnd_until_ts -and ([int64]$cfg.dnd_until_ts) -gt $now) {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'dnd'
        return
    }

    $maxS = if ($cfg.max_sentences) { [int]$cfg.max_sentences } else { 10 }
    $useMarkers = $true
    if ($cfg.PSObject.Properties['use_summary_markers']) {
        $useMarkers = [bool]$cfg.use_summary_markers
    }

    $summary = Extract-Summary -Text $rawText -MaxSentences $maxS -UseMarkers $useMarkers
    if ([string]::IsNullOrWhiteSpace($summary)) {
        Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'empty_summary'
        return
    }

    # Dedupe: skip if identical to last summary for this conversation.
    $dedupeFile = Join-Path $WorkDir ("{0}.last" -f ($convId -replace '[^A-Za-z0-9_\-]', '_'))
    $hash = Get-Sha1 $summary
    if (Test-Path $dedupeFile) {
        $prev = (Get-Content -Path $dedupeFile -Raw -Encoding utf8).Trim()
        if ($prev -eq $hash) {
            Write-HookLog -Phase 'speak' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds -Reason 'duplicate'
            return
        }
    }
    Write-AtomicFile -Path $dedupeFile -Content $hash

    $body = @{
        text             = $rawText
        summary_text     = $summary
        model            = $cfg.model
        voice            = $cfg.voice
        style            = $cfg.style
        format           = 'wav'
        autoplay         = $true
        source           = 'cursor'
        conversation_id  = $convId
    } | ConvertTo-Json -Depth 8 -Compress

    # Fire-and-forget: spawn detached pwsh so the hook returns immediately.
    $bodyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($body))
    $inner = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$bodyB64'))
try { Invoke-RestMethod -Uri '$ApiBase/generate' -Method Post -ContentType 'application/json; charset=utf-8' -Body `$json -TimeoutSec 60 | Out-Null } catch { }
"@
    Start-Process -FilePath 'pwsh.exe' `
        -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command', $inner) `
        -WindowStyle Hidden | Out-Null

    Write-HookLog -Phase 'speak' -ConvId $convId -Status 'ok' -DurationMs $sw.ElapsedMilliseconds -Reason "$($summary.Length)chars,dispatched"
}

try {
    switch ($Phase) {
        'capture' { Phase-Capture }
        'speak'   { Phase-Speak }
    }
} catch {
    Write-HookLog -Phase $Phase -Status 'error' -Reason ($_.Exception.Message -replace '\s+', ' ')
}

exit 0
