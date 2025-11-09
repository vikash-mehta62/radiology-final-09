# Script to add CORS headers to Orthanc configuration
# Must be run as Administrator

$configPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json"
$backupPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "Adding CORS headers to Orthanc configuration..." -ForegroundColor Yellow

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Backup original config
Write-Host "Creating backup at: $backupPath" -ForegroundColor Yellow
Copy-Item $configPath $backupPath -Force

# Read the config file
$content = Get-Content $configPath -Raw

# Check if HttpHeaders already exists
if ($content -match '"HttpHeaders"\s*:') {
    Write-Host "HttpHeaders already exists in config. Skipping..." -ForegroundColor Yellow
} else {
    # Find the line with "HttpDescribeErrors" and add HttpHeaders after it
    $corsConfig = @'
  
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  },
'@

    # Replace the line containing HttpDescribeErrors
    $content = $content -replace '("HttpDescribeErrors"\s*:\s*true\s*,)', "`$1$corsConfig"
    
    # Save the modified content
    Set-Content -Path $configPath -Value $content -NoNewline
    
    Write-Host "✓ CORS headers added to configuration" -ForegroundColor Green
}

# Restart Orthanc service
Write-Host "`nRestarting Orthanc service..." -ForegroundColor Yellow
try {
    Restart-Service Orthanc -ErrorAction Stop
    Write-Host "✓ Orthanc service restarted" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to restart Orthanc: $_" -ForegroundColor Red
    Write-Host "Please restart Orthanc manually from services.msc" -ForegroundColor Yellow
}

Start-Sleep -Seconds 5

# Test CORS headers
Write-Host "`nTesting CORS headers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8042/dicom-web/studies" -Method GET -UseBasicParsing -ErrorAction Stop
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    
    if ($corsHeader) {
        Write-Host "✓ CORS headers are working!" -ForegroundColor Green
        Write-Host "  Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Cyan
    } else {
        Write-Host "✗ CORS headers not found in response" -ForegroundColor Red
        Write-Host "  This might be normal - try refreshing OHIF" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error testing: $_" -ForegroundColor Red
}

Write-Host "`n✓ Done! Refresh OHIF at http://localhost:3001" -ForegroundColor Green
Write-Host "Backup saved at: $backupPath" -ForegroundColor Cyan

pause
