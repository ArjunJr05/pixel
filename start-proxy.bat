@echo off
echo ========================================
echo   PixelCheck - Starting Proxy Server
echo ========================================
echo.
echo Starting proxy server on http://localhost:3001
echo Keep this window open while using the app!
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0server"
node proxy.js
