# Orthanc Bridge Production Deployment Script (PowerShell)
# This script automates the deployment of the Orthanc Bridge to production environments

param(
    [Parameter(Position=0)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Rollback,
    [switch]$Help
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ConfigDir = Join-Path $ProjectRoot "deployment\environments\$Environment"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Error-Log {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Usage information
function Show-Usage {
    Write-Host "Usage: .\deploy.ps1 [environment] [options]"
    Write-Host ""
    Write-Host "Environments:"
    Write-Host "  staging     Deploy to staging environment (default)"
    Write-Host "  production  Deploy to production environment"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -DryRun     Show what would be deployed without executing"
    Write-Host "  -Force      Skip confirmation prompts"
    Write-Host "  -Rollback   Rollback to previous deployment"
    Write-Host "  -Help       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy.ps1 staging                    # Deploy to staging"
    Write-Host "  .\deploy.ps1 production -DryRun         # Preview production deployment"
    Write-Host "  .\deploy.ps1 production -Rollback       # Rollback production deployment"
}

if ($Help) {
    Show-Usage
    exit 0
}

# Check if configuration exists
if (-not (Test-Path $ConfigDir)) {
    Write-Error-Log "Configuration directory not found: $ConfigDir"
    Write-Error-Log "Please run: .\scripts\setup-deployment.ps1 $Environment"
    exit 1
}

Write-Log "🚀 Starting Orthanc Bridge deployment to $Environment environment"

# Pre-deployment validation
function Test-Prerequisites {
    Write-Log "🔍 Validating prerequisites..."
    
    # Check Docker
    try {
        docker --version | Out-Null
    } catch {
        Write-Error-Log "Docker is not installed"
        exit 1
    }
    
    # Check Docker Compose
    try {
        docker-compose --version | Out-Null
    } catch {
        Write-Error-Log "Docker Compose is not installed"
        exit 1
    }
    
    # Check environment configuration
    $envFile = Join-Path $ConfigDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Error-Log "Environment configuration not found: $envFile"
        exit 1
    }
    
    # Check required secrets
    $envContent = Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [PSCustomObject]@{
                Name = $matches[1]
                Value = $matches[2]
            }
        }
    }
    
    $orthancPassword = ($envContent | Where-Object { $_.Name -eq "ORTHANC_PASSWORD" }).Value
    if (-not $orthancPassword -or $orthancPassword -eq "orthanc_secure_2024") {
        Write-Error-Log "Production Orthanc password not configured"
        exit 1
    }
    
    $webhookSecret = ($envContent | Where-Object { $_.Name -eq "WEBHOOK_SECRET" }).Value
    if (-not $webhookSecret -or $webhookSecret -eq "webhook_secret_2024_change_in_prod") {
        Write-Error-Log "Production webhook secret not configured"
        exit 1
    }
    
    Write-Success "Prerequisites validated"
}

# Health check function
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [string]$HealthUrl,
        [int]$MaxAttempts = 30
    )
    
    Write-Log "🏥 Checking health of $ServiceName..."
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "$ServiceName is healthy"
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        Write-Log "Attempt $attempt/$MaxAttempts`: $ServiceName not ready, waiting..."
        Start-Sleep -Seconds 10
    }
    
    Write-Error-Log "$ServiceName failed health check after $MaxAttempts attempts"
    return $false
}

# Backup current deployment
function Backup-Deployment {
    if ($Environment -eq "production") {
        Write-Log "💾 Creating deployment backup..."
        
        $backupDir = Join-Path $ProjectRoot "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        
        # Backup current docker-compose state
        $composeFile = Join-Path $ConfigDir "docker-compose.yml"
        $envFile = Join-Path $ConfigDir ".env"
        
        docker-compose -f $composeFile config | Out-File -FilePath (Join-Path $backupDir "docker-compose.backup.yml")
        
        # Backup environment configuration
        Copy-Item $envFile (Join-Path $backupDir ".env.backup")
        
        # Export current container images
        docker images --format "table {{.Repository}}:{{.Tag}}" | Select-String -Pattern "(orthanc|dicom-bridge)" | Out-File -FilePath (Join-Path $backupDir "images.txt")
        
        Write-Success "Backup created at $backupDir"
        $backupDir | Out-File -FilePath (Join-Path $ProjectRoot ".last_backup")
    }
}

# Deploy services
function Deploy-Services {
    Write-Log "🐳 Deploying services..."
    
    Set-Location $ProjectRoot
    
    $composeFile = Join-Path $ConfigDir "docker-compose.yml"
    $envFile = Join-Path $ConfigDir ".env"
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would execute the following commands:"
        Write-Host "  docker-compose -f $composeFile --env-file $envFile pull"
        Write-Host "  docker-compose -f $composeFile --env-file $envFile up -d"
        return
    }
    
    # Pull latest images
    docker-compose -f $composeFile --env-file $envFile pull
    
    # Deploy services
    docker-compose -f $composeFile --env-file $envFile up -d
    
    Write-Success "Services deployed"
}

