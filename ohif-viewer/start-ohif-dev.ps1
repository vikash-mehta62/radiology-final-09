Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting OHIF Viewer (Development Mode)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\ohif-app"

Write-Host "Installing dependencies (this may take a few minutes on first run)..." -ForegroundColor Yellow
yarn install

Write-Host ""
Write-Host "Starting OHIF on port 3001..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Access OHIF at: " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

$env:APP_CONFIG = "config/local_orthanc.js"
$env:OHIF_PORT = "3001"
yarn run dev
