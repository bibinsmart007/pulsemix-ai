# github_push.ps1
# One-command commit + push to bibinsmart007/pulsemix-ai.
# Uses your already-configured git credentials (Windows Credential Manager or PAT).
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts\github_push.ps1
#   PowerShell -ExecutionPolicy Bypass -File scripts\github_push.ps1 -DryRun     # see what would happen, don't push

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Section($t) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $t -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

Section "GIT STATE"
git status --short
$changeCount = (git status --short | Measure-Object -Line).Lines
Write-Host ""
Write-Host "Total changed/new entries: $changeCount" -ForegroundColor White

if ($changeCount -eq 0) {
    Write-Host "Nothing to commit. Repo is clean." -ForegroundColor Yellow
    exit 0
}

Section "ADDING FILES (excluding huge renders)"
# Stage all tracked deletions + modifications + new files
# .gitignore already excludes public/exports/ (the big MP3/WAV/MKA renders)
git add -A
Write-Host "Files staged." -ForegroundColor Green

Section "STAGED CHANGES"
git diff --cached --stat | Select-Object -First 60
Write-Host ""
$stagedCount = (git diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "Files in this commit: $stagedCount" -ForegroundColor White

if ($DryRun) {
    Section "DRY RUN - stopping before commit"
    Write-Host "Run without -DryRun to actually commit and push." -ForegroundColor Yellow
    git reset | Out-Null
    exit 0
}

Section "COMMIT MESSAGE"
$commitMsg = @"
Party-ready: loudness norm, dj_mode.html, scripts, port refactor

Backend
- Real -10 LUFS loudness normalization via pyloudnorm (was a fake time.sleep)
- Fix 4 broken 'from backend.x' imports (main.py, exporter.py, stem_extractor.py)
- Recover null-byte / truncation corruption in main.py + exporter.py
- Relax requirements.txt version pins (Python 3.14 compatibility)

Frontend
- Refactor 71 hardcoded localhost:8000 references to localhost:8765
- Avoids Windows port-8000 reserved range issue

DJ Performance Mode (new)
- public/dj_mode.html: dual decks, jog wheel, live visualizer
- Tempo fader -15% to +15% with pitch preservation
- 8 synthesized FX pads (kick/snare/hihat/clap/airhorn/riser/drop/scratch)
- Searchable tracklist overlay for audience requests (press T)
- Auto-skips first 50s of v2.mp3 (YouTube ad)

Scripts (new)
- scripts/check_setup.py     pre-flight verifier (Python, ffmpeg, deps, DB)
- scripts/emergency_mix.py   standalone ffmpeg renderer with loudnorm
- scripts/setup_windows.ps1  one-command Windows installer
- scripts/import_to_pulsemix.ps1  bulk import 57 YouTube URLs via /api/import
- scripts/quick_party_mix.ps1     yt-dlp download + emergency_mix render
- scripts/party_lockdown.ps1      disable sleep + Focus Assist for party night
- scripts/github_push.ps1         this script

Repo hygiene
- Delete 5 unused .db files (kept backend/metadata.db)
- Delete orphan test*.html / test_stems.py / etc.
- Update .gitignore (already excludes public/exports/)

Party seed
- party_29may_urls.txt: 57 cleaned YouTube URLs from song list.xlsx
- tracklist_template.md: energy-arc set structure
- public/music/party_29may/: 57 downloaded source tracks
"@

Write-Host $commitMsg

Section "COMMITTING"
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed (exit $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Commit created." -ForegroundColor Green

Section "PUSHING to origin/main"
Write-Host "If prompted for credentials, use your GitHub username + Personal Access Token." -ForegroundColor Yellow
Write-Host "(Token has to have 'repo' scope. Create at: https://github.com/settings/tokens)" -ForegroundColor Yellow
Write-Host ""
git push origin main
$pushCode = $LASTEXITCODE

Section "RESULT"
if ($pushCode -eq 0) {
    Write-Host "PUSHED to https://github.com/bibinsmart007/pulsemix-ai" -ForegroundColor Green
    Write-Host ""
    Write-Host "View commit: https://github.com/bibinsmart007/pulsemix-ai/commits/main" -ForegroundColor Cyan
} else {
    Write-Host "PUSH FAILED (exit $pushCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  - If 'authentication failed': create a Personal Access Token at https://github.com/settings/tokens"
    Write-Host "    (with 'repo' scope), then re-run this script. Use the token as the password."
    Write-Host "  - If 'rejected (non-fast-forward)': someone pushed in parallel. Run: git pull --rebase ; then this script again."
    Write-Host "  - If 'file too large': check .gitignore covers any new big files."
    exit $pushCode
}
