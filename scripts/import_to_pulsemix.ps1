# import_to_pulsemix.ps1
# Bulk-import YouTube URLs into the running PulseMix backend.
#
# Reads URLs from party_29may_urls.txt (one per line, # = comment),
# POSTs each to /api/import on http://localhost:8765 with rate-limiting.
#
# Prerequisites:
#   - Backend running: python -m uvicorn main:app --reload --port 8765
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts\import_to_pulsemix.ps1
#   PowerShell -ExecutionPolicy Bypass -File scripts\import_to_pulsemix.ps1 -File party_29may_urls.txt -DelaySec 3
#   PowerShell -ExecutionPolicy Bypass -File scripts\import_to_pulsemix.ps1 -BackendPort 8765 -Limit 5

[CmdletBinding()]
param(
    [string]$File = "party_29may_urls.txt",
    [int]$BackendPort = 8765,
    [int]$DelaySec = 3,                # delay between imports (avoid YouTube rate limit)
    [int]$Limit = 0                    # 0 = import all; set N for first N (testing)
)

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:$BackendPort"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Resolve URL list file
if (-not [System.IO.Path]::IsPathRooted($File)) {
    $File = Join-Path $RepoRoot $File
}

if (-not (Test-Path $File)) {
    Write-Host "ERROR: URL file not found: $File" -ForegroundColor Red
    exit 1
}

# Backend health check
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/playlists" -TimeoutSec 5
    Write-Host "[OK] Backend responding at $baseUrl ($($health.playlists.Count) existing playlists)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Backend not reachable at $baseUrl" -ForegroundColor Red
    Write-Host "  Start it first: cd backend; python -m uvicorn main:app --reload --port $BackendPort" -ForegroundColor Cyan
    exit 1
}

# Read URLs (skip blank lines + comments)
$urls = Get-Content $File | Where-Object { $_ -and -not $_.StartsWith("#") }
if ($Limit -gt 0) { $urls = $urls | Select-Object -First $Limit }
$total = $urls.Count
Write-Host ""
Write-Host "Loaded $total URLs from $File" -ForegroundColor Cyan
Write-Host "Delay between imports: ${DelaySec}s (estimated total: $([math]::Round($total * $DelaySec / 60, 1)) min)" -ForegroundColor Cyan
Write-Host ""

$results = @()
$i = 0
foreach ($url in $urls) {
    $i++
    $url = $url.Trim()
    $idForLog = $url -replace ".*v=", "" -replace "&.*", ""

    Write-Host ("[{0,3}/{1}] {2,-15} " -f $i, $total, $idForLog) -NoNewline

    try {
        $body = @{ url = $url } | ConvertTo-Json -Compress
        $resp = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/import" `
            -ContentType "application/json" -Body $body -TimeoutSec 30
        $jobId = $resp.job_id
        Write-Host "OK     job=$jobId" -ForegroundColor Green
        $results += [PSCustomObject]@{ Url=$url; Status="queued"; JobId=$jobId; Error="" }
    } catch {
        $msg = $_.Exception.Message
        if ($_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
        Write-Host "FAIL   $msg" -ForegroundColor Red
        $results += [PSCustomObject]@{ Url=$url; Status="failed"; JobId=""; Error=$msg }
    }

    if ($i -lt $total) { Start-Sleep -Seconds $DelaySec }
}

# Summary
$ok = ($results | Where-Object Status -eq "queued").Count
$bad = ($results | Where-Object Status -eq "failed").Count
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Queued: $ok / $total    Failed: $bad" -ForegroundColor White
Write-Host ""

if ($bad -gt 0) {
    Write-Host "Failed URLs:" -ForegroundColor Red
    $results | Where-Object Status -eq "failed" | ForEach-Object {
        Write-Host "  $($_.Url)" -ForegroundColor Red
        Write-Host "    -> $($_.Error)" -ForegroundColor DarkRed
    }
}

# Save log
$logPath = Join-Path $RepoRoot "scratch\import_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null
$results | Export-Csv -Path $logPath -NoTypeInformation -Encoding UTF8
Write-Host "Log saved: $logPath" -ForegroundColor Gray

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Tracks are queued; actual download + analysis runs in the background." -ForegroundColor White
Write-Host "  2. Watch progress at http://localhost:3000 (library view)." -ForegroundColor White
Write-Host "  3. Each track takes ~30-90 sec to download + analyze (BPM/key)." -ForegroundColor White
Write-Host "  4. Once all tracks show status=analyzed, drag into a playlist and export." -ForegroundColor White
Write-Host ""
