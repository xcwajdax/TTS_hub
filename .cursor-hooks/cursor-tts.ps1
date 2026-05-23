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
    if ($null -eq $raw) { $raw = '' }
    $result = @{ Payload = $null; Raw = $raw; ParseOk = $false }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $result
    }
    try {
        $result.Payload = $raw | ConvertFrom-Json -Depth 64
        $result.ParseOk = $true
    } catch {
        $result.ParseOk = $false
    }
    return $result
}

function Get-PayloadKeys {
    param($Payload)
    if ($null -eq $Payload) { return '' }
    try {
        return (($Payload.PSObject.Properties | ForEach-Object { $_.Name }) -join ',')
    } catch {
        return ''
    }
}

function Extract-TextBlocks {
    param($Value)
    if ($null -eq $Value) { return '' }
    if ($Value -is [string]) { return $Value.Trim() }
    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $parts = @()
        foreach ($item in $Value) {
            $t = Extract-TextBlocks $item
            if ($t) { $parts += $t }
        }
        if ($parts.Count -gt 0) { return ($parts -join "`n").Trim() }
        return ''
    }
    if ($Value.PSObject.Properties['text']) {
        return Extract-TextBlocks $Value.text
    }
    if ($Value.PSObject.Properties['content']) {
        return Extract-TextBlocks $Value.content
    }
    if ($Value.PSObject.Properties['message']) {
        return Extract-TextBlocks $Value.message
    }
    return ''
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
    foreach ($prop in 'conversation_id', 'conversationId', 'session_id', 'sessionId', 'conversation', 'thread_id', 'threadId') {
        $v = $Payload.PSObject.Properties[$prop]
        if ($v -and -not [string]::IsNullOrWhiteSpace([string]$v.Value)) {
            return [string]$v.Value
        }
    }
    return 'default'
}

function Get-TextFromPayload {
    param($Payload)
    if ($null -eq $Payload) { return '' }
    foreach ($prop in 'text', 'response', 'assistant_message', 'agent_message') {
        $v = $Payload.PSObject.Properties[$prop]
        if ($v -and $v.Value) {
            $t = Extract-TextBlocks $v.Value
            if ($t) { return $t }
        }
    }
    foreach ($prop in 'content', 'message') {
        $v = $Payload.PSObject.Properties[$prop]
        if ($v -and $v.Value) {
            $t = Extract-TextBlocks $v.Value
            if ($t) { return $t }
        }
    }
    return ''
}

function Resolve-TranscriptPath {
    param($Payload)
    if ($Payload) {
        foreach ($prop in 'transcript_path', 'agent_transcript_path') {
            $v = $Payload.PSObject.Properties[$prop]
            if ($v -and -not [string]::IsNullOrWhiteSpace([string]$v.Value)) {
                $p = [string]$v.Value
                if (Test-Path $p) { return $p }
            }
        }
    }
    if ($env:CURSOR_TRANSCRIPT_PATH -and (Test-Path $env:CURSOR_TRANSCRIPT_PATH)) {
        return $env:CURSOR_TRANSCRIPT_PATH
    }
    $convId = Get-ConversationId $Payload
    if ([string]::IsNullOrWhiteSpace($convId) -or $convId -in @('unknown', 'default')) {
        return $null
    }
    $root = Join-Path $env:USERPROFILE '.cursor\projects'
    if (-not (Test-Path $root)) { return $null }
    $pattern = Join-Path $root "*\agent-transcripts\$convId\$convId.jsonl"
    $hit = Get-Item -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
    return $null
}

function Get-TextFromTranscript {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) { return '' }
    $last = ''
    foreach ($line in [System.IO.File]::ReadLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $row = $line | ConvertFrom-Json -Depth 32
        } catch {
            continue
        }
        if ($row.role -ne 'assistant') { continue }
        $t = Extract-TextBlocks $row.message
        if ($t) { $last = $t }
    }
    return $last
}

function Get-CaptureFilePath {
    param([string]$ConvId)
    $safe = ([string]$ConvId) -replace '[^A-Za-z0-9_\-]', '_'
    if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'default' }
    return Join-Path $WorkDir ("{0}.txt" -f $safe)
}

function Find-LatestCaptureFile {
    $latest = Join-Path $WorkDir 'latest.txt'
    if (Test-Path $latest) { return $latest }
    $files = Get-ChildItem -Path $WorkDir -Filter '*.txt' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'latest.txt' } |
        Sort-Object LastWriteTime -Descending
    if ($files.Count -gt 0) { return $files[0].FullName }
    return $null
}

function Get-CursorConfig {
    try {
        return Invoke-RestMethod -Uri "$ApiBase/cursor/config" -TimeoutSec 2 -ErrorAction Stop
    } catch {
        return $null
    }
}

function Get-ActiveFilterPreset {
    param($Cfg)
    if (-not $Cfg) { return $null }
    $tf = $null
    if ($Cfg.PSObject.Properties['text_filters']) {
        $tf = $Cfg.text_filters
    }
    if (-not $tf -or -not $tf.presets) { return $null }
    $activeId = $tf.active_preset_id
    if ($activeId) {
        foreach ($p in $tf.presets) {
            if ($p.id -eq $activeId) { return $p }
        }
    }
    if ($tf.presets.Count -gt 0) { return $tf.presets[0] }
    return $null
}

