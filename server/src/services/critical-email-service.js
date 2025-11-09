const nodemailer = require('nodemailer');

/**
 * Critical Email Service
 * Enhanced email service for critical medical notifications
 * Includes retry logic, delivery tracking, and specialized templates
 */
class CriticalEmailService {
  constructor(config = {}) {
    this.config = {
      smtpHost: config.smtpHost || process.env.SMTP_HOST,
      smtpPort: config.smtpPort || process.env.SMTP_PORT || 587,
      smtpSecure: config.smtpSecure || process.env.SMTP_SECURE === 'true',
      smtpUser: config.smtpUser || process.env.SMTP_USER,
      smtpPassword: config.smtpPassword || process.env.SMTP_PASSWORD,
      emailFrom: config.emailFrom || process.env.EMAIL_FROM || 'critical-alerts@medical-imaging.local',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // Initial delay in ms
      enabled: config.enabled !== false
    };

    this.transporter = null;
    this.deliveryLog = [];
    this.initialize();
  }

  /**
   * Initialize nodemailer transporter
   */
  initialize() {
    if (!this.config.smtpHost) {
      console.log('ℹ️  Critical email service disabled - SMTP_HOST not configured');
      console.log('ℹ️  Using fallback email logging');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: this.config.smtpUser ? {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword
        } : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100
      });

