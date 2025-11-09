@echo off
echo ========================================
echo Starting OHIF Viewer (Development Mode)
echo ========================================
echo.

cd /d "%~dp0\ohif-app"

echo Installing dependencies (this may take a few minutes on first run)...
call yarn install

echo.
echo Starting OHIF on port 3001...
echo.
echo Access OHIF at: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.

set APP_CONFIG=config/local_orthanc.js
set OHIF_PORT=3001
call yarn run dev
