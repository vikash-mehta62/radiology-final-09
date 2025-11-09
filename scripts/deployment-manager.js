#!/usr/bin/env node

/**
 * Orthanc Bridge Deployment Manager
 * 
 * This script provides comprehensive deployment automation with:
 * - Environment-specific configuration management
 * - Pre-deployment validation and health checks
 * - Automated rollback capabilities
 * - Production readiness verification
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class DeploymentManager {
    constructor() {
        this.projectRoot = path.dirname(__dirname);
        this.deploymentDir = path.join(this.projectRoot, 'deployment');
        this.scriptsDir = path.join(this.projectRoot, 'scripts');
        this.backupsDir = path.join(this.projectRoot, 'backups');
        
        // Supported environments
        this.environments = ['staging', 'production'];
        
        // Colors for console output
        this.colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            cyan: '\x1b[36m'
        };
    }

    log(message, color = 'blue') {
        const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
        console.log(`${this.colors[color]}[${timestamp}]${this.colors.reset} ${message}`);
    }

    error(message) {
        this.log(`ERROR: ${message}`, 'red');
    }

    success(message) {
        this.log(`SUCCESS: ${message}`, 'green');
    }

    warning(message) {
        this.log(`WARNING: ${message}`, 'yellow');
    }

    /**
     * Generate secure random password
     */
    generateSecurePassword(length = 32) {
        return crypto.randomBytes(length).toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, length);
    }

    /**
     * Create environment-specific configuration
     */
    createEnvironmentConfig(environment) {
        this.log(`🔧 Creating configuration for ${environment} environment`);
        
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        
        // Create directory structure
        this.ensureDirectoryExists(envDir);
        this.ensureDirectoryExists(path.join(envDir, 'ssl', 'certs'));
        this.ensureDirectoryExists(path.join(envDir, 'ssl', 'private'));
        this.ensureDirectoryExists(path.join(envDir, 'logs'));
        this.ensureDirectoryExists(path.join(envDir, 'backups'));

        // Generate environment variables
        const envConfig = this.generateEnvironmentConfig(environment);
        const envFile = path.join(envDir, '.env');
        fs.writeFileSync(envFile, envConfig);

        // Generate Docker Compose configuration
        const composeConfig = this.generateDockerComposeConfig(environment);
        const composeFile = path.join(envDir, 'docker-compose.yml');
        fs.writeFileSync(composeFile, composeConfig);

        // Generate validation script
        const validationScript = this.generateValidationScript(environment);
        const validationFile = path.join(envDir, 'validate-deployment.sh');
        fs.writeFileSync(validationFile, validationScript);
        fs.chmodSync(validationFile, '755');

        // Generate environment-specific README
        const readme = this.generateEnvironmentReadme(environment);
        const readmeFile = path.join(envDir, 'README.md');
        fs.writeFileSync(readmeFile, readme);

        this.success(`Configuration created for ${environment} environment: ${envDir}`);
        return envDir;
    }

    /**
     * Ensure directory exists
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**

     * Generate environment-specific .env file
     */
    generateEnvironmentConfig(environment) {
        const isProduction = environment === 'production';
        
        // Generate secure credentials
        const orthancPassword = this.generateSecurePassword(25);
        const webhookSecret = this.generateSecurePassword(32);
        const vaultToken = this.generateSecurePassword(32);

        return `# Orthanc Bridge Environment Configuration - ${environment}
# Generated on ${new Date().toISOString()}

# Environment
NODE_ENV=${environment}
ENVIRONMENT=${environment}

# Orthanc Configuration
ORTHANC_URL=http://orthanc:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=${orthancPassword}
ORTHANC_HTTP_PORT=${isProduction ? '8042' : '8042'}
ORTHANC_DICOM_PORT=${isProduction ? '4242' : '4242'}
ORTHANC_AET=ORTHANC_${environment.toUpperCase()}_AE

# Bridge Configuration
BRIDGE_PORT=${isProduction ? '3001' : '3001'}
BRIDGE_URL=http://dicom-bridge:3000
WEBHOOK_SECRET=${webhookSecret}
LOG_LEVEL=${isProduction ? 'warn' : 'info'}

# Secret Management
SECRET_PROVIDER=vault
VAULT_URL=http://vault:8200
VAULT_TOKEN=${vaultToken}
VAULT_ROLE=dicom-bridge

# Redis Configuration
REDIS_URL=redis://redis:6379

# External API Configuration
MAIN_API_URL=http://host.docker.internal:8001

# TLS Configuration
TLS_ENABLED=${isProduction ? 'true' : 'false'}
TLS_CERT_PATH=/etc/ssl/certs/orthanc.crt
TLS_KEY_PATH=/etc/ssl/private/orthanc.key

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30

# Backup Configuration
BACKUP_ENABLED=${isProduction ? 'true' : 'false'}
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=${isProduction ? '90' : '30'}

# Security Configuration
WEBHOOK_TIMEOUT=30
MAX_PAYLOAD_SIZE=10mb
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100

# Database Configuration
ORTHANC_DB_COMPRESSION=true
ORTHANC_STORAGE_COMPRESSION=true

${isProduction ? `
# Production-specific settings
CORS_ENABLED=false
DEBUG_MODE=false
DETAILED_ERRORS=false
AUDIT_LOG_LEVEL=info
SECURITY_HEADERS=true
` : `
# Development/Staging settings
CORS_ENABLED=true
DEBUG_MODE=true
DETAILED_ERRORS=true
`}`;
    } 
   /**
     * Generate Docker Compose configuration
     */
    generateDockerComposeConfig(environment) {
        const isProduction = environment === 'production';
        
        return `version: '3.8'

services:
  # Orthanc PACS Server
  orthanc:
    image: orthancteam/orthanc:24.3.3
    container_name: orthanc-\${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "\${ORTHANC_DICOM_PORT}:4242"
      - "\${ORTHANC_HTTP_PORT}:8042"
    volumes:
      - ../../../orthanc-config:/etc/orthanc:ro
      - orthanc-db:/var/lib/orthanc/db
      - orthanc-storage:/var/lib/orthanc/storage
      - ./ssl:/etc/ssl:ro
      - ./logs:/var/log/orthanc
    environment:
      - ORTHANC__NAME=\${ORTHANC_AET}
      - ORTHANC__DICOM_AET=\${ORTHANC_AET}
      - ORTHANC__DICOM_PORT=4242
      - ORTHANC__HTTP_PORT=8042
      - ORTHANC__REGISTERED_USERS={"orthanc":"\${ORTHANC_PASSWORD}"}
      - ORTHANC__AUTHENTICATION_ENABLED=true
      - ORTHANC__SSL_ENABLED=\${TLS_ENABLED}
      - ORTHANC__SSL_CERTIFICATE=\${TLS_CERT_PATH}
      - ORTHANC__SSL_PRIVATE_KEY=\${TLS_KEY_PATH}
    networks:
      - orthanc-bridge-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://69.62.70.102:8042/system"]
      interval: \${HEALTH_CHECK_INTERVAL}s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # DICOM Bridge Service
  dicom-bridge:
    build: 
      context: ../../../dicom-bridge
      dockerfile: Dockerfile
    image: dicom-bridge:\${ENVIRONMENT}
    container_name: dicom-bridge-\${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "\${BRIDGE_PORT}:3000"
      - "\${METRICS_PORT}:9090"
    environment:
      - NODE_ENV=\${NODE_ENV}
      - ENVIRONMENT=\${ENVIRONMENT}
      - SECRET_PROVIDER=\${SECRET_PROVIDER}
      - VAULT_URL=\${VAULT_URL}
      - VAULT_TOKEN=\${VAULT_TOKEN}
      - VAULT_ROLE=\${VAULT_ROLE}
      - ORTHANC_URL=\${ORTHANC_URL}
      - ORTHANC_USERNAME=\${ORTHANC_USERNAME}
      - ORTHANC_PASSWORD=\${ORTHANC_PASSWORD}
      - BRIDGE_URL=\${BRIDGE_URL}
      - WEBHOOK_SECRET=\${WEBHOOK_SECRET}
      - REDIS_URL=\${REDIS_URL}
      - MAIN_API_URL=\${MAIN_API_URL}
      - LOG_LEVEL=\${LOG_LEVEL}
      - TLS_ENABLED=\${TLS_ENABLED}
      - METRICS_ENABLED=\${METRICS_ENABLED}
      - BACKUP_ENABLED=\${BACKUP_ENABLED}
      - WEBHOOK_TIMEOUT=\${WEBHOOK_TIMEOUT}
      - MAX_PAYLOAD_SIZE=\${MAX_PAYLOAD_SIZE}
      - RATE_LIMIT_WINDOW=\${RATE_LIMIT_WINDOW}
      - RATE_LIMIT_MAX=\${RATE_LIMIT_MAX}
    depends_on:
      orthanc:
        condition: service_healthy
      redis:
        condition: service_healthy
      vault:
        condition: service_healthy
    networks:
      - orthanc-bridge-network
    volumes:
      - ./logs:/app/logs
      - ../../../dicom-bridge/config-templates:/app/config-templates:ro
      - ./ssl:/app/ssl:ro
      - ./backups:/app/backups
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: \${HEALTH_CHECK_INTERVAL}s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # HashiCorp Vault for Secret Management
  vault:
    image: hashicorp/vault:1.15
    container_name: vault-\${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "8200:8200"
    environment:
      - VAULT_DEV_ROOT_TOKEN_ID=\${VAULT_TOKEN}
      - VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200
      - VAULT_ADDR=http://0.0.0.0:8200
    cap_add:
      - IPC_LOCK
    networks:
      - orthanc-bridge-network
    volumes:
      - vault-data:/vault/data
      - ../../../vault-config:/vault/config:ro
      - ./logs:/vault/logs
    command: vault server -dev -dev-root-token-id=\${VAULT_TOKEN}
    healthcheck:
      test: ["CMD", "vault", "status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Redis for job queue and caching
  redis:
    image: redis:7-alpine
    container_name: redis-bridge-\${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./logs:/var/log/redis
    networks:
      - orthanc-bridge-network
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

${isProduction ? `
  # Nginx reverse proxy for production
  nginx:
    image: nginx:alpine
    container_name: nginx-\${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../../../nginx-config/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
      - ./logs:/var/log/nginx
    depends_on:
      - orthanc
      - dicom-bridge
    networks:
      - orthanc-bridge-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
` : ''}

networks:
  orthanc-bridge-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  orthanc-db:
    driver: local
    name: orthanc-db-\${ENVIRONMENT}
  orthanc-storage:
    driver: local
    name: orthanc-storage-\${ENVIRONMENT}
  redis-data:
    driver: local
    name: redis-data-\${ENVIRONMENT}
  vault-data:
    driver: local
    name: vault-data-\${ENVIRONMENT}
`;
    }  
  /**
     * Generate deployment validation script
     */
    generateValidationScript(environment) {
        return `#!/bin/bash

# Deployment Validation Script for ${environment} environment
# This script validates that the deployment is working correctly

set -e

ENVIRONMENT="${environment}"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables
if [[ -f "\$SCRIPT_DIR/.env" ]]; then
    source "\$SCRIPT_DIR/.env"
else
    echo "ERROR: Environment file not found: \$SCRIPT_DIR/.env"
    exit 1
fi

# Colors
GREEN='\\033[0;32m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log() {
    echo -e "\${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]\${NC} \$1"
}

success() {
    echo -e "\${GREEN}[SUCCESS]\${NC} \$1"
}

error() {
    echo -e "\${RED}[ERROR]\${NC} \$1"
}

warning() {
    echo -e "\${YELLOW}[WARNING]\${NC} \$1"
}

# Test service health with retry logic
test_service_health() {
    local service_name=\$1
    local health_url=\$2
    local expected_status=\${3:-200}
    local max_attempts=\${4:-10}
    local attempt=1
    
    log "Testing \$service_name health..."
    
    while [[ \$attempt -le \$max_attempts ]]; do
        local response_code=\$(curl -s -o /dev/null -w "%{http_code}" "\$health_url" 2>/dev/null || echo "000")
        
        if [[ "\$response_code" == "\$expected_status" ]]; then
            success "\$service_name is healthy (HTTP \$response_code)"
            return 0
        fi
        
        log "Attempt \$attempt/\$max_attempts: \$service_name not ready (HTTP \$response_code), waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "\$service_name health check failed after \$max_attempts attempts (HTTP \$response_code)"
    return 1
}

# Test Orthanc authentication
test_orthanc_auth() {
    log "Testing Orthanc authentication..."
    
    local response_code=\$(curl -s -o /dev/null -w "%{http_code}" \\
        -u "\$ORTHANC_USERNAME:\$ORTHANC_PASSWORD" \\
        "http://localhost:\$ORTHANC_HTTP_PORT/system" 2>/dev/null || echo "000")
    
    if [[ "\$response_code" == "200" ]]; then
        success "Orthanc authentication working"
        return 0
    else
        error "Orthanc authentication failed (HTTP \$response_code)"
        return 1
    fi
}

# Test webhook endpoint security
test_webhook_security() {
    log "Testing webhook endpoint security..."
    
    # Test unsigned request (should be rejected)
    local response_code=\$(curl -s -o /dev/null -w "%{http_code}" \\
        -X POST \\
        -H "Content-Type: application/json" \\
        -d '{"test": true}' \\
        "http://localhost:\$BRIDGE_PORT/webhook" 2>/dev/null || echo "000")
    
    if [[ "\$response_code" == "401" ]]; then
        success "Webhook security validation working (unsigned requests rejected)"
        return 0
    else
        warning "Webhook returned unexpected status for unsigned request (HTTP \$response_code)"
        return 1
    fi
}

# Test Redis connectivity
test_redis_connectivity() {
    log "Testing Redis connectivity..."
    
    local response_code=\$(curl -s -o /dev/null -w "%{http_code}" \\
        "http://localhost:\$BRIDGE_PORT/health/detailed" 2>/dev/null || echo "000")
    
    if [[ "\$response_code" == "200" ]]; then
        success "Redis connectivity working"
        return 0
    else
        error "Redis connectivity test failed (HTTP \$response_code)"
        return 1
    fi
}

# Test Vault connectivity
test_vault_connectivity() {
    log "Testing Vault connectivity..."
    
    local response_code=\$(curl -s -o /dev/null -w "%{http_code}" \\
        -H "X-Vault-Token: \$VAULT_TOKEN" \\
        "http://localhost:8200/v1/sys/health" 2>/dev/null || echo "000")
    
    if [[ "\$response_code" == "200" ]]; then
        success "Vault connectivity working"
        return 0
    else
        error "Vault connectivity test failed (HTTP \$response_code)"
        return 1
    fi
}

# Test TLS configuration (production only)
test_tls_configuration() {
    if [[ "\$TLS_ENABLED" != "true" ]]; then
        log "TLS not enabled, skipping TLS tests"
        return 0
    fi
    
    log "Testing TLS configuration..."
    
    # Check certificate files exist
    if [[ ! -f "\$SCRIPT_DIR/ssl/certs/orthanc.crt" ]]; then
        error "TLS certificate not found: \$SCRIPT_DIR/ssl/certs/orthanc.crt"
        return 1
    fi
    
    if [[ ! -f "\$SCRIPT_DIR/ssl/private/orthanc.key" ]]; then
        error "TLS private key not found: \$SCRIPT_DIR/ssl/private/orthanc.key"
        return 1
    fi
    
    # Test certificate validity
    if openssl x509 -in "\$SCRIPT_DIR/ssl/certs/orthanc.crt" -checkend 86400 -noout > /dev/null 2>&1; then
        success "TLS certificate is valid and not expiring within 24 hours"
        return 0
    else
        error "TLS certificate is invalid or expiring soon"
        return 1
    fi
}

# Run smoke tests if available
run_smoke_tests() {
    local smoke_test_file="../../../tests/smoke-tests.js"
    
    if [[ ! -f "\$smoke_test_file" ]]; then
        warning "Smoke tests not found, skipping"
        return 0
    fi
    
    log "Running smoke tests..."
    
    cd "../../../tests"
    if timeout 300 node smoke-tests.js; then
        success "Smoke tests passed"
        return 0
    else
        error "Smoke tests failed or timed out"
        return 1
    fi
}

# Main validation function
main() {
    log "🔍 Starting deployment validation for \$ENVIRONMENT environment"
    echo ""
    
    local failed_tests=0
    local total_tests=0
    
    # Core service health checks
    ((total_tests++))
    test_service_health "Orthanc" "http://localhost:\$ORTHANC_HTTP_PORT/system" 200 15 || ((failed_tests++))
    
    ((total_tests++))
    test_service_health "DICOM Bridge" "http://localhost:\$BRIDGE_PORT/health" 200 15 || ((failed_tests++))
    
    ((total_tests++))
    test_service_health "Vault" "http://localhost:8200/v1/sys/health" 200 10 || ((failed_tests++))
    
    # Authentication and security tests
    ((total_tests++))
    test_orthanc_auth || ((failed_tests++))
    
    ((total_tests++))
    test_webhook_security || ((failed_tests++))
    
    # Connectivity tests
    ((total_tests++))
    test_redis_connectivity || ((failed_tests++))
    
    ((total_tests++))
    test_vault_connectivity || ((failed_tests++))
    
    # TLS tests (production only)
    ((total_tests++))
    test_tls_configuration || ((failed_tests++))
    
    # Smoke tests
    ((total_tests++))
    run_smoke_tests || ((failed_tests++))
    
    echo ""
    log "📊 Validation Results:"
    log "  Total tests: \$total_tests"
    log "  Passed: \$((total_tests - failed_tests))"
    log "  Failed: \$failed_tests"
    echo ""
    
    if [[ \$failed_tests -eq 0 ]]; then
        success "🎉 All validation tests passed! Deployment is healthy."
        return 0
    else
        error "❌ \$failed_tests validation test(s) failed. Please review and fix issues before proceeding."
        return 1
    fi
}

# Handle script interruption
trap 'error "Validation interrupted"; exit 1' INT TERM

# Execute main function
main "\$@"
`;
    } 
   /**
     * Generate environment-specific README
     */
    generateEnvironmentReadme(environment) {
        const isProduction = environment === 'production';
        
        return `# Orthanc Bridge - ${environment.toUpperCase()} Environment

This directory contains the deployment configuration for the **${environment}** environment.

## 📁 Directory Structure

\`\`\`
${environment}/
├── .env                    # Environment variables
├── docker-compose.yml      # Service definitions
├── validate-deployment.sh  # Validation script
├── README.md              # This file
├── ssl/                   # SSL certificates
│   ├── certs/
│   └── private/
├── logs/                  # Application logs
└── backups/               # Backup storage
\`\`\`

## 🚀 Quick Start

### 1. Review Configuration
\`\`\`bash
# Edit environment variables
nano .env

# Review Docker Compose configuration
nano docker-compose.yml
\`\`\`

### 2. Setup SSL Certificates${isProduction ? ' (Required)' : ' (Optional)'}
\`\`\`bash
# See ssl/README.md for certificate setup instructions
${isProduction ? '# Production requires valid SSL certificates' : '# Development can use self-signed certificates'}
\`\`\`

### 3. Deploy Services
\`\`\`bash
# From project root
./scripts/deploy.sh ${environment}

# Or with deployment manager
node ./scripts/deployment-manager.js deploy ${environment}
\`\`\`

### 4. Validate Deployment
\`\`\`bash
# Run validation tests
./validate-deployment.sh
\`\`\`

## 🔍 Monitoring & Health Checks

### Service Endpoints
- **Orthanc**: http://localhost:\${ORTHANC_HTTP_PORT}
  - System info: \`/system\`
  - Statistics: \`/statistics\`
- **DICOM Bridge**: http://localhost:\${BRIDGE_PORT}
  - Health check: \`/health\`
  - Detailed health: \`/health/detailed\`
  - Metrics: \`/metrics\`
- **Vault**: http://localhost:8200
  - Health: \`/v1/sys/health\`

### Log Monitoring
\`\`\`bash
# View service logs
docker-compose logs -f dicom-bridge
docker-compose logs -f orthanc

# View application logs
tail -f logs/bridge.log
tail -f logs/orthanc.log
\`\`\`

## 🚨 Emergency Procedures

### Immediate Disable
\`\`\`bash
# Disable webhook processing
curl -u \$ORTHANC_USERNAME:\$ORTHANC_PASSWORD -X PUT \\
  "http://localhost:\$ORTHANC_HTTP_PORT/tools/configuration" \\
  -d '{"OnStoredInstance": []}' \\
  -H "Content-Type: application/json"

# Stop bridge service
docker stop dicom-bridge-${environment}
\`\`\`

### Complete Rollback
\`\`\`bash
# From project root
./scripts/deploy.sh ${environment} --rollback

# Or with deployment manager
node ./scripts/deployment-manager.js rollback ${environment}
\`\`\`

## 🔒 Security Considerations

${isProduction ? `
### Production Security Checklist
- [ ] SSL certificates installed and valid
- [ ] Default passwords changed
- [ ] Firewall rules configured
- [ ] Network access restricted
- [ ] Audit logging enabled
- [ ] Backup encryption enabled
- [ ] Security monitoring active
` : `
### Development Security Notes
- Change default passwords before production
- Use proper SSL certificates for production
- Review network access controls
- Enable audit logging for compliance
`}

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
**Environment**: ${environment}
**Version**: Generated by Deployment Manager
`;
    }

    /**
     * Validate prerequisites for deployment
     */
    async validatePrerequisites(environment) {
        this.log('🔍 Validating deployment prerequisites...');
        
        const issues = [];

        // Check Docker
        try {
            execSync('docker --version', { stdio: 'ignore' });
        } catch (error) {
            issues.push('Docker is not installed or not accessible');
        }

        // Check Docker Compose
        try {
            execSync('docker-compose --version', { stdio: 'ignore' });
        } catch (error) {
            issues.push('Docker Compose is not installed or not accessible');
        }

        // Check environment configuration
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        const envFile = path.join(envDir, '.env');
        
        if (!fs.existsSync(envFile)) {
            issues.push(`Environment configuration not found: ${envFile}`);
        } else {
            // Validate environment configuration
            const envContent = fs.readFileSync(envFile, 'utf8');
            
            // Check for default passwords
            if (envContent.includes('orthanc_secure_2024') || 
                envContent.includes('webhook_secret_2024_change_in_prod')) {
                issues.push('Default passwords detected in environment configuration');
            }

            // Check required variables
            const requiredVars = [
                'ORTHANC_PASSWORD', 'WEBHOOK_SECRET', 'VAULT_TOKEN',
                'ORTHANC_HTTP_PORT', 'BRIDGE_PORT'
            ];
            
            for (const varName of requiredVars) {
                if (!envContent.includes(`${varName}=`) || 
                    envContent.includes(`${varName}=\n`)) {
                    issues.push(`Required environment variable not set: ${varName}`);
                }
            }
        }

        // Check SSL certificates for production
        if (environment === 'production') {
            const sslDir = path.join(envDir, 'ssl');
            const certFile = path.join(sslDir, 'certs', 'orthanc.crt');
            const keyFile = path.join(sslDir, 'private', 'orthanc.key');
            
            if (!fs.existsSync(certFile)) {
                issues.push(`SSL certificate not found: ${certFile}`);
            }
            
            if (!fs.existsSync(keyFile)) {
                issues.push(`SSL private key not found: ${keyFile}`);
            }
        }

        if (issues.length > 0) {
            this.error('Prerequisites validation failed:');
            issues.forEach(issue => this.error(`  • ${issue}`));
            return false;
        }

        this.success('Prerequisites validation passed');
        return true;
    }    /*
*
     * Create deployment backup
     */
    createBackup(environment) {
        if (environment !== 'production') {
            this.log('Skipping backup for non-production environment');
            return null;
        }

        this.log('💾 Creating deployment backup...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        const backupDir = path.join(this.backupsDir, timestamp);
        
        this.ensureDirectoryExists(backupDir);
        
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        
        try {
            // Backup configuration files
            if (fs.existsSync(path.join(envDir, '.env'))) {
                fs.copyFileSync(
                    path.join(envDir, '.env'),
                    path.join(backupDir, '.env.backup')
                );
            }
            
            if (fs.existsSync(path.join(envDir, 'docker-compose.yml'))) {
                fs.copyFileSync(
                    path.join(envDir, 'docker-compose.yml'),
                    path.join(backupDir, 'docker-compose.backup.yml')
                );
            }

            // Export current container images
            try {
                const images = execSync('docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "(orthanc|dicom-bridge)"', 
                    { encoding: 'utf8' });
                fs.writeFileSync(path.join(backupDir, 'images.txt'), images);
            } catch (error) {
                this.warning('Could not export container images list');
            }

            // Save backup reference
            fs.writeFileSync(path.join(this.projectRoot, '.last_backup'), backupDir);
            
            this.success(`Backup created: ${backupDir}`);
            return backupDir;
        } catch (error) {
            this.error(`Failed to create backup: ${error.message}`);
            return null;
        }
    }

    /**
     * Deploy services
     */
    async deployServices(environment, options = {}) {
        this.log('🐳 Deploying services...');
        
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        const composeFile = path.join(envDir, 'docker-compose.yml');
        const envFile = path.join(envDir, '.env');
        
        if (options.dryRun) {
            this.log('DRY RUN: Would execute the following commands:');
            console.log(`  docker-compose -f ${composeFile} --env-file ${envFile} pull`);
            console.log(`  docker-compose -f ${composeFile} --env-file ${envFile} up -d`);
            return true;
        }

        try {
            // Pull latest images
            this.log('Pulling latest container images...');
            execSync(`docker-compose -f "${composeFile}" --env-file "${envFile}" pull`, {
                stdio: 'inherit',
                cwd: this.projectRoot
            });

            // Deploy services
            this.log('Starting services...');
            execSync(`docker-compose -f "${composeFile}" --env-file "${envFile}" up -d`, {
                stdio: 'inherit',
                cwd: this.projectRoot
            });

            this.success('Services deployed successfully');
            return true;
        } catch (error) {
            this.error(`Deployment failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate deployment
     */
    async validateDeployment(environment) {
        this.log('✅ Validating deployment...');
        
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        const validationScript = path.join(envDir, 'validate-deployment.sh');
        
        if (!fs.existsSync(validationScript)) {
            this.error(`Validation script not found: ${validationScript}`);
            return false;
        }

        try {
            execSync(`bash "${validationScript}"`, {
                stdio: 'inherit',
                cwd: envDir
            });
            
            this.success('Deployment validation completed successfully');
            return true;
        } catch (error) {
            this.error('Deployment validation failed');
            return false;
        }
    }

    /**
     * Rollback deployment
     */
    async rollbackDeployment(environment) {
        this.log('🔄 Rolling back deployment...');
        
        const lastBackupFile = path.join(this.projectRoot, '.last_backup');
        
        if (!fs.existsSync(lastBackupFile)) {
            this.error('No backup found for rollback');
            return false;
        }

        const backupDir = fs.readFileSync(lastBackupFile, 'utf8').trim();
        
        if (!fs.existsSync(backupDir)) {
            this.error(`Backup directory not found: ${backupDir}`);
            return false;
        }

        try {
            const envDir = path.join(this.deploymentDir, 'environments', environment);
            const composeFile = path.join(envDir, 'docker-compose.yml');
            const envFile = path.join(envDir, '.env');

            // Stop current services
            this.log('Stopping current services...');
            execSync(`docker-compose -f "${composeFile}" --env-file "${envFile}" down`, {
                stdio: 'inherit',
                cwd: this.projectRoot
            });

            // Restore configuration
            this.log('Restoring configuration from backup...');
            if (fs.existsSync(path.join(backupDir, '.env.backup'))) {
                fs.copyFileSync(path.join(backupDir, '.env.backup'), envFile);
            }
            
            if (fs.existsSync(path.join(backupDir, 'docker-compose.backup.yml'))) {
                fs.copyFileSync(path.join(backupDir, 'docker-compose.backup.yml'), composeFile);
            }

            // Restart services
            this.log('Restarting services with backup configuration...');
            execSync(`docker-compose -f "${composeFile}" --env-file "${envFile}" up -d`, {
                stdio: 'inherit',
                cwd: this.projectRoot
            });

            this.success('Rollback completed successfully');
            return true;
        } catch (error) {
            this.error(`Rollback failed: ${error.message}`);
            return false;
        }
    } 
   /**
     * Deploy environment with full workflow
     */
    async deployEnvironment(environment, options = {}) {
        this.log(`🚀 Starting deployment to ${environment} environment`);

        // Validate prerequisites
        if (!(await this.validatePrerequisites(environment))) {
            return false;
        }

        // Confirm deployment
        if (!options.force && !options.dryRun) {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question(`\nDeploy to ${environment} environment? (yes/no): `, resolve);
            });
            rl.close();

            if (!answer.toLowerCase().startsWith('y')) {
                this.log('Deployment cancelled');
                return false;
            }
        }

        // Create backup
        this.createBackup(environment);

        // Deploy services
        if (!(await this.deployServices(environment, options))) {
            return false;
        }

        // Validate deployment
        if (!(await this.validateDeployment(environment))) {
            this.error('Deployment validation failed');
            return false;
        }

        this.success(`🎉 Deployment to ${environment} completed successfully!`);
        
        // Show access information
        this.showAccessInformation(environment);
        
        return true;
    }

    /**
     * Show access information after deployment
     */
    showAccessInformation(environment) {
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        const envFile = path.join(envDir, '.env');
        
        if (!fs.existsSync(envFile)) {
            return;
        }

        const envContent = fs.readFileSync(envFile, 'utf8');
        const getEnvVar = (name) => {
            const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
            return match ? match[1] : '';
        };

        const orthancPort = getEnvVar('ORTHANC_HTTP_PORT') || '8042';
        const bridgePort = getEnvVar('BRIDGE_PORT') || '3001';
        const metricsPort = getEnvVar('METRICS_PORT') || '9090';

        console.log('\n📊 Access your services:');
        console.log(`  • Orthanc:      http://localhost:${orthancPort}`);
        console.log(`  • DICOM Bridge: http://localhost:${bridgePort}`);
        console.log(`  • Health Check: http://localhost:${bridgePort}/health`);
        console.log(`  • Metrics:      http://localhost:${metricsPort}/metrics`);
        console.log(`  • Vault:        http://localhost:8200`);
        console.log('');

        if (environment === 'production') {
            this.warning('🔍 Monitor the deployment for the next 24 hours');
            this.warning(`📞 Emergency rollback: node ./scripts/deployment-manager.js rollback ${environment}`);
        }
    }

    /**
     * Main CLI interface
     */
    async run() {
        const args = process.argv.slice(2);
        const command = args[0];
        const environment = args[1];

        if (!command) {
            this.showUsage();
            return;
        }

        // Validate environment
        if (environment && !this.environments.includes(environment)) {
            this.error(`Invalid environment: ${environment}. Valid options: ${this.environments.join(', ')}`);
            return;
        }

        try {
            switch (command) {
                case 'setup':
                    if (!environment) {
                        this.error('Environment required for setup command');
                        return;
                    }
                    this.createEnvironmentConfig(environment);
                    break;

                case 'deploy':
                    if (!environment) {
                        this.error('Environment required for deploy command');
                        return;
                    }
                    await this.deployEnvironment(environment, {
                        dryRun: args.includes('--dry-run'),
                        force: args.includes('--force')
                    });
                    break;

                case 'validate':
                    if (!environment) {
                        this.error('Environment required for validate command');
                        return;
                    }
                    await this.validateDeployment(environment);
                    break;

                case 'rollback':
                    if (!environment) {
                        this.error('Environment required for rollback command');
                        return;
                    }
                    await this.rollbackDeployment(environment);
                    break;

                case 'backup':
                    if (!environment) {
                        this.error('Environment required for backup command');
                        return;
                    }
                    this.createBackup(environment);
                    break;

                default:
                    this.error(`Unknown command: ${command}`);
                    this.showUsage();
            }
        } catch (error) {
            this.error(`Command failed: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Show usage information
     */
    showUsage() {
        console.log(`
Orthanc Bridge Deployment Manager

Usage: node deployment-manager.js <command> <environment> [options]

Commands:
  setup <env>       Create environment configuration
  deploy <env>      Deploy to environment
  validate <env>    Validate deployment
  rollback <env>    Rollback deployment
  backup <env>      Create backup

Environments:
  staging           Staging environment
  production        Production environment

Options:
  --dry-run         Show what would be done without executing
  --force           Skip confirmation prompts

Examples:
  node deployment-manager.js setup staging
  node deployment-manager.js deploy production
  node deployment-manager.js validate staging --dry-run
  node deployment-manager.js rollback production
        `);
    }
}

// Run if called directly
if (require.main === module) {
    const manager = new DeploymentManager();
    manager.run().catch(error => {
        console.error('Deployment manager failed:', error);
        process.exit(1);
    });
}

module.exports = DeploymentManager;