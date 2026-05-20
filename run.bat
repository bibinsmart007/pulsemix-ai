@echo off
title PulseMix AI DJ Studio
echo ====================================================================
echo   PulseMix AI - Next-Gen AI DJ Mixing Platform Bootstrapper
echo ====================================================================
echo.

:: 1. Verify Node.js presence
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your environment PATH.
    echo Please install Node.js (v18+) from https://nodejs.org/ to proceed.
    echo.
    pause
    exit /b
)

:: 2. Verify Python presence
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [SYSTEM NOTICE] Python was not found on your system.
    echo PulseMix will launch in FRONTEND-ONLY mode with pre-synthesized WAV loops.
    echo (You will still have full DJ decks, stems control, visualizers, and offline exporting!).
    echo.
    goto FRONTEND
)

echo [1/3] Preparing Python FastAPI backend environments...
echo.
python -m pip install -r backend\requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [SYSTEM NOTICE] Pip install finished. Some advanced dependencies may use fallbacks.
)
echo.

echo [2/3] Launching FastAPI Audio Processing Server (Port 8000)...
echo.
start "PulseMix AI - FastAPI Server" /min python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
echo FastAPI server running in background.
echo.

:FRONTEND
echo [3/3] Launching Next.js Studio Interface (Port 3000)...
echo.
npm run dev
echo.
pause
