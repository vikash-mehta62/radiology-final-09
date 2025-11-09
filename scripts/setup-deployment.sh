#!/bin/bash

# Orthanc Bridge Deployment Setup Script
# This script creates environment-specific configuration for deployment

set -e

ENVIRONMENT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"
ENV_DIR="$DEPLOYMENT_DIR/environments/$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

usage() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  staging     Setup staging environment (default)"
    echo "  production  Setup production environment"
    echo ""
    echo "This script creates environment-specific configuration files"
    echo "for deploying the Orthanc Bridge."
}

if [[ "$1" == "--help" ]]; then
    usage
    exit 0
fi

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT"
    usage
    exit 1
fi

log "🔧 Setting up deployment configuration for $ENVIRONMENT environment"

# Create directory structure
log "📁 Creating directory structure..."
mkdir -p "$ENV_DIR"
mkdir -p "$DEPLOYMENT_DIR/templates"
mkdir -p "$DEPLOYMENT_DIR/scripts"

# Generate environment-specific .env file
generate_env_file() {
    log "📝 Generating environment configuration..."
    
    local env_file="$ENV_DIR/.env"
    
    # Generate secure passwords
    local orthanc_password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    local webhook_secret=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    local vault_token=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    cat > "$env_file" << EOF
# Orthanc Bridge Environment Configuration - $ENVIRONMENT
# Generated on $(date)

# Environment
NODE_ENV=$ENVIRONMENT
ENVIRONMENT=$ENVIRONMENT

# Orthanc Configuration
ORTHANC_URL=http://orthanc:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=$orthanc_password
ORTHANC_HTTP_PORT=8042
ORTHANC_DICOM_PORT=4242
ORTHANC_AET=ORTHANC_${ENVIRONMENT^^}_AE

# Bridge Configuration
BRIDGE_PORT=3001
BRIDGE_URL=http://dicom-bridge:3000
WEBHOOK_SECRET=$webhook_secret
LOG_LEVEL=info

# Secret Management
SECRET_PROVIDER=vault
VAULT_URL=http://vault:8200
VAULT_TOKEN=$vault_token
VAULT_ROLE=dicom-bridge

# Redis Configuration
REDIS_URL=redis://redis:6379

# External API Configuration
MAIN_API_URL=http://host.docker.internal:8001

# TLS Configuration (Production)
TLS_ENABLED=false
TLS_CERT_PATH=/etc/ssl/certs/orthanc.crt
TLS_KEY_PATH=/etc/ssl/private/orthanc.key

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

EOF

    if [[ "$ENVIRONMENT" == "production" ]]; then
        cat >> "$env_file" << EOF

# Production-specific settings
TLS_ENABLED=true
LOG_LEVEL=warn
BACKUP_RETENTION_DAYS=90

EOF
    fi
    
    success "Environment configuration created: $env_file"
    warning "⚠️  Please review and update the configuration before deployment"
}

