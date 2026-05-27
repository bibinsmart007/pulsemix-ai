@echo off
title PulseMix LIVE - Server & Backend
color 0a

echo ===================================================
echo     PULSEMIX LIVE - STARTUP SEQUENCE INITIATED
echo ===================================================
echo.

echo [1/3] Starting Python Backend Server (Port 8766)...
start "PulseMix Backend" cmd /c "python backend/dj_requests.py"

echo [2/3] Starting Frontend Web Server (Port 3000)...
start "PulseMix Frontend" cmd /c "python -m http.server 3000"

echo [3/3] Launching PulseMix LIVE in your default browser...
timeout /t 2 /nobreak > nul
start http://localhost:3000/public/dj_live.html

echo.
echo ===================================================
echo   SYSTEMS ONLINE. HAVE A GREAT SHOW ON FRIDAY!
echo ===================================================
echo.
echo Leave this window open while you perform. 
echo When you are finished, just close this window.
pause
