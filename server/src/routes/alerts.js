const express = require('express');
const { getAlertManager } = require('../services/alert-manager');
const { getNotificationService } = require('../services/notification-service');

const router = express.Router();

/**
 * GET /alerts - Get active alerts
 */
router.get('/', (req, res) => {
  try {
    const alertManager = getAlertManager();
    const activeAlerts = alertManager.getActiveAlerts();
    
    res.json({
      alerts: activeAlerts,
      count: activeAlerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /alerts/history - Get alert history
 */
router.get('/history', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alertManager = getAlertManager();
    const history = alertManager.getAlertHistory(parseInt(limit));
    
    res.json({
      history: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alert history:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

/**
 * GET /alerts/stats - Get alert statistics
 */
router.get('/stats', (req, res) => {
  try {
    const alertManager = getAlertManager();
    const stats = alertManager.getAlertStats();
    
    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alert stats:', error);
    res.status(500).json({ error: 'Failed to get alert statistics' });
  }
});

/**
 * POST /alerts/test - Send test alert
 */
router.post('/test', async (req, res) => {
  try {
    const alertManager = getAlertManager();
    const testAlert = await alertManager.testAlert();
    
    res.json({
      message: 'Test alert sent',
      alert: testAlert,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending test alert:', error);
    res.status(500).json({ error: 'Failed to send test alert' });
  }
});

/**
 * POST /alerts/test-notifications - Test notification channels
 */
router.post('/test-notifications', async (req, res) => {
  try {
    const notificationService = getNotificationService();
    const results = await notificationService.testNotifications();
    
    res.json({
      message: 'Test notifications sent',
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing notifications:', error);
    res.status(500).json({ error: 'Failed to test notifications' });
  }
});

/**
 * GET /alerts/config - Get alerting configuration
 */
router.get('/config', (req, res) => {
  try {
    const alertManager = getAlertManager();
    const notificationService = getNotificationService();
    
    res.json({
      alertManager: {
        enabled: alertManager.config.enabled,
        checkInterval: alertManager.config.checkInterval,
        rulesCount: alertManager.config.rules.length
      },
      notifications: notificationService.getConfigurationStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alert config:', error);
    res.status(500).json({ error: 'Failed to get alert configuration' });
  }
});

/**
 * GET /alerts/rules - Get alert rules
 */
router.get('/rules', (req, res) => {
  try {
    const alertManager = getAlertManager();
    
    res.json({
      rules: alertManager.config.rules,
      count: alertManager.config.rules.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alert rules:', error);
    res.status(500).json({ error: 'Failed to get alert rules' });
  }
});

/**
 * POST /alerts/webhook - Webhook endpoint for external alert managers
 * Receives alerts from Prometheus AlertManager
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const { alerts } = req.body;
    
    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const notificationService = getNotificationService();
    const results = [];

    for (const alert of alerts) {
      try {
        const formattedAlert = {
          summary: alert.annotations?.summary || 'Alert',
          description: alert.annotations?.description || 'No description',
          severity: alert.labels?.severity || 'warning',
          service: alert.labels?.service || 'unknown',
          instance: alert.labels?.instance || 'unknown',
          timestamp: alert.startsAt || new Date().toISOString(),
          alertName: alert.labels?.alertname || 'unknown',
          runbookUrl: alert.annotations?.runbook_url
        };

        if (alert.status === 'resolved') {
          await notificationService.sendResolvedAlert(formattedAlert);
        } else {
          await notificationService.sendAlert(formattedAlert);
        }

        results.push({ success: true, alert: alert.labels?.alertname });
      } catch (error) {
        console.error('Error processing webhook alert:', error);
        results.push({ success: false, alert: alert.labels?.alertname, error: error.message });
      }
    }

    res.json({
      message: 'Webhook processed',
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing alert webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;