      console.log('✅ Critical email service initialized:', {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure
      });
    } catch (error) {
      console.error('❌ Failed to initialize critical email service:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Send critical notification email with retry logic
   * @param {Object} notification - Notification data
   * @param {String|Array} recipients - Email recipient(s)
   * @returns {Promise<Object>} Delivery result
   */
  async sendCriticalNotification(notification, recipients) {
    const recipientList = Array.isArray(recipients) ? recipients.join(', ') : recipients;
    
    const emailData = {
      from: this.config.emailFrom,
      to: recipientList,
      subject: this.generateSubject(notification),
      html: this.generateCriticalNotificationHTML(notification),
      text: this.generateCriticalNotificationText(notification),
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    return await this.sendWithRetry(emailData);
  }

  /**
   * Send email with exponential backoff retry logic
   * @param {Object} emailData - Email data
   * @param {Number} attempt - Current attempt number
   * @returns {Promise<Object>} Delivery result
   */
  async sendWithRetry(emailData, attempt = 1) {
    const deliveryRecord = {
      to: emailData.to,
      subject: emailData.subject,
      attempt,
      timestamp: new Date(),
      status: 'pending'
    };

    try {
      if (!this.transporter) {
        // Fallback: Log email instead of sending
        console.log('📧 [FALLBACK] Critical email would be sent:', {
          to: emailData.to,
          subject: emailData.subject,
          timestamp: new Date().toISOString()
        });

        deliveryRecord.status = 'logged';
        deliveryRecord.messageId = `fallback_${Date.now()}`;
        this.deliveryLog.push(deliveryRecord);

        return {
          success: true,
          messageId: deliveryRecord.messageId,
          status: 'logged',
          note: 'Email service not configured - logged instead'
        };
      }

      // Send email
      const info = await this.transporter.sendMail(emailData);

      deliveryRecord.status = 'sent';
      deliveryRecord.messageId = info.messageId;
      deliveryRecord.response = info.response;
      this.deliveryLog.push(deliveryRecord);

      console.log(`✅ Critical email sent (attempt ${attempt}):`, {
        messageId: info.messageId,
        to: emailData.to,
        subject: emailData.subject
      });

      return {
        success: true,
        messageId: info.messageId,
        status: 'sent',
        attempt
      };

    } catch (error) {
      deliveryRecord.status = 'failed';
      deliveryRecord.error = error.message;
      this.deliveryLog.push(deliveryRecord);

      console.error(`❌ Failed to send critical email (attempt ${attempt}):`, error.message);

      // Retry with exponential backoff
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return await this.sendWithRetry(emailData, attempt + 1);
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
   * Generate email subject for critical notification
   * @param {Object} notification - Notification data
   * @returns {String} Email subject
   */
  generateSubject(notification) {
    const severityEmoji = {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM'
    };

    const emoji = severityEmoji[notification.severity] || '⚠️';
    return `${emoji}: ${notification.title}`;
  }

  /**
   * Generate HTML email template for critical notification
   * @param {Object} notification - Notification data
   * @returns {String} HTML content
   */
  generateCriticalNotificationHTML(notification) {
    const severityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107'
    };

    const color = severityColors[notification.severity] || '#6c757d';
    const timestamp = new Date(notification.createdAt || Date.now()).toLocaleString();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  
  <!-- Critical Alert Banner -->
  <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
      ${notification.severity} Priority Alert
    </div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
      ${notification.title}
    </h1>
    <p style="margin: 10px 0 0 0; opacity: 0.95; font-size: 14px;">
      📅 ${timestamp}
    </p>
  </div>
  
  <!-- Main Content -->
  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Patient Information -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid ${color};">
      <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #495057;">Patient Information</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;"><strong>Patient ID:</strong></td>
          <td style="padding: 8px 0; font-size: 14px;">${notification.patientId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;"><strong>Study ID:</strong></td>
          <td style="padding: 8px 0; font-size: 14px;">${notification.studyId}</td>
        </tr>
      </table>
    </div>

    <!-- Finding Details -->
    ${notification.findingDetails ? `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #495057;">Finding Details</h2>
      <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107;">
        ${notification.findingDetails.location ? `
        <p style="margin: 0 0 10px 0; font-size: 14px;">
          <strong>Location:</strong> ${notification.findingDetails.location}
        </p>
        ` : ''}
        ${notification.findingDetails.description ? `
        <p style="margin: 0 0 10px 0; font-size: 14px;">
          <strong>Description:</strong> ${notification.findingDetails.description}
        </p>
        ` : ''}
        ${notification.findingDetails.urgency ? `
        <p style="margin: 0; font-size: 14px;">
          <strong>Urgency:</strong> ${notification.findingDetails.urgency}
        </p>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Message -->
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #495057;">Alert Message</h2>
      <p style="margin: 0; padding: 15px; background: #f8f9fa; border-radius: 6px; font-size: 14px; line-height: 1.6;">
        ${notification.message}
      </p>
    </div>

    <!-- Action Required -->
    <div style="background: #e7f3ff; padding: 20px; border-radius: 6px; border-left: 4px solid #0d6efd; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #0d6efd; text-transform: uppercase; letter-spacing: 0.5px;">
        ⚡ Action Required
      </h3>
      <p style="margin: 0; font-size: 14px; line-height: 1.6;">
        This critical finding requires immediate attention. Please review the study and acknowledge this notification as soon as possible.
      </p>
    </div>

    <!-- Call to Action Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/studies/${notification.studyId}" 
         style="display: inline-block; background: ${color}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        View Study & Acknowledge
      </a>
    </div>

    <!-- Escalation Notice -->
    <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-top: 20px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⏰ <strong>Note:</strong> If this notification is not acknowledged within 15 minutes, it will be escalated to the next level of the notification chain.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top: 20px; padding: 20px; background: #e9ecef; border-radius: 8px; text-align: center;">
    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6c757d;">
      This is an automated critical alert from your Medical Imaging System
    </p>
    <p style="margin: 0; font-size: 11px; color: #adb5bd;">
      Notification ID: ${notification.id || 'N/A'} | ${timestamp}
    </p>
    <p style="margin: 10px 0 0 0; font-size: 11px; color: #adb5bd;">
      This email contains confidential medical information. Handle with care.
    </p>
  </div>

</body>
</html>
    `;
  }

  /**
   * Generate plain text email for critical notification
   * @param {Object} notification - Notification data
   * @returns {String} Plain text content
   */
  generateCriticalNotificationText(notification) {
    const timestamp = new Date(notification.createdAt || Date.now()).toLocaleString();
    
    let text = `
${'='.repeat(70)}
CRITICAL MEDICAL ALERT
${'='.repeat(70)}

${notification.severity.toUpperCase()} PRIORITY: ${notification.title}

Timestamp: ${timestamp}

PATIENT INFORMATION
-------------------
Patient ID: ${notification.patientId}
Study ID: ${notification.studyId}

`;

    if (notification.findingDetails) {
      text += `
FINDING DETAILS
---------------
`;
      if (notification.findingDetails.location) {
        text += `Location: ${notification.findingDetails.location}\n`;
      }
      if (notification.findingDetails.description) {
        text += `Description: ${notification.findingDetails.description}\n`;
      }
      if (notification.findingDetails.urgency) {
        text += `Urgency: ${notification.findingDetails.urgency}\n`;
      }
      text += '\n';
    }

    text += `
ALERT MESSAGE
-------------
${notification.message}

ACTION REQUIRED
---------------
This critical finding requires immediate attention. Please review the study
and acknowledge this notification as soon as possible.

View Study: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/studies/${notification.studyId}

ESCALATION NOTICE
-----------------
If this notification is not acknowledged within 15 minutes, it will be
escalated to the next level of the notification chain.

${'='.repeat(70)}
This is an automated critical alert from your Medical Imaging System
Notification ID: ${notification.id || 'N/A'}
${timestamp}

CONFIDENTIAL: This email contains protected health information.
${'='.repeat(70)}
    `;

    return text;
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
      successRate: total > 0 ? ((sent + logged) / total * 100).toFixed(2) : 0
    };
  }

  /**
   * Test email configuration
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    if (!this.transporter) {
      return { 
        success: false, 
        error: 'Email service not configured',
        note: 'Using fallback logging mode'
      };
    }

    try {
      await this.transporter.verify();
      console.log('✅ Critical email service connection verified');
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      console.error('❌ Critical email service connection failed:', error.message);
      return { success: false, error: error.message };
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
let criticalEmailService = null;

/**
 * Get the singleton CriticalEmailService instance
 * @param {Object} config - Service configuration
 * @returns {CriticalEmailService} Service instance
 */
function getCriticalEmailService(config) {
  if (!criticalEmailService) {
    criticalEmailService = new CriticalEmailService(config);
  }
  return criticalEmailService;
}

module.exports = {
  CriticalEmailService,
  getCriticalEmailService
};
