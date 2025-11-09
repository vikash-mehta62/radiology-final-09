/**
 * Encryption Service for HIPAA-compliant PHI encryption
 * Uses AES-256-GCM for encryption with authentication
 */

const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // Get encryption key from environment variable
    // In production, this should be stored in a secure key management service (AWS KMS, Azure Key Vault, etc.)
    this.encryptionKey = process.env.PHI_ENCRYPTION_KEY || this.generateKey();
    
    if (!process.env.PHI_ENCRYPTION_KEY) {
      console.warn('WARNING: PHI_ENCRYPTION_KEY not set. Using generated key. This is NOT secure for production!');
    }
    
    // Validate key length (must be 32 bytes for AES-256)
    if (Buffer.from(this.encryptionKey, 'hex').length !== 32) {
      throw new Error('PHI_ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
    }
  }

  /**
   * Generate a random 256-bit encryption key
   * @returns {string} Hex-encoded encryption key
   */
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt PHI data using AES-256-GCM
   * @param {string|object} data - Data to encrypt (will be stringified if object)
   * @returns {object} Encrypted data with IV and auth tag
   */
  encrypt(data) {
    try {
      // Convert data to string if it's an object
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Generate a random initialization vector (IV)
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: 'aes-256-gcm'
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt PHI data using AES-256-GCM
   * @param {object} encryptedData - Object containing encrypted data, IV, and auth tag
   * @returns {string|object} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
      );
      
      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, return as string if it fails
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt notification content containing PHI
   * @param {object} notification - Notification object
   * @returns {object} Notification with encrypted PHI fields
   */
  encryptNotification(notification) {
    const phiFields = ['message', 'patientId', 'findingDetails'];
    const encrypted = { ...notification };
    
    phiFields.forEach(field => {
      if (notification[field]) {
        encrypted[field] = this.encrypt(notification[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });
    
    return encrypted;
  }

  /**
   * Decrypt notification content containing PHI
   * @param {object} notification - Notification object with encrypted fields
   * @returns {object} Notification with decrypted PHI fields
   */
  decryptNotification(notification) {
    const phiFields = ['message', 'patientId', 'findingDetails'];
    const decrypted = { ...notification };
    
    phiFields.forEach(field => {
      if (notification[`${field}_encrypted`]) {
        decrypted[field] = this.decrypt(notification[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });
    
    return decrypted;
  }

  /**
   * Encrypt audit log entry
   * @param {object} auditLog - Audit log entry
   * @returns {object} Audit log with encrypted sensitive fields
   */
  encryptAuditLog(auditLog) {
    const sensitiveFields = ['details', 'metadata', 'ipAddress', 'userAgent'];
    const encrypted = { ...auditLog };
    
    sensitiveFields.forEach(field => {
      if (auditLog[field]) {
        encrypted[field] = this.encrypt(auditLog[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });
    
    return encrypted;
  }

  /**
   * Decrypt audit log entry
   * @param {object} auditLog - Audit log with encrypted fields
   * @returns {object} Audit log with decrypted fields
   */
  decryptAuditLog(auditLog) {
    const sensitiveFields = ['details', 'metadata', 'ipAddress', 'userAgent'];
    const decrypted = { ...auditLog };
    
    sensitiveFields.forEach(field => {
      if (auditLog[`${field}_encrypted`]) {
        decrypted[field] = this.decrypt(auditLog[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });
    
    return decrypted;
  }

  /**
   * Encrypt session data
   * @param {object} sessionData - Session data object
   * @returns {object} Session data with encrypted sensitive fields
   */
  encryptSessionData(sessionData) {
    const sensitiveFields = ['deviceInfo', 'metadata'];
    const encrypted = { ...sessionData };
    
    sensitiveFields.forEach(field => {
      if (sessionData[field]) {
        encrypted[field] = this.encrypt(sessionData[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });
    
    return encrypted;
  }

  /**
   * Decrypt session data
   * @param {object} sessionData - Session data with encrypted fields
   * @returns {object} Session data with decrypted fields
   */
  decryptSessionData(sessionData) {
    const sensitiveFields = ['deviceInfo', 'metadata'];
    const decrypted = { ...sessionData };
    
    sensitiveFields.forEach(field => {
      if (sessionData[`${field}_encrypted`]) {
        decrypted[field] = this.decrypt(sessionData[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });
    
    return decrypted;
  }

  /**
   * Hash data for integrity verification (one-way)
   * @param {string} data - Data to hash
   * @returns {string} SHA-256 hash
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using hash
   * @param {string} data - Original data
   * @param {string} hash - Hash to verify against
   * @returns {boolean} True if hash matches
   */
  verifyHash(data, hash) {
    return this.hash(data) === hash;
  }
}

// Export singleton instance
module.exports = new EncryptionService();
