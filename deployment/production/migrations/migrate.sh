#!/bin/bash

# Database Migration Script
# This script runs MongoDB migrations for the PACS system

set -e

echo "=========================================="
echo "PACS Database Migration"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/opt/pacs/logs/migration.log"
BACKUP_DIR="/opt/pacs/backups/migrations"

# Load environment variables
if [ -f "$MIGRATION_DIR/../.env" ]; then
    source "$MIGRATION_DIR/../.env"
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

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

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if MongoDB is running
log "Checking MongoDB connection..."
if ! docker exec pacs-mongodb-prod mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
    error "Cannot connect to MongoDB. Is the container running?"
fi
log "✓ MongoDB connection successful"

# Create backup before migration
log "Creating backup before migration..."
BACKUP_NAME="pre_migration_$(date +%Y%m%d_%H%M%S)"
docker exec pacs-mongodb-prod mongodump --out "/tmp/$BACKUP_NAME" || error "Backup failed"
docker cp "pacs-mongodb-prod:/tmp/$BACKUP_NAME" "$BACKUP_DIR/" || error "Failed to copy backup"
log "✓ Backup created: $BACKUP_DIR/$BACKUP_NAME"

# Get list of migration files
MIGRATIONS=($(ls -1 "$MIGRATION_DIR"/*.js 2>/dev/null | sort))

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
    warning "No migration files found"
    exit 0
fi

# Create migrations tracking collection
log "Initializing migration tracking..."
docker exec pacs-mongodb-prod mongosh pacs --eval "
    db.migrations.createIndex({ version: 1 }, { unique: true });
    print('Migration tracking initialized');
" || warning "Migration tracking already initialized"

# Run each migration
for migration_file in "${MIGRATIONS[@]}"; do
    migration_name=$(basename "$migration_file")
    migration_version="${migration_name%%_*}"
    
    # Check if migration already applied
    APPLIED=$(docker exec pacs-mongodb-prod mongosh pacs --quiet --eval "
        db.migrations.countDocuments({ version: '$migration_version' })
    ")
    
    if [ "$APPLIED" -gt 0 ]; then
        log "⊘ Migration $migration_name already applied, skipping..."
        continue
    fi
    
    log "Running migration: $migration_name"
    
    # Copy migration file to container
    docker cp "$migration_file" pacs-mongodb-prod:/tmp/migration.js
    
    # Run migration
    if docker exec pacs-mongodb-prod mongosh pacs < "$migration_file" >> "$LOG_FILE" 2>&1; then
        # Mark migration as applied
        docker exec pacs-mongodb-prod mongosh pacs --eval "
            db.migrations.insertOne({
                version: '$migration_version',
                name: '$migration_name',
                appliedAt: new Date(),
                status: 'completed'
            });
        " >> "$LOG_FILE" 2>&1
        
        log "✓ Migration $migration_name completed successfully"
    else
        error "Migration $migration_name failed. Check $LOG_FILE for details"
    fi
done

# Verify collections
log "Verifying collections..."
COLLECTIONS=$(docker exec pacs-mongodb-prod mongosh pacs --quiet --eval "
    db.getCollectionNames().join(', ')
")
log "Collections: $COLLECTIONS"

# Verify indexes
log "Verifying indexes..."
docker exec pacs-mongodb-prod mongosh pacs --eval "
    print('\\nIndexes per collection:');
    db.getCollectionNames().forEach(function(collection) {
        var indexes = db[collection].getIndexes();
        print('\\n' + collection + ': ' + indexes.length + ' indexes');
        indexes.forEach(function(index) {
            print('  - ' + JSON.stringify(index.key));
        });
    });
" >> "$LOG_FILE"

# Migration summary
echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Backup location: $BACKUP_DIR/$BACKUP_NAME"
echo "Migration log: $LOG_FILE"
echo ""
echo "Applied migrations:"
docker exec pacs-mongodb-prod mongosh pacs --quiet --eval "
    db.migrations.find().sort({ appliedAt: 1 }).forEach(function(m) {
        print('  ✓ ' + m.name + ' (applied: ' + m.appliedAt.toISOString() + ')');
    });
"
echo ""
log "All migrations completed successfully!"
