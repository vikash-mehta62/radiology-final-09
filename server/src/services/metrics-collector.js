const client = require('prom-client');
const os = require('os');

/**
 * MetricsCollector - Prometheus metrics collection service
 * Collects and exposes system metrics for monitoring and alerting
 */
class MetricsCollector {
  constructor() {
    // Create a Registry to register the metrics
    this.register = new client.Registry();
    
    // Add default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'orthanc_bridge_'
    });

    // Initialize custom metrics
    this.initializeMetrics();
  }

  initializeMetrics() {
    // Queue depth metrics
    this.queueDepthGauge = new client.Gauge({
      name: 'orthanc_bridge_queue_depth',
      help: 'Current depth of processing queue',
      labelNames: ['queue_type']
    });

    // Processing time histogram
    this.processingTimeHistogram = new client.Histogram({
      name: 'orthanc_bridge_processing_time_seconds',
      help: 'Time taken to process DICOM instances',
      labelNames: ['operation_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    // Job failure counter
    this.jobFailureCounter = new client.Counter({
      name: 'orthanc_bridge_job_failures_total',
      help: 'Total number of job failures',
      labelNames: ['job_type', 'error_type']
    });

    // Instance processing counter
    this.instanceCounter = new client.Counter({
      name: 'orthanc_bridge_instances_processed_total',
      help: 'Total number of DICOM instances processed',
      labelNames: ['status', 'study_type']
    });

    // DICOM throughput gauge
    this.throughputGauge = new client.Gauge({
      name: 'orthanc_bridge_throughput_instances_per_minute',
      help: 'Current throughput in instances per minute',
      labelNames: ['time_window']
    });

    // Orthanc connectivity gauge
    this.orthancConnectivityGauge = new client.Gauge({
      name: 'orthanc_bridge_orthanc_connectivity',
      help: 'Orthanc server connectivity status (1=connected, 0=disconnected)'
    });

    // Database connectivity gauge
    this.dbConnectivityGauge = new client.Gauge({
      name: 'orthanc_bridge_database_connectivity',
      help: 'Database connectivity status (1=connected, 0=disconnected)'
    });

    // Webhook processing metrics
    this.webhookCounter = new client.Counter({
      name: 'orthanc_bridge_webhooks_received_total',
      help: 'Total number of webhooks received',
      labelNames: ['status', 'event_type']
    });

    // Migration metrics
    this.migrationCounter = new client.Counter({
      name: 'orthanc_bridge_migration_requests_total',
      help: 'Total number of migration requests by method',
      labelNames: ['method', 'status']
    });

    this.migrationPerformanceHistogram = new client.Histogram({
      name: 'orthanc_bridge_migration_performance_seconds',
      help: 'Performance comparison between Orthanc and Node decoding',
      labelNames: ['method', 'winner'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    // System resource metrics
    this.diskUsageGauge = new client.Gauge({
      name: 'orthanc_bridge_disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['mount_point']
    });

    // Register all custom metrics
    this.register.registerMetric(this.queueDepthGauge);
    this.register.registerMetric(this.processingTimeHistogram);
    this.register.registerMetric(this.jobFailureCounter);
    this.register.registerMetric(this.instanceCounter);
    this.register.registerMetric(this.throughputGauge);
    this.register.registerMetric(this.orthancConnectivityGauge);
    this.register.registerMetric(this.dbConnectivityGauge);
    this.register.registerMetric(this.webhookCounter);
    this.register.registerMetric(this.diskUsageGauge);
    this.register.registerMetric(this.migrationCounter);
    this.register.registerMetric(this.migrationPerformanceHistogram);

    // Initialize throughput tracking
    this.throughputTracker = {
      instances: [],
      lastMinute: 0,
      lastFiveMinutes: 0,
      lastHour: 0
    };

    // Start periodic metric collection
    this.startPeriodicCollection();
  }

  /**
   * Record queue depth for monitoring
   */
  recordQueueDepth(queueType, depth) {
    this.queueDepthGauge.set({ queue_type: queueType }, depth);
  }

  /**
   * Record processing time for an operation
   */
  recordProcessingTime(operationType, status, timeInSeconds) {
    this.processingTimeHistogram
      .labels(operationType, status)
      .observe(timeInSeconds);
  }

  /**
   * Record a job failure
   */
  recordJobFailure(jobType, errorType) {
    this.jobFailureCounter.inc({ job_type: jobType, error_type: errorType });
  }

  /**
   * Record instance processing
   */
  recordInstanceProcessed(status, studyType = 'unknown') {
    this.instanceCounter.inc({ status, study_type: studyType });
    
    // Track for throughput calculation
    const now = Date.now();
    this.throughputTracker.instances.push(now);
    
    // Clean old entries (older than 1 hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    this.throughputTracker.instances = this.throughputTracker.instances
      .filter(timestamp => timestamp > oneHourAgo);
  }

  /**
   * Record webhook received
   */
  recordWebhookReceived(status, eventType) {
    this.webhookCounter.inc({ status, event_type: eventType });
  }

  /**
   * Update Orthanc connectivity status
   */
  updateOrthancConnectivity(isConnected) {
    this.orthancConnectivityGauge.set(isConnected ? 1 : 0);
  }

  /**
   * Update database connectivity status
   */
  updateDatabaseConnectivity(isConnected) {
    this.dbConnectivityGauge.set(isConnected ? 1 : 0);
  }

  /**
   * Calculate and update throughput metrics
   */
  updateThroughputMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    const lastMinuteCount = this.throughputTracker.instances
      .filter(timestamp => timestamp > oneMinuteAgo).length;
    
    const lastFiveMinutesCount = this.throughputTracker.instances
      .filter(timestamp => timestamp > fiveMinutesAgo).length;
    
    const lastHourCount = this.throughputTracker.instances
      .filter(timestamp => timestamp > oneHourAgo).length;

    this.throughputGauge.set({ time_window: '1m' }, lastMinuteCount);
    this.throughputGauge.set({ time_window: '5m' }, lastFiveMinutesCount / 5);
    this.throughputGauge.set({ time_window: '1h' }, lastHourCount / 60);
  }

  /**
   * Update system resource metrics
   */
  updateSystemMetrics() {
    // Update disk usage (simplified - in production you'd check actual mount points)
    const stats = require('fs').statSync('.');
    // Note: This is a simplified implementation. In production, you'd use proper disk usage libraries
    this.diskUsageGauge.set({ mount_point: '/' }, process.memoryUsage().heapUsed);
  }

  /**
   * Start periodic metric collection
   */
  startPeriodicCollection() {
    // Update throughput metrics every 30 seconds
    setInterval(() => {
      this.updateThroughputMetrics();
    }, 30000);

    // Update system metrics every minute
    setInterval(() => {
      this.updateSystemMetrics();
    }, 60000);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return await this.register.metrics();
  }

  /**
   * Get metrics as JSON for debugging
   */
  async getMetricsAsJSON() {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operationType) {
    const startTime = Date.now();
    
    return {
      end: (status = 'success') => {
        const duration = (Date.now() - startTime) / 1000;
        this.recordProcessingTime(operationType, status, duration);
        return duration;
      }
    };
  }

  /**
   * Record migration request
   * @param {string} method - 'orthanc' or 'node'
   * @param {string} status - 'success', 'error', 'fallback'
   */
  recordMigrationRequest(method, status) {
    this.migrationCounter.inc({ method, status });
  }

  /**
   * Record migration performance comparison
   * @param {string} method - 'orthanc' or 'node'
   * @param {string} winner - 'orthanc', 'node', or 'tie'
   * @param {number} duration - Duration in seconds
   */
  recordMigrationPerformance(method, winner, duration) {
    this.migrationPerformanceHistogram.observe({ method, winner }, duration);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.register.resetMetrics();
    this.throughputTracker = {
      instances: [],
      lastMinute: 0,
      lastFiveMinutes: 0,
      lastHour: 0
    };
  }
}

// Singleton instance
let metricsCollector = null;

/**
 * Get the singleton MetricsCollector instance
 */
function getMetricsCollector() {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

module.exports = {
  MetricsCollector,
  getMetricsCollector
};