# Generate docker-compose file for environment
generate_compose_file() {
    log "🐳 Generating Docker Compose configuration..."
    
    local compose_file="$ENV_DIR/docker-compose.yml"
    
    cat > "$compose_file" << 'EOF'
version: '3.8'

services:
  # Orthanc PACS Server
  orthanc:
    image: orthancteam/orthanc:24.3.3
    container_name: orthanc-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "${ORTHANC_DICOM_PORT}:4242"
      - "${ORTHANC_HTTP_PORT}:8042"
    volumes:
      - ../../../orthanc-config:/etc/orthanc:ro
      - orthanc-db:/var/lib/orthanc/db
      - orthanc-storage:/var/lib/orthanc/storage
      - ./ssl:/etc/ssl:ro
    environment:
      - ORTHANC__NAME=${ORTHANC_AET}
      - ORTHANC__DICOM_AET=${ORTHANC_AET}
      - ORTHANC__DICOM_PORT=4242
      - ORTHANC__HTTP_PORT=8042
      - ORTHANC__REGISTERED_USERS={"${ORTHANC_USERNAME}":"${ORTHANC_PASSWORD}"}
    networks:
      - orthanc-bridge-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://69.62.70.102:8042/system"]
      interval: 30s
      timeout: 10s
      retries: 3

  # DICOM Bridge Service
  dicom-bridge:
    build: ../../../dicom-bridge
    container_name: dicom-bridge-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "${BRIDGE_PORT}:3000"
      - "${METRICS_PORT}:9090"
    environment:
      - NODE_ENV=${NODE_ENV}
      - SECRET_PROVIDER=${SECRET_PROVIDER}
      - VAULT_URL=${VAULT_URL}
      - VAULT_TOKEN=${VAULT_TOKEN}
      - VAULT_ROLE=${VAULT_ROLE}
      - ORTHANC_URL=${ORTHANC_URL}
      - ORTHANC_USERNAME=${ORTHANC_USERNAME}
      - ORTHANC_PASSWORD=${ORTHANC_PASSWORD}
      - BRIDGE_URL=${BRIDGE_URL}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - REDIS_URL=${REDIS_URL}
      - MAIN_API_URL=${MAIN_API_URL}
      - LOG_LEVEL=${LOG_LEVEL}
      - TLS_ENABLED=${TLS_ENABLED}
      - METRICS_ENABLED=${METRICS_ENABLED}
    depends_on:
      - orthanc
      - redis
      - vault
    networks:
      - orthanc-bridge-network
    volumes:
      - ./logs:/app/logs
      - ../../../dicom-bridge/config-templates:/app/config-templates:ro
      - ./ssl:/app/ssl:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # HashiCorp Vault for Secret Management
  vault:
    image: hashicorp/vault:1.15
    container_name: vault-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "8200:8200"
    environment:
      - VAULT_DEV_ROOT_TOKEN_ID=${VAULT_TOKEN}
      - VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200
      - VAULT_ADDR=http://0.0.0.0:8200
    cap_add:
      - IPC_LOCK
    networks:
      - orthanc-bridge-network
    volumes:
      - vault-data:/vault/data
      - ../../../vault-config:/vault/config:ro
    command: vault server -dev -dev-root-token-id=${VAULT_TOKEN}
    healthcheck:
      test: ["CMD", "vault", "status"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis for job queue
  redis:
    image: redis:7-alpine
    container_name: redis-bridge-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - orthanc-bridge-network
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  orthanc-bridge-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  orthanc-db:
    driver: local
    name: orthanc-db-${ENVIRONMENT}
  orthanc-storage:
    driver: local
    name: orthanc-storage-${ENVIRONMENT}
  redis-data:
    driver: local
    name: redis-data-${ENVIRONMENT}
  vault-data:
    driver: local
    name: vault-data-${ENVIRONMENT}
EOF

    success "Docker Compose configuration created: $compose_file"
}

# Generate deployment validation script
generate_validation_script() {
    log "✅ Generating deployment validation script..."
    
    local validation_script="$ENV_DIR/validate-deployment.sh"
    
    cat > "$validation_script" << 'EOF'
#!/bin/bash

# Deployment Validation Script
# This script validates that the deployment is working correctly

set -e

ENVIRONMENT="$(basename "$(dirname "$(realpath "$0")")")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Test service health
test_service_health() {
    local service_name=$1
    local health_url=$2
    local expected_status=${3:-200}
    
    log "Testing $service_name health..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || echo "000")
    
    if [[ "$response_code" == "$expected_status" ]]; then
        success "$service_name is healthy (HTTP $response_code)"
        return 0
    else
        error "$service_name health check failed (HTTP $response_code)"
        return 1
    fi
}

# Test Orthanc authentication
test_orthanc_auth() {
    log "Testing Orthanc authentication..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "$ORTHANC_USERNAME:$ORTHANC_PASSWORD" \
        "http://localhost:$ORTHANC_HTTP_PORT/system" || echo "000")
    
    if [[ "$response_code" == "200" ]]; then
        success "Orthanc authentication working"
        return 0
    else
        error "Orthanc authentication failed (HTTP $response_code)"
        return 1
    fi
}

# Test webhook endpoint
test_webhook() {
    log "Testing webhook endpoint..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"test": true}' \
        "http://localhost:$BRIDGE_PORT/webhook" || echo "000")
    
    # Webhook should reject unsigned requests with 401
    if [[ "$response_code" == "401" ]]; then
        success "Webhook security validation working"
        return 0
    else
        warning "Webhook returned unexpected status (HTTP $response_code)"
        return 1
    fi
}

# Main validation
main() {
    log "🔍 Starting deployment validation for $ENVIRONMENT environment"
    
    local failed_tests=0
    
    # Test service health
    test_service_health "Orthanc" "http://localhost:$ORTHANC_HTTP_PORT/system" || ((failed_tests++))
    test_service_health "DICOM Bridge" "http://localhost:$BRIDGE_PORT/health" || ((failed_tests++))
    test_service_health "Redis" "http://localhost:$BRIDGE_PORT/health/detailed" || ((failed_tests++))
    
    # Test authentication
    test_orthanc_auth || ((failed_tests++))
    
    # Test webhook security
    test_webhook || ((failed_tests++))
    
    echo ""
    if [[ $failed_tests -eq 0 ]]; then
        success "🎉 All validation tests passed!"
        return 0
    else
        error "❌ $failed_tests validation test(s) failed"
        return 1
    fi
}

main "$@"
EOF

    chmod +x "$validation_script"
    success "Validation script created: $validation_script"
}

# Generate SSL certificate directory structure
setup_ssl_directory() {
    log "🔒 Setting up SSL certificate directory..."
    
    local ssl_dir="$ENV_DIR/ssl"
    mkdir -p "$ssl_dir/certs"
    mkdir -p "$ssl_dir/private"
    
    # Create README for SSL setup
    cat > "$ssl_dir/README.md" << EOF
# SSL Certificate Setup

This directory contains SSL certificates for the $ENVIRONMENT environment.

## Certificate Files

- \`certs/orthanc.crt\` - Orthanc server certificate
- \`private/orthanc.key\` - Orthanc private key
- \`certs/ca.crt\` - Certificate Authority certificate (if using internal CA)

## Setup Instructions

### For Let's Encrypt certificates:
1. Install certbot
2. Generate certificates: \`certbot certonly --standalone -d your-domain.com\`
3. Copy certificates to this directory
4. Set up auto-renewal

### For internal CA certificates:
1. Generate private key: \`openssl genrsa -out private/orthanc.key 2048\`
2. Generate certificate request: \`openssl req -new -key private/orthanc.key -out orthanc.csr\`
3. Sign with your CA or generate self-signed certificate
4. Copy certificate to \`certs/orthanc.crt\`

## File Permissions

Ensure proper file permissions:
\`\`\`bash
chmod 600 private/orthanc.key
chmod 644 certs/orthanc.crt
\`\`\`

## Testing

Test certificate validity:
\`\`\`bash
openssl x509 -in certs/orthanc.crt -text -noout
openssl verify -CAfile certs/ca.crt certs/orthanc.crt
\`\`\`
EOF

    success "SSL directory created: $ssl_dir"
}

# Generate logs directory
setup_logs_directory() {
    log "📝 Setting up logs directory..."
    
    local logs_dir="$ENV_DIR/logs"
    mkdir -p "$logs_dir"
    
    # Create log rotation configuration
    cat > "$logs_dir/logrotate.conf" << EOF
$logs_dir/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        docker kill -s USR1 dicom-bridge-$ENVIRONMENT 2>/dev/null || true
    endscript
}
EOF

    success "Logs directory created: $logs_dir"
}

# Generate deployment README
generate_readme() {
    log "📚 Generating deployment README..."
    
    local readme_file="$ENV_DIR/README.md"
    
    cat > "$readme_file" << EOF
# Orthanc Bridge - $ENVIRONMENT Environment

This directory contains the deployment configuration for the $ENVIRONMENT environment.

## Files

- \`.env\` - Environment variables and configuration
- \`docker-compose.yml\` - Docker Compose service definitions
- \`validate-deployment.sh\` - Deployment validation script
- \`ssl/\` - SSL certificates directory
- \`logs/\` - Application logs directory

## Deployment

### 1. Review Configuration
\`\`\`bash
# Edit environment variables
nano .env

# Review Docker Compose configuration
nano docker-compose.yml
\`\`\`

### 2. Setup SSL Certificates (Production)
\`\`\`bash
# See ssl/README.md for certificate setup instructions
\`\`\`

### 3. Deploy Services
\`\`\`bash
# From project root
./scripts/deploy.sh $ENVIRONMENT
\`\`\`

### 4. Validate Deployment
\`\`\`bash
# Run validation tests
./validate-deployment.sh
\`\`\`

## Monitoring

### Health Checks
- Orthanc: http://localhost:\${ORTHANC_HTTP_PORT}/system
- Bridge: http://localhost:\${BRIDGE_PORT}/health
- Detailed: http://localhost:\${BRIDGE_PORT}/health/detailed

### Logs
\`\`\`bash
# View service logs
docker-compose logs -f dicom-bridge
docker-compose logs -f orthanc

# View application logs
tail -f logs/bridge.log
\`\`\`

## Emergency Procedures

### Immediate Disable
\`\`\`bash
# Disable webhook
curl -u \$ORTHANC_USERNAME:\$ORTHANC_PASSWORD -X PUT \\
  "http://localhost:\$ORTHANC_HTTP_PORT/tools/configuration" \\
  -d '{"OnStoredInstance": []}' \\
  -H "Content-Type: application/json"

# Stop bridge
docker stop dicom-bridge-$ENVIRONMENT
\`\`\`

### Complete Rollback
\`\`\`bash
# From project root
./scripts/deploy.sh $ENVIRONMENT --rollback
\`\`\`

## Security Notes

- Change default passwords in .env file
- Setup proper SSL certificates for production
- Review firewall rules and network access
- Monitor logs for security events
- Regularly update container images

## Support

For issues or questions, refer to the main project documentation or contact the development team.
EOF

    success "README created: $readme_file"
}

# Main execution
main() {
    generate_env_file
    generate_compose_file
    generate_validation_script
    setup_ssl_directory
    setup_logs_directory
    generate_readme
    
    echo ""
    success "🎉 Deployment configuration for $ENVIRONMENT environment created!"
    echo ""
    log "📁 Configuration directory: $ENV_DIR"
    echo ""
    log "📋 Next steps:"
    echo "  1. Review and update configuration: $ENV_DIR/.env"
    echo "  2. Setup SSL certificates (production): $ENV_DIR/ssl/"
    echo "  3. Deploy services: ./scripts/deploy.sh $ENVIRONMENT"
    echo "  4. Validate deployment: $ENV_DIR/validate-deployment.sh"
    echo ""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        warning "⚠️  Production deployment requires:"
        echo "  • PACS administrator approval"
        echo "  • Valid SSL certificates"
        echo "  • Security review completion"
        echo "  • Staging environment testing"
    fi
}

main "$@"