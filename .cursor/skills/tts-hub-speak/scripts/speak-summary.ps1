#requires -Version 7.0
<#
.SYNOPSIS
  Sends a Polish summary to TTS Hub (POST /generate) for the Cursor tts-hub-speak skill.

.PARAMETER SummaryText
  Plain text to synthesize (content from <!-- tts-summary --> markers).

.PARAMETER ConversationId
  Optional metadata for TTS Hub history.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SummaryText,

    [string]$ConversationId = ''
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$SkillRoot = Split-Path $PSScriptRoot -Parent
$ConfigPath = Join-Path $SkillRoot 'config.json'
$ExamplePath = Join-Path $SkillRoot 'config.json.example'
$WorkDir = Join-Path $env:TEMP 'cursor-tts-skill'
$LogFile = Join-Path $WorkDir 'cursor-tts-skill.log'
$DedupeFile = Join-Path $WorkDir 'last-summary.sha1'
$DefaultMinimaxVoice = 'Polish_female_1_sample1'
$DefaultMinimaxLanguage = 'pl'

if (-not (Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

function Write-SkillLog {
    param([string]$Status, [string]$Reason = '')
    try {
        $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
        Add-Content -Path $LogFile -Value "$ts | $Status | $Reason" -Encoding utf8
    } catch { }
}

function Get-Sha1 {
    param([string]$Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = [System.Security.Cryptography.SHA1]::Create().ComputeHash($bytes)
    -join ($hash | ForEach-Object { $_.ToString('x2') })
}

function Read-LocalConfig {
    $path = if (Test-Path $ConfigPath) { $ConfigPath } elseif (Test-Path $ExamplePath) { $ExamplePath } else { $null }
    if (-not $path) { return $null }
    try {
        return Get-Content -Path $path -Raw -Encoding utf8 | ConvertFrom-Json -Depth 16
    } catch {
        return $null
    }
}

function Get-AppCursorConfig {
    param([string]$ApiBase)
    try {
        return Invoke-RestMethod -Uri "$ApiBase/cursor/config" -TimeoutSec 2 -ErrorAction Stop
    } catch {
        return $null
    }
}

function Get-PresetByKey {
    param($Local, [string]$Key)
    if (-not $Local.presets) { return $null }
    if (-not $Local.presets.PSObject.Properties[$Key]) { return $null }
    return $Local.presets.$Key
}

function Apply-LocalPreset {
    param($Preset)
    $provider = if ($Preset.provider) { [string]$Preset.provider } else { 'minimax' }
    $model = if ($Preset.model) { [string]$Preset.model } else { 'speech-2.8-hd' }
    $voice = if ($Preset.voice) { [string]$Preset.voice } else { $DefaultMinimaxVoice }
    $style = $null
    if ($Preset.PSObject.Properties['style'] -and $Preset.style) { $style = [string]$Preset.style }
    $format = if ($Preset.format) { [string]$Preset.format } else { if ($provider -eq 'minimax') { 'mp3' } else { 'wav' } }
    $profileId = $null
    $language = $null
    $engine = $null
    $minimaxSpeed = $null
    $minimaxVol = $null
    $minimaxPitch = $null
    if ($Preset.PSObject.Properties['profile_id'] -and $Preset.profile_id) {
        $profileId = [string]$Preset.profile_id
    }
    if ($Preset.PSObject.Properties['language'] -and $Preset.language) {
        $language = [string]$Preset.language
    } elseif ($provider -eq 'minimax') {
        $language = $DefaultMinimaxLanguage
    }
    if ($Preset.PSObject.Properties['engine'] -and $Preset.engine) {
        $engine = [string]$Preset.engine
    }
    if ($Preset.PSObject.Properties['minimax_speed']) { $minimaxSpeed = [double]$Preset.minimax_speed }
    if ($Preset.PSObject.Properties['minimax_vol']) { $minimaxVol = [double]$Preset.minimax_vol }
    if ($Preset.PSObject.Properties['minimax_pitch']) { $minimaxPitch = [int]$Preset.minimax_pitch }
    return @{
        Provider     = $provider
        Model        = $model
        Voice        = $voice
        Style        = $style
        Format       = $format
        ProfileId    = $profileId
        Language     = $language
        Engine       = $engine
        MinimaxSpeed = $minimaxSpeed
        MinimaxVol   = $minimaxVol
        MinimaxPitch = $minimaxPitch
    }
}

function Merge-TtsSettings {
    param($Local, $App)
    $apiBase = if ($Local.api_base) { [string]$Local.api_base } else { 'http://127.0.0.1:8765' }
    $autoplay = $true
    if ($Local.PSObject.Properties['autoplay']) { $autoplay = [bool]$Local.autoplay }

    $presetName = if ($Local.active_preset) { [string]$Local.active_preset } else { 'minimax' }
    $preset = Get-PresetByKey -Local $Local -Key $presetName
    if (-not $preset) {
        $preset = @{
            provider = 'minimax'
            model    = 'speech-2.8-hd'
            voice    = $DefaultMinimaxVoice
            language = $DefaultMinimaxLanguage
            format   = 'mp3'
        }
    }

    $merged = Apply-LocalPreset -Preset $preset
    $provider = $merged.Provider
    $model = $merged.Model
    $voice = $merged.Voice
    $style = $merged.Style
    $format = $merged.Format
    $profileId = $merged.ProfileId
    $language = $merged.Language
    $engine = $merged.Engine
    $minimaxSpeed = $merged.MinimaxSpeed
    $minimaxVol = $merged.MinimaxVol
    $minimaxPitch = $merged.MinimaxPitch

    $preferApp = $true
    if ($Local.PSObject.Properties['prefer_app_config']) {
        $preferApp = [bool]$Local.prefer_app_config
    }
    $respectDnd = $true
    if ($Local.PSObject.Properties['respect_dnd']) {
        $respectDnd = [bool]$Local.respect_dnd
    }

    $skip = $false
    $skipReason = ''
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    if ($respectDnd -and $App -and $App.dnd_until_ts -and ([int64]$App.dnd_until_ts) -gt $now) {
        $skip = $true
        $skipReason = 'dnd'
    } elseif ($preferApp -and $App -and $App.enabled) {
        if ($App.PSObject.Properties['provider'] -and $App.provider) {
            $provider = [string]$App.provider
        }
        # Re-base on config presets.{provider} so provider/model/voice stay consistent.
        $providerPreset = Get-PresetByKey -Local $Local -Key $provider
        if ($providerPreset) {
            $rebases = Apply-LocalPreset -Preset $providerPreset
            $model = $rebases.Model
            $voice = $rebases.Voice
            $style = $rebases.Style
            $format = $rebases.Format
            $profileId = $rebases.ProfileId
            $language = $rebases.Language
            $engine = $rebases.Engine
            $minimaxSpeed = $rebases.MinimaxSpeed
            $minimaxVol = $rebases.MinimaxVol
            $minimaxPitch = $rebases.MinimaxPitch
        }
        # Provider-specific fields from app (same as hook cursor-tts.ps1) — voice_id z Integracji Cursor.
        if ($provider -eq 'voicebox') {
            if ($App.PSObject.Properties['profile_id'] -and $App.profile_id) {
                $profileId = [string]$App.profile_id
            }
            if ($App.PSObject.Properties['language'] -and $App.language) {
                $language = [string]$App.language
            }
            if ($App.PSObject.Properties['engine'] -and $App.engine) {
                $engine = [string]$App.engine
            }
            if ($App.PSObject.Properties['voice'] -and $App.voice) {
                $voice = [string]$App.voice
            }
            if ($App.PSObject.Properties['model'] -and $App.model) {
                $model = [string]$App.model
            }
        }
        if ($provider -eq 'minimax') {
            if ($App.PSObject.Properties['voice'] -and $App.voice) {
                $voice = [string]$App.voice
            }
            if ($App.PSObject.Properties['model'] -and $App.model) {
                $model = [string]$App.model
            }
            if ($App.PSObject.Properties['language'] -and $App.language) {
                $language = [string]$App.language
            }
            if ($App.PSObject.Properties['format'] -and $App.format) {
                $format = [string]$App.format
            }
            if ($App.PSObject.Properties['minimax_speed'] -and $null -ne $App.minimax_speed) {
                $minimaxSpeed = [double]$App.minimax_speed
            }
            if ($App.PSObject.Properties['minimax_vol'] -and $null -ne $App.minimax_vol) {
                $minimaxVol = [double]$App.minimax_vol
            }
            if ($App.PSObject.Properties['minimax_pitch'] -and $null -ne $App.minimax_pitch) {
                $minimaxPitch = [int]$App.minimax_pitch
            }
        }
        if ($provider -eq 'google') {
            if ($App.PSObject.Properties['voice'] -and $App.voice) {
                $voice = [string]$App.voice
            }
            if ($App.PSObject.Properties['model'] -and $App.model) {
                $model = [string]$App.model
            }
            if ($App.PSObject.Properties['style'] -and $App.style) {
                $style = [string]$App.style
            }
            if ($App.PSObject.Properties['format'] -and $App.format) {
                $format = [string]$App.format
            }
        }
        if ($App.PSObject.Properties['autoplay']) {
            $autoplay = [bool]$App.autoplay
        }
    }

    return @{
        ApiBase        = $apiBase
        Provider       = $provider
        Model          = $model
        Voice          = $voice
        Style          = $style
        Format         = $format
        ProfileId      = $profileId
        Language       = $language
        Engine         = $engine
        MinimaxSpeed   = $minimaxSpeed
        MinimaxVol     = $minimaxVol
        MinimaxPitch   = $minimaxPitch
        Autoplay       = $autoplay
        Skip           = $skip
        SkipReason     = $skipReason
    }
}

function Build-GenerateBody {
    param(
        [string]$Summary,
        [hashtable]$Settings,
        [string]$ConvId
    )
    $body = @{
        text           = $Summary
        summary_text   = $Summary
        provider       = $Settings.Provider
        model          = $Settings.Model
        voice          = $Settings.Voice
        format         = $Settings.Format
        autoplay       = $Settings.Autoplay
        source         = 'cursor-skill'
    }
    if ($Settings.Style) { $body['style'] = $Settings.Style }
    if ($ConvId) { $body['conversation_id'] = $ConvId }
    if ($Settings.Provider -eq 'voicebox') {
        if ($Settings.ProfileId) { $body['profile_id'] = $Settings.ProfileId }
        if ($Settings.Language) { $body['language'] = $Settings.Language }
        if ($Settings.Engine) { $body['engine'] = $Settings.Engine }
    }
    if ($Settings.Provider -eq 'minimax') {
        $lang = if ($Settings.Language) { $Settings.Language } else { $DefaultMinimaxLanguage }
        $body['language'] = $lang
        if ($null -ne $Settings.MinimaxSpeed) { $body['minimax_speed'] = $Settings.MinimaxSpeed }
        if ($null -ne $Settings.MinimaxVol) { $body['minimax_vol'] = $Settings.MinimaxVol }
        if ($null -ne $Settings.MinimaxPitch) { $body['minimax_pitch'] = $Settings.MinimaxPitch }
    }
    return $body
}

$summary = $SummaryText.Trim()
if ([string]::IsNullOrWhiteSpace($summary)) {
    Write-SkillLog -Status 'skip' -Reason 'empty_summary'
    exit 0
}

$hash = Get-Sha1 $summary
if (Test-Path $DedupeFile) {
    $prev = (Get-Content -Path $DedupeFile -Raw -Encoding utf8).Trim()
    if ($prev -eq $hash) {
        Write-SkillLog -Status 'skip' -Reason 'duplicate'
        exit 0
    }
}
Set-Content -Path $DedupeFile -Value $hash -Encoding utf8 -NoNewline

$local = Read-LocalConfig
if (-not $local) {
    Write-SkillLog -Status 'skip' -Reason 'no_config'
    exit 0
}

$apiBase = if ($local.api_base) { [string]$local.api_base.TrimEnd('/') } else { 'http://127.0.0.1:8765' }
$appCfg = Get-AppCursorConfig -ApiBase $apiBase
$settings = Merge-TtsSettings -Local $local -App $appCfg

if ($settings.Skip) {
    Write-SkillLog -Status 'skip' -Reason $settings.SkipReason
    exit 0
}

$body = Build-GenerateBody -Summary $summary -Settings $settings -ConvId $ConversationId
$bodyJson = $body | ConvertTo-Json -Depth 8 -Compress
$bodyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bodyJson))
$uri = "$($settings.ApiBase)/generate"

$inner = @"
`$ErrorActionPreference = 'SilentlyContinue'
`$json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$bodyB64'))
try { Invoke-RestMethod -Uri '$uri' -Method Post -ContentType 'application/json; charset=utf-8' -Body `$json -TimeoutSec 60 | Out-Null } catch { }
"@

try {
    Start-Process -FilePath 'pwsh.exe' `
        -ArgumentList @('-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', $inner) `
        -WindowStyle Hidden | Out-Null
    Write-SkillLog -Status 'ok' -Reason "$($summary.Length)chars,$($settings.Provider),dispatched"
} catch {
    Write-SkillLog -Status 'error' -Reason ($_.Exception.Message -replace '\s+', ' ')
}

exit 0
