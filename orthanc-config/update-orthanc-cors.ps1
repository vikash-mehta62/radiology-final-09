# This script updates the Orthanc configuration to enable CORS
# Must be run as Administrator

$configPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json"
$backupPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json.backup"

Write-Host "Updating Orthanc CORS configuration..." -ForegroundColor Yellow

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Backup original config
Write-Host "Creating backup..." -ForegroundColor Yellow
Copy-Item $configPath $backupPath -Force

# Read the config
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Add CORS headers
$corsHeaders = @{
    "Access-Control-Allow-Origin" = "*"
    "Access-Control-Allow-Methods" = "GET, POST, PUT, DELETE, OPTIONS"
    "Access-Control-Allow-Headers" = "Content-Type, Authorization, Accept, X-Requested-With"
    "Access-Control-Allow-Credentials" = "true"
    "Access-Control-Max-Age" = "86400"
}

$config | Add-Member -NotePropertyName "HttpHeaders" -NotePropertyValue $corsHeaders -Force

# Save the config
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath

Write-Host "✓ Configuration updated" -ForegroundColor Green

# Restart Orthanc service
Write-Host "Restarting Orthanc service..." -ForegroundColor Yellow
Restart-Service Orthanc

Start-Sleep -Seconds 3

# Verify service is running
$service = Get-Service Orthanc
if ($service.Status -eq "Running") {
    Write-Host "✓ Orthanc service restarted successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Orthanc service failed to start" -ForegroundColor Red
}

# Test CORS headers
Write-Host "`nTesting CORS headers..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8042/dicom-web/studies" -Method GET -UseBasicParsing
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    
    if ($corsHeader -eq "*") {
        Write-Host "✓ CORS headers are working!" -ForegroundColor Green
        Write-Host "  Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Cyan
    } else {
        Write-Host "✗ CORS headers not found" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error testing CORS: $_" -ForegroundColor Red
}

Write-Host "`n✓ Done! OHIF should now be able to connect to Orthanc." -ForegroundColor Green
Write-Host "Refresh OHIF at http://localhost:3001" -ForegroundColor Cyan

pause
