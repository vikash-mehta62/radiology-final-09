// MongoDB Migration: Create Collections and Indexes
// Run with: mongosh < 001_create_collections.js

db = db.getSiblingDB('pacs');

print('========================================');
print('Migration 001: Create Collections and Indexes');
print('========================================');

// 1. Create Critical Notifications Collection
print('\n1. Creating criticalnotifications collection...');
if (!db.getCollectionNames().includes('criticalnotifications')) {
    db.createCollection('criticalnotifications', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['type', 'severity', 'title', 'message', 'patientId', 'studyId', 'recipients', 'channels', 'status', 'createdAt'],
                properties: {
                    type: {
                        bsonType: 'string',
                        enum: ['critical_finding', 'urgent_review', 'system_alert']
                    },
                    severity: {
                        bsonType: 'string',
                        enum: ['critical', 'high', 'medium']
                    },
                    title: { bsonType: 'string' },
                    message: { bsonType: 'string' },
                    patientId: { bsonType: 'string' },
                    studyId: { bsonType: 'string' },
                    recipients: { bsonType: 'array' },
                    channels: { bsonType: 'array' },
                    status: {
                        bsonType: 'string',
                        enum: ['pending', 'delivered', 'acknowledged', 'escalated', 'failed']
                    },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });
    print('✓ criticalnotifications collection created');
} else {
    print('✓ criticalnotifications collection already exists');
}

// Create indexes for criticalnotifications
print('Creating indexes for criticalnotifications...');
db.criticalnotifications.createIndex({ patientId: 1, createdAt: -1 });
db.criticalnotifications.createIndex({ status: 1, createdAt: -1 });
db.criticalnotifications.createIndex({ 'recipients.userId': 1 });
db.criticalnotifications.createIndex({ severity: 1, status: 1 });
db.criticalnotifications.createIndex({ createdAt: -1 });
print('✓ Indexes created for criticalnotifications');

// 2. Create Digital Signatures Collection
print('\n2. Creating digitalsignatures collection...');
if (!db.getCollectionNames().includes('digitalsignatures')) {
    db.createCollection('digitalsignatures', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['reportId', 'signerId', 'signerName', 'signatureHash', 'algorithm', 'timestamp', 'meaning', 'status'],
                properties: {
                    reportId: { bsonType: 'string' },
                    signerId: { bsonType: 'string' },
                    signerName: { bsonType: 'string' },
                    signatureHash: { bsonType: 'string' },
                    algorithm: {
                        bsonType: 'string',
                        enum: ['RSA-SHA256']
                    },
                    timestamp: { bsonType: 'date' },
                    meaning: {
                        bsonType: 'string',
                        enum: ['author', 'reviewer', 'approver']
                    },
                    status: {
                        bsonType: 'string',
                        enum: ['valid', 'invalid', 'revoked']
                    }
                }
            }
        }
    });
    print('✓ digitalsignatures collection created');
} else {
    print('✓ digitalsignatures collection already exists');
}

// Create indexes for digitalsignatures
print('Creating indexes for digitalsignatures...');
db.digitalsignatures.createIndex({ reportId: 1 });
db.digitalsignatures.createIndex({ signerId: 1, timestamp: -1 });
db.digitalsignatures.createIndex({ status: 1 });
db.digitalsignatures.createIndex({ timestamp: -1 });
print('✓ Indexes created for digitalsignatures');

// 3. Create Export Sessions Collection
print('\n3. Creating exportsessions collection...');
if (!db.getCollectionNames().includes('exportsessions')) {
    db.createCollection('exportsessions', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['reportId', 'userId', 'format', 'status', 'createdAt'],
                properties: {
                    reportId: { bsonType: 'string' },
                    userId: { bsonType: 'string' },
                    format: {
                        bsonType: 'string',
                        enum: ['dicom-sr', 'fhir', 'pdf']
                    },
                    status: {
                        bsonType: 'string',
                        enum: ['initiated', 'processing', 'completed', 'failed']
                    },
                    progress: { bsonType: 'int' },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });
    print('✓ exportsessions collection created');
} else {
    print('✓ exportsessions collection already exists');
}

