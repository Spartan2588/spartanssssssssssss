@echo off
title Episodic Intelligence Engine - Server
echo.
echo  ==========================================
echo   Episodic Intelligence Engine
echo   Starting server at http://127.0.0.1:8000
echo  ==========================================
echo.

cd /d "%~dp0"

:: Wait 2 seconds then open the browser
start "" timeout /t 2 >nul && start "" "http://127.0.0.1:8000/"

:: Start the server (keeps this window open)
python api.py

pause
