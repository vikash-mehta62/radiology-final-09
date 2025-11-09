/**
 * Telemetry Listener
 * Captures telemetry events and sends them to backend/monitoring services
 */

import type { TelemetryEvent, ReportError } from '../utils/reportingUtils';

interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
}

class TelemetryListener {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private errorQueue: ReportError[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: import.meta.env.PROD || false,
      endpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT || '/api/telemetry',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    if (!this.config.enabled) {
      console.log('[Telemetry] Disabled in development mode');
      return;
    }

    // Listen for telemetry events
    window.addEventListener('telemetry', this.handleTelemetryEvent.bind(this));

    // Listen for error events
    window.addEventListener('reportError', this.handleErrorEvent.bind(this));

    // Start flush timer
    this.startFlushTimer();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    console.log('[Telemetry] Listener initialized');
  }

  private handleTelemetryEvent(event: Event): void {
    const customEvent = event as CustomEvent<TelemetryEvent>;
    const telemetryEvent = customEvent.detail;

    if (import.meta.env.DEV) {
      console.log('[Telemetry Event]', telemetryEvent);
    }

    this.eventQueue.push(telemetryEvent);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private handleErrorEvent(event: Event): void {
    const customEvent = event as CustomEvent<ReportError>;
    const errorEvent = customEvent.detail;

    if (import.meta.env.DEV) {
      console.error('[Error Event]', errorEvent);
    }

    this.errorQueue.push(errorEvent);

    // Flush errors immediately for critical severity
    if (errorEvent.severity === 'critical' || errorEvent.severity === 'high') {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0 && this.errorQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    const errors = [...this.errorQueue];

    // Clear queues
    this.eventQueue = [];
    this.errorQueue = [];

    try {
      // TODO: Implement actual backend endpoint
      // For now, this is a no-op stub that logs in development
      if (import.meta.env.DEV) {
        console.log('[Telemetry] Flushing events:', events.length, 'errors:', errors.length);
      }

      // Production implementation would send to backend:
      /*
      await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          events,
          errors,
          timestamp: new Date().toISOString(),
        }),
      });
      */
    } catch (err) {
      console.error('[Telemetry] Failed to flush:', err);
      // Re-queue events on failure (with limit to prevent memory issues)
      if (this.eventQueue.length < 100) {
        this.eventQueue.push(...events);
      }
      if (this.errorQueue.length < 100) {
        this.errorQueue.push(...errors);
      }
    }
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    window.removeEventListener('telemetry', this.handleTelemetryEvent.bind(this));
    window.removeEventListener('reportError', this.handleErrorEvent.bind(this));

    // Final flush
    this.flush();
  }
}

// Singleton instance
let telemetryListener: TelemetryListener | null = null;

export function initializeTelemetry(config?: Partial<TelemetryConfig>): void {
  if (telemetryListener) {
    console.warn('[Telemetry] Already initialized');
    return;
  }

  telemetryListener = new TelemetryListener(config);
}

export function destroyTelemetry(): void {
  if (telemetryListener) {
    telemetryListener.destroy();
    telemetryListener = null;
  }
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  initializeTelemetry();
}

export default TelemetryListener;