function Apply-TextFilters {
    param(
        [string]$Text,
        $Preset
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    if (-not $Preset) { return $Text.Trim() }

    $out = $Text
    $builtins = $Preset.builtins
    if (-not $builtins) { $builtins = @{} }

    if ($builtins.strip_fenced_code) {
        $out = [regex]::Replace($out, '(?s)```.*?```', ' ')
    }
    if ($builtins.strip_inline_code) {
        $out = [regex]::Replace($out, '`[^`]*`', ' ')
    }
    if ($builtins.strip_blockquotes) {
        $out = [regex]::Replace($out, '(?m)^>\s?.*$', ' ')
    }

    if ($Preset.custom) {
        foreach ($rule in $Preset.custom) {
            if (-not $rule.enabled) { continue }
            $pat = [string]$rule.pattern
            if ([string]::IsNullOrWhiteSpace($pat)) { continue }
            $flags = if ($rule.flags) { [string]$rule.flags } else { 'g' }
            $repl = if ($null -ne $rule.replacement) { [string]$rule.replacement } else { '' }
            try {
                $re = New-Object System.Text.RegularExpressions.Regex $pat, $flags
                $out = $re.Replace($out, $repl)
            } catch {
                # skip invalid custom rules
            }
        }
    }

    $out = [regex]::Replace($out, '\s+', ' ')
    return $out.Trim()
}

function Extract-Summary {
    param(
        [string]$Text,
        [int]$MaxSentences = 10,
        [bool]$UseMarkers = $true,
        [bool]$SkipCodeStrip = $false
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }

    if ($UseMarkers) {
        $m = [regex]::Match($Text, '(?s)<!--\s*tts-summary\s*-->(.*?)<!--\s*/tts-summary\s*-->')
        if ($m.Success) {
            return ($m.Groups[1].Value).Trim()
        }
    }

    $stripped = $Text
    if (-not $SkipCodeStrip) {
        $stripped = [regex]::Replace($stripped, '(?s)```.*?```', ' ')
        $stripped = [regex]::Replace($stripped, '`[^`]*`', ' ')
    }
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
    $stdin = Read-StdinJson
    $payload = $stdin.Payload
    $convId = Get-ConversationId $payload
    $source = 'stdin'
    $text = Get-TextFromPayload $payload
    if ([string]::IsNullOrWhiteSpace($text)) {
        $transcript = Resolve-TranscriptPath $payload
        if ($transcript) {
            $text = Get-TextFromTranscript $transcript
            if ($text) { $source = 'transcript' }
        }
    }
    if ([string]::IsNullOrWhiteSpace($text)) {
        $stdinLen = if ($stdin.Raw) { $stdin.Raw.Length } else { 0 }
        $keys = Get-PayloadKeys $payload
        $parse = if ($stdin.ParseOk) { 'ok' } else { 'fail' }
        Write-HookLog -Phase 'capture' -ConvId $convId -Status 'skip' -DurationMs $sw.ElapsedMilliseconds `
            -Reason "empty_text,stdin=${stdinLen},parse=${parse},keys=${keys}"
        return
    }
    $file = Get-CaptureFilePath $convId
    Write-AtomicFile -Path $file -Content $text
    Write-AtomicFile -Path (Join-Path $WorkDir 'latest.txt') -Content $text
    Write-HookLog -Phase 'capture' -ConvId $convId -Status 'ok' -DurationMs $sw.ElapsedMilliseconds `
        -Reason "$($text.Length)chars,$source"
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

    $filterPreset = Get-ActiveFilterPreset $cfg
    $filteredText = Apply-TextFilters -Text $rawText -Preset $filterPreset
    $skipCodeStrip = $false
    if ($filterPreset -and $filterPreset.builtins) {
        $b = $filterPreset.builtins
        $skipCodeStrip = [bool]$b.strip_fenced_code -and [bool]$b.strip_inline_code
    }
    $textForSummary = if (-not [string]::IsNullOrWhiteSpace($filteredText)) { $filteredText } else { $rawText }

    $summary = Extract-Summary -Text $textForSummary -MaxSentences $maxS -UseMarkers $useMarkers -SkipCodeStrip $skipCodeStrip
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

    $fmt = 'wav'
    if ($cfg.PSObject.Properties['format'] -and $cfg.format) {
        $fmt = [string]$cfg.format
    } elseif ($cfg.PSObject.Properties['provider'] -and $cfg.provider -eq 'minimax') {
        $fmt = 'mp3'
    }
    $body = @{
        text             = $rawText
        summary_text     = $summary
        model            = $cfg.model
        voice            = $cfg.voice
        style            = $cfg.style
        format           = $fmt
        autoplay         = $true
        source           = 'cursor'
        conversation_id  = $convId
    }
    if ($cfg.PSObject.Properties['provider'] -and $cfg.provider) {
        $body['provider'] = [string]$cfg.provider
    }
    if ($cfg.provider -eq 'voicebox') {
        if ($cfg.profile_id) { $body['profile_id'] = [string]$cfg.profile_id }
        if ($cfg.language) { $body['language'] = [string]$cfg.language }
        if ($cfg.engine) { $body['engine'] = [string]$cfg.engine }
    }
    if ($cfg.provider -eq 'minimax') {
        if ($cfg.minimax_speed) { $body['minimax_speed'] = [double]$cfg.minimax_speed }
        if ($cfg.minimax_vol) { $body['minimax_vol'] = [double]$cfg.minimax_vol }
        if ($null -ne $cfg.minimax_pitch) { $body['minimax_pitch'] = [int]$cfg.minimax_pitch }
    }
    $bodyJson = $body | ConvertTo-Json -Depth 8 -Compress

    # Fire-and-forget: spawn detached pwsh so the hook returns immediately.
    $bodyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bodyJson))
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
