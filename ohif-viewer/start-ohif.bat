@echo off
echo ========================================
echo Starting OHIF Viewer
echo ========================================
echo.

cd /d "%~dp0"

echo Checking if Docker is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

echo.
echo Pulling latest OHIF image...
docker pull ohif/viewer:latest

echo.
echo Starting OHIF Viewer on port 3001...
docker-compose up -d

echo.
echo ========================================
echo OHIF Viewer Started Successfully!
echo ========================================
echo.
echo Access OHIF at: http://localhost:3001
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
pause
