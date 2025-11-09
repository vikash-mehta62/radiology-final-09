/**
 * Health Check System
 * Monitors system health and readiness for the reporting system
 */

interface HealthCheckResult {
  ok: boolean;
  details: string[];
  timestamp: string;
  duration: number; // milliseconds
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
}

/**
 * Check API reachability
 */
async function checkAPIReachability(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      return {
        name: 'API',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        message: `API reachable (${Math.round(responseTime)}ms)`,
        responseTime,
      };
    } else {
      return {
        name: 'API',
        status: 'unhealthy',
        message: `API returned ${response.status}`,
        responseTime,
      };
    }
  } catch (err) {
    const responseTime = performance.now() - startTime;
    return {
      name: 'API',
      status: 'unhealthy',
      message: `API unreachable: ${err instanceof Error ? err.message : 'Unknown error'}`,
      responseTime,
    };
  }
}

/**
 * Check templates availability
 */
async function checkTemplates(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    const response = await fetch('/api/templates', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      const templates = await response.json();
      const count = Array.isArray(templates) ? templates.length : 0;
      
      return {
        name: 'Templates',
        status: count > 0 ? 'healthy' : 'degraded',
        message: `${count} templates available`,
        responseTime,
      };
    } else {
      return {
        name: 'Templates',
        status: 'unhealthy',
        message: `Templates endpoint returned ${response.status}`,
        responseTime,
      };
    }
  } catch (err) {
    const responseTime = performance.now() - startTime;
    return {
      name: 'Templates',
      status: 'unhealthy',
      message: `Templates check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      responseTime,
    };
  }
}

/**
 * Check reports CRUD operations (mock in tests)
 */
async function checkReportsCRUD(): Promise<ServiceHealth> {
  const startTime = performance.now();
  
  try {
    // Simple check: try to fetch reports list
    const response = await fetch('/api/reports?limit=1', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      return {
        name: 'Reports CRUD',
        status: 'healthy',
        message: 'Reports endpoint operational',
        responseTime,
      };
    } else if (response.status === 401 || response.status === 403) {
      // Auth required is still "healthy" - endpoint is working
      return {
        name: 'Reports CRUD',
        status: 'healthy',
        message: 'Reports endpoint operational (auth required)',
        responseTime,
      };
    } else {
      return {
        name: 'Reports CRUD',
        status: 'unhealthy',
        message: `Reports endpoint returned ${response.status}`,
        responseTime,
      };
    }
  } catch (err) {
    const responseTime = performance.now() - startTime;
    return {
      name: 'Reports CRUD',
      status: 'unhealthy',
      message: `Reports check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      responseTime,
    };
  }
}

/**
 * Check browser capabilities
 */
function checkBrowserCapabilities(): ServiceHealth {
  const startTime = performance.now();
  const issues: string[] = [];
  
  // Check required APIs
  if (!window.localStorage) {
    issues.push('localStorage not available');
  }
  
  if (!window.sessionStorage) {
    issues.push('sessionStorage not available');
  }
  
  if (!window.fetch) {
    issues.push('fetch API not available');
  }
  
  if (!window.CustomEvent) {
    issues.push('CustomEvent not available');
  }
  
  const responseTime = performance.now() - startTime;
  
  if (issues.length === 0) {
    return {
      name: 'Browser',
      status: 'healthy',
      message: 'All required browser APIs available',
      responseTime,
    };
  } else {
    return {
      name: 'Browser',
      status: 'unhealthy',
      message: `Missing APIs: ${issues.join(', ')}`,
      responseTime,
    };
  }
}

/**
 * Comprehensive reporting system health check
 */
export async function reportingHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const checks: ServiceHealth[] = [];
  
  // Run all health checks
  checks.push(checkBrowserCapabilities());
  checks.push(await checkAPIReachability());
  checks.push(await checkTemplates());
  checks.push(await checkReportsCRUD());
  
  const duration = performance.now() - startTime;
  
  // Determine overall health
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');
  
  const ok = !hasUnhealthy;
  
  const details = checks.map(c => {
    const icon = c.status === 'healthy' ? '✓' : c.status === 'degraded' ? '⚠' : '✗';
    return `${icon} ${c.name}: ${c.message}`;
  });
  
  return {
    ok,
    details,
    timestamp: new Date().toISOString(),
    duration: Math.round(duration),
  };
}

/**
 * Quick health check (API only)
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const apiHealth = await checkAPIReachability();
    return apiHealth.status !== 'unhealthy';
  } catch {
    return false;
  }
}

/**
 * Get detailed service health
 */
export async function getServiceHealth(): Promise<ServiceHealth[]> {
  return [
    checkBrowserCapabilities(),
    await checkAPIReachability(),
    await checkTemplates(),
    await checkReportsCRUD(),
  ];
}

/**
 * Monitor health continuously
 */
export class HealthMonitor {
  private interval: NodeJS.Timeout | null = null;
  private listeners: Array<(result: HealthCheckResult) => void> = [];
  
  constructor(private intervalMs: number = 60000) {}
  
  start(): void {
    if (this.interval) {
      console.warn('[Health Monitor] Already running');
      return;
    }
    
    // Initial check
    this.check();
    
    // Periodic checks
    this.interval = setInterval(() => {
      this.check();
    }, this.intervalMs);
    
    console.log(`[Health Monitor] Started (interval: ${this.intervalMs}ms)`);
  }
  
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Health Monitor] Stopped');
    }
  }
  
  private async check(): Promise<void> {
    try {
      const result = await reportingHealth();
      this.notifyListeners(result);
      
      if (!result.ok) {
        console.warn('[Health Monitor] System unhealthy:', result.details);
      }
    } catch (err) {
      console.error('[Health Monitor] Check failed:', err);
    }
  }
  
  onHealthChange(listener: (result: HealthCheckResult) => void): void {
    this.listeners.push(listener);
  }
  
  private notifyListeners(result: HealthCheckResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (err) {
        console.error('[Health Monitor] Listener error:', err);
      }
    });
  }
}

export default {
  reportingHealth,
  quickHealthCheck,
  getServiceHealth,
  HealthMonitor,
};
