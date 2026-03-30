@echo off
setlocal EnableDelayedExpansion

:: Always run from the directory where this script lives (project root)
cd /d "%~dp0"

echo ============================================
echo   NearDrop - Starting Development Servers
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Install Python dependencies
echo Installing Python dependencies...
pip install -r backend\requirements.txt -q

:: Copy .env if it doesn't exist
if not exist backend\.env (
    echo Creating backend .env file...
    copy backend\.env.example backend\.env >nul
)

:: Seed the database
echo Seeding database...
python -m backend.seed

:: Install frontend dependencies
if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

:: Start backend in a new window
echo Starting backend server...
start "NearDrop Backend" cmd /k "call venv\Scripts\activate.bat && uvicorn backend.main:app --reload --port 8000"

:: Give backend a moment to start
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo Starting frontend server...
start "NearDrop Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   NearDrop is starting!
echo ============================================
echo.
echo   Driver PWA:   http://localhost:5173/driver
echo   Hub App:      http://localhost:5173/hub
echo   Dashboard:    http://localhost:5173/dashboard
echo   API Docs:     http://localhost:8000/docs
echo.
echo Two terminal windows have opened for backend and frontend.
echo Close those windows to stop the servers.
echo.
pause
