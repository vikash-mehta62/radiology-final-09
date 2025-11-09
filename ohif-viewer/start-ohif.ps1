Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting OHIF Viewer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "Checking if Docker is running..." -ForegroundColor Yellow
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Pulling latest OHIF image..." -ForegroundColor Yellow
docker pull ohif/viewer:latest

Write-Host ""
Write-Host "Starting OHIF Viewer on port 3001..." -ForegroundColor Yellow
docker-compose up -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "OHIF Viewer Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access OHIF at: " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Yellow
Write-Host "To stop: docker-compose down" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
