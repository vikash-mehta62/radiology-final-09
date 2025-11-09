@echo off
echo ========================================
echo OHIF CORS Fix for Orthanc
echo ========================================
echo.
echo This will add CORS headers to Orthanc configuration
echo.
echo IMPORTANT: You must run this as Administrator!
echo Right-click this file and select "Run as administrator"
echo.
pause

cd /d "%~dp0"

echo.
echo Opening Orthanc configuration in Notepad...
echo.
echo INSTRUCTIONS:
echo 1. Find the line: "HttpDescribeErrors" : true,
echo 2. After that line, add this text:
echo.
echo   "HttpHeaders": {
echo     "Access-Control-Allow-Origin": "*",
echo     "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
echo     "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With"
echo   },
echo.
echo 3. Save the file (Ctrl+S)
echo 4. Close Notepad
echo.
pause

notepad "C:\Program Files\Orthanc Server\Configuration\orthanc.json"

echo.
echo Did you save the changes? (Y/N)
set /p saved=
if /i "%saved%"=="Y" goto restart
if /i "%saved%"=="y" goto restart
echo Exiting without restart...
goto end

:restart
echo.
echo Restarting Orthanc service...
net stop Orthanc
timeout /t 2 /nobreak >nul
net start Orthanc

echo.
echo ========================================
echo Done!
echo ========================================
echo.
echo Now refresh OHIF at: http://localhost:3001
echo Press Ctrl+F5 to hard refresh
echo.

:end
pause
