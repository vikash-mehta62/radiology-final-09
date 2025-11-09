/**
 * SMS Service
 * Handles SMS notifications via Twilio or AWS SNS
 * Includes phone validation, retry logic, and delivery tracking
 */
class SMSService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || process.env.SMS_PROVIDER || 'twilio', // 'twilio' or 'aws-sns'
      
      // Twilio Configuration
      twilioAccountSid: config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: config.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER,
      
      // AWS SNS Configuration
      awsRegion: config.awsRegion || process.env.AWS_REGION || 'us-east-1',
      awsAccessKeyId: config.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 2000,
      enabled: config.enabled !== false
    };

    this.client = null;
    this.deliveryLog = [];
    this.initialize();
  }

  /**
   * Initialize SMS provider client
   */
  initialize() {
    if (!this.config.enabled) {
      console.log('ℹ️  SMS service disabled');
      return;
    }

    try {
      if (this.config.provider === 'twilio') {
        this.initializeTwilio();
      } else if (this.config.provider === 'aws-sns') {
        this.initializeAWSSNS();
      } else {
        console.warn('⚠️  Unknown SMS provider:', this.config.provider);
        console.log('ℹ️  Using fallback SMS logging');
      }
    } catch (error) {
      console.error('❌ Failed to initialize SMS service:', error.message);
      this.client = null;
    }
  }

  /**
   * Initialize Twilio client
   */
  initializeTwilio() {
    if (!this.config.twilioAccountSid || !this.config.twilioAuthToken) {
      console.log('ℹ️  Twilio SMS service disabled - credentials not configured');
      console.log('ℹ️  Using fallback SMS logging');
      return;
    }

    try {
      const twilio = require('twilio');
      this.client = twilio(this.config.twilioAccountSid, this.config.twilioAuthToken);
      
      console.log('✅ Twilio SMS service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio:', error.message);
      console.log('ℹ️  Install twilio package: npm install twilio');
      this.client = null;
    }
  }

  /**
   * Initialize AWS SNS client
   */
  initializeAWSSNS() {
    if (!this.config.awsAccessKeyId || !this.config.awsSecretAccessKey) {
      console.log('ℹ️  AWS SNS service disabled - credentials not configured');
      console.log('ℹ️  Using fallback SMS logging');
      return;
    }

    try {
      const AWS = require('aws-sdk');
      AWS.config.update({
        region: this.config.awsRegion,
        accessKeyId: this.config.awsAccessKeyId,
        secretAccessKey: this.config.awsSecretAccessKey
      });
      
      this.client = new AWS.SNS();
      console.log('✅ AWS SNS service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AWS SNS:', error.message);
      console.log('ℹ️  Install aws-sdk package: npm install aws-sdk');
      this.client = null;
    }
  }

  /**
   * Send SMS notification
   * @param {Object} notification - Notification data
   * @param {String|Array} phoneNumbers - Phone number(s)
   * @returns {Promise<Object>} Delivery result
   */
  async sendSMS(notification, phoneNumbers) {
    const numbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
    const results = [];

    for (const phoneNumber of numbers) {
      // Validate phone number
      const validatedNumber = this.validatePhoneNumber(phoneNumber);
      if (!validatedNumber.valid) {
        results.push({
          phoneNumber,
          success: false,
          error: validatedNumber.error
        });
        continue;
      }

      // Generate SMS message
      const message = this.generateSMSMessage(notification);

      // Send with retry
      const result = await this.sendWithRetry(validatedNumber.number, message);
      results.push({
        phoneNumber,
        ...result
      });
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Send SMS with retry logic
   * @param {String} phoneNumber - Phone number
   * @param {String} message - SMS message
   * @param {Number} attempt - Current attempt
   * @returns {Promise<Object>} Delivery result
   */
  async sendWithRetry(phoneNumber, message, attempt = 1) {
    const deliveryRecord = {
      phoneNumber,
      message: message.substring(0, 50) + '...',
      attempt,
      timestamp: new Date(),
      status: 'pending'
    };

    try {
      if (!this.client) {
        // Fallback: Log SMS instead of sending
        console.log('📱 [FALLBACK] SMS would be sent:', {
          to: phoneNumber,
          message: message.substring(0, 100) + '...',
          timestamp: new Date().toISOString()
        });

        deliveryRecord.status = 'logged';
        deliveryRecord.messageId = `fallback_${Date.now()}`;
        this.deliveryLog.push(deliveryRecord);

        return {
          success: true,
          messageId: deliveryRecord.messageId,
          status: 'logged',
          note: 'SMS service not configured - logged instead'
        };
      }

      let result;
      if (this.config.provider === 'twilio') {
        result = await this.sendViaTwilio(phoneNumber, message);
      } else if (this.config.provider === 'aws-sns') {
        result = await this.sendViaAWSSNS(phoneNumber, message);
      } else {
        throw new Error('No SMS provider configured');
      }

      deliveryRecord.status = 'sent';
      deliveryRecord.messageId = result.messageId;
      this.deliveryLog.push(deliveryRecord);

      console.log(`✅ SMS sent (attempt ${attempt}):`, {
        messageId: result.messageId,
        to: phoneNumber
      });

      return {
        success: true,
        messageId: result.messageId,
        status: 'sent',
        attempt
      };

    } catch (error) {
      deliveryRecord.status = 'failed';
      deliveryRecord.error = error.message;
      this.deliveryLog.push(deliveryRecord);

      console.error(`❌ Failed to send SMS (attempt ${attempt}):`, error.message);

      // Retry with exponential backoff
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return await this.sendWithRetry(phoneNumber, message, attempt + 1);
      }

      // Max retries reached
      return {
        success: false,
        error: error.message,
        attempts: attempt,
        status: 'failed'
      };
    }
  }

  /**
   * Send SMS via Twilio
   * @param {String} phoneNumber - Phone number
   * @param {String} message - SMS message
   * @returns {Promise<Object>} Twilio response
   */
  async sendViaTwilio(phoneNumber, message) {
    const result = await this.client.messages.create({
      body: message,
      from: this.config.twilioPhoneNumber,
      to: phoneNumber
    });

    return {
      messageId: result.sid,
      status: result.status
    };
  }

  /**
   * Send SMS via AWS SNS
   * @param {String} phoneNumber - Phone number
   * @param {String} message - SMS message
   * @returns {Promise<Object>} AWS SNS response
   */
  async sendViaAWSSNS(phoneNumber, message) {
    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional' // Use transactional for critical alerts
        }
      }
    };

    const result = await this.client.publish(params).promise();

    return {
      messageId: result.MessageId,
      status: 'sent'
    };
  }

  /**
   * Validate phone number
   * @param {String} phoneNumber - Phone number to validate
   * @returns {Object} Validation result
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return { valid: false, error: 'Phone number is required' };
    }

    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Check if it's a valid length (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
      return { 
        valid: false, 
        error: 'Phone number must be 10-15 digits' 
      };
    }

    // Format with country code if not present
    let formatted = cleaned;
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      formatted = '1' + cleaned; // Add US country code
    }

    // Add + prefix for international format
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }

    return {
      valid: true,
      number: formatted,
      original: phoneNumber
    };
  }

  /**
   * Generate SMS message from notification
   * @param {Object} notification - Notification data
   * @returns {String} SMS message (max 160 characters for single SMS)
   */
  generateSMSMessage(notification) {
    const severityPrefix = {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM'
    };

    const prefix = severityPrefix[notification.severity] || 'ALERT';
    
    // Keep message concise for SMS
    let message = `${prefix}: ${notification.title}\n\n`;
    message += `Patient: ${notification.patientId}\n`;
    message += `Study: ${notification.studyId}\n\n`;
    
    // Add truncated message if space allows
    const remainingSpace = 160 - message.length - 30; // Reserve space for URL
    if (remainingSpace > 20) {
      const truncatedMessage = notification.message.substring(0, remainingSpace);
      message += truncatedMessage;
      if (notification.message.length > remainingSpace) {
        message += '...';
      }
      message += '\n\n';
    }
    
    // Add action URL
    const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/studies/${notification.studyId}`;
    message += `View: ${url}`;

    return message;
  }

  /**
   * Generate SMS template for different notification types
   * @param {String} template - Template name
   * @param {Object} data - Template data
   * @returns {String} SMS message
   */
  generateTemplate(template, data) {
    const templates = {
      critical_finding: `🔴 CRITICAL: ${data.finding}\nPatient: ${data.patientId}\nAction required immediately.\nView: ${data.url}`,
      
      urgent_review: `🟠 URGENT: Review needed\nPatient: ${data.patientId}\nStudy: ${data.studyId}\nView: ${data.url}`,
      
      escalation: `⚠️ ESCALATED: ${data.title}\nOriginal alert not acknowledged.\nPatient: ${data.patientId}\nView: ${data.url}`,
      
      acknowledgment: `✅ Alert acknowledged by ${data.userName}\nPatient: ${data.patientId}\nTime: ${data.time}`
    };

    return templates[template] || `Alert: ${data.message}`;
  }

  /**
   * Get delivery log
   * @param {Number} limit - Maximum number of records
   * @returns {Array} Delivery log entries
   */
  getDeliveryLog(limit = 100) {
    return this.deliveryLog.slice(-limit);
  }

  /**
   * Get delivery statistics
   * @returns {Object} Statistics
   */
  getDeliveryStatistics() {
    const total = this.deliveryLog.length;
    const sent = this.deliveryLog.filter(d => d.status === 'sent').length;
    const failed = this.deliveryLog.filter(d => d.status === 'failed').length;
    const logged = this.deliveryLog.filter(d => d.status === 'logged').length;

    return {
      total,
      sent,
      failed,
      logged,
      successRate: total > 0 ? ((sent + logged) / total * 100).toFixed(2) : 0,
      provider: this.config.provider,
      enabled: this.config.enabled && !!this.client
    };
  }

  /**
   * Test SMS service
   * @param {String} phoneNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async testSMS(phoneNumber) {
    if (!this.client) {
      return {
        success: false,
        error: 'SMS service not configured',
        note: 'Using fallback logging mode'
      };
    }

    const testMessage = `Test SMS from Medical Imaging System\nTimestamp: ${new Date().toLocaleString()}\nThis is a test message.`;

    try {
      const result = await this.sendWithRetry(phoneNumber, testMessage);
      return {
        success: result.success,
        message: 'Test SMS sent successfully',
        messageId: result.messageId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {Number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear delivery log
   */
  clearDeliveryLog() {
    this.deliveryLog = [];
  }
}

// Singleton instance
let smsService = null;

/**
 * Get the singleton SMSService instance
 * @param {Object} config - Service configuration
 * @returns {SMSService} Service instance
 */
function getSMSService(config) {
  if (!smsService) {
    smsService = new SMSService(config);
  }
  return smsService;
}

module.exports = {
  SMSService,
  getSMSService
};
