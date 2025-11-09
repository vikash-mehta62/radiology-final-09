const { AlertManager, getAlertManager } = require('../../src/services/alert-manager');
const { getNotificationService } = require('../../src/services/notification-service');
const { getMetricsCollector } = require('../../src/services/metrics-collector');

// Mock dependencies
jest.mock('../../src/services/notification-service');
jest.mock('../../src/services/metrics-collector');

describe('AlertManager', () => {
  let alertManager;
  let mockNotificationService;
  let mockMetricsCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock notification service
    mockNotificationService = {
      sendAlert: jest.fn().mockResolvedValue(true),
      sendResolvedAlert: jest.fn().mockResolvedValue(true)
    };
    getNotificationService.mockReturnValue(mockNotificationService);
    
    // Mock metrics collector
    mockMetricsCollector = {
      getMetricsAsJSON: jest.fn().mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 50 }]
        },
        {
          name: 'orthanc_bridge_orthanc_connectivity',
          type: 'gauge',
          values: [{ value: 1 }]
        }
      ])
    };
    getMetricsCollector.mockReturnValue(mockMetricsCollector);
    
    // Create alert manager with test config
    alertManager = new AlertManager({
      checkInterval: 1000,
      enabled: true,
      rules: [
        {
          name: 'TestHighQueue',
          metric: 'orthanc_bridge_queue_depth',
          condition: '>',
          threshold: 100,
          duration: 1000,
          severity: 'warning',
          summary: 'High queue depth',
          description: 'Queue depth is {{ $value }}'
        }
      ]
    });
  });

  afterEach(() => {
    if (alertManager) {
      alertManager.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultManager = new AlertManager();
      
      expect(defaultManager.config.checkInterval).toBe(30000);
      expect(defaultManager.config.enabled).toBe(true);
      expect(defaultManager.config.rules).toBeDefined();
      expect(defaultManager.config.rules.length).toBeGreaterThan(0);
    });

    test('should initialize with custom configuration', () => {
      expect(alertManager.config.checkInterval).toBe(1000);
      expect(alertManager.config.enabled).toBe(true);
      expect(alertManager.config.rules.length).toBe(1);
      expect(alertManager.config.rules[0].name).toBe('TestHighQueue');
    });

    test('should initialize notification service and metrics collector', () => {
      expect(getNotificationService).toHaveBeenCalled();
      expect(getMetricsCollector).toHaveBeenCalled();
      expect(alertManager.notificationService).toBe(mockNotificationService);
      expect(alertManager.metricsCollector).toBe(mockMetricsCollector);
    });
  });

  describe('Alert Rule Evaluation', () => {
    test('should evaluate condition correctly for greater than', () => {
      expect(alertManager.evaluateCondition(150, '>', 100)).toBe(true);
      expect(alertManager.evaluateCondition(50, '>', 100)).toBe(false);
    });

    test('should evaluate condition correctly for less than', () => {
      expect(alertManager.evaluateCondition(50, '<', 100)).toBe(true);
      expect(alertManager.evaluateCondition(150, '<', 100)).toBe(false);
    });

    test('should evaluate condition correctly for equals', () => {
      expect(alertManager.evaluateCondition(100, '==', 100)).toBe(true);
      expect(alertManager.evaluateCondition(99, '==', 100)).toBe(false);
    });

    test('should handle null/undefined values', () => {
      expect(alertManager.evaluateCondition(null, '>', 100)).toBe(false);
      expect(alertManager.evaluateCondition(undefined, '>', 100)).toBe(false);
    });

    test('should handle unknown conditions', () => {
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      expect(alertManager.evaluateCondition(100, 'unknown', 50)).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('Unknown condition: unknown');
      
      console.warn = originalConsoleWarn;
    });
  });

  describe('Metric Value Extraction', () => {
    test('should extract gauge metric value', () => {
      const metrics = [
        {
          name: 'test_gauge',
          type: 'gauge',
          values: [{ value: 42 }]
        }
      ];
      
      const value = alertManager.getMetricValue('test_gauge', metrics);
      expect(value).toBe(42);
    });

    test('should extract counter metric value', () => {
      const metrics = [
        {
          name: 'test_counter',
          type: 'counter',
          values: [{ value: 100 }]
        }
      ];
      
      const value = alertManager.getMetricValue('test_counter', metrics);
      expect(value).toBe(100);
    });

    test('should handle missing metric', () => {
      const metrics = [];
      const value = alertManager.getMetricValue('missing_metric', metrics);
      expect(value).toBeNull();
    });

    test('should handle metric with no values', () => {
      const metrics = [
        {
          name: 'empty_metric',
          type: 'gauge',
          values: []
        }
      ];
      
      const value = alertManager.getMetricValue('empty_metric', metrics);
      expect(value).toBe(0);
    });
  });

  describe('Alert Creation and Firing', () => {
    test('should create alert with correct structure', () => {
      const rule = {
        name: 'TestAlert',
        summary: 'Test alert summary',
        description: 'Value is {{ $value }}',
        severity: 'warning',
        metric: 'test_metric',
        threshold: 100,
        condition: '>'
      };
      
      const alert = alertManager.createAlert(rule, 150);
      
      expect(alert.name).toBe('TestAlert');
      expect(alert.summary).toBe('Test alert summary');
      expect(alert.description).toBe('Value is 150');
      expect(alert.severity).toBe('warning');
      expect(alert.value).toBe(150);
      expect(alert.threshold).toBe(100);
      expect(alert.id).toBeDefined();
      expect(alert.timestamp).toBeDefined();
    });

    test('should fire alert and send notification', async () => {
      const alert = {
        id: 'test-alert-1',
        name: 'TestAlert',
        summary: 'Test alert',
        severity: 'warning'
      };
      
      await alertManager.fireAlert(alert);
      
      expect(mockNotificationService.sendAlert).toHaveBeenCalledWith(alert);
      expect(alertManager.alertHistory.length).toBe(1);
      expect(alertManager.alertHistory[0].action).toBe('fired');
    });

    test('should handle notification failures gracefully', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      mockNotificationService.sendAlert.mockRejectedValue(new Error('Notification failed'));
      
      const alert = { id: 'test-alert-1', name: 'TestAlert' };
      
      await expect(alertManager.fireAlert(alert)).resolves.not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to send alert notification:',
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });
  });

  describe('Alert Resolution', () => {
    test('should resolve alert and send notification', async () => {
      const alert = {
        id: 'test-alert-1',
        name: 'TestAlert',
        summary: 'Test alert resolved'
      };
      
      await alertManager.resolveAlert('test-key', alert);
      
      expect(mockNotificationService.sendResolvedAlert).toHaveBeenCalledWith(alert);
      expect(alertManager.alertHistory.length).toBe(1);
      expect(alertManager.alertHistory[0].action).toBe('resolved');
      expect(alertManager.alertHistory[0].resolvedAt).toBeDefined();
    });
  });

  describe('Alert Rule Processing', () => {
    test('should trigger alert when threshold exceeded', async () => {
      // Set up metrics that exceed threshold
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 150 }] // Exceeds threshold of 100
        }
      ]);
      
      await alertManager.checkAlerts();
      
      // Should have triggered alert
      expect(alertManager.activeAlerts.size).toBe(1);
      expect(mockNotificationService.sendAlert).toHaveBeenCalled();
    });

    test('should not trigger alert when threshold not exceeded', async () => {
      // Set up metrics below threshold
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 50 }] // Below threshold of 100
        }
      ]);
      
      await alertManager.checkAlerts();
      
      // Should not have triggered alert
      expect(alertManager.activeAlerts.size).toBe(0);
      expect(mockNotificationService.sendAlert).not.toHaveBeenCalled();
    });

    test('should resolve alert when condition no longer met', async () => {
      // First trigger an alert
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 150 }]
        }
      ]);
      
      await alertManager.checkAlerts();
      expect(alertManager.activeAlerts.size).toBe(1);
      
      // Then resolve it
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 50 }]
        }
      ]);
      
      await alertManager.checkAlerts();
      expect(alertManager.activeAlerts.size).toBe(0);
      expect(mockNotificationService.sendResolvedAlert).toHaveBeenCalled();
    });
  });

  describe('Alert Duration Handling', () => {
    test('should respect alert duration before firing', async () => {
      // Create rule with duration
      alertManager.config.rules = [{
        name: 'DurationTest',
        metric: 'orthanc_bridge_queue_depth',
        condition: '>',
        threshold: 100,
        duration: 5000, // 5 seconds
        severity: 'warning',
        summary: 'Duration test',
        description: 'Test duration'
      }];
      
      // Set up metrics that exceed threshold
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 150 }]
        }
      ]);
      
      // First check - should not fire yet (duration not met)
      await alertManager.checkAlerts();
      expect(alertManager.activeAlerts.size).toBe(0);
      
      // Simulate time passing by manipulating alert state
      const alertKey = 'DurationTest_default';
      const alertState = alertManager.alertStates.get(alertKey);
      if (alertState) {
        alertState.triggeredAt = Date.now() - 6000; // 6 seconds ago
      }
      
      // Second check - should fire now (duration met)
      await alertManager.checkAlerts();
      expect(alertManager.activeAlerts.size).toBe(1);
    });
  });

  describe('Alert Manager Lifecycle', () => {
    test('should start alert checking when enabled', () => {
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;
      
      alertManager.start();
      
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );
      
      global.setInterval = originalSetInterval;
    });

    test('should not start when disabled', () => {
      const originalConsoleLog = console.log;
      console.log = jest.fn();
      
      const disabledManager = new AlertManager({ enabled: false });
      disabledManager.start();
      
      expect(console.log).toHaveBeenCalledWith('Alert manager is disabled');
      
      console.log = originalConsoleLog;
    });

    test('should stop alert checking', () => {
      const originalClearInterval = global.clearInterval;
      const mockClearInterval = jest.fn();
      global.clearInterval = mockClearInterval;
      
      alertManager.checkInterval = 'mock-interval-id';
      alertManager.stop();
      
      expect(mockClearInterval).toHaveBeenCalledWith('mock-interval-id');
      expect(alertManager.checkInterval).toBeNull();
      
      global.clearInterval = originalClearInterval;
    });
  });  desc
