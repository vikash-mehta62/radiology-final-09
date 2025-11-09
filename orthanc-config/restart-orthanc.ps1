Write-Host "Restarting Orthanc..." -ForegroundColor Yellow

# Stop Orthanc processes
Get-Process | Where-Object {$_.ProcessName -like "*orthanc*"} | ForEach-Object {
    Write-Host "Stopping $($_.ProcessName) (PID: $($_.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

# Start Orthanc
Write-Host "Starting Orthanc..." -ForegroundColor Green
Start-Process -FilePath "Orthanc.exe" -ArgumentList "orthanc.json" -WorkingDirectory $PSScriptRoot

Start-Sleep -Seconds 3

# Check if Orthanc is running
$running = Test-NetConnection localhost -Port 8042 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($running) {
    Write-Host "✓ Orthanc restarted successfully on port 8042" -ForegroundColor Green
} else {
    Write-Host "✗ Orthanc failed to start" -ForegroundColor Red
}
