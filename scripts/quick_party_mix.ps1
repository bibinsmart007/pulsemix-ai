# quick_party_mix.ps1
# Safety-net workflow: download all party tracks via yt-dlp, then render a
# normalized continuous mix with emergency_mix.py. Bypasses PulseMix entirely.
#
# Use this when:
#   - You want a playable backup file ASAP without touching the PulseMix UI
#   - PulseMix has any issue and you need Plan B
#   - You want to test the audio pipeline before the polished render
#
# Prerequisites:
#   - yt-dlp installed (python -m pip install yt-dlp)
#   - ffmpeg on PATH (already verified by check_setup.py)
#   - pyloudnorm installed
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts\quick_party_mix.ps1
#   PowerShell -ExecutionPolicy Bypass -File scripts\quick_party_mix.ps1 -Preset loud -Xfade 6

[CmdletBinding()]
param(
    [string]$File = "party_29may_urls.txt",
    [string]$DownloadDir = "public\music\party_29may",
    [string]$OutputBase = "public\exports\party_29may_v1",
    [string]$Preset = "balanced",                   # safe | balanced | loud
    [int]$Xfade = 8,
    [switch]$SkipDownload,                          # already downloaded, just re-render
    [switch]$DownloadOnly                           # don't render, just download
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not [System.IO.Path]::IsPathRooted($File))         { $File         = Join-Path $RepoRoot $File }
if (-not [System.IO.Path]::IsPathRooted($DownloadDir))  { $DownloadDir  = Join-Path $RepoRoot $DownloadDir }
if (-not [System.IO.Path]::IsPathRooted($OutputBase))   { $OutputBase   = Join-Path $RepoRoot $OutputBase }

function Section($t) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $t -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

Section "PulseMix Quick Party Mix"
Write-Host "  URL file     : $File"
Write-Host "  Download dir : $DownloadDir"
Write-Host "  Output       : $OutputBase.{mp3,wav}"
Write-Host "  Preset       : $Preset (-10 LUFS for 'balanced')"
Write-Host "  Crossfade    : ${Xfade}s"

if (-not (Test-Path $File)) {
    Write-Host "ERROR: URL file not found: $File" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null
$urls = Get-Content $File | Where-Object { $_ -and -not $_.StartsWith("#") }
$total = $urls.Count
Write-Host ""
Write-Host "Loaded $total URLs"

# --- DOWNLOAD PHASE ---
if (-not $SkipDownload) {
    Section "Downloading via yt-dlp (skip already-downloaded)"
    $i = 0
    $okCount = 0
    $failCount = 0
    $failed = @()

    # Verify yt-dlp is callable
    $hasYtDlp = $false
    try { python -m yt_dlp --version 2>&1 | Out-Null; $hasYtDlp = ($LASTEXITCODE -eq 0) } catch {}
    if (-not $hasYtDlp) {
        Write-Host "ERROR: yt-dlp not installed." -ForegroundColor Red
        Write-Host "  Fix: python -m pip install --upgrade yt-dlp" -ForegroundColor Cyan
        exit 1
    }

    foreach ($url in $urls) {
        $i++
        $url = $url.Trim()
        $vid = ($url -split "v=")[1] -replace "&.*", ""
        $padIdx = "{0:D2}" -f $i
        $outTemplate = Join-Path $DownloadDir "${padIdx}_${vid}.%(ext)s"

        # Skip if any file matching this prefix already exists
        $existing = Get-ChildItem -Path $DownloadDir -Filter "${padIdx}_${vid}.*" -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host ("[{0,3}/{1}] {2} -> skip (already have {3})" -f $i, $total, $vid, $existing[0].Name) -ForegroundColor DarkGray
            $okCount++
            continue
        }

        Write-Host ("[{0,3}/{1}] {2,-15} downloading..." -f $i, $total, $vid) -NoNewline
        # yt-dlp: best audio, mp3 (re-encode for compatibility), embed metadata
        $cmd = "python -m yt_dlp -x --audio-format mp3 --audio-quality 0 --no-playlist --no-warnings -o `"$outTemplate`" `"$url`""
        $out = Invoke-Expression $cmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            $newFile = Get-ChildItem -Path $DownloadDir -Filter "${padIdx}_${vid}.*" | Select-Object -First 1
            $sizeMB = if ($newFile) { [math]::Round($newFile.Length / 1MB, 1) } else { 0 }
            Write-Host " OK ($sizeMB MB)" -ForegroundColor Green
            $okCount++
        } else {
            Write-Host " FAIL" -ForegroundColor Red
            $failCount++
            $failed += $url
            Write-Host "        $(($out | Select-Object -Last 2) -join ' ')" -ForegroundColor DarkRed
        }
    }

    Write-Host ""
    Write-Host "Download summary: $okCount / $total OK, $failCount failed" -ForegroundColor White
    if ($failCount -gt 0) {
        $failLog = Join-Path $RepoRoot "scratch\download_failures.txt"
        New-Item -ItemType Directory -Force -Path (Split-Path $failLog) | Out-Null
        $failed | Set-Content $failLog
        Write-Host "Failed URLs saved to: $failLog" -ForegroundColor Yellow
        Write-Host "Re-run with same script to retry just the failures (it skips already-downloaded)." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Skipping download (--SkipDownload)" -ForegroundColor Yellow
}

if ($DownloadOnly) {
    Section "Download-only mode — skipping render."
    Write-Host "Files in: $DownloadDir"
    Get-ChildItem $DownloadDir | Sort-Object Name | ForEach-Object {
        Write-Host ("  {0,-50} {1,8:0.0} MB" -f $_.Name, ($_.Length / 1MB))
    }
    exit 0
}

# --- RENDER PHASE ---
Section "Rendering with scripts\emergency_mix.py"

$files = Get-ChildItem $DownloadDir -File | Where-Object { $_.Extension -in @(".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus") } | Sort-Object Name
if ($files.Count -eq 0) {
    Write-Host "ERROR: No audio files in $DownloadDir" -ForegroundColor Red
    exit 1
}
Write-Host "Found $($files.Count) audio files to render"

$pyScript = Join-Path $RepoRoot "scripts\emergency_mix.py"
$renderCmd = "python `"$pyScript`" --input `"$DownloadDir`" --output `"$OutputBase`" --preset $Preset --xfade $Xfade"
Write-Host ""
Write-Host "Running: $renderCmd" -ForegroundColor DarkGray
Write-Host ""
Invoke-Expression $renderCmd

if ($LASTEXITCODE -eq 0) {
    Section "DONE"
    Write-Host "Outputs:" -ForegroundColor Green
    Write-Host "  MP3 320kbps : $OutputBase.mp3"   -ForegroundColor White
    Write-Host "  WAV master  : $OutputBase.wav"   -ForegroundColor White
    Write-Host "  Tracklist   : $OutputBase.tracklist.txt" -ForegroundColor White
    Write-Host ""
    Write-Host "This is your SAFETY NET mix. Play it through a speaker tonight to validate." -ForegroundColor Cyan
    Write-Host "For the polished render, use PulseMix UI to order + export on Wednesday." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Render failed. Check scripts\emergency_mix.py output above." -ForegroundColor Red
    exit 1
}
