# PACS Production Deployment Guide

This guide provides step-by-step instructions for deploying the PACS system to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Setup](#environment-setup)
4. [Database Migration](#database-migration)
5. [Build and Deploy](#build-and-deploy)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or later (recommended)
- **CPU**: Minimum 8 cores (16 cores recommended)
- **RAM**: Minimum 16GB (32GB recommended)
- **Disk**: Minimum 500GB SSD (1TB recommended)
- **Network**: Static IP address, open ports 80, 443, 4242

### Software Requirements

- Docker 20.10 or later
- Docker Compose 2.0 or later
- Node.js 18 or later (for build process)
- OpenSSL (for key generation)

### Access Requirements

- Root or sudo access to production server
- Docker registry credentials
- DNS configuration access
- SSL certificate (Let's Encrypt recommended)

## Pre-Deployment Checklist

### Security

- [ ] Generate cryptographic keys for FDA signatures
- [ ] Configure SSL/TLS certificates
- [ ] Set up firewall rules
- [ ] Configure secure passwords for all services
- [ ] Review and update security policies
- [ ] Enable audit logging

### Configuration

- [ ] Update `.env` file with production values
- [ ] Configure domain names in docker-compose.prod.yml
- [ ] Set up DNS records
- [ ] Configure email service (SendGrid)
- [ ] Configure SMS service (Twilio)
- [ ] Configure monitoring alerts

### Backup

- [ ] Set up automated backup schedule
- [ ] Test backup and restore procedures
- [ ] Configure off-site backup storage
- [ ] Document backup retention policy

### Testing

- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Perform security scan
- [ ] Load testing completed
- [ ] User acceptance testing completed

## Environment Setup

### 1. Initial Server Setup

```bash
# Run the setup script
sudo bash deployment/production/scripts/setup-production.sh
```

This script will:
- Install Docker and Docker Compose
- Create directory structure
- Generate cryptographic keys
- Generate SSL certificates (self-signed)
- Configure firewall
- Set up system limits
- Configure log rotation
- Create backup scripts

### 2. Configure Environment Variables

```bash
# Copy environment template
cd /opt/pacs/deployment/production
cp .env.example .env

# Edit environment file
nano .env
```

**Important variables to configure:**

```bash
# Domain Configuration
FRONTEND_DOMAIN=pacs.yourhospital.com
API_DOMAIN=api.pacs.yourhospital.com

# Database Credentials
MONGO_ROOT_PASSWORD=<strong-password>
MONGODB_URI=mongodb://pacs_user:<password>@mongodb:27017/pacs

# JWT Secrets (generate with: openssl rand -base64 64)
JWT_SECRET=<random-secret>
JWT_REFRESH_SECRET=<random-secret>

# External Services
SENDGRID_API_KEY=<your-sendgrid-key>
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>

# SSL Configuration
ACME_EMAIL=admin@yourhospital.com
```

### 3. Configure DNS

Point your domains to the server IP:

```
pacs.yourhospital.com        A    <server-ip>
api.pacs.yourhospital.com    A    <server-ip>
traefik.pacs.yourhospital.com A   <server-ip>
```

### 4. SSL Certificates

For production, replace self-signed certificates with Let's Encrypt:

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d pacs.yourhospital.com
sudo certbot certonly --standalone -d api.pacs.yourhospital.com

# Copy certificates
sudo cp /etc/letsencrypt/live/pacs.yourhospital.com/fullchain.pem /opt/pacs/ssl/cert.pem
sudo cp /etc/letsencrypt/live/pacs.yourhospital.com/privkey.pem /opt/pacs/ssl/key.pem
```

## Database Migration

### 1. Test Migration in Staging

```bash
# Run migration script in dry-run mode
cd /opt/pacs/deployment/production/migrations
bash migrate.sh --dry-run
```

### 2. Create Pre-Migration Backup

```bash
# Backup is automatically created by migration script
# Or manually create backup:
docker exec pacs-mongodb-prod mongodump --out /tmp/pre_migration_backup
```

### 3. Run Migration

```bash
# Run migration
bash migrate.sh
```

### 4. Verify Migration

```bash
# Check migration status
docker exec pacs-mongodb-prod mongosh pacs --eval "db.migrations.find().pretty()"

# Verify collections
docker exec pacs-mongodb-prod mongosh pacs --eval "db.getCollectionNames()"
```

## Build and Deploy

### 1. Build Docker Images

```bash
# Run build script
cd /opt/pacs/deployment/production/scripts
bash build.sh
```

This will:
- Install dependencies
- Run tests
- Build frontend and backend
- Create Docker images
- Run security scans
- Push to registry (optional)

### 2. Deploy to Production

```bash
# Run deployment script
bash deploy.sh
```

This will:
- Create pre-deployment backup
- Pull latest images
- Stop existing services
- Start new services
- Run health checks
- Display deployment status

### 3. Manual Deployment (Alternative)

```bash
cd /opt/pacs/deployment/production

# Pull images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Run health check script
node /opt/pacs/deployment/production/monitoring/health-check.js

# Check individual services
curl http://localhost:5000/health  # Backend
curl http://localhost:3000/health  # Frontend
curl http://localhost:8042/system  # Orthanc
```

### 2. Verify Services

```bash
# Check running containers
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs --tail=50

# Check resource usage
docker stats
```

### 3. Test Critical Features

- [ ] User login
- [ ] DICOM upload
- [ ] Image viewing
- [ ] Report creation
- [ ] Critical notification delivery
- [ ] Digital signature
- [ ] Export functionality
- [ ] Session management

### 4. Verify Monitoring

- Access Grafana: http://localhost:3001
- Access Prometheus: http://localhost:9090
- Check alert rules are loaded
- Verify metrics are being collected

## Monitoring and Alerting

### Access Monitoring Dashboards

- **Grafana**: http://localhost:3001
  - Username: admin
  - Password: (from .env GRAFANA_ADMIN_PASSWORD)

- **Prometheus**: http://localhost:9090

- **Traefik Dashboard**: https://traefik.pacs.yourhospital.com

### Configure Alerts

Edit alertmanager configuration:

```bash
nano /opt/pacs/deployment/production/monitoring/alertmanager.yml
```

Update email addresses and notification channels.

### Test Alerts

```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts -d '[{
  "labels": {"alertname": "TestAlert", "severity": "warning"},
  "annotations": {"summary": "Test alert"}
}]'
```

## Rollback Procedures

### Quick Rollback

```bash
# Run rollback script
cd /opt/pacs/deployment/production/migrations
bash rollback.sh
```

Select the backup to restore from the list.

### Manual Rollback

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore database
docker exec pacs-mongodb-prod mongorestore --drop /path/to/backup

# Start previous version
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check disk space
df -h

# Check memory
free -h

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check MongoDB status
docker exec pacs-mongodb-prod mongosh --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker logs pacs-mongodb-prod

# Restart MongoDB
docker-compose -f docker-compose.prod.yml restart mongodb
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check system resources
htop

# Check network
netstat -tulpn

# Check disk I/O
iotop
```

### SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /opt/pacs/ssl/cert.pem -noout -dates

# Renew Let's Encrypt certificate
sudo certbot renew

# Restart services
docker-compose -f docker-compose.prod.yml restart traefik
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor system health
- Check error logs
- Verify backups completed

**Weekly:**
- Review security logs
- Check disk space
- Review performance metrics

**Monthly:**
- Update dependencies
- Review and rotate logs
- Test backup restoration
- Security audit

### Updates

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -a
```

## Support

For issues or questions:
- Check logs: `/opt/pacs/logs/`
- Review documentation: `/opt/pacs/docs/`
- Contact: support@yourhospital.com

## Appendix

### Useful Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# Execute command in container
docker exec -it pacs-backend-prod bash

# Check database
docker exec -it pacs-mongodb-prod mongosh pacs

# Backup database
docker exec pacs-mongodb-prod mongodump --out /tmp/backup

# Check metrics
curl http://localhost:5000/metrics
```

### File Locations

- Configuration: `/opt/pacs/deployment/production/`
- Logs: `/opt/pacs/logs/`
- Backups: `/opt/pacs/backups/`
- Keys: `/opt/pacs/keys/`
- SSL Certificates: `/opt/pacs/ssl/`
