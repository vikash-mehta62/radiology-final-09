#!/bin/bash

# Production Environment Setup Script
# This script prepares the production environment for PACS deployment

set -e

echo "=========================================="
echo "PACS Production Environment Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 1. Install Docker and Docker Compose
echo ""
echo "Step 1: Installing Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $SUDO_USER
    print_status "Docker installed"
else
    print_status "Docker already installed"
fi

if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed"
else
    print_status "Docker Compose already installed"
fi

# 2. Create directory structure
echo ""
echo "Step 2: Creating directory structure..."
mkdir -p /opt/pacs/{deployment,keys,logs,backups,data}
mkdir -p /opt/pacs/deployment/{production,staging}
mkdir -p /opt/pacs/logs/{application,audit,nginx,mongodb}
print_status "Directory structure created"

# 3. Generate cryptographic keys for FDA signatures
echo ""
echo "Step 3: Generating cryptographic keys..."
if [ ! -f /opt/pacs/keys/signature-private.pem ]; then
    openssl genrsa -out /opt/pacs/keys/signature-private.pem 2048
    openssl rsa -in /opt/pacs/keys/signature-private.pem -pubout -out /opt/pacs/keys/signature-public.pem
    chmod 600 /opt/pacs/keys/signature-private.pem
    chmod 644 /opt/pacs/keys/signature-public.pem
    print_status "Cryptographic keys generated"
else
    print_warning "Keys already exist, skipping generation"
fi

# 4. Generate SSL certificates (self-signed for testing, use Let's Encrypt for production)
echo ""
echo "Step 4: Generating SSL certificates..."
mkdir -p /opt/pacs/ssl
if [ ! -f /opt/pacs/ssl/cert.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /opt/pacs/ssl/key.pem \
        -out /opt/pacs/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Hospital/CN=pacs.yourhospital.com"
    print_status "SSL certificates generated (self-signed)"
    print_warning "For production, replace with Let's Encrypt certificates"
else
    print_warning "SSL certificates already exist"
fi

# 5. Set up firewall rules
echo ""
echo "Step 5: Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 4242/tcp  # DICOM
    ufw --force enable
    print_status "Firewall configured"
else
    print_warning "UFW not installed, skipping firewall configuration"
fi

# 6. Configure system limits
echo ""
echo "Step 6: Configuring system limits..."
cat >> /etc/security/limits.conf <<EOF
# PACS System Limits
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF
print_status "System limits configured"

# 7. Configure kernel parameters
echo ""
echo "Step 7: Configuring kernel parameters..."
cat >> /etc/sysctl.conf <<EOF
# PACS System Parameters
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.ip_local_port_range = 10000 65535
vm.max_map_count = 262144
fs.file-max = 2097152
EOF
sysctl -p
print_status "Kernel parameters configured"

# 8. Install monitoring tools
echo ""
echo "Step 8: Installing monitoring tools..."
if ! command -v htop &> /dev/null; then
    apt-get update
    apt-get install -y htop iotop nethogs
    print_status "Monitoring tools installed"
else
    print_status "Monitoring tools already installed"
fi

# 9. Set up log rotation
echo ""
echo "Step 9: Configuring log rotation..."
cat > /etc/logrotate.d/pacs <<EOF
/opt/pacs/logs/**/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker-compose -f /opt/pacs/deployment/production/docker-compose.prod.yml restart backend
    endscript
}
EOF
print_status "Log rotation configured"

# 10. Create backup script
echo ""
echo "Step 10: Creating backup script..."
cat > /opt/pacs/scripts/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/pacs/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pacs_backup_${DATE}.tar.gz"

# Backup MongoDB
docker exec pacs-mongodb-prod mongodump --out /tmp/mongodb_backup
docker cp pacs-mongodb-prod:/tmp/mongodb_backup ${BACKUP_DIR}/mongodb_${DATE}

# Backup application data
tar -czf ${BACKUP_DIR}/${BACKUP_FILE} \
    /opt/pacs/keys \
    /opt/pacs/logs \
    ${BACKUP_DIR}/mongodb_${DATE}

# Clean up old backups (keep last 30 days)
find ${BACKUP_DIR} -name "pacs_backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}"
EOF
chmod +x /opt/pacs/scripts/backup.sh
print_status "Backup script created"

# 11. Set up cron jobs
echo ""
echo "Step 11: Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/pacs/scripts/backup.sh >> /opt/pacs/logs/backup.log 2>&1") | crontab -
print_status "Cron jobs configured"

# 12. Create environment file template
echo ""
echo "Step 12: Creating environment file template..."
cp /opt/pacs/deployment/production/.env.example /opt/pacs/deployment/production/.env
print_warning "Please edit /opt/pacs/deployment/production/.env with your configuration"

# 13. Set proper permissions
echo ""
echo "Step 13: Setting permissions..."
chown -R root:docker /opt/pacs
chmod -R 750 /opt/pacs
chmod 600 /opt/pacs/keys/*
chmod 644 /opt/pacs/keys/signature-public.pem
print_status "Permissions set"

# Summary
echo ""
echo "=========================================="
echo "Production Environment Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /opt/pacs/deployment/production/.env with your configuration"
echo "2. Update domain names in docker-compose.prod.yml"
echo "3. Configure DNS records to point to this server"
echo "4. Run: cd /opt/pacs/deployment/production && docker-compose -f docker-compose.prod.yml up -d"
echo "5. Monitor logs: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Important files:"
echo "  - Configuration: /opt/pacs/deployment/production/.env"
echo "  - Keys: /opt/pacs/keys/"
echo "  - Logs: /opt/pacs/logs/"
echo "  - Backups: /opt/pacs/backups/"
echo ""
print_warning "Remember to replace self-signed SSL certificates with Let's Encrypt certificates!"
