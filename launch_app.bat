@echo off
setlocal ENABLEDELAYEDEXPANSION
title BrewTrade AI Launcher

REM ============================================================
REM   BrewTrade AI - Carib Brewery International Ordering POC
REM   Single-click launcher (Windows)
REM ============================================================

color 0E
cls
echo.
echo +==============================================================+
echo ^|                                                              ^|
echo ^|   BrewTrade AI - Carib Brewery International Ordering        ^|
echo ^|                   Intelligence Platform                      ^|
echo ^|                                                              ^|
echo +==============================================================+
echo.
color 07

REM ---------- Prerequisite checks ----------
echo [1/6] Checking prerequisites...
where python >nul 2>nul
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Python is not installed or not on PATH.
    echo          Please install Python 3.10+ from https://python.org
    echo          and re-run this script.
    echo.
    color 07
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Node.js is not installed or not on PATH.
    echo          Please install Node.js 18+ from https://nodejs.org
    echo          and re-run this script.
    echo.
    color 07
    pause
    exit /b 1
)

for /f "delims=" %%i in ('python --version 2^>^&1') do set "PY_VER=%%i"
for /f "delims=" %%i in ('node --version 2^>^&1') do set "NODE_VER=%%i"
echo        Found: !PY_VER!
echo        Found: Node !NODE_VER!

REM Node 18+ is required for Vite 5. Parse the major version (strip leading 'v').
set "NODE_RAW=!NODE_VER:v=!"
for /f "tokens=1 delims=." %%a in ("!NODE_RAW!") do set "NODE_MAJOR=%%a"
if !NODE_MAJOR! LSS 18 (
    color 0C
    echo.
    echo  [ERROR] Node !NODE_VER! is installed, but BrewTrade AI requires Node 18+.
    echo          Vite 5 fails on Node 16 with "crypto.getRandomValues is not a function".
    echo.
    echo          Install Node 18 LTS from https://nodejs.org/en/download/
    echo          After install, open a NEW terminal so the PATH refreshes, then
    echo          delete frontend\node_modules and re-run this script.
    echo.
    color 07
    pause
    exit /b 1
)
echo.

REM ---------- Backend venv ----------
echo [2/6] Preparing backend (Python venv)...
cd /d "%~dp0backend" || (
    color 0C & echo  [ERROR] backend\ folder not found. & color 07 & pause & exit /b 1
)

if not exist ".venv" (
    echo        Creating virtual environment .venv ...
    python -m venv .venv
    if errorlevel 1 (
        color 0C & echo  [ERROR] Failed to create venv. & color 07 & pause & exit /b 1
    )
) else (
    echo        Virtual environment already exists.
)

call .venv\Scripts\activate.bat

REM ---------- Backend deps ----------
echo [3/6] Installing backend dependencies...
if not exist ".deps_installed" (
    echo        Running pip install -r requirements.txt ...
    pip install --upgrade pip >nul
    pip install -r requirements.txt
    if errorlevel 1 (
        color 0C & echo  [ERROR] pip install failed. & color 07 & pause & exit /b 1
    )
    echo installed > .deps_installed
) else (
    echo        Backend dependencies already installed (delete backend\.deps_installed to reinstall).
)

call .venv\Scripts\deactivate.bat 2>nul

REM ---------- Frontend deps ----------
echo [4/6] Preparing frontend (Node packages)...
cd /d "%~dp0frontend" || (
    color 0C & echo  [ERROR] frontend\ folder not found. & color 07 & pause & exit /b 1
)

if not exist "node_modules" (
    echo        Running npm install (this may take a few minutes) ...
    call npm install
    if errorlevel 1 (
        color 0C & echo  [ERROR] npm install failed. & color 07 & pause & exit /b 1
    )
) else (
    echo        node_modules already present.
)

cd /d "%~dp0"

REM ---------- Start backend ----------
echo.
echo [5/6] Starting FastAPI backend (port 8000) in a new window...
pushd "%~dp0backend"
start "BrewTrade Backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"
popd

echo        Waiting 8 seconds for the backend to initialize...
timeout /t 8 /nobreak >nul

REM ---------- Start frontend ----------
echo [6/6] Starting React frontend (port 5173) in a new window...
pushd "%~dp0frontend"
start "BrewTrade Frontend" cmd /k "npm run dev"
popd

echo        Waiting 6 seconds for the frontend dev server...
timeout /t 6 /nobreak >nul

REM ---------- Open browser ----------
start "" http://localhost:5173

color 0E
echo.
echo +==============================================================+
echo ^|                  BrewTrade AI is now running                 ^|
echo +==============================================================+
echo ^|                                                              ^|
echo ^|   Frontend  :  http://localhost:5173                         ^|
echo ^|   Backend   :  http://localhost:8000                         ^|
echo ^|   API Docs  :  http://localhost:8000/docs                    ^|
echo ^|                                                              ^|
echo +-------------------- DEMO CREDENTIALS ------------------------+
echo ^|                                                              ^|
echo ^|   Distributor :  caribbean_imports  /  demo123               ^|
echo ^|                  (dozens of distributor accounts seeded;     ^|
echo ^|                   login screen shows hints)                  ^|
echo ^|   Manager     :  manager_demo       /  demo123               ^|
echo ^|   Executive   :  exec_demo          /  demo123               ^|
echo ^|                                                              ^|
echo +==============================================================+
echo.
echo  The backend and frontend run in their own windows. Close those
echo  windows (or press Ctrl+C inside them) to stop the services.
echo.
echo  If a window failed to open, check it for an error message,
echo  or run uvicorn/npm manually from backend\ and frontend\.
echo.
color 07
pause
endlocal
exit /b 0
