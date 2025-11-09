@echo off
echo ========================================
echo Verifying Structured Reporting Fix
echo ========================================
echo.

cd /d "%~dp0"

echo Checking file...
if exist "src\components\reporting\EnhancedReportingInterface.tsx" (
    echo ✓ EnhancedReportingInterface.tsx exists
    
    findstr /C:"Simply render StructuredReporting" "src\components\reporting\EnhancedReportingInterface.tsx" >nul
    if %errorlevel% equ 0 (
        echo ✓ File has been updated with new code
    ) else (
        echo ✗ File might not be updated
        echo   Please check the file manually
    )
) else (
    echo ✗ File not found
)

echo.
echo Checking StructuredReporting...
if exist "src\components\reporting\StructuredReporting.tsx" (
    echo ✓ StructuredReporting.tsx exists
    
    findstr /C:"Choose Template (MOVED TO FIRST)" "src\components\reporting\StructuredReporting.tsx" >nul
    if %errorlevel% equ 0 (
        echo ✓ Selection screen order is correct
    ) else (
        echo ✗ Selection screen might not be updated
    )
) else (
    echo ✗ File not found
)

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Start dev server: npm run dev
echo 2. Open browser and go to a study
echo 3. Click "Structured Reporting" tab
echo 4. Press Ctrl+Shift+R to hard refresh
echo 5. You should see selection screen with:
echo    - Choose Template (GREEN, FIRST)
echo    - AI-Generated (PURPLE, SECOND)
echo    - Normal Report (BLUE, THIRD)
echo ========================================
echo.

pause