// Create indexes for exportsessions
print('Creating indexes for exportsessions...');
db.exportsessions.createIndex({ reportId: 1, createdAt: -1 });
db.exportsessions.createIndex({ userId: 1, format: 1 });
db.exportsessions.createIndex({ status: 1 });
db.exportsessions.createIndex({ createdAt: -1 });
print('✓ Indexes created for exportsessions');

// 4. Create Sessions Collection
print('\n4. Creating sessions collection...');
if (!db.getCollectionNames().includes('sessions')) {
    db.createCollection('sessions', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'accessToken', 'refreshToken', 'deviceInfo', 'createdAt', 'expiresAt', 'status'],
                properties: {
                    userId: { bsonType: 'string' },
                    accessToken: { bsonType: 'string' },
                    refreshToken: { bsonType: 'string' },
                    deviceInfo: { bsonType: 'object' },
                    createdAt: { bsonType: 'date' },
                    lastActivity: { bsonType: 'date' },
                    expiresAt: { bsonType: 'date' },
                    status: {
                        bsonType: 'string',
                        enum: ['active', 'expired', 'revoked']
                    }
                }
            }
        }
    });
    print('✓ sessions collection created');
} else {
    print('✓ sessions collection already exists');
}

// Create indexes for sessions
print('Creating indexes for sessions...');
db.sessions.createIndex({ userId: 1, status: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.sessions.createIndex({ 'deviceInfo.deviceId': 1 });
db.sessions.createIndex({ accessToken: 1 });
db.sessions.createIndex({ refreshToken: 1 });
print('✓ Indexes created for sessions');

// 5. Create Audit Logs Collection
print('\n5. Creating auditlogs collection...');
if (!db.getCollectionNames().includes('auditlogs')) {
    db.createCollection('auditlogs', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['action', 'userId', 'timestamp', 'resourceType', 'resourceId'],
                properties: {
                    action: { bsonType: 'string' },
                    userId: { bsonType: 'string' },
                    timestamp: { bsonType: 'date' },
                    resourceType: { bsonType: 'string' },
                    resourceId: { bsonType: 'string' },
                    ipAddress: { bsonType: 'string' },
                    userAgent: { bsonType: 'string' }
                }
            }
        }
    });
    print('✓ auditlogs collection created');
} else {
    print('✓ auditlogs collection already exists');
}

// Create indexes for auditlogs
print('Creating indexes for auditlogs...');
db.auditlogs.createIndex({ userId: 1, timestamp: -1 });
db.auditlogs.createIndex({ resourceType: 1, resourceId: 1 });
db.auditlogs.createIndex({ action: 1, timestamp: -1 });
db.auditlogs.createIndex({ timestamp: -1 });
print('✓ Indexes created for auditlogs');

// 6. Update existing collections with new indexes
print('\n6. Updating existing collections...');

// Add indexes to reports collection if it exists
if (db.getCollectionNames().includes('reports')) {
    print('Adding indexes to reports collection...');
    db.reports.createIndex({ status: 1, createdAt: -1 });
    db.reports.createIndex({ patientId: 1, studyId: 1 });
    db.reports.createIndex({ authorId: 1, createdAt: -1 });
    print('✓ Indexes added to reports collection');
}

// Add indexes to users collection if it exists
if (db.getCollectionNames().includes('users')) {
    print('Adding indexes to users collection...');
    db.users.createIndex({ email: 1 }, { unique: true });
    db.users.createIndex({ role: 1 });
    db.users.createIndex({ status: 1 });
    print('✓ Indexes added to users collection');
}

// Migration complete
print('\n========================================');
print('Migration 001 completed successfully!');
print('========================================');
print('\nCollections created:');
print('  - criticalnotifications');
print('  - digitalsignatures');
print('  - exportsessions');
print('  - sessions');
print('  - auditlogs');
print('\nIndexes created for all collections');
