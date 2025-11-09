/**
 * Metrics Collection System
 * Provides counter, gauge, and histogram metrics for observability
 */

export interface MetricTags {
  [key: string]: string | number | boolean;
}

export interface MetricData {
  name: string;
  value: number;
  tags: MetricTags;
  timestamp: number;
  type: 'counter' | 'gauge' | 'histogram';
}

export interface MetricsCollector {
  collect(metric: MetricData): void;
  flush(): void;
}

/**
 * Global metrics collector hook
 * Can be set by external monitoring systems (e.g., Datadog, Prometheus)
 */
declare global {
  interface Window {
    __METRICS_COLLECTOR?: MetricsCollector;
  }
}

/**
 * Internal metrics buffer for development
 */
class MetricsBuffer {
  private buffer: MetricData[] = [];
  private maxSize = 1000;

  add(metric: MetricData): void {
    this.buffer.push(metric);
    
    // Prevent memory leak
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Metrics]', metric.type, metric.name, metric.value, metric.tags);
    }
  }

  getAll(): MetricData[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  getByName(name: string): MetricData[] {
    return this.buffer.filter(m => m.name === name);
  }
}

const metricsBuffer = new MetricsBuffer();

/**
 * Get default tags for all metrics
 */
function getDefaultTags(): MetricTags {
  return {
    env: import.meta.env.MODE || 'development',
    service: 'viewer',
  };
}

/**
 * Emit metric to collector
 */
function emitMetric(metric: MetricData): void {
  // Merge with default tags
  metric.tags = { ...getDefaultTags(), ...metric.tags };

  // Add to internal buffer
  metricsBuffer.add(metric);

  // Send to external collector if available
  if (typeof window !== 'undefined' && window.__METRICS_COLLECTOR) {
    try {
      window.__METRICS_COLLECTOR.collect(metric);
    } catch (err) {
      console.error('[Metrics] Failed to send to collector:', err);
    }
  }
}

/**
 * Increment a counter metric
 * Counters always increase (e.g., request count, error count)
 */
export function counter(name: string, tags: MetricTags = {}, value: number = 1): void {
  emitMetric({
    name,
    value,
    tags,
    timestamp: Date.now(),
    type: 'counter',
  });
}

/**
 * Set a gauge metric
 * Gauges can go up or down (e.g., active users, queue size)
 */
export function gauge(name: string, value: number, tags: MetricTags = {}): void {
  emitMetric({
    name,
    value,
    tags,
    timestamp: Date.now(),
    type: 'gauge',
  });
}

/**
 * Record a histogram metric
 * Histograms track distributions (e.g., latency, response time)
 */
export function histogram(name: string, value: number, tags: MetricTags = {}): void {
  emitMetric({
    name,
    value,
    tags,
    timestamp: Date.now(),
    type: 'histogram',
  });
}

/**
 * Measure execution time of a function
 */
export function measure<T>(
  name: string,
  fn: () => T | Promise<T>,
  tags: MetricTags = {}
): T | Promise<T> {
  const start = performance.now();

  try {
    const result = fn();

    // Handle async functions
    if (result instanceof Promise) {
      return result
        .then(value => {
          const duration = performance.now() - start;
          histogram(name, duration, { ...tags, status: 'success' });
          return value;
        })
        .catch(error => {
          const duration = performance.now() - start;
          histogram(name, duration, { ...tags, status: 'error' });
          throw error;
        }) as T;
    }

    // Handle sync functions
    const duration = performance.now() - start;
    histogram(name, duration, { ...tags, status: 'success' });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    histogram(name, duration, { ...tags, status: 'error' });
    throw error;
  }
}

/**
 * Create a timer that can be stopped
 */
export function startTimer(name: string, tags: MetricTags = {}): () => void {
  const start = performance.now();

  return (additionalTags: MetricTags = {}) => {
    const duration = performance.now() - start;
    histogram(name, duration, { ...tags, ...additionalTags });
  };
}

/**
 * Get metrics buffer (for testing/debugging)
 */
export function getMetricsBuffer(): MetricData[] {
  return metricsBuffer.getAll();
}

/**
 * Clear metrics buffer
 */
export function clearMetricsBuffer(): void {
  metricsBuffer.clear();
}

/**
 * Get metrics by name
 */
export function getMetricsByName(name: string): MetricData[] {
  return metricsBuffer.getByName(name);
}

/**
 * Calculate statistics for histogram metrics
 */
export function calculateStats(metrics: MetricData[]): {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (metrics.length === 0) {
    return {
      count: 0,
      sum: 0,
      min: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const values = metrics.map(m => m.value).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const count = values.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * count) - 1;
    return values[Math.max(0, index)];
  };

  return {
    count,
    sum,
    min: values[0],
    max: values[count - 1],
    mean: sum / count,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

/**
 * Register external metrics collector
 */
export function registerMetricsCollector(collector: MetricsCollector): void {
  if (typeof window !== 'undefined') {
    window.__METRICS_COLLECTOR = collector;
    console.log('[Metrics] External collector registered');
  }
}

/**
 * Unregister external metrics collector
 */
export function unregisterMetricsCollector(): void {
  if (typeof window !== 'undefined') {
    delete window.__METRICS_COLLECTOR;
    console.log('[Metrics] External collector unregistered');
  }
}

/**
 * Common metric names (constants for consistency)
 */
export const METRICS = {
  // Autosave
  AUTOSAVE_ATTEMPT: 'autosave.attempt',
  AUTOSAVE_SUCCESS: 'autosave.success',
  AUTOSAVE_FAILURE: 'autosave.failure',
  AUTOSAVE_LATENCY: 'autosave.latency',
  AUTOSAVE_RETRY: 'autosave.retry',

  // Report operations
  REPORT_CREATE: 'report.create',
  REPORT_LOAD: 'report.load',
  REPORT_FINALIZE: 'report.finalize',
  REPORT_SIGN: 'report.sign',
  REPORT_EXPORT: 'report.export',
  REPORT_ADDENDUM: 'report.addendum',

  // Version conflicts
  VERSION_CONFLICT: 'version.conflict',
  VERSION_CONFLICT_RESOLVED: 'version.conflict.resolved',

  // API calls
  API_REQUEST: 'api.request',
  API_SUCCESS: 'api.success',
  API_ERROR: 'api.error',
  API_LATENCY: 'api.latency',

  // UI performance
  RENDER_TIME: 'ui.render.time',
  INTERACTION_LATENCY: 'ui.interaction.latency',
  PAGE_LOAD: 'ui.page.load',

  // Errors
  ERROR_RATE: 'error.rate',
  ERROR_COUNT: 'error.count',

  // Network
  NETWORK_OFFLINE: 'network.offline',
  NETWORK_ONLINE: 'network.online',
} as const;

export default {
  counter,
  gauge,
  histogram,
  measure,
  startTimer,
  getMetricsBuffer,
  clearMetricsBuffer,
  getMetricsByName,
  calculateStats,
  registerMetricsCollector,
  unregisterMetricsCollector,
  METRICS,
};
