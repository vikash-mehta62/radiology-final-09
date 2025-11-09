#!/bin/bash

# Orthanc Bridge Production Deployment Script
# This script automates the deployment of the Orthanc Bridge to production environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
CONFIG_DIR="$PROJECT_ROOT/deployment/environments/$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Usage information
usage() {
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment (default)"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Options:"
    echo "  --dry-run   Show what would be deployed without executing"
    echo "  --force     Skip confirmation prompts"
    echo "  --rollback  Rollback to previous deployment"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 staging                    # Deploy to staging"
    echo "  $0 production --dry-run       # Preview production deployment"
    echo "  $0 production --rollback      # Rollback production deployment"
}

# Parse command line arguments
DRY_RUN=false
FORCE=false
ROLLBACK=false

while [[ $# -gt 1 ]]; do
    case $2 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $2"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT"
    usage
    exit 1
fi

# Check if configuration exists
if [[ ! -d "$CONFIG_DIR" ]]; then
    error "Configuration directory not found: $CONFIG_DIR"
    error "Please run: ./scripts/setup-deployment.sh $ENVIRONMENT"
    exit 1
fi

log "🚀 Starting Orthanc Bridge deployment to $ENVIRONMENT environment"

# Pre-deployment validation
validate_prerequisites() {
    log "🔍 Validating prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment configuration
    if [[ ! -f "$CONFIG_DIR/.env" ]]; then
        error "Environment configuration not found: $CONFIG_DIR/.env"
        exit 1
    fi
    
    # Check required secrets
    source "$CONFIG_DIR/.env"
    if [[ -z "$ORTHANC_PASSWORD" || "$ORTHANC_PASSWORD" == "orthanc_secure_2024" ]]; then
        error "Production Orthanc password not configured"
        exit 1
    fi
    
    if [[ -z "$WEBHOOK_SECRET" || "$WEBHOOK_SECRET" == "webhook_secret_2024_change_in_prod" ]]; then
        error "Production webhook secret not configured"
        exit 1
    fi
    
    success "Prerequisites validated"
}

# Health check function
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1
    
    log "🏥 Checking health of $service_name..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            success "$service_name is healthy"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: $service_name not ready, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "$service_name failed health check after $max_attempts attempts"
    return 1
}

# Backup current deployment
backup_deployment() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "💾 Creating deployment backup..."
        
        local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Backup current docker-compose state
        docker-compose -f "$CONFIG_DIR/docker-compose.yml" config > "$backup_dir/docker-compose.backup.yml"
        
        # Backup environment configuration
        cp "$CONFIG_DIR/.env" "$backup_dir/.env.backup"
        
        # Export current container images
        docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(orthanc|dicom-bridge)" > "$backup_dir/images.txt"
        
        success "Backup created at $backup_dir"
        echo "$backup_dir" > "$PROJECT_ROOT/.last_backup"
    fi
}

# Deploy services
deploy_services() {
    log "🐳 Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would execute the following commands:"
        echo "  docker-compose -f $CONFIG_DIR/docker-compose.yml --env-file $CONFIG_DIR/.env pull"
        echo "  docker-compose -f $CONFIG_DIR/docker-compose.yml --env-file $CONFIG_DIR/.env up -d"
        return 0
    fi
    
    # Pull latest images
    docker-compose -f "$CONFIG_DIR/docker-compose.yml" --env-file "$CONFIG_DIR/.env" pull
    
    # Deploy services
    docker-compose -f "$CONFIG_DIR/docker-compose.yml" --env-file "$CONFIG_DIR/.env" up -d
    
    success "Services deployed"
}

# Post-deployment validation
validate_deployment() {
    log "✅ Validating deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would validate deployment health"
        return 0
    fi
    
    # Load environment configuration
    source "$CONFIG_DIR/.env"
    
    # Check service health
    check_service_health "Orthanc" "http://localhost:${ORTHANC_HTTP_PORT:-8042}/system" || return 1
    check_service_health "DICOM Bridge" "http://localhost:${BRIDGE_PORT:-3001}/health" || return 1
    check_service_health "Redis" "http://localhost:${BRIDGE_PORT:-3001}/health/detailed" || return 1
    
    # Run smoke tests if available
    if [[ -f "$PROJECT_ROOT/tests/smoke-tests.js" ]]; then
        log "🧪 Running smoke tests..."
        cd "$PROJECT_ROOT/tests"
        if node smoke-tests.js; then
            success "Smoke tests passed"
        else
            error "Smoke tests failed"
            return 1
        fi
    fi
    
    success "Deployment validation completed"
}

# Rollback function
rollback_deployment() {
    log "🔄 Rolling back deployment..."
    
    if [[ ! -f "$PROJECT_ROOT/.last_backup" ]]; then
        error "No backup found for rollback"
        exit 1
    fi
    
    local backup_dir=$(cat "$PROJECT_ROOT/.last_backup")
    
    if [[ ! -d "$backup_dir" ]]; then
        error "Backup directory not found: $backup_dir"
        exit 1
    fi
    
    # Stop current services
    docker-compose -f "$CONFIG_DIR/docker-compose.yml" --env-file "$CONFIG_DIR/.env" down
    
    # Restore configuration
    cp "$backup_dir/.env.backup" "$CONFIG_DIR/.env"
    cp "$backup_dir/docker-compose.backup.yml" "$CONFIG_DIR/docker-compose.yml"
    
    # Restart services
    docker-compose -f "$CONFIG_DIR/docker-compose.yml" --env-file "$CONFIG_DIR/.env" up -d
    
    success "Rollback completed"
}

# Confirmation prompt
confirm_deployment() {
    if [[ "$FORCE" == "true" || "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    echo ""
    warning "⚠️  You are about to deploy to $ENVIRONMENT environment"
    echo ""
    echo "Configuration:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Config Dir:  $CONFIG_DIR"
    echo ""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -e "${RED}🚨 PRODUCTION DEPLOYMENT WARNING 🚨${NC}"
        echo "This will deploy to the production environment."
        echo "Ensure you have:"
        echo "  ✅ PACS administrator approval"
        echo "  ✅ Completed staging testing"
        echo "  ✅ Verified all security requirements"
        echo ""
    fi
    
    read -p "Continue with deployment? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Deployment cancelled"
        exit 0
    fi
}

# Main execution
main() {
    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
        exit 0
    fi
    
    # Run pre-deployment checks
    log "🔍 Running pre-deployment health checks..."
    if ! node "$SCRIPT_DIR/pre-deployment-check.js" "$ENVIRONMENT"; then
        error "Pre-deployment checks failed. Please resolve issues before continuing."
        exit 1
    fi
    
    validate_prerequisites
    confirm_deployment
    backup_deployment
    deploy_services
    validate_deployment
    
    echo ""
    success "🎉 Deployment to $ENVIRONMENT completed successfully!"
    echo ""
    log "📊 Access your services:"
    source "$CONFIG_DIR/.env"
    echo "  • Orthanc:      http://localhost:${ORTHANC_HTTP_PORT:-8042}"
    echo "  • DICOM Bridge: http://localhost:${BRIDGE_PORT:-3001}"
    echo "  • Health Check: http://localhost:${BRIDGE_PORT:-3001}/health"
    echo ""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        warning "🔍 Monitor the deployment for the next 24 hours"
        warning "📞 Emergency rollback: ./scripts/deploy.sh production --rollback"
        warning "📞 Alternative rollback: node ./scripts/deployment-manager.js rollback production"
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Execute main function
main "$@"