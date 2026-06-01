@echo off
title PulseMix DJ - KEEP THIS WINDOW OPEN
cd /d "C:\Users\user\ANTIGRAVITY1\public"
echo.
echo   ==========================================
echo     PULSEMIX DJ
echo   ==========================================
echo.
echo   Starting the music server...
echo.
echo   When you see "Serving HTTP on ..." below,
echo   your browser will open automatically.
echo.
echo   *** KEEP THIS BLACK WINDOW OPEN ***
echo   *** all night - closing it stops   ***
echo   *** the music.                     ***
echo   ==========================================
echo.
REM Open the browser after a short delay (server needs ~1 sec to boot)
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:8080/dj_live.html"
REM Start the server - try python, then py
python -m http.server 8080
if errorlevel 1 py -m http.server 8080
if errorlevel 1 (
  echo.
  echo   ==========================================
  echo   PYTHON NOT FOUND.
  echo   Use the backup: open this file in VLC:
  echo   C:\Users\user\ANTIGRAVITY1\public\exports\party_29may_v4.mp3
  echo   ==========================================
  pause
)
