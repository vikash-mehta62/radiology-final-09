const nodemailer = require('nodemailer');

/**
 * EmailService - Production-ready email notification service
 * Handles SMTP email delivery with HTML templates
 */
class EmailService {
  constructor(config = {}) {
    this.config = {
      smtpHost: config.smtpHost || process.env.SMTP_HOST,
      smtpPort: config.smtpPort || process.env.SMTP_PORT || 587,
      smtpSecure: config.smtpSecure || process.env.SMTP_SECURE === 'true',
      smtpUser: config.smtpUser || process.env.SMTP_USER,
      smtpPassword: config.smtpPassword || process.env.SMTP_PASSWORD,
      emailFrom: config.emailFrom || process.env.EMAIL_FROM || 'noreply@medical-imaging.local',
      emailTo: config.emailTo || process.env.EMAIL_TO || 'admin@medical-imaging.local',
      enabled: config.enabled !== false
    };

    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize nodemailer transporter
   */
  initialize() {
    if (!this.config.smtpHost) {
      console.log('ℹ️  Email service disabled - SMTP_HOST not configured');
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
        }
      });

      console.log('✅ Email service initialized:', {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: !!this.config.smtpUser
      });
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Send alert email
   */
  async sendAlert(alert, recipients = null) {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const to = recipients || this.config.emailTo;
      const severityEmoji = {
        critical: '🔴',
        high: '🟠',
        warning: '🟡',
        medium: '🟡',
        info: '🔵',
        low: '⚪'
      };

      const emoji = severityEmoji[alert.severity] || '⚠️';
      const subject = `${emoji} ${alert.severity.toUpperCase()}: ${alert.summary}`;

      const info = await this.transporter.sendMail({
        from: this.config.emailFrom,
        to: to,
        subject: subject,
        html: this.generateAlertHTML(alert),
        text: this.generateAlertText(alert)
      });

      console.log('✅ Alert email sent:', {
        messageId: info.messageId,
        to: to,
        subject: subject
      });

      return { success: true, messageId: info.messageId, to: to };
    } catch (error) {
      console.error('❌ Failed to send alert email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, resetToken, resetUrl) {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; border-top: none;">
    <p>You requested a password reset for your Medical Imaging System account.</p>
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #1976d2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6c757d;">
      Or copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #1976d2; word-break: break-all;">${resetUrl}</a>
    </p>
    
    <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
      This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
    </p>
  </div>
</body>
</html>
      `;

      const info = await this.transporter.sendMail({
        from: this.config.emailFrom,
        to: email,
        subject: 'Password Reset Request - Medical Imaging System',
        html: html,
        text: `Password Reset Request\n\nYou requested a password reset. Click this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.`
      });

      console.log('✅ Password reset email sent:', { messageId: info.messageId, to: email });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send report delivery email
   */
  async sendReport(email, reportData, pdfBuffer = null) {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: this.config.emailFrom,
        to: email,
        subject: `Medical Report - ${reportData.patientName || 'Patient'}`,
        html: this.generateReportHTML(reportData),
        text: `Medical Report for ${reportData.patientName}\n\nStudy: ${reportData.studyDescription}\nDate: ${reportData.studyDate}`
      };

      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `report_${reportData.studyInstanceUID}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }];
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Report email sent:', { messageId: info.messageId, to: email });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send report email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate HTML for alert emails
   */
  generateAlertHTML(alert) {
    const severityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      warning: '#ffc107',
      medium: '#ffc107',
      info: '#0dcaf0',
      low: '#6c757d'
    };

    const color = severityColors[alert.severity] || '#6c757d';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${alert.summary}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">${alert.summary}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">
      ${new Date(alert.timestamp).toLocaleString()}
    </p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Severity:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">
          <span style="background: ${color}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px;">
            ${alert.severity}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Service:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">${alert.service}</td>
      </tr>
      ${alert.component ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Component:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">${alert.component}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 10px 0;" colspan="2">
          <strong>Description:</strong>
          <p style="margin: 10px 0 0 0; padding: 15px; background: white; border-left: 4px solid ${color}; border-radius: 4px;">
            ${alert.description}
          </p>
        </td>
      </tr>
      ${alert.runbookUrl ? `
      <tr>
        <td style="padding: 10px 0;" colspan="2">
          <a href="${alert.runbookUrl}" style="display: inline-block; background: #0d6efd; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
            📖 View Runbook
          </a>
        </td>
      </tr>
      ` : ''}
    </table>
  </div>
  
  <div style="margin-top: 20px; padding: 20px; background: #e9ecef; border-radius: 8px; font-size: 12px; color: #6c757d;">
    <p style="margin: 0;">This is an automated alert from your Medical Imaging System.</p>
    <p style="margin: 10px 0 0 0;">Alert ID: ${alert.alertId || 'N/A'} | ${alert.timestamp}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text for alert emails
   */
  generateAlertText(alert) {
    return `
ALERT: ${alert.summary}
${'='.repeat(60)}

Severity: ${alert.severity.toUpperCase()}
Service: ${alert.service}
${alert.component ? `Component: ${alert.component}` : ''}
Timestamp: ${new Date(alert.timestamp).toLocaleString()}

Description:
${alert.description}

${alert.runbookUrl ? `Runbook: ${alert.runbookUrl}\n` : ''}
${'='.repeat(60)}
This is an automated alert from your Medical Imaging System.
    `;
  }

  /**
   * Generate HTML for report emails
   */
  generateReportHTML(reportData) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Medical Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Medical Imaging Report</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Patient:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">${reportData.patientName || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Study:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">${reportData.studyDescription || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;"><strong>Date:</strong></td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6;">${reportData.studyDate || 'N/A'}</td>
      </tr>
    </table>
    
    <p style="margin-top: 20px;">Your medical imaging report is attached to this email as a PDF document.</p>
    
    <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
      <strong>Note:</strong> This report contains confidential medical information. Please handle with care.
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
let emailService = null;

function getEmailService(config = {}) {
  if (!emailService) {
    emailService = new EmailService(config);
  }
  return emailService;
}

module.exports = { EmailService, getEmailService };
