# CORS Fix Script for Orthanc
# This script adds CORS headers to Orthanc configuration

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OHIF CORS Fix for Orthanc" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Close this window" -ForegroundColor Yellow
    Write-Host "2. Right-click on PowerShell" -ForegroundColor Yellow
    Write-Host "3. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "4. Run this script again" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

$configPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json"
$backupPath = "C:\Program Files\Orthanc Server\Configuration\orthanc.json.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"

# Check if config file exists
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: Orthanc configuration file not found at:" -ForegroundColor Red
    Write-Host $configPath -ForegroundColor Red
    Write-Host ""
    Write-Host "Please verify Orthanc is installed." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Found Orthanc configuration file" -ForegroundColor Green
Write-Host ""

# Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
try {
    Copy-Item $configPath $backupPath -Force
    Write-Host "✓ Backup created: $backupPath" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create backup: $_" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Reading configuration file..." -ForegroundColor Yellow

# Read the config file
$content = Get-Content $configPath -Raw

# Check if HttpHeaders already exists
if ($content -match '"HttpHeaders"\s*:\s*\{') {
    Write-Host "✓ HttpHeaders already exists in configuration" -ForegroundColor Green
    Write-Host "Skipping modification..." -ForegroundColor Yellow
} else {
    Write-Host "Adding CORS headers..." -ForegroundColor Yellow
    
    # The CORS configuration to add
    $corsConfig = @'

  "HttpHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With"
  },
'@

    # Find and replace
    if ($content -match '"HttpDescribeErrors"\s*:\s*true\s*,') {
        $content = $content -replace '("HttpDescribeErrors"\s*:\s*true\s*,)', "`$1$corsConfig"
        
        # Save the modified content
        try {
            Set-Content -Path $configPath -Value $content -NoNewline -Force
            Write-Host "✓ CORS headers added successfully" -ForegroundColor Green
        } catch {
            Write-Host "ERROR: Failed to save configuration: $_" -ForegroundColor Red
            Write-Host "Restoring backup..." -ForegroundColor Yellow
            Copy-Item $backupPath $configPath -Force
            pause
            exit 1
        }
    } else {
        Write-Host "ERROR: Could not find 'HttpDescribeErrors' in configuration" -ForegroundColor Red
        Write-Host "Manual edit required. See QUICK_FIX.txt for instructions." -ForegroundColor Yellow
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "Restarting Orthanc service..." -ForegroundColor Yellow

try {
    # Stop Orthanc
    Write-Host "Stopping Orthanc..." -ForegroundColor Yellow
    Stop-Service Orthanc -Force -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    # Start Orthanc
    Write-Host "Starting Orthanc..." -ForegroundColor Yellow
    Start-Service Orthanc -ErrorAction Stop
    Start-Sleep -Seconds 5
    
    # Check if service is running
    $service = Get-Service Orthanc
    if ($service.Status -eq "Running") {
        Write-Host "✓ Orthanc service restarted successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Orthanc service status: $($service.Status)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Failed to restart Orthanc: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please restart Orthanc manually:" -ForegroundColor Yellow
    Write-Host "1. Press Win+R" -ForegroundColor Yellow
    Write-Host "2. Type: services.msc" -ForegroundColor Yellow
    Write-Host "3. Find 'Orthanc' and restart it" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Testing CORS headers..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8042/dicom-web/studies" -Method GET -UseBasicParsing -ErrorAction Stop
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    
    if ($corsHeader) {
        Write-Host "✓ CORS headers are working!" -ForegroundColor Green
        Write-Host "  Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Cyan
    } else {
        Write-Host "⚠ CORS header not found in response" -ForegroundColor Yellow
        Write-Host "  This might be normal - try refreshing OHIF" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not test CORS (Orthanc might still be starting)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ CORS Fix Applied!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open OHIF: http://localhost:3001" -ForegroundColor White
Write-Host "2. Press Ctrl+F5 to hard refresh" -ForegroundColor White
Write-Host "3. Studies should now load!" -ForegroundColor White
Write-Host ""
Write-Host "Backup saved at:" -ForegroundColor Cyan
Write-Host $backupPath -ForegroundColor White
Write-Host ""

pause
