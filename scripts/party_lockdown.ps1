# party_lockdown.ps1
# Run BEFORE leaving for the party. Run with elevated PowerShell ("Run as Administrator")
# for full effect - without admin, sleep settings still apply but Focus Assist won't toggle.
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts\party_lockdown.ps1
#
# Restore afterwards:
#   PowerShell -ExecutionPolicy Bypass -File scripts\party_lockdown.ps1 -Restore

[CmdletBinding()]
param(
    [switch]$Restore
)

$ErrorActionPreference = "Continue"

$stateFile = Join-Path $env:TEMP "pulsemix_lockdown_state.json"

function Save-State {
    param($state)
    $state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8
}

function Load-State {
    if (-not (Test-Path $stateFile)) { return $null }
    return Get-Content $stateFile -Raw | ConvertFrom-Json
}

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $title -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

if ($Restore) {
    Write-Section "RESTORE: returning system to normal"
    $state = Load-State
    if ($null -eq $state) {
        Write-Host "No saved state found. Restoring to sensible defaults." -ForegroundColor Yellow
        powercfg /change standby-timeout-ac 30
        powercfg /change monitor-timeout-ac 15
    } else {
        Write-Host "Restoring saved settings..."
        powercfg /change standby-timeout-ac $state.standby_ac
        powercfg /change monitor-timeout-ac $state.monitor_ac
        Remove-Item $stateFile -ErrorAction SilentlyContinue
    }
    Write-Host "Restore complete." -ForegroundColor Green
    exit 0
}

Write-Section "PULSEMIX PARTY LOCKDOWN"
Write-Host "Locking laptop down for live audio playback." -ForegroundColor White

# --- Capture current power settings so we can restore them later ---
$currentStandby = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String "Current AC Power Setting Index").ToString()
$currentMonitor = (powercfg /query SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String "Current AC Power Setting Index").ToString()

Save-State @{
    standby_ac = 30
    monitor_ac = 15
    timestamp = (Get-Date).ToString("o")
}

# --- 1. Disable sleep & screen-off while plugged in ---
Write-Section "1. Disable sleep / screen off (AC)"
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change disk-timeout-ac 0
Write-Host "  Sleep, screen, hibernate, disk timeouts -> NEVER (on AC)" -ForegroundColor Green

# --- 2. Set Focus Assist to "Priority only" so notifications don't beep over the music ---
Write-Section "2. Focus Assist (silence notifications)"
try {
    # Registry path for Focus Assist (Windows 10/11). 1 = Off, 2 = Priority Only, 3 = Alarms Only.
    $regPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings\Windows.SystemToast.QuietHours"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    # Best-effort: stop the toast service from showing banners
    $globalSetting = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\CurrentVersion\PushNotifications"
    if (-not (Test-Path $globalSetting)) { New-Item -Path $globalSetting -Force | Out-Null }
    Set-ItemProperty -Path $globalSetting -Name "NoToastApplicationNotification" -Value 1 -Type DWord -Force
    Write-Host "  Toast notifications suppressed via registry (NoToastApplicationNotification=1)" -ForegroundColor Green
    Write-Host "  ALSO: manually enable Focus Assist 'Alarms only' from Action Center for full effect." -ForegroundColor Yellow
} catch {
    Write-Host "  WARN: couldn't set Focus Assist via registry. Toggle manually in Action Center." -ForegroundColor Yellow
}

# --- 3. Show battery status ---
Write-Section "3. Battery check"
$battery = Get-WmiObject Win32_Battery -ErrorAction SilentlyContinue
if ($null -ne $battery) {
    $pct = $battery.EstimatedChargeRemaining
    $status = switch ($battery.BatteryStatus) {
        1 { "Discharging" }
        2 { "AC Plugged In" }
        3 { "Fully Charged" }
        default { "Unknown ($($battery.BatteryStatus))" }
    }
    Write-Host "  Charge: $pct%   Status: $status"
    if ($pct -lt 80) {
        Write-Host "  WARNING: charge below 80%. Charge before leaving!" -ForegroundColor Red
    } else {
        Write-Host "  Battery OK." -ForegroundColor Green
    }
} else {
    Write-Host "  No battery (desktop?) - make sure power cable is firmly seated."
}

# --- 4. Audio output info ---
Write-Section "4. Audio devices"
try {
    Get-WmiObject Win32_SoundDevice | Where-Object { $_.Status -eq "OK" } | ForEach-Object {
        Write-Host "  - $($_.ProductName)"
    }
    Write-Host "  TIP: in Sound Settings, set the AUX/HDMI device as DEFAULT before the party." -ForegroundColor Yellow
} catch {
    Write-Host "  Couldn't enumerate audio devices."
}

# --- 5. Wi-Fi/Bluetooth - your call. Off is safer for live audio. ---
Write-Section "5. Network / Bluetooth"
Write-Host "  Wi-Fi  : leave ON if PulseMix backend needs it; OFF if playing a rendered MP3."
Write-Host "  Bluetooth: turn OFF unless you're using a BT speaker. AUX is more reliable."
Write-Host "  (Toggle manually from system tray - automating these requires admin + extra modules.)" -ForegroundColor Yellow

# --- 6. Open the exports folder so you can grab the mix file fast ---
Write-Section "6. Quick access"
$exports = Join-Path (Split-Path -Parent $PSScriptRoot) "public\exports"
if (Test-Path $exports) {
    Write-Host "  Exports folder: $exports"
    Write-Host "  Latest files:"
    Get-ChildItem $exports -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host ("    {0,-50}  {1:0.0} MB" -f $_.Name, ($_.Length / 1MB))
    }
} else {
    Write-Host "  WARN: $exports does not exist yet. Run an export from PulseMix first." -ForegroundColor Yellow
}

Write-Section "PARTY-READY CHECKLIST"
@(
    "[ ]  Main mix file copied to USB stick"
    "[ ]  Backup mix copied to phone (WhatsApp self-chat or Drive)"
    "[ ]  AUX cable + 3.5mm-to-RCA adapter + 3.5mm-to-XLR adapter in bag"
    "[ ]  Laptop charger packed"
    "[ ]  Phone charger packed"
    "[ ]  Test cable connection at home with a speaker BEFORE leaving"
    "[ ]  Tracklist PDF on phone (know what's coming next)"
    "[ ]  Drop moments (chendamelam, darbuka, ganapathy) in a labeled folder"
    "[ ]  Venue contact number saved"
    "[ ]  Drive route + parking checked"
) | ForEach-Object { Write-Host $_ -ForegroundColor White }

Write-Host ""
Write-Host "Lockdown complete. Have a great party!" -ForegroundColor Green
Write-Host "Run with -Restore tomorrow to undo: " -NoNewline
Write-Host "powershell -ExecutionPolicy Bypass -File $PSCommandPath -Restore" -ForegroundColor Cyan
