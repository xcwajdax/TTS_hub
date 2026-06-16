# Smoke-test Voicebox HTTP contract used by TTS Hub.
# Requires a running Voicebox (or ttshub-local-server) on $BaseUrl.
#
# Usage:
#   pwsh -File scripts/test-voicebox-contract.ps1
#   pwsh -File scripts/test-voicebox-contract.ps1 -BaseUrl http://127.0.0.1:17493

param(
    [string]$BaseUrl = "http://127.0.0.1:17493"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-Vb {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    $headers = @{
        "User-Agent"            = "TTS-Hub/contract-test (Voicebox-client)"
        "X-Voicebox-Client-Id"  = "tts-hub"
    }
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $headers
        TimeoutSec  = 30
    }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 6 -Compress)
    }
    try {
        $resp = Invoke-WebRequest @params
        return @{
            Ok     = $true
            Status = [int]$resp.StatusCode
            Body   = $resp.Content
        }
    } catch {
        if ($_.Exception.Response) {
            $r = $_.Exception.Response
            $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
            $text = $reader.ReadToEnd()
            return @{
                Ok     = $false
                Status = [int]$r.StatusCode
                Body   = $text
            }
        }
        throw
    }
}

function Assert-JsonKeys {
    param(
        [string]$Label,
        [string]$Json,
        [string[]]$Keys
    )
    $obj = $Json | ConvertFrom-Json
    foreach ($k in $Keys) {
        if (-not ($obj.PSObject.Properties.Name -contains $k)) {
            throw "$Label missing JSON key: $k"
        }
    }
    return $obj
}

Write-Host "Voicebox contract test -> $BaseUrl" -ForegroundColor Cyan

# GET /health
$h = Invoke-Vb GET "/health"
if (-not $h.Ok) { throw "GET /health failed: $($h.Status) $($h.Body)" }
$health = Assert-JsonKeys "GET /health" $h.Body @("status")
Write-Host "  OK GET /health status=$($health.status)"

# GET /profiles
$p = Invoke-Vb GET "/profiles"
if (-not $p.Ok) { throw "GET /profiles failed: $($p.Status) $($p.Body)" }
$profiles = $p.Body | ConvertFrom-Json
if ($profiles -isnot [Array]) { throw "GET /profiles expected array" }
Write-Host "  OK GET /profiles count=$($profiles.Count)"

# GET /models/status
$m = Invoke-Vb GET "/models/status"
if (-not $m.Ok) { throw "GET /models/status failed: $($m.Status) $($m.Body)" }
$models = Assert-JsonKeys "GET /models/status" $m.Body @("models")
Write-Host "  OK GET /models/status models=$($models.models.Count)"

# GET /history
$hist = Invoke-Vb GET "/history?limit=1&offset=0"
if (-not $hist.Ok) { throw "GET /history failed: $($hist.Status) $($hist.Body)" }
$history = Assert-JsonKeys "GET /history" $hist.Body @("items", "total")
Write-Host "  OK GET /history total=$($history.total)"

Write-Host ""
Write-Host "All contract checks passed." -ForegroundColor Green
