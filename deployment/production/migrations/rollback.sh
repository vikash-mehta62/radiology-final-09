#!/bin/bash

# Database Rollback Script
# This script rolls back the database to a previous backup

set -e

echo "=========================================="
echo "PACS Database Rollback"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/opt/pacs/backups/migrations"
LOG_FILE="/opt/pacs/logs/rollback.log"

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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if MongoDB is running
log "Checking MongoDB connection..."
if ! docker exec pacs-mongodb-prod mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
    error "Cannot connect to MongoDB. Is the container running?"
fi
log "✓ MongoDB connection successful"

# List available backups
echo ""
echo "Available backups:"
echo "=========================================="
BACKUPS=($(ls -1t "$BACKUP_DIR" 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    error "No backups found in $BACKUP_DIR"
fi

# Display backups with numbers
for i in "${!BACKUPS[@]}"; do
    backup="${BACKUPS[$i]}"
    size=$(du -sh "$BACKUP_DIR/$backup" | cut -f1)
    echo "$((i+1)). $backup (Size: $size)"
done

echo "=========================================="
echo ""

# Prompt for backup selection
read -p "Enter the number of the backup to restore (or 'q' to quit): " selection

if [ "$selection" = "q" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Validate selection
if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#BACKUPS[@]} ]; then
    error "Invalid selection"
fi

SELECTED_BACKUP="${BACKUPS[$((selection-1))]}"
BACKUP_PATH="$BACKUP_DIR/$SELECTED_BACKUP"

echo ""
warning "You are about to restore the database from: $SELECTED_BACKUP"
warning "This will OVERWRITE the current database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Create a backup of current state before rollback
log "Creating backup of current state..."
CURRENT_BACKUP="pre_rollback_$(date +%Y%m%d_%H%M%S)"
docker exec pacs-mongodb-prod mongodump --out "/tmp/$CURRENT_BACKUP" || error "Current state backup failed"
docker cp "pacs-mongodb-prod:/tmp/$CURRENT_BACKUP" "$BACKUP_DIR/" || error "Failed to copy current state backup"
log "✓ Current state backed up: $BACKUP_DIR/$CURRENT_BACKUP"

# Stop backend service to prevent writes during rollback
log "Stopping backend service..."
docker-compose -f /opt/pacs/deployment/production/docker-compose.prod.yml stop backend || warning "Failed to stop backend"

# Copy backup to container
log "Copying backup to MongoDB container..."
docker cp "$BACKUP_PATH" pacs-mongodb-prod:/tmp/restore_backup || error "Failed to copy backup to container"

# Drop existing database
log "Dropping existing database..."
docker exec pacs-mongodb-prod mongosh pacs --eval "db.dropDatabase()" || error "Failed to drop database"

# Restore from backup
log "Restoring database from backup..."
docker exec pacs-mongodb-prod mongorestore --drop "/tmp/restore_backup" || error "Database restore failed"

# Verify restoration
log "Verifying restoration..."
COLLECTIONS=$(docker exec pacs-mongodb-prod mongosh pacs --quiet --eval "
    db.getCollectionNames().length
")

if [ "$COLLECTIONS" -gt 0 ]; then
    log "✓ Database restored successfully ($COLLECTIONS collections)"
else
    error "Database restoration verification failed"
fi

# Restart backend service
log "Restarting backend service..."
docker-compose -f /opt/pacs/deployment/production/docker-compose.prod.yml start backend || error "Failed to restart backend"

# Wait for backend to be healthy
log "Waiting for backend to be healthy..."
sleep 5
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    log "✓ Backend is healthy"
else
    warning "Backend health check returned HTTP $BACKEND_HEALTH"
fi

# Rollback summary
echo ""
echo "=========================================="
echo "Rollback Complete!"
echo "=========================================="
echo ""
echo "Restored from: $SELECTED_BACKUP"
echo "Current state backup: $BACKUP_DIR/$CURRENT_BACKUP"
echo "Rollback log: $LOG_FILE"
echo ""
echo "Collections in database:"
docker exec pacs-mongodb-prod mongosh pacs --quiet --eval "
    db.getCollectionNames().forEach(function(c) {
        var count = db[c].countDocuments();
        print('  - ' + c + ': ' + count + ' documents');
    });
"
echo ""
log "Rollback completed successfully!"
