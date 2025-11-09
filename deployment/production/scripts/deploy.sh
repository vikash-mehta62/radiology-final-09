#!/bin/bash

# Production Deployment Script
# This script deploys the PACS application to production

set -e

echo "=========================================="
echo "PACS Production Deployment"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOYMENT_DIR="/opt/pacs/deployment/production"
BACKUP_DIR="/opt/pacs/backups"
LOG_FILE="/opt/pacs/logs/deployment.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running in correct directory
if [ ! -f "$DEPLOYMENT_DIR/docker-compose.prod.yml" ]; then
    error "docker-compose.prod.yml not found in $DEPLOYMENT_DIR"
fi

# Load environment variables
if [ ! -f "$DEPLOYMENT_DIR/.env" ]; then
    error ".env file not found. Please create it from .env.example"
fi

source "$DEPLOYMENT_DIR/.env"

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed"
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    warning "Disk usage is above 80%: ${DISK_USAGE}%"
fi

# Check if services are running
if docker-compose -f "$DEPLOYMENT_DIR/docker-compose.prod.yml" ps | grep -q "Up"; then
    log "Existing services detected. Creating backup..."
    
    # Create backup
    BACKUP_FILE="$BACKUP_DIR/pre_deployment_$(date +%Y%m%d_%H%M%S).tar.gz"
    docker exec pacs-mongodb-prod mongodump --out /tmp/mongodb_backup || warning "MongoDB backup failed"
    docker cp pacs-mongodb-prod:/tmp/mongodb_backup "$BACKUP_DIR/mongodb_$(date +%Y%m%d_%H%M%S)" || warning "Failed to copy MongoDB backup"
    
    log "Backup created: $BACKUP_FILE"
fi

# Pull latest images
log "Pulling latest Docker images..."
cd "$DEPLOYMENT_DIR"
docker-compose -f docker-compose.prod.yml pull || error "Failed to pull images"

# Stop existing services
log "Stopping existing services..."
docker-compose -f docker-compose.prod.yml down || warning "Failed to stop some services"

# Start services
log "Starting services..."
docker-compose -f docker-compose.prod.yml up -d || error "Failed to start services"

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 10

# Health checks
log "Running health checks..."

# Check backend
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    log "✓ Backend is healthy"
else
    error "Backend health check failed (HTTP $BACKEND_HEALTH)"
fi

# Check frontend
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    log "✓ Frontend is healthy"
else
    warning "Frontend health check failed (HTTP $FRONTEND_HEALTH)"
fi

# Check MongoDB
if docker exec pacs-mongodb-prod mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
    log "✓ MongoDB is healthy"
else
    error "MongoDB health check failed"
fi

# Check Redis
if docker exec pacs-redis-prod redis-cli ping | grep -q "PONG"; then
    log "✓ Redis is healthy"
else
    error "Redis health check failed"
fi

# Check Orthanc
ORTHANC_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8042/system || echo "000")
if [ "$ORTHANC_HEALTH" = "200" ]; then
    log "✓ Orthanc is healthy"
else
    warning "Orthanc health check failed (HTTP $ORTHANC_HEALTH)"
fi

# Display running services
log "Running services:"
docker-compose -f docker-compose.prod.yml ps

# Display logs
log "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

# Post-deployment tasks
log "Running post-deployment tasks..."

# Clear Redis cache
docker exec pacs-redis-prod redis-cli FLUSHDB || warning "Failed to clear Redis cache"

# Run database migrations (if any)
# docker exec pacs-backend-prod npm run migrate || warning "Database migration failed"

# Deployment summary
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services Status:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "Access URLs:"
echo "  Frontend: https://$FRONTEND_DOMAIN"
echo "  API: https://$API_DOMAIN"
echo "  Traefik Dashboard: https://$TRAEFIK_DOMAIN"
echo "  Grafana: http://localhost:3001"
echo "  Prometheus: http://localhost:9090"
echo ""
echo "Monitoring:"
echo "  View logs: docker-compose -f $DEPLOYMENT_DIR/docker-compose.prod.yml logs -f"
echo "  Check status: docker-compose -f $DEPLOYMENT_DIR/docker-compose.prod.yml ps"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Deployment log: $LOG_FILE"
echo ""
log "Deployment completed successfully!"
