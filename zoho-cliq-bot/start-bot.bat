@echo off
echo ========================================
echo   PixelCheck Zoho Cliq Bot Startup
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js found!
echo.

echo [2/3] Installing dependencies...
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)
echo.

echo [3/3] Starting PixelCheck Bot Server...
echo.
echo Bot server will start on port 3001
echo Webhook URL: http://localhost:3001/bot/message
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

call npm start

pause
