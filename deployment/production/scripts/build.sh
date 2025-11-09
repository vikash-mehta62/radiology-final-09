#!/bin/bash

# Production Build Script
# This script builds Docker images for production deployment

set -e

echo "=========================================="
echo "PACS Production Build"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment/production"
BUILD_LOG="$PROJECT_ROOT/logs/build.log"

# Load environment variables
if [ -f "$DEPLOYMENT_DIR/.env" ]; then
    source "$DEPLOYMENT_DIR/.env"
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$BUILD_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$BUILD_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$BUILD_LOG"
}

# Check prerequisites
log "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
fi

if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
fi

log "✓ Prerequisites check passed"

# Get version from package.json or use environment variable
if [ -z "$VERSION" ]; then
    VERSION=$(node -p "require('$PROJECT_ROOT/viewer/package.json').version")
fi

log "Building version: $VERSION"

# Build Frontend
echo ""
log "Building frontend..."
cd "$PROJECT_ROOT"

# Install frontend dependencies
info "Installing frontend dependencies..."
cd viewer
npm ci || error "Failed to install frontend dependencies"

# Run frontend tests
info "Running frontend tests..."
npm run test:unit -- --run || error "Frontend tests failed"

# Build frontend
info "Building frontend bundle..."
npm run build || error "Frontend build failed"

# Check bundle size
BUNDLE_SIZE=$(du -sh dist | cut -f1)
log "✓ Frontend bundle size: $BUNDLE_SIZE"

# Build frontend Docker image
info "Building frontend Docker image..."
cd "$PROJECT_ROOT"
docker build \
    -f deployment/production/Dockerfile.frontend \
    -t ${DOCKER_REGISTRY}/pacs-frontend:${VERSION} \
    -t ${DOCKER_REGISTRY}/pacs-frontend:latest \
    --build-arg VITE_API_URL=${API_URL} \
    --build-arg VITE_WEBSOCKET_URL=${WEBSOCKET_URL} \
    --build-arg VITE_ORTHANC_URL=${ORTHANC_URL} \
    . || error "Frontend Docker build failed"

log "✓ Frontend Docker image built"

# Build Backend
echo ""
log "Building backend..."
cd "$PROJECT_ROOT/server"

# Install backend dependencies
info "Installing backend dependencies..."
npm ci || error "Failed to install backend dependencies"

# Run backend tests
info "Running backend tests..."
npm run test -- --run || error "Backend tests failed"

# Build backend Docker image
info "Building backend Docker image..."
cd "$PROJECT_ROOT"
docker build \
    -f deployment/production/Dockerfile.backend \
    -t ${DOCKER_REGISTRY}/pacs-backend:${VERSION} \
    -t ${DOCKER_REGISTRY}/pacs-backend:latest \
    . || error "Backend Docker build failed"

log "✓ Backend Docker image built"

# Verify images
echo ""
log "Verifying Docker images..."
docker images | grep pacs-frontend | grep $VERSION || error "Frontend image not found"
docker images | grep pacs-backend | grep $VERSION || error "Backend image not found"

# Get image sizes
FRONTEND_SIZE=$(docker images ${DOCKER_REGISTRY}/pacs-frontend:${VERSION} --format "{{.Size}}")
BACKEND_SIZE=$(docker images ${DOCKER_REGISTRY}/pacs-backend:${VERSION} --format "{{.Size}}")

log "✓ Frontend image size: $FRONTEND_SIZE"
log "✓ Backend image size: $BACKEND_SIZE"

# Security scan (optional)
if command -v trivy &> /dev/null; then
    echo ""
    log "Running security scans..."
    
    info "Scanning frontend image..."
    trivy image --severity HIGH,CRITICAL ${DOCKER_REGISTRY}/pacs-frontend:${VERSION} || true
    
    info "Scanning backend image..."
    trivy image --severity HIGH,CRITICAL ${DOCKER_REGISTRY}/pacs-backend:${VERSION} || true
else
    info "Trivy not installed, skipping security scans"
fi

# Push to registry (optional)
echo ""
read -p "Push images to registry? (yes/no): " push_confirm

if [ "$push_confirm" = "yes" ]; then
    log "Pushing images to registry..."
    
    docker push ${DOCKER_REGISTRY}/pacs-frontend:${VERSION} || error "Failed to push frontend image"
    docker push ${DOCKER_REGISTRY}/pacs-frontend:latest || error "Failed to push frontend latest tag"
    
    docker push ${DOCKER_REGISTRY}/pacs-backend:${VERSION} || error "Failed to push backend image"
    docker push ${DOCKER_REGISTRY}/pacs-backend:latest || error "Failed to push backend latest tag"
    
    log "✓ Images pushed to registry"
fi

# Build summary
echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo ""
echo "Version: $VERSION"
echo ""
echo "Images built:"
echo "  - ${DOCKER_REGISTRY}/pacs-frontend:${VERSION} (${FRONTEND_SIZE})"
echo "  - ${DOCKER_REGISTRY}/pacs-backend:${VERSION} (${BACKEND_SIZE})"
echo ""
echo "Bundle sizes:"
echo "  - Frontend: $BUNDLE_SIZE"
echo ""
echo "Build log: $BUILD_LOG"
echo ""
echo "Next steps:"
echo "  1. Review build log for any warnings"
echo "  2. Test images locally: docker-compose -f deployment/production/docker-compose.prod.yml up"
echo "  3. Deploy to production: ./deployment/production/scripts/deploy.sh"
echo ""
log "Build completed successfully!"
