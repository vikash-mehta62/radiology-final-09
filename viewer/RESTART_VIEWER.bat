@echo off
echo ========================================
echo Restarting Viewer with Cache Clear
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping any running processes...
taskkill /F /IM node.exe 2>nul

echo.
echo Clearing Vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo ✓ Vite cache cleared
) else (
    echo ✓ No Vite cache found
)

echo.
echo Starting dev server...
echo.
echo ========================================
echo IMPORTANT: Clear your browser cache!
echo Press Ctrl+Shift+R or Ctrl+F5
echo ========================================
echo.

npm run dev

pause
