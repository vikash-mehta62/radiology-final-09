const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const auditService = require('../services/audit-service');

/**
 * Multi-Factor Authentication Service
 * Implements TOTP and SMS-based MFA for sensitive operations
 * Requirements: 4.3
 */

class MFAService {
  constructor() {
    // SMS service configuration (Twilio or AWS SNS)
    this.smsEnabled = process.env.MFA_SMS_ENABLED === 'true';
    this.smsProvider = process.env.MFA_SMS_PROVIDER || 'twilio'; // 'twilio' or 'aws-sns'
    
    // TOTP configuration
    this.totpIssuer = process.env.MFA_TOTP_ISSUER || 'Medical Imaging System';
    this.totpWindow = parseInt(process.env.MFA_TOTP_WINDOW) || 2; // Allow 2 time steps before/after
    
    // Verification code storage (in production, use Redis)
    this.verificationCodes = new Map();
    
    // Code expiration time (5 minutes)
    this.codeExpirationMs = 5 * 60 * 1000;
  }

  /**
   * Setup TOTP for a user
   * Generates secret and QR code for authenticator app
   * @param {string} userId - User ID
   * @returns {Promise<object>} Secret and QR code data URL
   */
  async setupTOTP(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.totpIssuer} (${user.email})`,
        issuer: this.totpIssuer,
        length: 32
      });

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

      // Store secret temporarily (user must verify before it's saved)
      this.verificationCodes.set(`totp_setup_${userId}`, {
        secret: secret.base32,
        timestamp: Date.now()
      });

      // Clean up after 10 minutes
      setTimeout(() => {
        this.verificationCodes.delete(`totp_setup_${userId}`);
      }, 10 * 60 * 1000);

      console.log('🔐 TOTP setup initiated for user:', userId);

      return {
        secret: secret.base32,
        qrCode: qrCodeDataURL,
        manualEntryKey: secret.base32
      };
    } catch (error) {
      console.error('❌ Error setting up TOTP:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP setup
   * User must provide valid code to complete setup
   * @param {string} userId - User ID
   * @param {string} token - TOTP token from authenticator app
   * @returns {Promise<boolean>} True if setup completed successfully
   */
  async verifyTOTPSetup(userId, token) {
    try {
      const setupData = this.verificationCodes.get(`totp_setup_${userId}`);
      
      if (!setupData) {
        throw new Error('TOTP setup not found or expired. Please start setup again.');
      }

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: setupData.secret,
        encoding: 'base32',
        token,
        window: this.totpWindow
      });

      if (!verified) {
        throw new Error('Invalid verification code');
      }

      // Save secret to user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Encrypt secret before storing
      const encryptedSecret = this.encryptSecret(setupData.secret);

      user.mfaEnabled = true;
      user.mfaMethod = 'totp';
      user.mfaSecret = encryptedSecret;
      await user.save();

      // Clean up temporary data
      this.verificationCodes.delete(`totp_setup_${userId}`);

      // Log audit event
      await auditService.logSecurityEvent(
        'mfa_enabled',
        userId,
        'unknown',
        'success',
        'TOTP MFA enabled'
      );

      console.log('✅ TOTP setup completed for user:', userId);

      return true;
    } catch (error) {
      console.error('❌ Error verifying TOTP setup:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP token
   * @param {string} userId - User ID
   * @param {string} token - TOTP token
   * @returns {Promise<boolean>} True if token is valid
   */
  async verifyTOTP(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.mfaEnabled || user.mfaMethod !== 'totp') {
        throw new Error('TOTP MFA is not enabled for this user');
      }

      // Decrypt secret
      const secret = this.decryptSecret(user.mfaSecret);

      // Verify token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: this.totpWindow
      });

      // Log verification attempt
      await auditService.logSecurityEvent(
        'mfa_verification',
        userId,
        'unknown',
        verified ? 'success' : 'failure',
        `TOTP verification ${verified ? 'succeeded' : 'failed'}`
      );

      if (!verified) {
        console.log('❌ TOTP verification failed for user:', userId);
        throw new Error('Invalid verification code');
      }

      console.log('✅ TOTP verification successful for user:', userId);

      return true;
    } catch (error) {
      console.error('❌ Error verifying TOTP:', error);
      throw error;
    }
  }

  /**
   * Send SMS verification code
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<string>} Verification code ID
   */
  async sendSMSCode(userId, phoneNumber) {
    try {
      if (!this.smsEnabled) {
        throw new Error('SMS MFA is not enabled');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate 6-digit code
      const code = crypto.randomInt(100000, 999999).toString();

      // Store code with expiration
      const codeId = crypto.randomBytes(16).toString('hex');
      this.verificationCodes.set(codeId, {
        userId,
        code,
        phoneNumber,
        timestamp: Date.now(),
        attempts: 0
      });

      // Clean up after expiration
      setTimeout(() => {
        this.verificationCodes.delete(codeId);
      }, this.codeExpirationMs);

      // Send SMS (implementation depends on provider)
      await this.sendSMS(phoneNumber, `Your verification code is: ${code}. Valid for 5 minutes.`);

      // Log audit event
      await auditService.logSecurityEvent(
        'mfa_sms_sent',
        userId,
        'unknown',
        'success',
        `SMS verification code sent to ${phoneNumber.slice(-4)}`
      );

      console.log('📱 SMS verification code sent to user:', userId);

      return codeId;
    } catch (error) {
      console.error('❌ Error sending SMS code:', error);
      throw error;
    }
  }

  /**
   * Verify SMS code
   * @param {string} codeId - Code ID from sendSMSCode
   * @param {string} code - Verification code
   * @returns {Promise<boolean>} True if code is valid
   */
  async verifySMSCode(codeId, code) {
    try {
      const codeData = this.verificationCodes.get(codeId);

      if (!codeData) {
        throw new Error('Verification code not found or expired');
      }

      // Check expiration
      if (Date.now() - codeData.timestamp > this.codeExpirationMs) {
        this.verificationCodes.delete(codeId);
        throw new Error('Verification code has expired');
      }

      // Check attempts
      if (codeData.attempts >= 3) {
        this.verificationCodes.delete(codeId);
        throw new Error('Too many failed attempts. Please request a new code.');
      }

      // Verify code
      if (codeData.code !== code) {
        codeData.attempts++;
        
        // Log failed attempt
        await auditService.logSecurityEvent(
          'mfa_sms_verification',
          codeData.userId,
          'unknown',
          'failure',
          'SMS verification failed'
        );

        throw new Error('Invalid verification code');
      }

      // Clean up
      this.verificationCodes.delete(codeId);

      // Log successful verification
      await auditService.logSecurityEvent(
        'mfa_sms_verification',
        codeData.userId,
        'unknown',
        'success',
        'SMS verification succeeded'
      );

      console.log('✅ SMS verification successful for user:', codeData.userId);

      return true;
    } catch (error) {
      console.error('❌ Error verifying SMS code:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for a user
   * @param {string} userId - User ID
   * @param {string} password - User password for confirmation
   * @returns {Promise<boolean>} True if MFA disabled successfully
   */
  async disableMFA(userId, password) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Disable MFA
      user.mfaEnabled = false;
      user.mfaMethod = undefined;
      user.mfaSecret = undefined;
      await user.save();

      // Log audit event
      await auditService.logSecurityEvent(
        'mfa_disabled',
        userId,
        'unknown',
        'success',
        'MFA disabled'
      );

      console.log('🔓 MFA disabled for user:', userId);

      return true;
    } catch (error) {
      console.error('❌ Error disabling MFA:', error);
      throw error;
    }
  }

  /**
   * Check if user has MFA enabled
   * @param {string} userId - User ID
   * @returns {Promise<object>} MFA status
   */
  async getMFAStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        enabled: user.mfaEnabled || false,
        method: user.mfaMethod || null
      };
    } catch (error) {
      console.error('❌ Error getting MFA status:', error);
      throw error;
    }
  }

  /**
   * Encrypt MFA secret
   * @param {string} secret - Secret to encrypt
   * @returns {string} Encrypted secret
   * @private
   */
  encryptSecret(secret) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY || 'default_key_change_in_production_32b', 'utf8');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt MFA secret
   * @param {string} encryptedSecret - Encrypted secret
   * @returns {string} Decrypted secret
   * @private
   */
  decryptSecret(encryptedSecret) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY || 'default_key_change_in_production_32b', 'utf8');
    
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Send SMS (implementation depends on provider)
   * @param {string} phoneNumber - Phone number
   * @param {string} message - Message to send
   * @returns {Promise<void>}
   * @private
   */
  async sendSMS(phoneNumber, message) {
    // TODO: Implement actual SMS sending based on provider
    // For now, just log (in production, integrate with Twilio or AWS SNS)
    console.log(`📱 SMS to ${phoneNumber}: ${message}`);
    
    // Example Twilio implementation:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber
    // });
  }
}

// Export singleton instance
module.exports = new MFAService();
