# setup_windows.ps1
# One-command setup for PulseMix-AI on Windows.
# Run from the repo root:
#   PowerShell -ExecutionPolicy Bypass -File scripts\setup_windows.ps1
#
# What this does:
#   1. Verify Python + Node are installed
#   2. Verify ffmpeg + ffprobe are on PATH (install via winget/choco if missing)
#   3. pip install backend requirements (including pyloudnorm)
#   4. npm install frontend dependencies
#   5. Run check_setup.py to confirm everything is ready
#
# Safe to re-run. Skips steps that are already done.

[CmdletBinding()]
param(
    [switch]$SkipFrontend,     # skip npm install (use if you only need the backend)
    [switch]$SkipBackend,      # skip pip install (use if frontend-only work)
    [switch]$InstallFfmpeg     # try to install ffmpeg via winget if missing
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Colors
function Section($title) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $title -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}
function Ok($msg)   { Write-Host "  [OK]    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  [FAIL]  $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "  [..]    $msg" -ForegroundColor Gray }

Section "PulseMix-AI Windows Setup"
Write-Host "  Repo: $RepoRoot"

# ---------- 1. Python ----------
Section "1. Python"
$pythonOk = $false
try {
    $pyVer = (python --version 2>&1) -replace "Python ", ""
    if ($pyVer -match "^3\.(1[0-9]|[2-9][0-9])") {
        Ok "Python $pyVer"
        $pythonOk = $true
    } elseif ($pyVer -match "^3\.[89]") {
        Warn "Python $pyVer (works but 3.10+ recommended)"
        $pythonOk = $true
    } else {
        Fail "Python $pyVer is too old"
    }
} catch {
    Fail "python not on PATH"
    Write-Host "        Install: winget install Python.Python.3.12" -ForegroundColor Cyan
}
if (-not $pythonOk) {
    Write-Host "`nCannot continue without Python. Install it, restart PowerShell, re-run." -ForegroundColor Red
    exit 1
}

# ---------- 2. Node ----------
Section "2. Node.js"
$nodeOk = $false
if (-not $SkipFrontend) {
    try {
        $nodeVer = (node --version 2>&1)
        Ok "node $nodeVer"
        $npmVer = (npm --version 2>&1)
        Ok "npm $npmVer"
        $nodeOk = $true
    } catch {
        Fail "node not on PATH"
        Write-Host "        Install: winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
        Write-Host "        Then restart PowerShell." -ForegroundColor Cyan
    }
} else {
    Info "Skipping Node check (--SkipFrontend)"
}

# ---------- 3. ffmpeg ----------
Section "3. ffmpeg / ffprobe"
$ffmpegOk = $false
$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffprobePath = Get-Command ffprobe -ErrorAction SilentlyContinue

if ($ffmpegPath -and $ffprobePath) {
    Ok "ffmpeg  : $($ffmpegPath.Source)"
    Ok "ffprobe : $($ffprobePath.Source)"
    $ffmpegOk = $true
} else {
    Fail "ffmpeg/ffprobe not found"
    if ($InstallFfmpeg) {
        Info "Attempting to install via winget..."
        winget install --id Gyan.FFmpeg --silent --accept-source-agreements --accept-package-agreements
        Warn "ffmpeg installed. RESTART PowerShell, then re-run this script."
        exit 0
    } else {
        Write-Host "        Install option A: winget install Gyan.FFmpeg" -ForegroundColor Cyan
        Write-Host "        Install option B: choco install ffmpeg" -ForegroundColor Cyan
        Write-Host "        After install, restart PowerShell and re-run." -ForegroundColor Cyan
        Write-Host "        Or re-run this script with -InstallFfmpeg to attempt auto-install." -ForegroundColor Cyan
    }
}

# ---------- 4. Backend deps ----------
if (-not $SkipBackend) {
    Section "4. Backend Python deps"
    Push-Location (Join-Path $RepoRoot "backend")
    try {
        Info "Running: pip install -r requirements.txt"
        # --user falls back gracefully if no venv; --quiet keeps output small
        python -m pip install --upgrade pip --quiet 2>&1 | Out-Null
        $pipOut = python -m pip install -r requirements.txt 2>&1
        if ($LASTEXITCODE -eq 0) {
            Ok "Python deps installed"
            # Sanity-check the critical few
            foreach ($pkg in @("fastapi","uvicorn","pydub","pyloudnorm","librosa","yt_dlp")) {
                $check = python -c "import $pkg; print($pkg.__version__ if hasattr($pkg,'__version__') else 'ok')" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Ok "$pkg : $check"
                } else {
                    Fail "$pkg failed to import: $check"
                }
            }
        } else {
            Fail "pip install failed"
            Write-Host $pipOut -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
} else {
    Info "Skipping backend deps (--SkipBackend)"
}

# ---------- 5. Frontend deps ----------
if (-not $SkipFrontend -and $nodeOk) {
    Section "5. Frontend npm deps"
    Push-Location $RepoRoot
    try {
        if (Test-Path "node_modules") {
            Info "node_modules exists — running 'npm install' to sync"
        } else {
            Info "Fresh install — this may take a few minutes"
        }
        npm install --no-audit --no-fund 2>&1 | Tee-Object -Variable npmOut | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Ok "npm install complete"
        } else {
            Fail "npm install failed"
            Write-Host ($npmOut | Select-Object -Last 30) -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
} elseif ($SkipFrontend) {
    Info "Skipping frontend deps (--SkipFrontend)"
}

# ---------- 6. Pre-flight check ----------
Section "6. Pre-flight verification"
Push-Location $RepoRoot
try {
    python scripts\check_setup.py
    $preflightCode = $LASTEXITCODE
} finally {
    Pop-Location
}

# ---------- Final summary ----------
Section "Setup Summary"
if ($preflightCode -eq 0) {
    Write-Host ""
    Write-Host "  Setup complete." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor White
    Write-Host "    1. Start the backend:" -ForegroundColor White
    Write-Host "         cd backend; uvicorn main:app --reload --port 8000" -ForegroundColor Cyan
    Write-Host "    2. In a SECOND PowerShell window, start the frontend:" -ForegroundColor White
    Write-Host "         npm run dev" -ForegroundColor Cyan
    Write-Host "    3. Open http://localhost:3000 and load your YouTube links." -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  Setup finished with issues. Review check_setup.py output above." -ForegroundColor Yellow
    Write-Host "  Re-run after fixing the FAILs:" -ForegroundColor Yellow
    Write-Host "    PowerShell -ExecutionPolicy Bypass -File scripts\setup_windows.ps1" -ForegroundColor Cyan
    Write-Host ""
}

exit $preflightCode
