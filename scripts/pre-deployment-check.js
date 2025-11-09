#!/usr/bin/env node

/**
 * Pre-Deployment Health Check Script
 * 
 * This script performs comprehensive pre-deployment validation including:
 * - System prerequisites validation
 * - Configuration validation
 * - Security requirements verification
 * - Production readiness checklist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class PreDeploymentChecker {
    constructor() {
        this.projectRoot = path.dirname(__dirname);
        this.deploymentDir = path.join(this.projectRoot, 'deployment');
        
        // Colors for console output
        this.colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            cyan: '\x1b[36m'
        };
        
        this.checkResults = {
            passed: 0,
            failed: 0,
            warnings: 0,
            issues: []
        };
    }

    log(message, color = 'blue') {
        const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
        console.log(`${this.colors[color]}[${timestamp}]${this.colors.reset} ${message}`);
    }

    error(message) {
        this.log(`❌ ERROR: ${message}`, 'red');
        this.checkResults.failed++;
        this.checkResults.issues.push({ type: 'error', message });
    }

    success(message) {
        this.log(`✅ SUCCESS: ${message}`, 'green');
        this.checkResults.passed++;
    }

    warning(message) {
        this.log(`⚠️  WARNING: ${message}`, 'yellow');
        this.checkResults.warnings++;
        this.checkResults.issues.push({ type: 'warning', message });
    }

    info(message) {
        this.log(`ℹ️  INFO: ${message}`, 'cyan');
    }

    /**
     * Check system prerequisites
     */
    checkSystemPrerequisites() {
        this.log('🔍 Checking system prerequisites...');
        
        // Check Docker
        try {
            const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
            this.success(`Docker installed: ${dockerVersion}`);
        } catch (error) {
            this.error('Docker is not installed or not accessible');
        }

        // Check Docker Compose
        try {
            const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
            this.success(`Docker Compose installed: ${composeVersion}`);
        } catch (error) {
            this.error('Docker Compose is not installed or not accessible');
        }

        // Check Node.js
        try {
            const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
            this.success(`Node.js installed: ${nodeVersion}`);
        } catch (error) {
            this.error('Node.js is not installed or not accessible');
        }

        // Check available disk space
        try {
            const diskUsage = execSync('df -h .', { encoding: 'utf8' });
            const lines = diskUsage.split('\n');
            if (lines.length > 1) {
                const usage = lines[1].split(/\s+/);
                const available = usage[3];
                this.success(`Available disk space: ${available}`);
                
                // Parse available space (assuming format like "10G" or "1024M")
                const availableBytes = this.parseSize(available);
                if (availableBytes < 5 * 1024 * 1024 * 1024) { // 5GB
                    this.warning('Less than 5GB disk space available. Consider freeing up space.');
                }
            }
        } catch (error) {
            this.warning('Could not check disk space');
        }

        // Check memory
        try {
            const memInfo = execSync('free -h', { encoding: 'utf8' });
            const lines = memInfo.split('\n');
            if (lines.length > 1) {
                const memLine = lines[1].split(/\s+/);
                const totalMem = memLine[1];
                this.success(`Total memory: ${totalMem}`);
                
                const totalBytes = this.parseSize(totalMem);
                if (totalBytes < 4 * 1024 * 1024 * 1024) { // 4GB
                    this.warning('Less than 4GB RAM available. Performance may be impacted.');
                }
            }
        } catch (error) {
            this.warning('Could not check memory information');
        }
    }

    /**
     * Parse size string to bytes
     */
    parseSize(sizeStr) {
        const units = { K: 1024, M: 1024**2, G: 1024**3, T: 1024**4 };
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        return value * (units[unit] || 1);
    }

    /**
     * Check environment configuration
     */
    checkEnvironmentConfiguration(environment) {
        this.log(`🔧 Checking ${environment} environment configuration...`);
        
        const envDir = path.join(this.deploymentDir, 'environments', environment);
        const envFile = path.join(envDir, '.env');
        const composeFile = path.join(envDir, 'docker-compose.yml');
        
        // Check if environment directory exists
        if (!fs.existsSync(envDir)) {
            this.error(`Environment directory not found: ${envDir}`);
            return;
        }

        // Check environment file
        if (!fs.existsSync(envFile)) {
            this.error(`Environment configuration file not found: ${envFile}`);
            return;
        }

        this.success(`Environment directory exists: ${envDir}`);
        
        // Validate environment file content
        const envContent = fs.readFileSync(envFile, 'utf8');
        this.validateEnvironmentFile(envContent, environment);

        // Check Docker Compose file
        if (!fs.existsSync(composeFile)) {
            this.error(`Docker Compose file not found: ${composeFile}`);
        } else {
            this.success(`Docker Compose file exists: ${composeFile}`);
            this.validateDockerComposeFile(composeFile);
        }

        // Check SSL configuration for production
        if (environment === 'production') {
            this.checkSSLConfiguration(envDir);
        }
    }

    /**
     * Validate environment file content
     */
    validateEnvironmentFile(envContent, environment) {
        // Check for required variables
        const requiredVars = [
            'NODE_ENV', 'ENVIRONMENT', 'ORTHANC_URL', 'ORTHANC_USERNAME', 
            'ORTHANC_PASSWORD', 'WEBHOOK_SECRET', 'VAULT_TOKEN', 'REDIS_URL'
        ];

        for (const varName of requiredVars) {
            const regex = new RegExp(`^${varName}=(.+)$`, 'm');
            const match = envContent.match(regex);
            
            if (!match) {
                this.error(`Required environment variable missing: ${varName}`);
            } else if (match[1].trim() === '') {
                this.error(`Environment variable is empty: ${varName}`);
            } else {
                this.success(`Environment variable configured: ${varName}`);
            }
        }

        // Check for default/insecure passwords
        const insecurePatterns = [
            'orthanc_secure_2024',
            'webhook_secret_2024_change_in_prod',
            'password123',
            'admin',
            'changeme'
        ];

        for (const pattern of insecurePatterns) {
            if (envContent.includes(pattern)) {
                this.error(`Insecure default password detected: ${pattern}`);
            }
        }

        // Check password strength
        const passwordRegex = /^(ORTHANC_PASSWORD|WEBHOOK_SECRET|VAULT_TOKEN)=(.+)$/gm;
        let match;
        while ((match = passwordRegex.exec(envContent)) !== null) {
            const [, varName, password] = match;
            if (password.length < 16) {
                this.warning(`${varName} should be at least 16 characters long`);
            } else {
                this.success(`${varName} meets minimum length requirements`);
            }
        }

        // Check environment-specific settings
        if (environment === 'production') {
            if (!envContent.includes('TLS_ENABLED=true')) {
                this.error('TLS must be enabled for production environment');
            }
            if (!envContent.includes('LOG_LEVEL=warn') && !envContent.includes('LOG_LEVEL=error')) {
                this.warning('Consider using warn or error log level for production');
            }
        }
    }

    /**
     * Validate Docker Compose file
     */
    validateDockerComposeFile(composeFile) {
        try {
            // Test Docker Compose file syntax
            execSync(`docker-compose -f "${composeFile}" config`, { stdio: 'ignore' });
            this.success('Docker Compose file syntax is valid');
        } catch (error) {
            this.error('Docker Compose file has syntax errors');
        }

        // Check for required services
        const composeContent = fs.readFileSync(composeFile, 'utf8');
        const requiredServices = ['orthanc', 'dicom-bridge', 'redis', 'vault'];
        
        for (const service of requiredServices) {
            if (composeContent.includes(`${service}:`)) {
                this.success(`Required service defined: ${service}`);
            } else {
                this.error(`Required service missing: ${service}`);
            }
        }

        // Check for health checks
        if (composeContent.includes('healthcheck:')) {
            this.success('Health checks are configured');
        } else {
            this.warning('No health checks found in Docker Compose file');
        }

        // Check for proper networking
        if (composeContent.includes('networks:')) {
            this.success('Custom networks are configured');
        } else {
            this.warning('No custom networks configured');
        }
    }

    /**
     * Check SSL configuration for production
     */
    checkSSLConfiguration(envDir) {
        this.log('🔒 Checking SSL configuration...');
        
        const sslDir = path.join(envDir, 'ssl');
        const certFile = path.join(sslDir, 'certs', 'orthanc.crt');
        const keyFile = path.join(sslDir, 'private', 'orthanc.key');

        if (!fs.existsSync(sslDir)) {
            this.error('SSL directory not found');
            return;
        }

        if (!fs.existsSync(certFile)) {
            this.error(`SSL certificate not found: ${certFile}`);
        } else {
            this.success('SSL certificate file exists');
            this.validateSSLCertificate(certFile);
        }

        if (!fs.existsSync(keyFile)) {
            this.error(`SSL private key not found: ${keyFile}`);
        } else {
            this.success('SSL private key file exists');
            this.checkFilePermissions(keyFile, '600');
        }
    }

    /**
     * Validate SSL certificate
     */
    validateSSLCertificate(certFile) {
        try {
            // Check certificate validity
            const certInfo = execSync(`openssl x509 -in "${certFile}" -text -noout`, { encoding: 'utf8' });
            
            // Check expiration
            const expiryCheck = execSync(`openssl x509 -in "${certFile}" -checkend 2592000 -noout`, { stdio: 'ignore' });
            this.success('SSL certificate is valid and not expiring within 30 days');
            
            // Extract subject and issuer
            const subjectMatch = certInfo.match(/Subject: (.+)/);
            const issuerMatch = certInfo.match(/Issuer: (.+)/);
            
            if (subjectMatch) {
                this.info(`Certificate subject: ${subjectMatch[1]}`);
            }
            if (issuerMatch) {
                this.info(`Certificate issuer: ${issuerMatch[1]}`);
            }
            
        } catch (error) {
            if (error.status === 1) {
                this.warning('SSL certificate expires within 30 days');
            } else {
                this.error('SSL certificate is invalid or corrupted');
            }
        }
    }

    /**
     * Check file permissions
     */
    checkFilePermissions(filePath, expectedPerms) {
        try {
            const stats = fs.statSync(filePath);
            const perms = (stats.mode & parseInt('777', 8)).toString(8);
            
            if (perms === expectedPerms) {
                this.success(`File permissions correct: ${filePath} (${perms})`);
            } else {
                this.warning(`File permissions should be ${expectedPerms}, found ${perms}: ${filePath}`);
            }
        } catch (error) {
            this.error(`Could not check file permissions: ${filePath}`);
        }
    }

    /**
     * Check security requirements
     */
    checkSecurityRequirements(environment) {
        this.log('🛡️  Checking security requirements...');
        
        // Check for .env files in repository
        const gitIgnoreFile = path.join(this.projectRoot, '.gitignore');
        if (fs.existsSync(gitIgnoreFile)) {
            const gitIgnoreContent = fs.readFileSync(gitIgnoreFile, 'utf8');
            if (gitIgnoreContent.includes('.env') || gitIgnoreContent.includes('*.env')) {
                this.success('.env files are properly ignored by git');
            } else {
                this.error('.env files are not ignored by git - security risk!');
            }
        } else {
            this.warning('.gitignore file not found');
        }

        // Check for secrets in repository
        try {
            const gitFiles = execSync('git ls-files', { encoding: 'utf8', cwd: this.projectRoot });
            const suspiciousFiles = gitFiles.split('\n').filter(file => 
                file.includes('.env') && !file.includes('.example')
            );
            
            if (suspiciousFiles.length > 0) {
                this.error(`Potential secrets in repository: ${suspiciousFiles.join(', ')}`);
            } else {
                this.success('No obvious secrets found in repository');
            }
        } catch (error) {
            this.warning('Could not check repository for secrets');
        }

        // Check for default ports in production
        if (environment === 'production') {
            const envFile = path.join(this.deploymentDir, 'environments', environment, '.env');
            if (fs.existsSync(envFile)) {
                const envContent = fs.readFileSync(envFile, 'utf8');
                
                // Check for default ports
                const defaultPorts = ['8042', '4242', '3001', '6379', '8200'];
                let hasDefaultPorts = false;
                
                for (const port of defaultPorts) {
                    if (envContent.includes(`=${port}`)) {
                        hasDefaultPorts = true;
                        break;
                    }
                }
                
                if (hasDefaultPorts) {
                    this.warning('Using default ports in production - consider changing for security');
                } else {
                    this.success('Non-default ports configured for production');
                }
            }
        }
    }

    /**
     * Check production readiness
     */
    checkProductionReadiness(environment) {
        if (environment !== 'production') {
            this.info('Skipping production readiness checks for non-production environment');
            return;
        }

        this.log('🚀 Checking production readiness...');
        
        // Check backup configuration
        const envFile = path.join(this.deploymentDir, 'environments', environment, '.env');
        if (fs.existsSync(envFile)) {
            const envContent = fs.readFileSync(envFile, 'utf8');
            
            if (envContent.includes('BACKUP_ENABLED=true')) {
                this.success('Backup is enabled for production');
            } else {
                this.error('Backup must be enabled for production');
            }
            
            if (envContent.includes('METRICS_ENABLED=true')) {
                this.success('Metrics collection is enabled');
            } else {
                this.warning('Metrics collection should be enabled for production monitoring');
            }
        }

        // Check monitoring configuration
        const monitoringFiles = [
            path.join(this.projectRoot, 'monitoring', 'prometheus.yml'),
            path.join(this.projectRoot, 'monitoring', 'grafana'),
            path.join(this.projectRoot, 'monitoring', 'alertmanager.yml')
        ];

        for (const file of monitoringFiles) {
            if (fs.existsSync(file)) {
                this.success(`Monitoring configuration found: ${path.basename(file)}`);
            } else {
                this.warning(`Monitoring configuration missing: ${path.basename(file)}`);
            }
        }

        // Check documentation
        const docFiles = [
            path.join(this.projectRoot, 'docs', 'PACS-RUNBOOK.md'),
            path.join(this.projectRoot, 'docs', 'ROLLBACK.md'),
            path.join(this.projectRoot, 'docs', 'SECURITY_REVIEW_PROCESS.md')
        ];

        for (const file of docFiles) {
            if (fs.existsSync(file)) {
                this.success(`Documentation found: ${path.basename(file)}`);
            } else {
                this.warning(`Documentation missing: ${path.basename(file)}`);
            }
        }
    }

    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        this.log('🌐 Checking network connectivity...');
        
        // Check Docker daemon
        try {
            execSync('docker info', { stdio: 'ignore' });
            this.success('Docker daemon is accessible');
        } catch (error) {
            this.error('Docker daemon is not accessible');
        }

        // Check if required ports are available
        const requiredPorts = [8042, 4242, 3001, 6379, 8200, 9090];
        
        for (const port of requiredPorts) {
            try {
                execSync(`netstat -ln | grep :${port}`, { stdio: 'ignore' });
                this.warning(`Port ${port} is already in use`);
            } catch (error) {
                this.success(`Port ${port} is available`);
            }
        }
    }

    /**
     * Generate summary report
     */
    generateSummaryReport(environment) {
        console.log('\n' + '='.repeat(60));
        console.log(`PRE-DEPLOYMENT CHECK SUMMARY - ${environment.toUpperCase()}`);
        console.log('='.repeat(60));
        
        console.log(`\n📊 Results:`);
        console.log(`  ✅ Passed: ${this.checkResults.passed}`);
        console.log(`  ❌ Failed: ${this.checkResults.failed}`);
        console.log(`  ⚠️  Warnings: ${this.checkResults.warnings}`);
        
        if (this.checkResults.issues.length > 0) {
            console.log(`\n🔍 Issues to address:`);
            this.checkResults.issues.forEach((issue, index) => {
                const icon = issue.type === 'error' ? '❌' : '⚠️';
                console.log(`  ${index + 1}. ${icon} ${issue.message}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        if (this.checkResults.failed === 0) {
            this.success('🎉 All critical checks passed! Ready for deployment.');
            return true;
        } else {
            this.error(`❌ ${this.checkResults.failed} critical issue(s) must be resolved before deployment.`);
            return false;
        }
    }

    /**
     * Run all checks
     */
    async runAllChecks(environment) {
        this.log(`🔍 Starting pre-deployment checks for ${environment} environment`);
        console.log('');
        
        // Run all checks
        this.checkSystemPrerequisites();
        console.log('');
        
        this.checkEnvironmentConfiguration(environment);
        console.log('');
        
        this.checkSecurityRequirements(environment);
        console.log('');
        
        this.checkProductionReadiness(environment);
        console.log('');
        
        await this.checkNetworkConnectivity();
        console.log('');
        
        // Generate summary
        const success = this.generateSummaryReport(environment);
        
        return success;
    }

    /**
     * Show usage information
     */
    showUsage() {
        console.log(`
Pre-Deployment Health Check

Usage: node pre-deployment-check.js <environment>

Environments:
  staging           Check staging environment
  production        Check production environment

Examples:
  node pre-deployment-check.js staging
  node pre-deployment-check.js production
        `);
    }

    /**
     * Main CLI interface
     */
    async run() {
        const args = process.argv.slice(2);
        const environment = args[0];

        if (!environment) {
            this.showUsage();
            return;
        }

        if (!['staging', 'production'].includes(environment)) {
            this.error(`Invalid environment: ${environment}. Valid options: staging, production`);
            return;
        }

        try {
            const success = await this.runAllChecks(environment);
            process.exit(success ? 0 : 1);
        } catch (error) {
            this.error(`Pre-deployment check failed: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const checker = new PreDeploymentChecker();
    checker.run();
}

module.exports = PreDeploymentChecker;