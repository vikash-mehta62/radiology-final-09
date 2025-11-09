const { getNotificationService } = require('./notification-service');
const { getMetricsCollector } = require('./metrics-collector');

/**
 * AlertManager - Manages alert rules, thresholds, and notifications
 * Monitors metrics and triggers alerts based on configured rules
 */
class AlertManager {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      enabled: config.enabled !== false,
      rules: config.rules || this.getDefaultRules(),
      ...config
    };

    this.notificationService = getNotificationService(config.notifications);
    this.metricsCollector = getMetricsCollector();
    
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.checkInterval = null;
    
    // Alert state tracking
    this.alertStates = new Map();
  }

  /**
   * Start the alert manager
   */
  start() {
    if (!this.config.enabled) {
      console.log('Alert manager is disabled');
      return;
    }

    console.log('Starting alert manager...');
    
    // Run initial check
    this.checkAlerts();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, this.config.checkInterval);

    console.log(`Alert manager started with ${this.config.checkInterval}ms check interval`);
  }

  /**
   * Stop the alert manager
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Alert manager stopped');
    }
  }

  /**
   * Check all alert rules
   */
  async checkAlerts() {
    try {
      const metrics = await this.metricsCollector.getMetricsAsJSON();
      
      for (const rule of this.config.rules) {
        await this.evaluateRule(rule, metrics);
      }
      
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  /**
   * Evaluate a single alert rule
   */
  async evaluateRule(rule, metrics) {
    try {
      const metricValue = this.getMetricValue(rule.metric, metrics);
      const isTriggered = this.evaluateCondition(metricValue, rule.condition, rule.threshold);
      
      const alertKey = `${rule.name}_${rule.instance || 'default'}`;
      const existingAlert = this.activeAlerts.get(alertKey);
      const alertState = this.alertStates.get(alertKey) || { 
        triggeredAt: null, 
        notifiedAt: null,
        count: 0 
      };

      if (isTriggered) {
        alertState.count++;
        
        if (!alertState.triggeredAt) {
          alertState.triggeredAt = Date.now();
        }

        // Check if alert should fire (considering duration)
        const durationMet = !rule.duration || 
          (Date.now() - alertState.triggeredAt) >= rule.duration;

        if (durationMet && !existingAlert) {
          // Fire new alert
          const alert = this.createAlert(rule, metricValue);
          this.activeAlerts.set(alertKey, alert);
          alertState.notifiedAt = Date.now();
          
          await this.fireAlert(alert);
        }
      } else {
        // Condition not met
        if (existingAlert) {
          // Resolve existing alert
          await this.resolveAlert(alertKey, existingAlert);
          this.activeAlerts.delete(alertKey);
        }
        
        // Reset alert state
        alertState.triggeredAt = null;
        alertState.notifiedAt = null;
        alertState.count = 0;
      }

      this.alertStates.set(alertKey, alertState);
      
    } catch (error) {
      console.error(`Error evaluating rule ${rule.name}:`, error);
    }
  }

  /**
   * Get metric value from metrics array
   */
  getMetricValue(metricName, metrics) {
    const metric = metrics.find(m => m.name === metricName);
    if (!metric) {
      return null;
    }

    // Handle different metric types
    if (metric.type === 'gauge' || metric.type === 'counter') {
      return metric.values && metric.values.length > 0 ? metric.values[0].value : 0;
    }
    
    if (metric.type === 'histogram') {
      // For histograms, we might want specific buckets or quantiles
      // This is simplified - in production you'd handle histogram data properly
      return metric.values && metric.values.length > 0 ? metric.values[0].value : 0;
    }

    return 0;
  }

  /**
   * Evaluate condition against threshold
   */
  evaluateCondition(value, condition, threshold) {
    if (value === null || value === undefined) {
      return false;
    }

    switch (condition) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        console.warn(`Unknown condition: ${condition}`);
        return false;
    }
  }

  /**
   * Create alert object
   */
  createAlert(rule, value) {
    return {
      id: this.generateAlertId(),
      name: rule.name,
      summary: rule.summary,
      description: rule.description.replace('{{ $value }}', value),
      severity: rule.severity,
      service: rule.service || 'orthanc-bridge',
      instance: rule.instance || 'unknown',
      metric: rule.metric,
      value: value,
      threshold: rule.threshold,
      condition: rule.condition,
      timestamp: new Date().toISOString(),
      runbookUrl: rule.runbookUrl,
      labels: rule.labels || {}
    };
  }

  /**
   * Fire an alert
   */
  async fireAlert(alert) {
    console.log(`🚨 ALERT FIRED: ${alert.name} - ${alert.summary}`);
    
    try {
      await this.notificationService.sendAlert(alert);
      
      // Store in history
      this.alertHistory.unshift({
        ...alert,
        action: 'fired'
      });
      
      // Trim history
      if (this.alertHistory.length > 1000) {
        this.alertHistory = this.alertHistory.slice(0, 1000);
      }
      
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertKey, alert) {
    console.log(`✅ ALERT RESOLVED: ${alert.name} - ${alert.summary}`);
    
    try {
      await this.notificationService.sendResolvedAlert(alert);
      
      // Store resolution in history
      this.alertHistory.unshift({
        ...alert,
        action: 'resolved',
        resolvedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to send alert resolution notification:', error);
    }
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default alert rules
   */
  getDefaultRules() {
    return [
      {
        name: 'HighQueueDepth',
        metric: 'orthanc_bridge_queue_depth',
        condition: '>',
        threshold: 100,
        duration: 5 * 60 * 1000, // 5 minutes
        severity: 'warning',
        summary: 'High queue depth detected',
        description: 'Queue depth is {{ $value }} which is above the threshold of 100',
        runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/high-queue-depth'
      },
      {
        name: 'CriticalQueueDepth',
        metric: 'orthanc_bridge_queue_depth',
        condition: '>',
        threshold: 500,
        duration: 2 * 60 * 1000, // 2 minutes
        severity: 'critical',
        summary: 'Critical queue depth detected',
        description: 'Queue depth is {{ $value }} which is critically high (>500)',
        runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/critical-queue-depth'
      },
      {
        name: 'OrthancDown',
        metric: 'orthanc_bridge_orthanc_connectivity',
        condition: '==',
        threshold: 0,
        duration: 1 * 60 * 1000, // 1 minute
        severity: 'critical',
        summary: 'Orthanc server is down',
        description: 'Cannot connect to Orthanc server',
        runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/orthanc-down'
      },
      {
        name: 'DatabaseDown',
        metric: 'orthanc_bridge_database_connectivity',
        condition: '==',
        threshold: 0,
        duration: 1 * 60 * 1000, // 1 minute
        severity: 'critical',
        summary: 'Database is down',
        description: 'Cannot connect to database',
        runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/database-down'
      },
      {
        name: 'NoThroughput',
        metric: 'orthanc_bridge_throughput_instances_per_minute',
        condition: '==',
        threshold: 0,
        duration: 5 * 60 * 1000, // 5 minutes
        severity: 'critical',
        summary: 'No processing throughput',
        description: 'No instances have been processed recently',
        runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/no-throughput'
      }
    ];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7d = now - (7 * 24 * 60 * 60 * 1000);

    const recent24h = this.alertHistory.filter(a => 
      new Date(a.timestamp).getTime() > last24h
    );
    
    const recent7d = this.alertHistory.filter(a => 
      new Date(a.timestamp).getTime() > last7d
    );

    return {
      active: this.activeAlerts.size,
      total24h: recent24h.length,
      total7d: recent7d.length,
      critical24h: recent24h.filter(a => a.severity === 'critical').length,
      warning24h: recent24h.filter(a => a.severity === 'warning').length,
      resolved24h: recent24h.filter(a => a.action === 'resolved').length
    };
  }

  /**
   * Test alert system
   */
  async testAlert() {
    const testAlert = {
      id: this.generateAlertId(),
      name: 'TestAlert',
      summary: 'Test Alert - System Check',
      description: 'This is a test alert to verify the alerting system is working',
      severity: 'info',
      service: 'orthanc-bridge',
      instance: 'test',
      timestamp: new Date().toISOString(),
      runbookUrl: 'https://docs.orthanc-bridge.local/runbooks/test'
    };

    await this.fireAlert(testAlert);
    return testAlert;
  }
}

// Singleton instance
let alertManager = null;

/**
 * Get the singleton AlertManager instance
 */
function getAlertManager(config) {
  if (!alertManager) {
    alertManager = new AlertManager(config);
  }
  return alertManager;
}

module.exports = {
  AlertManager,
  getAlertManager
};