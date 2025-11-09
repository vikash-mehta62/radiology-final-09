Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OHIF Viewer Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if OHIF is installed
Write-Host "Checking installation..." -ForegroundColor Yellow
if (Test-Path "ohif-app/node_modules") {
    Write-Host "✓ OHIF dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ OHIF dependencies NOT installed" -ForegroundColor Red
    Write-Host "  Run: cd ohif-app && yarn install" -ForegroundColor Yellow
}

Write-Host ""

# Check if OHIF is running
Write-Host "Checking if OHIF is running..." -ForegroundColor Yellow
try {
    $response = Test-NetConnection -ComputerName localhost -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($response) {
        Write-Host "✓ OHIF is running on port 3001" -ForegroundColor Green
        Write-Host "  Access at: http://localhost:3001" -ForegroundColor Cyan
    } else {
        Write-Host "✗ OHIF is NOT running" -ForegroundColor Red
        Write-Host "  Start with: .\start-ohif-dev.ps1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ OHIF is NOT running" -ForegroundColor Red
    Write-Host "  Start with: .\start-ohif-dev.ps1" -ForegroundColor Yellow
}

Write-Host ""

# Check if Orthanc is running
Write-Host "Checking if Orthanc is running..." -ForegroundColor Yellow
try {
    $response = Test-NetConnection -ComputerName localhost -Port 8042 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($response) {
        Write-Host "✓ Orthanc is running on port 8042" -ForegroundColor Green
        Write-Host "  Access at: http://localhost:8042" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Orthanc is NOT running" -ForegroundColor Red
        Write-Host "  OHIF needs Orthanc to work!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Orthanc is NOT running" -ForegroundColor Red
    Write-Host "  OHIF needs Orthanc to work!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