# Post-deployment validation
function Test-Deployment {
    Write-Log "✅ Validating deployment..."
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would validate deployment health"
        return $true
    }
    
    # Load environment configuration
    $envFile = Join-Path $ConfigDir ".env"
    $envContent = Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [PSCustomObject]@{
                Name = $matches[1]
                Value = $matches[2]
            }
        }
    }
    
    $orthancPort = ($envContent | Where-Object { $_.Name -eq "ORTHANC_HTTP_PORT" }).Value
    if (-not $orthancPort) { $orthancPort = "8042" }
    
    $bridgePort = ($envContent | Where-Object { $_.Name -eq "BRIDGE_PORT" }).Value
    if (-not $bridgePort) { $bridgePort = "3001" }
    
    # Check service health
    if (-not (Test-ServiceHealth "Orthanc" "http://localhost:$orthancPort/system")) {
        return $false
    }
    
    if (-not (Test-ServiceHealth "DICOM Bridge" "http://localhost:$bridgePort/health")) {
        return $false
    }
    
    if (-not (Test-ServiceHealth "Redis" "http://localhost:$bridgePort/health/detailed")) {
        return $false
    }
    
    # Run smoke tests if available
    $smokeTestFile = Join-Path $ProjectRoot "tests\smoke-tests.js"
    if (Test-Path $smokeTestFile) {
        Write-Log "🧪 Running smoke tests..."
        Set-Location (Join-Path $ProjectRoot "tests")
        
        try {
            node smoke-tests.js
            Write-Success "Smoke tests passed"
        } catch {
            Write-Error-Log "Smoke tests failed"
            return $false
        }
    }
    
    Write-Success "Deployment validation completed"
    return $true
}

# Rollback function
function Invoke-Rollback {
    Write-Log "🔄 Rolling back deployment..."
    
    $lastBackupFile = Join-Path $ProjectRoot ".last_backup"
    if (-not (Test-Path $lastBackupFile)) {
        Write-Error-Log "No backup found for rollback"
        exit 1
    }
    
    $backupDir = Get-Content $lastBackupFile
    
    if (-not (Test-Path $backupDir)) {
        Write-Error-Log "Backup directory not found: $backupDir"
        exit 1
    }
    
    # Stop current services
    $composeFile = Join-Path $ConfigDir "docker-compose.yml"
    $envFile = Join-Path $ConfigDir ".env"
    docker-compose -f $composeFile --env-file $envFile down
    
    # Restore configuration
    Copy-Item (Join-Path $backupDir ".env.backup") $envFile
    Copy-Item (Join-Path $backupDir "docker-compose.backup.yml") $composeFile
    
    # Restart services
    docker-compose -f $composeFile --env-file $envFile up -d
    
    Write-Success "Rollback completed"
}

# Confirmation prompt
function Confirm-Deployment {
    if ($Force -or $DryRun) {
        return $true
    }
    
    Write-Host ""
    Write-Warning-Log "⚠️  You are about to deploy to $Environment environment"
    Write-Host ""
    Write-Host "Configuration:"
    Write-Host "  Environment: $Environment"
    Write-Host "  Config Dir:  $ConfigDir"
    Write-Host ""
    
    if ($Environment -eq "production") {
        Write-Host "🚨 PRODUCTION DEPLOYMENT WARNING 🚨" -ForegroundColor Red
        Write-Host "This will deploy to the production environment."
        Write-Host "Ensure you have:"
        Write-Host "  ✅ PACS administrator approval"
        Write-Host "  ✅ Completed staging testing"
        Write-Host "  ✅ Verified all security requirements"
        Write-Host ""
    }
    
    $response = Read-Host "Continue with deployment? (yes/no)"
    return $response -match "^[Yy][Ee][Ss]$"
}

# Main execution
function Main {
    try {
        if ($Rollback) {
            Invoke-Rollback
            return
        }
        
        # Run pre-deployment checks
        Write-Log "🔍 Running pre-deployment health checks..."
        $preCheckResult = & node "$ScriptDir\pre-deployment-check.js" $Environment
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Log "Pre-deployment checks failed. Please resolve issues before continuing."
            exit 1
        }
        
        Test-Prerequisites
        
        if (-not (Confirm-Deployment)) {
            Write-Log "Deployment cancelled"
            return
        }
        
        Backup-Deployment
        Deploy-Services
        
        if (-not (Test-Deployment)) {
            Write-Error-Log "Deployment validation failed"
            exit 1
        }
        
        Write-Host ""
        Write-Success "🎉 Deployment to $Environment completed successfully!"
        Write-Host ""
        Write-Log "📊 Access your services:"
        
        # Load environment configuration for output
        $envFile = Join-Path $ConfigDir ".env"
        $envContent = Get-Content $envFile | ForEach-Object {
            if ($_ -match "^([^=]+)=(.*)$") {
                [PSCustomObject]@{
                    Name = $matches[1]
                    Value = $matches[2]
                }
            }
        }
        
        $orthancPort = ($envContent | Where-Object { $_.Name -eq "ORTHANC_HTTP_PORT" }).Value
        if (-not $orthancPort) { $orthancPort = "8042" }
        
        $bridgePort = ($envContent | Where-Object { $_.Name -eq "BRIDGE_PORT" }).Value
        if (-not $bridgePort) { $bridgePort = "3001" }
        
        Write-Host "  • Orthanc:      http://localhost:$orthancPort"
        Write-Host "  • DICOM Bridge: http://localhost:$bridgePort"
        Write-Host "  • Health Check: http://localhost:$bridgePort/health"
        Write-Host ""
        
        if ($Environment -eq "production") {
            Write-Warning-Log "🔍 Monitor the deployment for the next 24 hours"
            Write-Warning-Log "📞 Emergency rollback: .\scripts\deploy.ps1 production -Rollback"
            Write-Warning-Log "📞 Alternative rollback: node .\scripts\deployment-manager.js rollback production"
        }
        
    } catch {
        Write-Error-Log "Deployment failed: $($_.Exception.Message)"
        exit 1
    }
}

# Execute main function
Main