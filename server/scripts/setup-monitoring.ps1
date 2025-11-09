# Orthanc Bridge Monitoring Setup Script (PowerShell)
# This script sets up the complete monitoring stack for the Orthanc Bridge

Write-Host "🚀 Setting up Orthanc Bridge Monitoring Stack..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Create monitoring directory structure
Write-Host "📁 Creating monitoring directory structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "monitoring\prometheus" | Out-Null
New-Item -ItemType Directory -Force -Path "monitoring\grafana" | Out-Null
New-Item -ItemType Directory -Force -Path "monitoring\alertmanager" | Out-Null
New-Item -ItemType Directory -Force -Path "monitoring\grafana\dashboards" | Out-Null

# Copy configuration files
Write-Host "📋 Copying configuration files..." -ForegroundColor Yellow
Copy-Item "config\prometheus.yml" "monitoring\prometheus\"
Copy-Item "config\prometheus-rules.yml" "monitoring\prometheus\"
Copy-Item "config\alertmanager.yml" "monitoring\alertmanager\"
Copy-Item "config\grafana-datasources.yml" "monitoring\grafana\"
Copy-Item "config\grafana-dashboards\*.json" "monitoring\grafana\dashboards\"
Copy-Item "config\grafana-dashboards\dashboard-config.yml" "monitoring\grafana\"

# Check environment variables
Write-Host "🔧 Checking environment variables..." -ForegroundColor Yellow
if (-not $env:SLACK_WEBHOOK_URL) {
    Write-Host "⚠️  SLACK_WEBHOOK_URL not set. Slack notifications will be disabled." -ForegroundColor Yellow
}

if (-not $env:PAGERDUTY_INTEGRATION_KEY) {
    Write-Host "⚠️  PAGERDUTY_INTEGRATION_KEY not set. PagerDuty alerts will be disabled." -ForegroundColor Yellow
}

# Start monitoring stack
Write-Host "🐳 Starting monitoring stack..." -ForegroundColor Yellow
Set-Location "monitoring"
docker-compose -f "..\config\docker-compose.monitoring.yml" up -d

# Wait for services to start
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow
$services = @(
    @{name="Prometheus"; port=9090},
    @{name="Grafana"; port=3000},
    @{name="AlertManager"; port=9093}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.port)" -TimeoutSec 5 -UseBasicParsing
        Write-Host "✅ $($service.name) is running on port $($service.port)" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($service.name) is not responding on port $($service.port)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Monitoring stack setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access your monitoring tools:" -ForegroundColor Cyan
Write-Host "   • Grafana:      http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "   • Prometheus:   http://localhost:9090" -ForegroundColor White
Write-Host "   • AlertManager: http://localhost:9093" -ForegroundColor White
Write-Host ""
Write-Host "📈 Available Dashboards:" -ForegroundColor Cyan
Write-Host "   • System Overview: Orthanc Bridge - System Overview" -ForegroundColor White
Write-Host "   • Detailed Metrics: Orthanc Bridge - Detailed Metrics" -ForegroundColor White
Write-Host "   • Alerts & Incidents: Orthanc Bridge - Alerts & Incidents" -ForegroundColor White
Write-Host ""
Write-Host "🔔 To configure notifications:" -ForegroundColor Cyan
Write-Host "   1. Set SLACK_WEBHOOK_URL environment variable" -ForegroundColor White
Write-Host "   2. Set PAGERDUTY_INTEGRATION_KEY environment variable" -ForegroundColor White
Write-Host "   3. Restart AlertManager: docker-compose restart alertmanager" -ForegroundColor White
Write-Host ""
Write-Host "📚 For more information, see the monitoring documentation." -ForegroundColor Cyan

Set-Location ".."