const { getMetricsCollector } = require('../../src/services/metrics-collector');
const { getHealthChecker } = require('../../src/services/health-checker');
const { getAlertManager } = require('../../src/services/alert-manager');
const { getNotificationService } = require('../../src/services/notification-service');
const axios = require('axios');
const mongoose = require('mongoose');

// Mock external dependencies
jest.mock('axios');
jest.mock('mongoose', () => ({
  connection: {
    readyState: 1,
    host: 'test-mongo',
    name: 'test-db',
    db: {
      admin: () => ({
        ping: jest.fn().mockResolvedValue({})
      })
    }
  }
}));

describe('Monitoring System Integration', () => {
  let metricsCollector;
  let healthChecker;
  let alertManager;
  let notificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock metrics collector with required methods
    metricsCollector = {
      recordQueueDepth: jest.fn(),
      recordInstanceProcessed: jest.fn(),
      recordJobFailure: jest.fn(),
      updateOrthancConnectivity: jest.fn(),
      updateDatabaseConnectivity: jest.fn(),
      getMetrics: jest.fn().mockResolvedValue('# Mock metrics'),
      getMetricsAsJSON: jest.fn().mockResolvedValue([
        {
          name: 'orthanc_bridge_queue_depth',
          type: 'gauge',
          values: [{ value: 15 }]
        }
      ]),
      reset: jest.fn()
    };
    
    healthChecker = getHealthChecker({
      orthancUrl: 'http://test-orthanc:8042',
      checkInterval: 1000
    });
    
    // Mock the metrics collector in health checker
    healthChecker.metricsCollector = metricsCollector;
    
    // Mock notification service
    notificationService = {
      sendAlert: jest.fn().mockResolvedValue([{ status: 'fulfilled' }]),
      sendResolvedAlert: jest.fn().mockResolvedValue([{ status: 'fulfilled' }])
    };
    
    alertManager = getAlertManager({
      checkInterval: 1000,
      notifications: {},
      rules: [
        {
          name: 'TestHighQueue',
          metric: 'orthanc_bridge_queue_depth',
          condition: '>',
          threshold: 10,
          duration: 100,
          severity: 'warning',
          summary: 'High queue depth detected',
          description: 'Queue depth is {{ $value }}'
        }
      ]
    });
    
    // Replace services in alert manager
    alertManager.notificationService = notificationService;
    alertManager.metricsCollector = metricsCollector;
  });

  afterEach(() => {
    if (healthChecker) {
      healthChecker.stop();
    }
    if (alertManager) {
      alertManager.stop();
    }
    if (metricsCollector) {
      metricsCollector.reset();
    }
  });

  describe('End-to-End Monitoring Flow', () => {
    test('should collect metrics, perform health checks, and trigger alerts', async () => {
      // Step 1: Simulate system activity and collect metrics
      metricsCollector.recordQueueDepth('processing', 15); // Above threshold
      metricsCollector.recordInstanceProcessed('success', 'CT');
      metricsCollector.recordJobFailure('webhook_processing', 'timeout');

      // Step 2: Mock health check dependencies
      axios.get.mockResolvedValue({
        status: 200,
        data: { Version: '1.9.7', Name: 'Test Orthanc' }
      });
      mongoose.connection.readyState = 1;
      mongoose.connection.db = {
        admin: () => ({ ping: jest.fn().mockResolvedValue({}) })
      };

      // Step 3: Run health checks
      await healthChecker.runAllChecks();
      
      // Verify health status
      const healthStatus = healthChecker.getHealthStatus();
      expect(healthStatus.overall).toBe('healthy');
      expect(healthStatus.checks.orthanc.status).toBe('healthy');
      expect(healthStatus.checks.database.status).toBe('healthy');

      // Step 4: Check alerts (should trigger due to high queue depth)
      await alertManager.checkAlerts();
      
      // Wait for duration to pass
      await new Promise(resolve => setTimeout(resolve, 150));
      await alertManager.checkAlerts();

      // Verify alert was triggered
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].name).toBe('TestHighQueue');
      expect(activeAlerts[0].value).toBe(15);
      
      // Verify notification was sent
      expect(notificationService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestHighQueue',
          value: 15,
          severity: 'warning'
        })
      );

      // Step 5: Resolve the issue and verify alert resolution
      metricsCollector.recordQueueDepth('processing', 5); // Below threshold
      await alertManager.checkAlerts();

      // Verify alert was resolved
      const resolvedActiveAlerts = alertManager.getActiveAlerts();
      expect(resolvedActiveAlerts.length).toBe(0);
      expect(notificationService.sendResolvedAlert).toHaveBeenCalled();
    });

    test('should handle system degradation gracefully', async () => {
      // Simulate Orthanc going down
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      
      // Mock mongoose connection as disconnected
      const originalReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0; // Disconnected

      // Run health checks
      await healthChecker.runAllChecks();
      
      // Verify degraded health status
      const healthStatus = healthChecker.getHealthStatus();
      expect(healthStatus.overall).toBe('critical');
      expect(healthStatus.checks.orthanc.status).toBe('unhealthy');
      expect(healthStatus.checks.database.status).toBe('unhealthy');

      // Verify metrics were updated
      expect(healthChecker.metricsCollector.updateOrthancConnectivity).toHaveBeenCalledWith(0);
      expect(healthChecker.metricsCollector.updateDatabaseConnectivity).toHaveBeenCalledWith(0);
      
      // Restore original state
      mongoose.connection.readyState = originalReadyState;
    });
  });

  describe('Metrics Export and Monitoring', () => {
    test('should export comprehensive metrics for monitoring systems', async () => {
      // Generate various metrics
      metricsCollector.recordQueueDepth('processing', 25);
      metricsCollector.recordInstanceProcessed('success', 'CT');
      metricsCollector.recordJobFailure('dicom_parsing', 'corrupt_file');
      metricsCollector.updateOrthancConnectivity(1);
      metricsCollector.updateDatabaseConnectivity(1);

      // Export metrics in Prometheus format
      const prometheusMetrics = await metricsCollector.getMetrics();
      
      expect(prometheusMetrics).toContain('orthanc_bridge_queue_depth');
      expect(prometheusMetrics).toContain('orthanc_bridge_instances_processed_total');
      expect(prometheusMetrics).toContain('orthanc_bridge_failures_total');
      expect(prometheusMetrics).toContain('orthanc_bridge_orthanc_connectivity');
      expect(prometheusMetrics).toContain('orthanc_bridge_database_connectivity');

      // Export metrics as JSON for debugging
      const jsonMetrics = await metricsCollector.getMetricsAsJSON();
      
      expect(Array.isArray(jsonMetrics)).toBe(true);
      expect(jsonMetrics.length).toBeGreaterThan(0);
      
      const metricNames = jsonMetrics.map(m => m.name);
      expect(metricNames).toContain('orthanc_bridge_queue_depth');
    });

    test('should provide health check results for external monitoring', async () => {
      // Mock successful health checks
      axios.get.mockResolvedValue({
        status: 200,
        data: { Version: '1.9.7' }
      });
      // mongoose is already mocked as connected

      await healthChecker.runAllChecks();
      
      const healthStatus = healthChecker.getHealthStatus();
      
      // Verify structure suitable for external monitoring
      expect(healthStatus).toHaveProperty('overall');
      expect(healthStatus).toHaveProperty('checks');
      expect(healthStatus).toHaveProperty('lastUpdate');
      expect(healthStatus).toHaveProperty('summary');
      
      expect(healthStatus.summary.total).toBeGreaterThan(0);
      expect(healthStatus.summary.healthy).toBeDefined();
      expect(healthStatus.summary.warning).toBeDefined();
      expect(healthStatus.summary.critical).toBeDefined();
    });
  });

  describe('Alert System Reliability', () => {
    test('should handle alert notification failures gracefully', async () => {
      // Mock notification failure
      notificationService.sendAlert.mockRejectedValue(new Error('Notification service down'));
      
      // Trigger alert condition
      metricsCollector.recordQueueDepth('processing', 20);
      await alertManager.checkAlerts();
      
      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, 150));
      await alertManager.checkAlerts();

      // Alert should still be recorded even if notification fails
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      
      const alertHistory = alertManager.getAlertHistory();
      expect(alertHistory.length).toBe(1);
      expect(alertHistory[0].action).toBe('fired');
    });

    test('should prevent alert spam with duration requirements', async () => {
      // Set high queue depth
      metricsCollector.recordQueueDepth('processing', 20);
      
      // First check - should not fire immediately
      await alertManager.checkAlerts();
      expect(alertManager.getActiveAlerts().length).toBe(0);
      expect(notificationService.sendAlert).not.toHaveBeenCalled();
      
      // Second check before duration - still should not fire
      await new Promise(resolve => setTimeout(resolve, 50));
      await alertManager.checkAlerts();
      expect(alertManager.getActiveAlerts().length).toBe(0);
      
      // Third check after duration - should fire
      await new Promise(resolve => setTimeout(resolve, 100));
      await alertManager.checkAlerts();
      expect(alertManager.getActiveAlerts().length).toBe(1);
      expect(notificationService.sendAlert).toHaveBeenCalled();
    });
  });

  describe('Performance and Resource Usage', () => {
    test('should handle high-frequency metric updates efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate high-frequency updates
      for (let i = 0; i < 1000; i++) {
        metricsCollector.recordQueueDepth('processing', i % 100);
        metricsCollector.recordInstanceProcessed('success', 'CT');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Metrics should still be exportable
      const metrics = await metricsCollector.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
    });

    test('should maintain memory usage within bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate lots of metrics and alerts
      for (let i = 0; i < 100; i++) {
        metricsCollector.recordInstanceProcessed({
          studyInstanceUID: `study-${i}`,
          seriesInstanceUID: `series-${i}`,
          sopInstanceUID: `instance-${i}`
        });
        
        // Trigger and resolve alerts
        metricsCollector.recordQueueDepth('processing', 20);
        await alertManager.checkAlerts();
        await new Promise(resolve => setTimeout(resolve, 10));
        metricsCollector.recordQueueDepth('processing', 5);
        await alertManager.checkAlerts();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Configuration and Customization', () => {
    test('should support custom alert rules', async () => {
      const customAlertManager = getAlertManager({
        rules: [
          {
            name: 'CustomFailureRate',
            metric: 'orthanc_bridge_failures_total',
            condition: '>',
            threshold: 5,
            duration: 100,
            severity: 'critical',
            summary: 'High failure rate detected',
            description: 'Failure count is {{ $value }}'
          }
        ]
      });
      
      customAlertManager.notificationService = notificationService;
      
      // Trigger failures
      for (let i = 0; i < 7; i++) {
        metricsCollector.recordJobFailure('test_operation', 'test_error');
      }
      
      await customAlertManager.checkAlerts();
      await new Promise(resolve => setTimeout(resolve, 150));
      await customAlertManager.checkAlerts();
      
      const activeAlerts = customAlertManager.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].name).toBe('CustomFailureRate');
      expect(activeAlerts[0].severity).toBe('critical');
      
      customAlertManager.stop();
    });

    test('should support different health check intervals', async () => {
      const fastHealthChecker = getHealthChecker({
        checkInterval: 500 // 500ms
      });
      
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;
      
      fastHealthChecker.start();
      
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        500
      );
      
      global.setInterval = originalSetInterval;
      fastHealthChecker.stop();
    });
  });
});