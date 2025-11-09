const axios = require('axios');
const mongoose = require('mongoose');
const { HealthChecker, getHealthChecker } = require('../../src/services/health-checker');
const { getMetricsCollector } = require('../../src/services/metrics-collector');

// Mock dependencies
jest.mock('axios');
jest.mock('mongoose');
jest.mock('../../src/services/metrics-collector');

describe('HealthChecker', () => {
  let healthChecker;
  let mockMetricsCollector;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock metrics collector
    mockMetricsCollector = {
      startTimer: jest.fn(() => ({
        end: jest.fn(() => 100) // Mock timer duration
      })),
      updateOrthancConnectivity: jest.fn(),
      updateDatabaseConnectivity: jest.fn()
    };
    getMetricsCollector.mockReturnValue(mockMetricsCollector);
    
    // Create fresh health checker instance
    healthChecker = new HealthChecker({
      orthancUrl: 'http://test-orthanc:8042',
      orthancUsername: 'test-user',
      orthancPassword: 'test-pass',
      webhookUrl: 'http://test-webhook:8001',
      checkInterval: 1000,
      timeout: 2000
    });
  });

  afterEach(() => {
    if (healthChecker) {
      healthChecker.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultChecker = new HealthChecker();
      
      expect(defaultChecker.config.orthancUrl).toBe('http://69.62.70.102:8042');
      expect(defaultChecker.config.checkInterval).toBe(30000);
      expect(defaultChecker.config.timeout).toBe(5000);
      expect(defaultChecker.healthStatus.overall).toBe('unknown');
    });

    test('should initialize with custom configuration', () => {
      expect(healthChecker.config.orthancUrl).toBe('http://test-orthanc:8042');
      expect(healthChecker.config.checkInterval).toBe(1000);
      expect(healthChecker.config.timeout).toBe(2000);
    });

    test('should initialize metrics collector', () => {
      expect(getMetricsCollector).toHaveBeenCalled();
      expect(healthChecker.metricsCollector).toBe(mockMetricsCollector);
    });
  });

  describe('Orthanc Connectivity Check', () => {
    test('should pass when Orthanc is healthy', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          Version: '1.9.7',
          Name: 'Test Orthanc'
        }
      });

      const result = await healthChecker.checkOrthancConnectivity();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Orthanc server is responding');
      expect(result.details.version).toBe('1.9.7');
      expect(result.details.name).toBe('Test Orthanc');
      
      expect(axios.get).toHaveBeenCalledWith(
        'http://test-orthanc:8042/system',
        expect.objectContaining({
          auth: {
            username: 'test-user',
            password: 'test-pass'
          },
          timeout: 2000
        })
      );
    });

    test('should fail when Orthanc is unreachable', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await healthChecker.checkOrthancConnectivity();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Orthanc connectivity failed');
      expect(result.details.error).toBe('ECONNREFUSED');
    });

    test('should fail when Orthanc returns non-200 status', async () => {
      axios.get.mockResolvedValue({
        status: 500,
        data: null
      });

      const result = await healthChecker.checkOrthancConnectivity();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('not responding properly');
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ETIMEDOUT';
      axios.get.mockRejectedValue(timeoutError);

      const result = await healthChecker.checkOrthancConnectivity();

      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBe('ETIMEDOUT');
    });
  });

  describe('Database Connectivity Check', () => {
    test('should pass when database is connected', async () => {
      mongoose.connection.readyState = 1; // connected
      mongoose.connection.host = 'test-mongo';
      mongoose.connection.name = 'test-db';
      mongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({})
        })
      };

      const result = await healthChecker.checkDatabaseConnectivity();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Database is connected and responsive');
      expect(result.details.state).toBe(1);
      expect(result.details.host).toBe('test-mongo');
      expect(result.details.name).toBe('test-db');
    });

    test('should fail when database is disconnected', async () => {
      mongoose.connection.readyState = 0; // disconnected

      const result = await healthChecker.checkDatabaseConnectivity();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Database is not connected');
      expect(result.details.state).toBe(0);
    });

    test('should fail when database ping fails', async () => {
      mongoose.connection.readyState = 1; // connected
      mongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      };

      const result = await healthChecker.checkDatabaseConnectivity();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Database connectivity failed');
      expect(result.details.error).toBe('Database error');
    });
  });

  describe('Webhook Endpoint Check', () => {
    test('should pass when webhook endpoint is responding', async () => {
      axios.get.mockResolvedValue({
        status: 200
      });

      const result = await healthChecker.checkWebhookEndpoint();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Webhook endpoint is responding');
      expect(result.details.statusCode).toBe(200);
      expect(result.details.url).toBe('http://test-webhook:8001');
    });

    test('should fail when webhook endpoint is unreachable', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await healthChecker.checkWebhookEndpoint();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Webhook endpoint check failed');
      expect(result.details.error).toBe('ECONNREFUSED');
    });
  });

  describe('Worker Liveness Check', () => {
    test('should pass when worker process is alive', async () => {
      // Mock process methods
      const originalMemoryUsage = process.memoryUsage;
      const originalUptime = process.uptime;
      const originalPid = process.pid;
      
      process.memoryUsage = jest.fn(() => ({
        rss: 50 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        heapTotal: 40 * 1024 * 1024
      }));
      process.uptime = jest.fn(() => 3600);
      process.pid = 12345;

      const result = await healthChecker.checkWorkerLiveness();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Worker process is alive and responsive');
      expect(result.details.uptime).toBe(3600);
      expect(result.details.pid).toBe(12345);
      expect(result.details.memoryUsage.rss).toBe('50MB');

      // Restore original methods
      process.memoryUsage = originalMemoryUsage;
      process.uptime = originalUptime;
      process.pid = originalPid;
    });
  });  de
