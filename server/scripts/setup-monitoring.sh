#!/bin/bash

# Orthanc Bridge Monitoring Setup Script
# This script sets up the complete monitoring stack for the Orthanc Bridge

set -e

echo "🚀 Setting up Orthanc Bridge Monitoring Stack..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create monitoring directory structure
echo "📁 Creating monitoring directory structure..."
mkdir -p monitoring/{prometheus,grafana,alertmanager}
mkdir -p monitoring/grafana/dashboards

# Copy configuration files
echo "📋 Copying configuration files..."
cp config/prometheus.yml monitoring/prometheus/
cp config/prometheus-rules.yml monitoring/prometheus/
cp config/alertmanager.yml monitoring/alertmanager/
cp config/grafana-datasources.yml monitoring/grafana/
cp config/grafana-dashboards/*.json monitoring/grafana/dashboards/
cp config/grafana-dashboards/dashboard-config.yml monitoring/grafana/

# Set environment variables for AlertManager
echo "🔧 Setting up environment variables..."
if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "⚠️  SLACK_WEBHOOK_URL not set. Slack notifications will be disabled."
fi

if [ -z "$PAGERDUTY_INTEGRATION_KEY" ]; then
    echo "⚠️  PAGERDUTY_INTEGRATION_KEY not set. PagerDuty alerts will be disabled."
fi

# Start monitoring stack
echo "🐳 Starting monitoring stack..."
cd monitoring
docker-compose -f ../config/docker-compose.monitoring.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
services=("prometheus:9090" "grafana:3000" "alertmanager:9093")
for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -s -f "http://localhost:$port" > /dev/null; then
        echo "✅ $name is running on port $port"
    else
        echo "❌ $name is not responding on port $port"
    fi
done

echo ""
echo "🎉 Monitoring stack setup complete!"
echo ""
echo "📊 Access your monitoring tools:"
echo "   • Grafana:      http://localhost:3000 (admin/admin)"
echo "   • Prometheus:   http://localhost:9090"
echo "   • AlertManager: http://localhost:9093"
echo ""
echo "📈 Available Dashboards:"
echo "   • System Overview: Orthanc Bridge - System Overview"
echo "   • Detailed Metrics: Orthanc Bridge - Detailed Metrics"
echo "   • Alerts & Incidents: Orthanc Bridge - Alerts & Incidents"
echo ""
echo "🔔 To configure notifications:"
echo "   1. Set SLACK_WEBHOOK_URL environment variable"
echo "   2. Set PAGERDUTY_INTEGRATION_KEY environment variable"
echo "   3. Restart AlertManager: docker-compose restart alertmanager"
echo ""
echo "📚 For more information, see the monitoring documentation."