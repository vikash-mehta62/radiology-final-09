#!/usr/bin/env node

/**
 * Deployment Configuration Generator
 * 
 * This script generates environment-specific deployment configurations
 * with proper templating and validation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DeploymentConfigGenerator {
    constructor() {
        this.projectRoot = path.dirname(__dirname);
        this.templatesDir = path.join(this.projectRoot, 'deployment', 'templates');
        this.environmentsDir = path.join(this.projectRoot, 'deployment', 'environments');
        
        this.ensureDirectoryExists(this.templatesDir);
        this.ensureDirectoryExists(this.environmentsDir);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    generateSecurePassword(length = 32) {
        return crypto.randomBytes(length).toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, length);
    }

    /**
     * Create base configuration templates
     */
    createBaseTemplates() {
        console.log('📝 Creating base configuration templates...');
        
        // Create environment template
        const envTemplate = this.createEnvironmentTemplate();
        fs.writeFileSync(path.join(this.templatesDir, '.env.template'), envTemplate);
        
        // Create Docker Compose template
        const composeTemplate = this.createDockerComposeTemplate();
        fs.writeFileSync(path.join(this.templatesDir, 'docker-compose.template.yml'), composeTemplate);
        
        // Create validation script template
        const validationTemplate = this.createValidationScriptTemplate();
        fs.writeFileSync(path.join(this.templatesDir, 'validate-deployment.template.sh'), validationTemplate);
        
        // Create SSL setup guide
        const sslGuide = this.createSSLSetupGuide();
        fs.writeFileSync(path.join(this.templatesDir, 'SSL-SETUP.md'), sslGuide);
        
        console.log('✅ Base templates created successfully');
    }

    createEnvironmentTemplate() {
        return `# Orthanc Bridge Environment Configuration Template
# Copy this file to deployment/environments/{environment}/.env and customize

# Environment Settings
NODE_ENV={{ENVIRONMENT}}
ENVIRONMENT={{ENVIRONMENT}}

# Orthanc Configuration
ORTHANC_URL=http://orthanc:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD={{ORTHANC_PASSWORD}}
ORTHANC_HTTP_PORT={{ORTHANC_HTTP_PORT}}
ORTHANC_DICOM_PORT={{ORTHANC_DICOM_PORT}}
ORTHANC_AET=ORTHANC_{{ENVIRONMENT_UPPER}}_AE

# Bridge Configuration
BRIDGE_PORT={{BRIDGE_PORT}}
BRIDGE_URL=http://dicom-bridge:3000
WEBHOOK_SECRET={{WEBHOOK_SECRET}}
LOG_LEVEL={{LOG_LEVEL}}

# Secret Management
SECRET_PROVIDER=vault
VAULT_URL=http://vault:8200
VAULT_TOKEN={{VAULT_TOKEN}}
VAULT_ROLE=dicom-bridge

# Redis Configuration
REDIS_URL=redis://redis:6379

# External API Configuration
MAIN_API_URL=http://host.docker.internal:8001

# TLS Configuration
TLS_ENABLED={{TLS_ENABLED}}
TLS_CERT_PATH=/etc/ssl/certs/orthanc.crt
TLS_KEY_PATH=/etc/ssl/private/orthanc.key

# Monitoring Configuration
METRICS_ENABLED=true
METRICS_PORT={{METRICS_PORT}}
HEALTH_CHECK_INTERVAL={{HEALTH_CHECK_INTERVAL}}

# Backup Configuration
BACKUP_ENABLED={{BACKUP_ENABLED}}
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS={{BACKUP_RETENTION_DAYS}}

# Security Configuration
WEBHOOK_TIMEOUT=30
MAX_PAYLOAD_SIZE=10mb
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100

# Database Configuration
ORTHANC_DB_COMPRESSION=true
ORTHANC_STORAGE_COMPRESSION=true

# Environment-specific settings
{{ENVIRONMENT_SPECIFIC_CONFIG}}
`;
    }

    createDockerComposeTemplate() {
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

{{PRODUCTION_SERVICES}}

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

    createValidationScriptTemplate() {
        return `#!/bin/bash

# Deployment Validation Script Template
# This script validates that the deployment is working correctly

set -e

ENVIRONMENT="{{ENVIRONMENT}}"
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

# Environment-specific validation tests
{{ENVIRONMENT_SPECIFIC_TESTS}}

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
    
    # Run environment-specific tests
    {{ENVIRONMENT_SPECIFIC_TEST_CALLS}}
    
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

    createSSLSetupGuide() {
        return `# SSL Certificate Setup Guide

This guide covers SSL certificate setup for the Orthanc Bridge deployment.

## Certificate Requirements

### Production Environment
- Valid SSL certificates from a trusted Certificate Authority (CA)
- Certificates must cover all domains/IPs used to access the services
- Private keys must be properly secured (600 permissions)
- Certificates should have at least 30 days before expiration

### Staging/Development Environment
- Self-signed certificates are acceptable
- Can use internal CA certificates
- Focus on testing SSL configuration rather than trust chain

## Setup Methods

### Method 1: Let's Encrypt (Recommended for Production)

1. Install Certbot:
   \`\`\`bash
   # Ubuntu/Debian
   sudo apt-get install certbot
   
   # CentOS/RHEL
   sudo yum install certbot
   \`\`\`

2. Generate certificates:
   \`\`\`bash
   sudo certbot certonly --standalone -d your-domain.com
   \`\`\`

3. Copy certificates to deployment directory:
   \`\`\`bash
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/certs/orthanc.crt
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/private/orthanc.key
   \`\`\`

4. Set proper permissions:
   \`\`\`bash
   chmod 644 ssl/certs/orthanc.crt
   chmod 600 ssl/private/orthanc.key
   \`\`\`

### Method 2: Self-Signed Certificates (Development/Testing)

1. Generate private key:
   \`\`\`bash
   openssl genrsa -out ssl/private/orthanc.key 2048
   \`\`\`

2. Generate certificate:
   \`\`\`bash
   openssl req -new -x509 -key ssl/private/orthanc.key -out ssl/certs/orthanc.crt -days 365 \\
     -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   \`\`\`

3. Set permissions:
   \`\`\`bash
   chmod 644 ssl/certs/orthanc.crt
   chmod 600 ssl/private/orthanc.key
   \`\`\`

### Method 3: Internal CA Certificates

1. Generate private key:
   \`\`\`bash
   openssl genrsa -out ssl/private/orthanc.key 2048
   \`\`\`

2. Generate certificate signing request:
   \`\`\`bash
   openssl req -new -key ssl/private/orthanc.key -out orthanc.csr \\
     -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
   \`\`\`

3. Sign with your internal CA:
   \`\`\`bash
   openssl x509 -req -in orthanc.csr -CA ca.crt -CAkey ca.key -CAcreateserial \\
     -out ssl/certs/orthanc.crt -days 365
   \`\`\`

4. Copy CA certificate (if needed):
   \`\`\`bash
   cp ca.crt ssl/certs/ca.crt
   \`\`\`

## Certificate Validation

Test your certificates before deployment:

\`\`\`bash
# Check certificate details
openssl x509 -in ssl/certs/orthanc.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ssl/certs/ca.crt ssl/certs/orthanc.crt

# Check certificate expiration
openssl x509 -in ssl/certs/orthanc.crt -checkend 2592000 -noout
\`\`\`

## Automated Renewal

### Let's Encrypt Auto-Renewal

1. Create renewal script:
   \`\`\`bash
   #!/bin/bash
   # /etc/cron.daily/certbot-renew
   
   certbot renew --quiet
   
   # Copy renewed certificates
   if [ -f /etc/letsencrypt/live/your-domain.com/fullchain.pem ]; then
       cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/deployment/ssl/certs/orthanc.crt
       cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/deployment/ssl/private/orthanc.key
       
       # Restart services
       docker-compose restart orthanc dicom-bridge
   fi
   \`\`\`

2. Make executable:
   \`\`\`bash
   chmod +x /etc/cron.daily/certbot-renew
   \`\`\`

## Troubleshooting

### Common Issues

1. **Permission denied errors**:
   - Check file permissions: \`ls -la ssl/private/orthanc.key\`
   - Should be 600 for private key, 644 for certificate

2. **Certificate not trusted**:
   - Verify certificate chain
   - Check if CA certificate is properly installed

3. **Certificate expired**:
   - Check expiration: \`openssl x509 -in ssl/certs/orthanc.crt -dates -noout\`
   - Renew certificate using appropriate method

4. **Docker container can't read certificates**:
   - Check volume mounts in docker-compose.yml
   - Verify file paths in environment variables

### Testing SSL Configuration

\`\`\`bash
# Test SSL connection
openssl s_client -connect localhost:8042 -servername localhost

# Test with curl
curl -k https://localhost:8042/system

# Check certificate from browser
# Navigate to https://localhost:8042 and inspect certificate
\`\`\`

## Security Best Practices

1. **Private Key Security**:
   - Never commit private keys to version control
   - Use proper file permissions (600)
   - Consider using hardware security modules for production

2. **Certificate Management**:
   - Monitor certificate expiration
   - Implement automated renewal
   - Keep backup copies of certificates

3. **Network Security**:
   - Use strong cipher suites
   - Disable weak SSL/TLS versions
   - Implement proper firewall rules

## Support

For additional help with SSL setup:
- Let's Encrypt documentation: https://letsencrypt.org/docs/
- OpenSSL documentation: https://www.openssl.org/docs/
- Docker SSL configuration: https://docs.docker.com/engine/security/
`;
    }

    /**
     * Generate environment-specific configuration
     */
    generateEnvironmentConfig(environment) {
        console.log(`🔧 Generating ${environment} environment configuration...`);
        
        const envDir = path.join(this.environmentsDir, environment);
        this.ensureDirectoryExists(envDir);
        this.ensureDirectoryExists(path.join(envDir, 'ssl', 'certs'));
        this.ensureDirectoryExists(path.join(envDir, 'ssl', 'private'));
        this.ensureDirectoryExists(path.join(envDir, 'logs'));
        this.ensureDirectoryExists(path.join(envDir, 'backups'));

        const isProduction = environment === 'production';
        
        // Generate secure credentials
        const orthancPassword = this.generateSecurePassword(25);
        const webhookSecret = this.generateSecurePassword(32);
        const vaultToken = this.generateSecurePassword(32);

        // Environment-specific values
        const config = {
            ENVIRONMENT: environment,
            ENVIRONMENT_UPPER: environment.toUpperCase(),
            ORTHANC_PASSWORD: orthancPassword,
            WEBHOOK_SECRET: webhookSecret,
            VAULT_TOKEN: vaultToken,
            ORTHANC_HTTP_PORT: isProduction ? '8042' : '8042',
            ORTHANC_DICOM_PORT: isProduction ? '4242' : '4242',
            BRIDGE_PORT: isProduction ? '3001' : '3001',
            METRICS_PORT: isProduction ? '9090' : '9090',
            LOG_LEVEL: isProduction ? 'warn' : 'info',
            TLS_ENABLED: isProduction ? 'true' : 'false',
            BACKUP_ENABLED: isProduction ? 'true' : 'false',
            BACKUP_RETENTION_DAYS: isProduction ? '90' : '30',
            HEALTH_CHECK_INTERVAL: '30'
        };

        // Environment-specific configuration
        config.ENVIRONMENT_SPECIFIC_CONFIG = isProduction ? `
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
`;

        // Generate .env file
        let envTemplate = fs.readFileSync(path.join(this.templatesDir, '.env.template'), 'utf8');
        for (const [key, value] of Object.entries(config)) {
            envTemplate = envTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        fs.writeFileSync(path.join(envDir, '.env'), envTemplate);

        // Generate docker-compose.yml
        let composeTemplate = fs.readFileSync(path.join(this.templatesDir, 'docker-compose.template.yml'), 'utf8');
        
        // Add production-specific services
        const productionServices = isProduction ? `
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
` : '';

        composeTemplate = composeTemplate.replace('{{PRODUCTION_SERVICES}}', productionServices);
        fs.writeFileSync(path.join(envDir, 'docker-compose.yml'), composeTemplate);

        // Generate validation script
        let validationTemplate = fs.readFileSync(path.join(this.templatesDir, 'validate-deployment.template.sh'), 'utf8');
        
        // Environment-specific tests
        const environmentTests = isProduction ? `
# Test TLS configuration
test_tls_configuration() {
    log "Testing TLS configuration..."
    
    if [[ ! -f "\$SCRIPT_DIR/ssl/certs/orthanc.crt" ]]; then
        error "TLS certificate not found"
        return 1
    fi
    
    if openssl x509 -in "\$SCRIPT_DIR/ssl/certs/orthanc.crt" -checkend 86400 -noout > /dev/null 2>&1; then
        success "TLS certificate is valid"
        return 0
    else
        error "TLS certificate is invalid or expiring soon"
        return 1
    fi
}

# Test production security
test_production_security() {
    log "Testing production security configuration..."
    
    # Test webhook security
    local response_code=\$(curl -s -o /dev/null -w "%{http_code}" \\
        -X POST -H "Content-Type: application/json" -d '{"test": true}' \\
        "http://localhost:\$BRIDGE_PORT/webhook" 2>/dev/null || echo "000")
    
    if [[ "\$response_code" == "401" ]]; then
        success "Webhook security is properly configured"
        return 0
    else
        error "Webhook security test failed"
        return 1
    fi
}
` : `
# Test development configuration
test_development_config() {
    log "Testing development configuration..."
    
    # Check if debug mode is enabled
    if curl -s "http://localhost:\$BRIDGE_PORT/health/detailed" | grep -q "debug"; then
        success "Debug mode is enabled for development"
        return 0
    else
        warning "Debug mode not detected"
        return 0
    fi
}
`;

        const testCalls = isProduction ? `
    # Production-specific tests
    ((total_tests++))
    test_tls_configuration || ((failed_tests++))
    
    ((total_tests++))
    test_production_security || ((failed_tests++))
` : `
    # Development-specific tests
    ((total_tests++))
    test_development_config || ((failed_tests++))
`;

        validationTemplate = validationTemplate.replace('{{ENVIRONMENT}}', environment);
        validationTemplate = validationTemplate.replace('{{ENVIRONMENT_SPECIFIC_TESTS}}', environmentTests);
        validationTemplate = validationTemplate.replace('{{ENVIRONMENT_SPECIFIC_TEST_CALLS}}', testCalls);
        
        const validationFile = path.join(envDir, 'validate-deployment.sh');
        fs.writeFileSync(validationFile, validationTemplate);
        fs.chmodSync(validationFile, '755');

        // Generate environment README
        const readme = this.generateEnvironmentReadme(environment);
        fs.writeFileSync(path.join(envDir, 'README.md'), readme);

        console.log(`✅ ${environment} environment configuration generated successfully`);
        console.log(`📁 Configuration directory: ${envDir}`);
        
        return envDir;
    }

    generateEnvironmentReadme(environment) {
        const isProduction = environment === 'production';
        
        return `# Orthanc Bridge - ${environment.toUpperCase()} Environment

Generated on: ${new Date().toISOString()}

## 🚀 Quick Start

1. **Review Configuration**
   \`\`\`bash
   # Edit environment variables
   nano .env
   \`\`\`

2. **Setup SSL Certificates** ${isProduction ? '(Required)' : '(Optional)'}
   \`\`\`bash
   # See ../../../deployment/templates/SSL-SETUP.md for detailed instructions
   \`\`\`

3. **Deploy Services**
   \`\`\`bash
   # From project root
   ./scripts/deploy.sh ${environment}
   \`\`\`

4. **Validate Deployment**
   \`\`\`bash
   # Run validation tests
   ./validate-deployment.sh
   \`\`\`

## 📋 Configuration Checklist

### Required Steps
- [ ] Review and customize .env file
- [ ] ${isProduction ? 'Install valid SSL certificates' : 'Generate SSL certificates (optional)'}
- [ ] Test Docker Compose configuration
- [ ] Run pre-deployment checks
- [ ] Execute deployment
- [ ] Validate deployment health

### ${environment === 'production' ? 'Production' : 'Development'} Specific
${isProduction ? `
- [ ] Obtain valid SSL certificates from trusted CA
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure backup procedures
- [ ] Review security settings
- [ ] Obtain PACS administrator approval
` : `
- [ ] Generate self-signed certificates if testing SSL
- [ ] Configure development-specific settings
- [ ] Set up local testing environment
- [ ] Enable debug logging if needed
`}

## 🔧 Configuration Files

- \`.env\` - Environment variables and secrets
- \`docker-compose.yml\` - Service definitions and configuration
- \`validate-deployment.sh\` - Deployment validation script
- \`ssl/\` - SSL certificates directory
- \`logs/\` - Application logs directory
- \`backups/\` - Backup storage directory

## 📞 Support

For deployment issues:
- Check logs: \`docker-compose logs -f\`
- Run validation: \`./validate-deployment.sh\`
- Review documentation: \`../../../README.md\`

---
**Environment**: ${environment}  
**Generated by**: Deployment Configuration Generator  
**Version**: 1.0.0
`;
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

        try {
            switch (command) {
                case 'templates':
                    this.createBaseTemplates();
                    break;

                case 'generate':
                    if (!environment) {
                        console.error('Environment required for generate command');
                        return;
                    }
                    if (!['staging', 'production'].includes(environment)) {
                        console.error(`Invalid environment: ${environment}`);
                        return;
                    }
                    this.generateEnvironmentConfig(environment);
                    break;

                default:
                    console.error(`Unknown command: ${command}`);
                    this.showUsage();
            }
        } catch (error) {
            console.error(`Command failed: ${error.message}`);
            process.exit(1);
        }
    }

    showUsage() {
        console.log(`
Deployment Configuration Generator

Usage: node generate-deployment-config.js <command> [environment]

Commands:
  templates           Create base configuration templates
  generate <env>      Generate environment-specific configuration

Environments:
  staging             Generate staging environment configuration
  production          Generate production environment configuration

Examples:
  node generate-deployment-config.js templates
  node generate-deployment-config.js generate staging
  node generate-deployment-config.js generate production
        `);
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new DeploymentConfigGenerator();
    generator.run();
}

module.exports = DeploymentConfigGenerator;