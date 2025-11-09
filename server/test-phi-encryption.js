/**
 * Test script for PHI encryption service
 * Run with: node test-phi-encryption.js
 */

const encryptionService = require('./src/services/encryption-service');

console.log('=== PHI Encryption Service Test ===\n');

// Test 1: Basic string encryption/decryption
console.log('Test 1: Basic String Encryption');
const testString = 'Patient John Doe, MRN: 12345';
console.log('Original:', testString);

const encrypted = encryptionService.encrypt(testString);
console.log('Encrypted:', JSON.stringify(encrypted, null, 2));

const decrypted = encryptionService.decrypt(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', testString === decrypted ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 2: Object encryption/decryption
console.log('Test 2: Object Encryption');
const testObject = {
  patientName: 'Jane Smith',
  mrn: '67890',
  diagnosis: 'Pneumonia',
  findings: ['Consolidation in right lower lobe', 'Pleural effusion']
};
console.log('Original:', JSON.stringify(testObject, null, 2));

const encryptedObj = encryptionService.encrypt(testObject);
console.log('Encrypted:', JSON.stringify(encryptedObj, null, 2));

const decryptedObj = encryptionService.decrypt(encryptedObj);
console.log('Decrypted:', JSON.stringify(decryptedObj, null, 2));
console.log('Match:', JSON.stringify(testObject) === JSON.stringify(decryptedObj) ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 3: Notification encryption
console.log('Test 3: Notification Encryption');
const notification = {
  id: 'notif-123',
  type: 'critical_finding',
  severity: 'critical',
  title: 'Critical Finding Alert',
  message: 'Patient John Doe (MRN: 12345) has a critical finding requiring immediate attention',
  patientId: 'patient-12345',
  studyId: 'study-67890',
  findingDetails: {
    location: 'Right lung',
    description: 'Large pneumothorax',
    urgency: 'immediate'
  },
  status: 'pending',
  createdAt: new Date()
};

console.log('Original notification (PHI fields):');
console.log('- message:', notification.message);
console.log('- patientId:', notification.patientId);
console.log('- findingDetails:', JSON.stringify(notification.findingDetails));

const encryptedNotif = encryptionService.encryptNotification(notification);
console.log('\nEncrypted notification (PHI fields):');
console.log('- message:', JSON.stringify(encryptedNotif.message));
console.log('- patientId:', JSON.stringify(encryptedNotif.patientId));
console.log('- findingDetails:', JSON.stringify(encryptedNotif.findingDetails));

const decryptedNotif = encryptionService.decryptNotification(encryptedNotif);
console.log('\nDecrypted notification (PHI fields):');
console.log('- message:', decryptedNotif.message);
console.log('- patientId:', decryptedNotif.patientId);
console.log('- findingDetails:', JSON.stringify(decryptedNotif.findingDetails));

const notifMatch = 
  notification.message === decryptedNotif.message &&
  notification.patientId === decryptedNotif.patientId &&
  JSON.stringify(notification.findingDetails) === JSON.stringify(decryptedNotif.findingDetails);
console.log('\nMatch:', notifMatch ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 4: Audit log encryption
console.log('Test 4: Audit Log Encryption');
const auditLog = {
  action: 'report_signed',
  userId: 'user-123',
  timestamp: new Date(),
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  details: 'Report signed by Dr. Smith for patient MRN 12345',
  metadata: {
    reportId: 'report-456',
    signatureId: 'sig-789'
  }
};

console.log('Original audit log (sensitive fields):');
console.log('- ipAddress:', auditLog.ipAddress);
console.log('- details:', auditLog.details);

const encryptedAudit = encryptionService.encryptAuditLog(auditLog);
console.log('\nEncrypted audit log (sensitive fields):');
console.log('- ipAddress:', JSON.stringify(encryptedAudit.ipAddress));
console.log('- details:', JSON.stringify(encryptedAudit.details));

const decryptedAudit = encryptionService.decryptAuditLog(encryptedAudit);
console.log('\nDecrypted audit log (sensitive fields):');
console.log('- ipAddress:', decryptedAudit.ipAddress);
console.log('- details:', decryptedAudit.details);

const auditMatch = 
  auditLog.ipAddress === decryptedAudit.ipAddress &&
  auditLog.details === decryptedAudit.details;
console.log('\nMatch:', auditMatch ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 5: Session data encryption
console.log('Test 5: Session Data Encryption');
const sessionData = {
  id: 'session-123',
  userId: 'user-456',
  accessToken: 'token-abc',
  deviceInfo: {
    userAgent: 'Mozilla/5.0...',
    ipAddress: '192.168.1.100',
    deviceId: 'device-xyz',
    location: 'New York, USA'
  },
  metadata: {
    loginTime: new Date(),
    lastActivity: new Date()
  }
};

console.log('Original session (sensitive fields):');
console.log('- deviceInfo:', JSON.stringify(sessionData.deviceInfo));

const encryptedSession = encryptionService.encryptSessionData(sessionData);
console.log('\nEncrypted session (sensitive fields):');
console.log('- deviceInfo:', JSON.stringify(encryptedSession.deviceInfo));

const decryptedSession = encryptionService.decryptSessionData(encryptedSession);
console.log('\nDecrypted session (sensitive fields):');
console.log('- deviceInfo:', JSON.stringify(decryptedSession.deviceInfo));

const sessionMatch = JSON.stringify(sessionData.deviceInfo) === JSON.stringify(decryptedSession.deviceInfo);
console.log('\nMatch:', sessionMatch ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 6: Hash verification
console.log('Test 6: Hash Verification');
const dataToHash = 'Sensitive patient data';
const hash1 = encryptionService.hash(dataToHash);
const hash2 = encryptionService.hash(dataToHash);
const hash3 = encryptionService.hash('Different data');

console.log('Data:', dataToHash);
console.log('Hash 1:', hash1);
console.log('Hash 2:', hash2);
console.log('Hash 3 (different data):', hash3);
console.log('Hash 1 === Hash 2:', hash1 === hash2 ? '✓ PASS' : '✗ FAIL');
console.log('Hash 1 !== Hash 3:', hash1 !== hash3 ? '✓ PASS' : '✗ FAIL');
console.log('Verify Hash 1:', encryptionService.verifyHash(dataToHash, hash1) ? '✓ PASS' : '✗ FAIL');
console.log();

console.log('=== All Tests Complete ===');
