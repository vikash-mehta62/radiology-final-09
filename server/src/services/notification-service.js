const axios = require('axios');
const { getEmailService } = require('./email-service');

/**
 * NotificationService - Handles alert notifications to various channels
 * Integrates with Slack, PagerDuty, and other notification systems
 */
class NotificationService {
  constructor(config = {}) {
    this.config = {
      slackWebhookUrl: config.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL,
      pagerDutyIntegrationKey: config.pagerDutyIntegrationKey || process.env.PAGERDUTY_INTEGRATION_KEY,
      emailSmtpHost: config.emailSmtpHost || process.env.SMTP_HOST,
      emailSmtpPort: config.emailSmtpPort || process.env.SMTP_PORT || 587,
      emailFrom: config.emailFrom || process.env.EMAIL_FROM || 'alerts@orthanc-bridge.local',
      enabled: config.enabled !== false, // Default to enabled
      ...config
    };

    this.alertHistory = [];
    this.maxHistorySize = 1000;
    this.emailService = getEmailService(config);
  }

  /**
   * Send alert notification to all configured channels
   */
  async sendAlert(alert) {
    if (!this.config.enabled) {
      console.log('Notifications disabled, skipping alert:', alert.summary);
      return;
    }

    // Store in history
    this.storeAlert(alert);

    const promises = [];

    // Send to Slack if configured
    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackNotification(alert));
    }

    // Send to PagerDuty if configured and critical
    if (this.config.pagerDutyIntegrationKey && alert.severity === 'critical') {
      promises.push(this.sendPagerDutyAlert(alert));
    }

    // Send email if configured
    if (this.emailService && this.emailService.transporter) {
      promises.push(this.emailService.sendAlert(alert));
    }

    // Wait for all notifications to complete
    const results = await Promise.allSettled(promises);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      }
    });

    return results;
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(alert) {
    try {
      const color = this.getSeverityColor(alert.severity);
      const channel = alert.severity === 'critical' ? '#orthanc-alerts' : '#orthanc-monitoring';
      
      const payload = {
        channel: channel,
        username: 'Orthanc Bridge Monitor',
        icon_emoji: ':warning:',
        attachments: [{
          color: color,
          title: `${alert.severity.toUpperCase()}: ${alert.summary}`,
          text: alert.description,
          fields: [
            {
              title: 'Service',
              value: alert.service || 'orthanc-bridge',
              short: true
            },
            {
              title: 'Instance',
              value: alert.instance || 'unknown',
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toLocaleString(),
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            }
          ],
          footer: 'Orthanc Bridge Monitoring',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }]
      };

      if (alert.runbookUrl) {
        payload.attachments[0].actions = [{
          type: 'button',
          text: 'View Runbook',
          url: alert.runbookUrl
        }];
      }

      const response = await axios.post(this.config.slackWebhookUrl, payload, {
        timeout: 10000
      });

      console.log('Slack notification sent successfully');
      return { success: true, channel: 'slack', response: response.status };
      
    } catch (error) {
      console.error('Failed to send Slack notification:', error.message);
      throw new Error(`Slack notification failed: ${error.message}`);
    }
  }

  /**
   * Send PagerDuty alert
   */
  async sendPagerDutyAlert(alert) {
    try {
      const payload = {
        routing_key: this.config.pagerDutyIntegrationKey,
        event_action: 'trigger',
        dedup_key: `orthanc-bridge-${alert.alertName}-${alert.instance}`,
        payload: {
          summary: alert.summary,
          source: alert.instance || 'orthanc-bridge',
          severity: alert.severity,
          component: 'orthanc-bridge',
          group: 'medical-imaging',
          class: 'infrastructure',
          custom_details: {
            description: alert.description,
            service: alert.service,
            timestamp: alert.timestamp,
            runbook_url: alert.runbookUrl
          }
        }
      };

      const response = await axios.post('https://events.pagerduty.com/v2/enqueue', payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('PagerDuty alert sent successfully');
      return { success: true, channel: 'pagerduty', response: response.data };
      
    } catch (error) {
      console.error('Failed to send PagerDuty alert:', error.message);
      throw new Error(`PagerDuty alert failed: ${error.message}`);
    }
  }

  /**
   * Send email notification (simplified implementation)
   */
  async sendEmailNotification(alert) {
    try {
      // This is a simplified implementation
      // In production, you would use a proper email service like nodemailer
      console.log('Email notification would be sent:', {
        to: 'ops-team@company.com',
        subject: `${alert.severity.toUpperCase()}: ${alert.summary}`,
        body: `
Alert: ${alert.summary}
Description: ${alert.description}
Severity: ${alert.severity}
Service: ${alert.service}
Instance: ${alert.instance}
Time: ${new Date(alert.timestamp).toLocaleString()}
${alert.runbookUrl ? `Runbook: ${alert.runbookUrl}` : ''}
        `
      });

      return { success: true, channel: 'email', note: 'Email implementation placeholder' };
      
    } catch (error) {
      console.error('Failed to send email notification:', error.message);
      throw new Error(`Email notification failed: ${error.message}`);
    }
  }

  /**
   * Send resolved alert notification
   */
  async sendResolvedAlert(alert) {
    const resolvedAlert = {
      ...alert,
      summary: `RESOLVED: ${alert.summary}`,
      description: `Alert has been resolved: ${alert.description}`,
      resolved: true,
      resolvedAt: new Date().toISOString()
    };

    return await this.sendAlert(resolvedAlert);
  }

  /**
   * Get severity color for Slack
   */
  getSeverityColor(severity) {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'good';
      default:
        return '#808080';
    }
  }

  /**
   * Store alert in history
   */
  storeAlert(alert) {
    this.alertHistory.unshift({
      ...alert,
      id: this.generateAlertId(),
      receivedAt: new Date().toISOString()
    });

    // Trim history to max size
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Test notification channels
   */
  async testNotifications() {
    const testAlert = {
      summary: 'Test Alert - Notification System Check',
      description: 'This is a test alert to verify notification channels are working correctly',
      severity: 'info',
      service: 'orthanc-bridge',
      instance: 'test-instance',
      timestamp: new Date().toISOString(),
      alertName: 'test-alert',
      runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/test'
    };

    console.log('Sending test notifications...');
    const results = await this.sendAlert(testAlert);
    
    console.log('Test notification results:', results);
    return results;
  }

  /**
   * Get notification configuration status
   */
  getConfigurationStatus() {
    return {
      enabled: this.config.enabled,
      channels: {
        slack: !!this.config.slackWebhookUrl,
        pagerduty: !!this.config.pagerDutyIntegrationKey,
        email: !!this.config.emailSmtpHost
      },
      alertHistorySize: this.alertHistory.length
    };
  }
}

// Singleton instance
let notificationService = null;

/**
 * Get the singleton NotificationService instance
 */
function getNotificationService(config) {
  if (!notificationService) {
    notificationService = new NotificationService(config);
  }
  return notificationService;
}

module.exports = {
  NotificationService,
  getNotificationService
};