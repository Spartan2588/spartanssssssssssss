@echo off
title StoryForge AI - Complete System
echo.
echo  ==========================================
echo   StoryForge AI - Complete System
echo  ==========================================
echo.
echo  Starting both servers...
echo.
echo  [1] Python Backend (Episodic Engine) - Port 8000
echo  [2] Node.js Frontend (Story App) - Port 5000
echo.
echo  ==========================================
echo.

cd /d "%~dp0"

:: Start Python backend in new window
start "Episodic Engine (Port 8000)" cmd /k "cd episodic_engine && python api.py"

:: Wait 3 seconds
timeout /t 3 /nobreak >nul

:: Start Node.js frontend in new window
start "Story App (Port 5000)" cmd /k "cd temp_repo && npm start"

:: Wait 5 seconds then open browser
timeout /t 5 /nobreak >nul
start "" "http://localhost:5000"

echo.
echo  ==========================================
echo   Both servers are starting!
echo  ==========================================
echo.
echo   Frontend: http://localhost:5000
echo   Backend API: http://localhost:8000
echo   Backend Docs: http://localhost:8000/docs
echo.
echo  Press any key to exit this window...
echo  (Servers will continue running in separate windows)
echo  ==========================================
pause >nul
