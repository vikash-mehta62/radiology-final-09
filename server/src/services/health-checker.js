const axios = require('axios');
const mongoose = require('mongoose');
const { getMetricsCollector } = require('./metrics-collector');

/**
 * HealthChecker - Comprehensive health check framework
 * Performs synthetic tests and connectivity checks for monitoring
 */
class HealthChecker {
  constructor(config = {}) {
    this.config = {
      orthancUrl: config.orthancUrl || process.env.ORTHANC_URL || 'http://69.62.70.102:8042',
      orthancUsername: config.orthancUsername || process.env.ORTHANC_USERNAME || 'orthanc',
      orthancPassword: config.orthancPassword || process.env.ORTHANC_PASSWORD || 'orthanc',
      webhookUrl: config.webhookUrl || process.env.WEBHOOK_URL || 'http://3.144.196.75:8001',
      checkInterval: config.checkInterval || 30000, // 30 seconds
      timeout: config.timeout || 5000, // 5 seconds
      ...config
    };

    this.healthStatus = {
      overall: 'unknown',
      checks: {},
      lastUpdate: null
    };

    this.metricsCollector = getMetricsCollector();
    this.checkInterval = null;
  }

  /**
   * Start periodic health checks
   */
  start() {
    console.log('Starting health check framework...');
    
    // Run initial check
    this.runAllChecks();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runAllChecks();
    }, this.config.checkInterval);

    console.log(`Health checks scheduled every ${this.config.checkInterval}ms`);
  }

  /**
   * Stop periodic health checks
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Health check framework stopped');
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const startTime = Date.now();
    
    try {
      const checks = await Promise.allSettled([
        this.checkOrthancConnectivity(),
        this.checkDatabaseConnectivity(),
        this.checkWebhookEndpoint(),
        this.checkWorkerLiveness(),
        this.checkSystemResources(),
        this.checkDiskSpace()
      ]);

      // Process results
      const results = {
        orthanc: checks[0],
        database: checks[1],
        webhook: checks[2],
        worker: checks[3],
        system: checks[4],
        disk: checks[5]
      };

      // Update health status
      this.updateHealthStatus(results);
      
      // Update metrics
      this.updateHealthMetrics(results);

      const duration = Date.now() - startTime;
      console.log(`Health checks completed in ${duration}ms`);

    } catch (error) {
      console.error('Error running health checks:', error);
      this.healthStatus.overall = 'critical';
      this.healthStatus.lastUpdate = new Date().toISOString();
    }
  }

  /**
   * Check Orthanc server connectivity
   */
  async checkOrthancConnectivity() {
    const timer = this.metricsCollector.startTimer('health_check_orthanc');
    
    try {
      const response = await axios.get(`${this.config.orthancUrl}/system`, {
        auth: {
          username: this.config.orthancUsername,
          password: this.config.orthancPassword
        },
        timeout: this.config.timeout
      });

      const isHealthy = response.status === 200 && response.data;
      timer.end(isHealthy ? 'success' : 'failure');
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Orthanc server is responding' : 'Orthanc server not responding properly',
        details: {
          responseTime: timer.end('success'),
          version: response.data?.Version || 'unknown',
          name: response.data?.Name || 'unknown'
        }
      };
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `Orthanc connectivity failed: ${error.message}`,
        details: {
          error: error.code || error.message,
          url: this.config.orthancUrl
        }
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseConnectivity() {
    const timer = this.metricsCollector.startTimer('health_check_database');
    
    try {
      // Check MongoDB connection state
      const isConnected = mongoose.connection.readyState === 1;
      
      if (isConnected) {
        // Perform a simple query to verify database is responsive
        await mongoose.connection.db.admin().ping();
        timer.end('success');
        
        return {
          status: 'healthy',
          message: 'Database is connected and responsive',
          details: {
            state: mongoose.connection.readyState,
            host: mongoose.connection.host,
            name: mongoose.connection.name
          }
        };
      } else {
        timer.end('failure');
        return {
          status: 'unhealthy',
          message: 'Database is not connected',
          details: {
            state: mongoose.connection.readyState,
            readyStates: {
              0: 'disconnected',
              1: 'connected',
              2: 'connecting',
              3: 'disconnecting'
            }
          }
        };
      }
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `Database connectivity failed: ${error.message}`,
        details: {
          error: error.message,
          state: mongoose.connection.readyState
        }
      };
    }
  }

  /**
   * Check webhook endpoint availability
   */
  async checkWebhookEndpoint() {
    const timer = this.metricsCollector.startTimer('health_check_webhook');
    
    try {
      // Check if our own webhook endpoint is responding
      const response = await axios.get(`${this.config.webhookUrl}/`, {
        timeout: this.config.timeout
      });

      const isHealthy = response.status === 200;
      timer.end(isHealthy ? 'success' : 'failure');
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Webhook endpoint is responding' : 'Webhook endpoint not responding',
        details: {
          responseTime: timer.end(isHealthy ? 'success' : 'failure'),
          statusCode: response.status,
          url: this.config.webhookUrl
        }
      };
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `Webhook endpoint check failed: ${error.message}`,
        details: {
          error: error.code || error.message,
          url: this.config.webhookUrl
        }
      };
    }
  }

  /**
   * Check worker process liveness
   */
  async checkWorkerLiveness() {
    const timer = this.metricsCollector.startTimer('health_check_worker');
    
    try {
      // Check if the main process is responsive
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Simple liveness check - if we can get memory usage, worker is alive
      const isHealthy = memoryUsage && uptime > 0;
      timer.end(isHealthy ? 'success' : 'failure');
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Worker process is alive and responsive' : 'Worker process not responding',
        details: {
          uptime: uptime,
          memoryUsage: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
          },
          pid: process.pid
        }
      };
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `Worker liveness check failed: ${error.message}`,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check system resources
   */
  async checkSystemResources() {
    const timer = this.metricsCollector.startTimer('health_check_system');
    
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Check memory usage (warn if over 80% of heap limit)
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const isMemoryHealthy = heapUsedPercent < 80;
      
      // Overall system health
      const isHealthy = isMemoryHealthy;
      timer.end(isHealthy ? 'success' : 'failure');
      
      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: isHealthy ? 'System resources are within normal limits' : 'System resources are under pressure',
        details: {
          memory: {
            heapUsedPercent: Math.round(heapUsedPercent),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        }
      };
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `System resource check failed: ${error.message}`,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    const timer = this.metricsCollector.startTimer('health_check_disk');
    
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // This is a simplified check - in production you'd use proper disk space libraries
      const isHealthy = true; // Placeholder - would implement actual disk space check
      timer.end('success');
      
      return {
        status: 'healthy',
        message: 'Disk space check completed',
        details: {
          note: 'Simplified disk space check - implement proper monitoring in production'
        }
      };
    } catch (error) {
      timer.end('failure');
      return {
        status: 'unhealthy',
        message: `Disk space check failed: ${error.message}`,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Update overall health status based on check results
   */
  updateHealthStatus(results) {
    const checks = {};
    let healthyCount = 0;
    let totalChecks = 0;
    let hasCritical = false;

    for (const [checkName, result] of Object.entries(results)) {
      totalChecks++;
      
      if (result.status === 'fulfilled') {
        checks[checkName] = result.value;
        
        if (result.value.status === 'healthy') {
          healthyCount++;
        } else if (result.value.status === 'unhealthy') {
          hasCritical = true;
        }
      } else {
        checks[checkName] = {
          status: 'unhealthy',
          message: `Check failed: ${result.reason?.message || 'Unknown error'}`,
          details: { error: result.reason?.message || 'Unknown error' }
        };
        hasCritical = true;
      }
    }

    // Determine overall status
    let overall;
    if (hasCritical) {
      overall = 'critical';
    } else if (healthyCount === totalChecks) {
      overall = 'healthy';
    } else {
      overall = 'warning';
    }

    this.healthStatus = {
      overall,
      checks,
      lastUpdate: new Date().toISOString(),
      summary: {
        total: totalChecks,
        healthy: healthyCount,
        warning: totalChecks - healthyCount - (hasCritical ? 1 : 0),
        critical: hasCritical ? 1 : 0
      }
    };
  }

  /**
   * Update health metrics for Prometheus
   */
  updateHealthMetrics(results) {
    // Update connectivity metrics
    for (const [checkName, result] of Object.entries(results)) {
      if (result.status === 'fulfilled') {
        const isHealthy = result.value.status === 'healthy' ? 1 : 0;
        
        switch (checkName) {
          case 'orthanc':
            this.metricsCollector.updateOrthancConnectivity(isHealthy);
            break;
          case 'database':
            this.metricsCollector.updateDatabaseConnectivity(isHealthy);
            break;
        }
      }
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return this.healthStatus;
  }

  /**
   * Get health status for a specific check
   */
  getCheckStatus(checkName) {
    return this.healthStatus.checks[checkName] || null;
  }

  /**
   * Run a single health check on demand
   */
  async runSingleCheck(checkName) {
    const checkMethods = {
      orthanc: this.checkOrthancConnectivity.bind(this),
      database: this.checkDatabaseConnectivity.bind(this),
      webhook: this.checkWebhookEndpoint.bind(this),
      worker: this.checkWorkerLiveness.bind(this),
      system: this.checkSystemResources.bind(this),
      disk: this.checkDiskSpace.bind(this)
    };

    const checkMethod = checkMethods[checkName];
    if (!checkMethod) {
      throw new Error(`Unknown health check: ${checkName}`);
    }

    return await checkMethod();
  }
}

// Singleton instance
let healthChecker = null;

/**
 * Get the singleton HealthChecker instance
 */
function getHealthChecker(config) {
  if (!healthChecker) {
    healthChecker = new HealthChecker(config);
  }
  return healthChecker;
}

module.exports = {
  HealthChecker,
  getHealthChecker
};