scribe('System Resources Check', () => {
    test('should pass when system resources are healthy', async () => {
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;
      
      process.memoryUsage = jest.fn(() => ({
        rss: 100 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024
      }));
      process.cpuUsage = jest.fn(() => ({
        user: 1000000,
        system: 500000
      }));

      const result = await healthChecker.checkSystemResources();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('System resources are within normal limits');
      expect(result.details.memory.heapUsedPercent).toBe(60); // 30/50 * 100

      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
    });

    test('should warn when memory usage is high', async () => {
      const originalMemoryUsage = process.memoryUsage;
      
      process.memoryUsage = jest.fn(() => ({
        rss: 100 * 1024 * 1024,
        heapUsed: 85 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024
      }));

      const result = await healthChecker.checkSystemResources();

      expect(result.status).toBe('warning');
      expect(result.message).toContain('System resources are under pressure');
      expect(result.details.memory.heapUsedPercent).toBe(85);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Health Check Execution', () => {
    test('should run all health checks', async () => {
      // Mock all external dependencies
      axios.get.mockResolvedValue({ status: 200, data: { Version: '1.9.7' } });
      mongoose.connection.readyState = 1;
      mongoose.connection.db = {
        admin: () => ({ ping: jest.fn().mockResolvedValue({}) })
      };

      await healthChecker.runAllChecks();

      expect(healthChecker.healthStatus.overall).toBeDefined();
      expect(healthChecker.healthStatus.checks).toBeDefined();
      expect(healthChecker.healthStatus.lastUpdate).toBeDefined();
      expect(healthChecker.healthStatus.summary).toBeDefined();
    });

    test('should handle partial check failures', async () => {
      // Mock mixed results
      axios.get
        .mockResolvedValueOnce({ status: 200, data: { Version: '1.9.7' } }) // Orthanc OK
        .mockRejectedValueOnce(new Error('Webhook failed')); // Webhook fails
      
      mongoose.connection.readyState = 1;
      mongoose.connection.db = {
        admin: () => ({ ping: jest.fn().mockResolvedValue({}) })
      };

      await healthChecker.runAllChecks();

      expect(healthChecker.healthStatus.overall).toBe('critical');
      expect(healthChecker.healthStatus.checks.orthanc.status).toBe('healthy');
      expect(healthChecker.healthStatus.checks.webhook.status).toBe('unhealthy');
    });

    test('should update metrics after health checks', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { Version: '1.9.7' } });
      mongoose.connection.readyState = 1;
      mongoose.connection.db = {
        admin: () => ({ ping: jest.fn().mockResolvedValue({}) })
      };

      await healthChecker.runAllChecks();

      expect(mockMetricsCollector.updateOrthancConnectivity).toHaveBeenCalledWith(1);
      expect(mockMetricsCollector.updateDatabaseConnectivity).toHaveBeenCalledWith(1);
    });
  });

  describe('Health Check Scheduling', () => {
    test('should start periodic health checks', () => {
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;

      healthChecker.start();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1000 // checkInterval from config
      );

      global.setInterval = originalSetInterval;
    });

    test('should stop periodic health checks', () => {
      const originalClearInterval = global.clearInterval;
      const mockClearInterval = jest.fn();
      global.clearInterval = mockClearInterval;

      // Start then stop
      healthChecker.checkInterval = 'mock-interval-id';
      healthChecker.stop();

      expect(mockClearInterval).toHaveBeenCalledWith('mock-interval-id');
      expect(healthChecker.checkInterval).toBeNull();

      global.clearInterval = originalClearInterval;
    });
  });

  describe('Health Status Reporting', () => {
    test('should return current health status', () => {
      healthChecker.healthStatus = {
        overall: 'healthy',
        checks: { orthanc: { status: 'healthy' } },
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      const status = healthChecker.getHealthStatus();

      expect(status.overall).toBe('healthy');
      expect(status.checks.orthanc.status).toBe('healthy');
      expect(status.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should return specific check status', () => {
      healthChecker.healthStatus = {
        checks: {
          orthanc: { status: 'healthy', message: 'OK' },
          database: { status: 'unhealthy', message: 'Failed' }
        }
      };

      const orthancStatus = healthChecker.getCheckStatus('orthanc');
      const databaseStatus = healthChecker.getCheckStatus('database');
      const unknownStatus = healthChecker.getCheckStatus('unknown');

      expect(orthancStatus.status).toBe('healthy');
      expect(databaseStatus.status).toBe('unhealthy');
      expect(unknownStatus).toBeNull();
    });
  });

  describe('Single Check Execution', () => {
    test('should run single orthanc check', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { Version: '1.9.7' } });

      const result = await healthChecker.runSingleCheck('orthanc');

      expect(result.status).toBe('healthy');
      expect(axios.get).toHaveBeenCalledWith(
        'http://test-orthanc:8042/system',
        expect.any(Object)
      );
    });

    test('should throw error for unknown check', async () => {
      await expect(healthChecker.runSingleCheck('unknown')).rejects.toThrow(
        'Unknown health check: unknown'
      );
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getHealthChecker', () => {
      const instance1 = getHealthChecker();
      const instance2 = getHealthChecker();

      expect(instance1).toBe(instance2);
    });

    test('should initialize singleton with config', () => {
      const config = { orthancUrl: 'http://custom:8042' };
      const instance = getHealthChecker(config);

      expect(instance).toBeInstanceOf(HealthChecker);
      expect(instance.config.orthancUrl).toBe('http://custom:8042');
    });
  });

  describe('Error Handling', () => {
    test('should handle check execution errors gracefully', async () => {
      // Mock all checks to throw errors
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force an error in runAllChecks
      healthChecker.checkOrthancConnectivity = jest.fn().mockRejectedValue(new Error('Test error'));

      await healthChecker.runAllChecks();

      expect(healthChecker.healthStatus.overall).toBe('critical');
      expect(console.error).toHaveBeenCalled();

      console.error = originalConsoleError;
    });

    test('should handle timer errors gracefully', async () => {
      mockMetricsCollector.startTimer.mockReturnValue({
        end: jest.fn().mockImplementation(() => {
          throw new Error('Timer error');
        })
      });

      const result = await healthChecker.checkOrthancConnectivity();

      // Should still return a result despite timer error
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });
});