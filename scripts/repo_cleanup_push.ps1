# repo_cleanup_push.ps1
# Cleans the repo: untracks redis/, scratch/, dump.rdb, public/storage/
# (still keeps the files locally, just removes them from git history going forward).
# Then commits the .gitignore update + cleanup and pushes.
#
# Run AFTER github_push.ps1 worked. Safe to re-run.

[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Section($t) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $t -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

Section "REPO CLEANUP"
Write-Host "Untracking junk from git (keeping files locally)..."
Write-Host ""

# Use git rm --cached to remove from index without deleting from disk
$pathsToUntrack = @(
    "redis",
    "redis.zip",
    "dump.rdb",
    "scratch",
    "public/storage"
)

foreach ($p in $pathsToUntrack) {
    if (Test-Path $p) {
        Write-Host "Untracking: $p"
        git rm -r --cached $p 2>&1 | Out-Null
    }
}

Section "STAGED CHANGES"
git diff --cached --stat | Select-Object -First 30
$staged = (git diff --cached --name-only | Measure-Object -Line).Lines
Write-Host ""
Write-Host "Files in cleanup commit: $staged" -ForegroundColor White

# Also stage the .gitignore update + new doc files
git add .gitignore PARTY_NIGHT.md tracklist_phone.md 2>&1 | Out-Null

if ($DryRun) {
    Section "DRY RUN - reset and exit"
    git reset 2>&1 | Out-Null
    Write-Host "Run without -DryRun to commit and push." -ForegroundColor Yellow
    exit 0
}

Section "COMMITTING"
$msg = @"
Cleanup: gitignore redis/scratch/dump.rdb, add PARTY_NIGHT runbook

- .gitignore now excludes redis/, redis.zip, dump.rdb, scratch/, public/storage/, render outputs
- Untracked those folders from git index (kept locally for use)
- Added PARTY_NIGHT.md - Friday runbook with all commands + checklist
- Added tracklist_phone.md - tracklist with rendered-mix timestamps
"@

git commit -m $msg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed (exit $LASTEXITCODE). Repo may already be clean." -ForegroundColor Yellow
    exit $LASTEXITCODE
}
Write-Host "Commit created." -ForegroundColor Green

Section "PUSHING"
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "PUSHED. View: https://github.com/bibinsmart007/pulsemix-ai/commits/main" -ForegroundColor Green
} else {
    Write-Host "Push failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}