ribe('Alert Statistics and History', () => {
    test('should return active alerts', () => {
      const alert1 = { id: 'alert-1', name: 'Alert1' };
      const alert2 = { id: 'alert-2', name: 'Alert2' };
      
      alertManager.activeAlerts.set('key1', alert1);
      alertManager.activeAlerts.set('key2', alert2);
      
      const activeAlerts = alertManager.getActiveAlerts();
      
      expect(activeAlerts).toHaveLength(2);
      expect(activeAlerts).toContain(alert1);
      expect(activeAlerts).toContain(alert2);
    });

    test('should return alert history with limit', () => {
      // Add some history
      for (let i = 0; i < 10; i++) {
        alertManager.alertHistory.push({
          id: `alert-${i}`,
          name: `Alert${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      const history = alertManager.getAlertHistory(5);
      expect(history).toHaveLength(5);
    });

    test('should calculate alert statistics', () => {
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Add test data
      alertManager.activeAlerts.set('active1', { id: 'active1' });
      alertManager.activeAlerts.set('active2', { id: 'active2' });
      
      alertManager.alertHistory = [
        { timestamp: yesterday, severity: 'critical', action: 'fired' },
        { timestamp: yesterday, severity: 'warning', action: 'fired' },
        { timestamp: yesterday, action: 'resolved' },
        { timestamp: lastWeek, severity: 'critical', action: 'fired' }
      ];
      
      const stats = alertManager.getAlertStats();
      
      expect(stats.active).toBe(2);
      expect(stats.total24h).toBe(3);
      expect(stats.total7d).toBe(4);
      expect(stats.critical24h).toBe(1);
      expect(stats.warning24h).toBe(1);
      expect(stats.resolved24h).toBe(1);
    });
  });

  describe('Test Alert Functionality', () => {
    test('should send test alert', async () => {
      const testAlert = await alertManager.testAlert();
      
      expect(testAlert.name).toBe('TestAlert');
      expect(testAlert.summary).toBe('Test Alert - System Check');
      expect(testAlert.severity).toBe('info');
      expect(testAlert.id).toBeDefined();
      expect(testAlert.timestamp).toBeDefined();
      
      expect(mockNotificationService.sendAlert).toHaveBeenCalledWith(testAlert);
    });
  });

  describe('Default Alert Rules', () => {
    test('should have default alert rules', () => {
      const defaultManager = new AlertManager();
      const rules = defaultManager.getDefaultRules();
      
      expect(rules).toBeInstanceOf(Array);
      expect(rules.length).toBeGreaterThan(0);
      
      // Check for expected default rules
      const ruleNames = rules.map(r => r.name);
      expect(ruleNames).toContain('HighQueueDepth');
      expect(ruleNames).toContain('CriticalQueueDepth');
      expect(ruleNames).toContain('OrthancDown');
      expect(ruleNames).toContain('DatabaseDown');
      expect(ruleNames).toContain('NoThroughput');
    });

    test('should have properly structured default rules', () => {
      const defaultManager = new AlertManager();
      const rules = defaultManager.getDefaultRules();
      
      rules.forEach(rule => {
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('metric');
        expect(rule).toHaveProperty('condition');
        expect(rule).toHaveProperty('threshold');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('summary');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('runbookUrl');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle metrics collection errors', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      mockMetricsCollector.getMetricsAsJSON.mockRejectedValue(new Error('Metrics error'));
      
      await alertManager.checkAlerts();
      
      expect(console.error).toHaveBeenCalledWith(
        'Error checking alerts:',
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });

    test('should handle rule evaluation errors', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Create a rule that will cause an error
      alertManager.config.rules = [{
        name: 'ErrorRule',
        metric: 'invalid_metric',
        condition: '>',
        threshold: 100
      }];
      
      mockMetricsCollector.getMetricsAsJSON.mockResolvedValue([]);
      
      await alertManager.checkAlerts();
      
      // Should handle the error gracefully
      expect(console.error).toHaveBeenCalledWith(
        'Error evaluating rule ErrorRule:',
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getAlertManager', () => {
      const instance1 = getAlertManager();
      const instance2 = getAlertManager();
      
      expect(instance1).toBe(instance2);
    });

    test('should initialize singleton with config', () => {
      const config = { checkInterval: 5000 };
      const instance = getAlertManager(config);
      
      expect(instance).toBeInstanceOf(AlertManager);
      expect(instance.config.checkInterval).toBe(5000);
    });
  });

  describe('Alert ID Generation', () => {
    test('should generate unique alert IDs', () => {
      const id1 = alertManager.generateAlertId();
      const id2 = alertManager.generateAlertId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^alert_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^alert_\d+_[a-z0-9]+$/);
    });
  });

  describe('Alert History Management', () => {
    test('should trim alert history when it exceeds limit', async () => {
      // Fill history beyond limit
      for (let i = 0; i < 1005; i++) {
        alertManager.alertHistory.push({
          id: `alert-${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      const alert = { id: 'new-alert', name: 'NewAlert' };
      await alertManager.fireAlert(alert);
      
      expect(alertManager.alertHistory.length).toBe(1000);
    });
  });
});