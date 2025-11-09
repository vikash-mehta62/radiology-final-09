# PACS Production Deployment

This directory contains all files and scripts needed for production deployment of the PACS system.

## Quick Start

```bash
# 1. Setup production environment
sudo bash scripts/setup-production.sh

# 2. Configure environment
cd /opt/pacs/deployment/production
cp .env.example .env
nano .env  # Edit with your values

# 3. Run database migrations
bash migrations/migrate.sh

# 4. Build Docker images
bash scripts/build.sh

# 5. Deploy to production
bash scripts/deploy.sh
```

## Directory Structure

```
deployment/production/
├── docker-compose.prod.yml      # Production Docker Compose configuration
├── .env.example                 # Environment variables template
├── .dockerignore               # Docker build exclusions
├── Dockerfile.frontend         # Frontend Docker build
├── Dockerfile.backend          # Backend Docker build
├── nginx.conf                  # Nginx configuration
├── scripts/
│   ├── setup-production.sh     # Initial server setup
│   ├── deploy.sh              # Deployment script
│   └── build.sh               # Build script
├── migrations/
│   ├── 001_create_collections.js  # Database schema migration
│   ├── migrate.sh             # Migration execution
│   └── rollback.sh            # Rollback script
├── monitoring/
│   ├── prometheus.yml         # Prometheus configuration
│   ├── alert-rules.yml        # Alert definitions
│   ├── alertmanager.yml       # Alert routing
│   ├── health-check.js        # Health check script
│   └── grafana/
│       ├── dashboards/        # Grafana dashboards
│       └── datasources/       # Grafana data sources
├── DEPLOYMENT_GUIDE.md        # Comprehensive deployment guide
├── DEPLOYMENT_SUMMARY.md      # Implementation summary
└── README.md                  # This file
```

## Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Implementation details

## Prerequisites

- Ubuntu 20.04 LTS or later
- Docker 20.10+
- Docker Compose 2.0+
- 16GB RAM minimum (32GB recommended)
- 500GB disk space minimum
- Root/sudo access

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Critical settings to configure:
FRONTEND_DOMAIN=pacs.yourhospital.com
API_DOMAIN=api.pacs.yourhospital.com
MONGO_ROOT_PASSWORD=<strong-password>
JWT_SECRET=<random-secret>
SENDGRID_API_KEY=<your-key>
TWILIO_ACCOUNT_SID=<your-sid>
```

### DNS Configuration

Point your domains to the server:
```
pacs.yourhospital.com        A    <server-ip>
api.pacs.yourhospital.com    A    <server-ip>
```

### SSL Certificates

For production, use Let's Encrypt:
```bash
sudo certbot certonly --standalone -d pacs.yourhospital.com
```

## Services

The deployment includes:

- **Frontend** (Port 3000) - React application with Nginx
- **Backend** (Port 5000) - Node.js API server
- **MongoDB** (Port 27017) - Database
- **Redis** (Port 6379) - Cache and sessions
- **Orthanc** (Port 8042, 4242) - DICOM server
- **Traefik** (Port 80, 443) - Load balancer
- **Prometheus** (Port 9090) - Metrics
- **Grafana** (Port 3001) - Dashboards

## Monitoring

### Access Dashboards

- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **Traefik**: https://traefik.pacs.yourhospital.com

### Health Checks

```bash
# Run health check
node monitoring/health-check.js

# Check specific service
curl http://localhost:5000/health
```

## Deployment

### Initial Deployment

```bash
# Deploy all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Update Deployment

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Database Management

### Run Migrations

```bash
cd migrations
bash migrate.sh
```

### Rollback

```bash
cd migrations
bash rollback.sh
```

### Backup

```bash
# Manual backup
docker exec pacs-mongodb-prod mongodump --out /tmp/backup

# Automated backups run daily at 2 AM (configured in setup script)
```

## Troubleshooting

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services

```bash
# All services
docker-compose -f docker-compose.prod.yml restart

# Specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Check Resources

```bash
# Container stats
docker stats

# System resources
htop

# Disk space
df -h
```

## Maintenance

### Daily Tasks
- Monitor system health
- Check error logs
- Verify backups

### Weekly Tasks
- Review security logs
- Check disk space
- Review performance metrics

### Monthly Tasks
- Update dependencies
- Security audit
- Test backup restoration

## Security

### Firewall Rules

```bash
# Allow required ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 4242/tcp # DICOM
sudo ufw enable
```

### SSL/TLS

- Use Let's Encrypt for production certificates
- Automatic renewal configured in Traefik
- TLS 1.3 enforced

### Secrets Management

- Never commit `.env` file
- Use strong passwords
- Rotate secrets regularly
- Use environment variables for sensitive data

## Backup and Recovery

### Automated Backups

Backups run daily at 2 AM:
- MongoDB database
- Application keys
- Configuration files

Location: `/opt/pacs/backups/`

### Manual Backup

```bash
/opt/pacs/scripts/backup.sh
```

### Restore from Backup

```bash
cd migrations
bash rollback.sh
# Select backup from list
```

## Performance Optimization

### Database Indexes

All collections have optimized indexes for:
- Query performance
- Sorting operations
- Unique constraints

### Caching

Redis caching for:
- Session data
- Frequently accessed data
- API responses

### Load Balancing

Traefik provides:
- Automatic load balancing
- SSL termination
- Request routing

## Compliance

### FDA 21 CFR Part 11

- Digital signatures implemented
- Audit trail logging
- Data integrity verification

### HIPAA

- PHI encryption
- Access logging
- Data retention policies
- Secure transmission

## Support

### Documentation
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Full deployment guide
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Implementation details

### Logs
- Application: `/opt/pacs/logs/application.log`
- Audit: `/opt/pacs/logs/audit.log`
- Deployment: `/opt/pacs/logs/deployment.log`

### Health Checks
```bash
node monitoring/health-check.js --json
```

## License

Copyright © 2024 Hospital Name. All rights reserved.

## Version

Version: 1.0.0
Last Updated: 2024
