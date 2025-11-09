/**
 * Feature Flags Configuration
 * Centralized feature flag management for gradual rollouts and A/B testing
 */

export interface FeatureFlags {
  REPORTING_UNIFIED: boolean;
  REPORTING_UNIFIED_ONLY: boolean;
  REPORTING_UNIFIED_PERCENT: number;
  REPORTING_LEGACY_KILL_DATE: string | null;
  REPORTING_AI_ANALYSIS: boolean;
  REPORTING_VOICE_DICTATION: boolean;
  REPORTING_SMART_TEMPLATES: boolean;
  REPORTING_EXPORT_PDF: boolean;
  REPORTING_EXPORT_DOCX: boolean;
  REPORTING_DIGITAL_SIGNATURE: boolean;
  REPORTING_ADDENDUM: boolean;
  REPORTING_PRIOR_AUTH: boolean;
  REPORTING_FOLLOWUP: boolean;
  PERFORMANCE_MONITORING: boolean;
  TELEMETRY_ENABLED: boolean;
}

// Runtime flags loaded from /flags.json or window.__FLAGS__
interface RuntimeFlags extends Partial<FeatureFlags> {}

declare global {
  interface Window {
    __FLAGS__?: RuntimeFlags;
  }
}

/**
 * Default feature flags
 * Override via environment variables: VITE_FEATURE_<FLAG_NAME>=true/false
 */
// Default flags (build-time)
const DEFAULT_FLAGS: FeatureFlags = {
  // Core reporting features
  REPORTING_UNIFIED: getEnvFlag('REPORTING_UNIFIED', true),
  REPORTING_UNIFIED_ONLY: getEnvFlag('REPORTING_UNIFIED_ONLY', false),
  REPORTING_UNIFIED_PERCENT: getEnvNumber('REPORTING_UNIFIED_PERCENT', 100),
  REPORTING_LEGACY_KILL_DATE: getEnvString('REPORTING_LEGACY_KILL_DATE', null),
  REPORTING_AI_ANALYSIS: getEnvFlag('REPORTING_AI_ANALYSIS', true),
  REPORTING_VOICE_DICTATION: getEnvFlag('REPORTING_VOICE_DICTATION', true),
  REPORTING_SMART_TEMPLATES: getEnvFlag('REPORTING_SMART_TEMPLATES', true),
  
  // Export features
  REPORTING_EXPORT_PDF: getEnvFlag('REPORTING_EXPORT_PDF', true),
  REPORTING_EXPORT_DOCX: getEnvFlag('REPORTING_EXPORT_DOCX', true),
  
  // Advanced features
  REPORTING_DIGITAL_SIGNATURE: getEnvFlag('REPORTING_DIGITAL_SIGNATURE', true),
  REPORTING_ADDENDUM: getEnvFlag('REPORTING_ADDENDUM', true),
  REPORTING_PRIOR_AUTH: getEnvFlag('REPORTING_PRIOR_AUTH', true),
  REPORTING_FOLLOWUP: getEnvFlag('REPORTING_FOLLOWUP', true),
  
  // Monitoring
  PERFORMANCE_MONITORING: getEnvFlag('PERFORMANCE_MONITORING', true),
  TELEMETRY_ENABLED: getEnvFlag('TELEMETRY_ENABLED', import.meta.env.PROD),
};

// Mutable runtime flags
export const FLAGS: FeatureFlags = { ...DEFAULT_FLAGS };

/**
 * Get feature flag from environment variable
 */
function getEnvFlag(name: string, defaultValue: boolean): boolean {
  const envKey = `VITE_FEATURE_${name}`;
  const envValue = import.meta.env[envKey];
  
  if (envValue === undefined) {
    return defaultValue;
  }
  
  return envValue === 'true' || envValue === '1' || envValue === true;
}

/**
 * Get string value from environment variable
 */
function getEnvString(name: string, defaultValue: string | null): string | null {
  const envKey = `VITE_FEATURE_${name}`;
  const envValue = import.meta.env[envKey];
  
  if (envValue === undefined || envValue === '') {
    return defaultValue;
  }
  
  return envValue;
}

/**
 * Get number value from environment variable
 */
function getEnvNumber(name: string, defaultValue: number): number {
  const envKey = `VITE_FEATURE_${name}`;
  const envValue = import.meta.env[envKey];
  
  if (envValue === undefined || envValue === '') {
    return defaultValue;
  }
  
  const parsed = parseInt(envValue, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return FLAGS[feature] === true;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Runtime feature flag override (for testing/debugging)
 * Only works in development mode
 */
export function setFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void {
  if (import.meta.env.PROD) {
    console.warn('[Feature Flags] Cannot override flags in production');
    return;
  }
  
  FLAGS[feature] = enabled;
  console.log(`[Feature Flags] ${feature} = ${enabled}`);
}

/**
 * Check if legacy reporting should be disabled
 */
export function isLegacyKilled(): boolean {
  if (FLAGS.REPORTING_UNIFIED_ONLY) {
    return true;
  }
  
  if (FLAGS.REPORTING_LEGACY_KILL_DATE) {
    const killDate = new Date(FLAGS.REPORTING_LEGACY_KILL_DATE);
    const now = new Date();
    return now >= killDate;
  }
  
  return false;
}

/**
 * Warn if legacy modules are requested after kill date
 */
export function warnLegacyUsage(moduleName: string): void {
  if (isLegacyKilled()) {
    console.warn(
      `[Legacy Warning] Module "${moduleName}" is deprecated and will be removed. ` +
      `Please migrate to unified reporting. Kill date: ${FLAGS.REPORTING_LEGACY_KILL_DATE || 'IMMEDIATE'}`
    );
  }
}

/**
 * Runtime flag loading
 */
let flagsLoaded = false;
const flagsLoadedCallbacks: Array<() => void> = [];

/**
 * Load runtime flags from window.__FLAGS__ or /flags.json
 */
export async function loadRuntimeFlags(): Promise<void> {
  if (flagsLoaded) return;

  try {
    // Check window.__FLAGS__ first
    if (typeof window !== 'undefined' && window.__FLAGS__) {
      Object.assign(FLAGS, window.__FLAGS__);
      console.log('[Feature Flags] Loaded from window.__FLAGS__');
      flagsLoaded = true;
      notifyFlagsLoaded();
      return;
    }

    // Try loading from /flags.json
    const response = await fetch('/flags.json', {
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const runtimeFlags = await response.json();
      Object.assign(FLAGS, runtimeFlags);
      console.log('[Feature Flags] Loaded from /flags.json', runtimeFlags);
    } else {
      console.log('[Feature Flags] Using defaults (flags.json not found)');
    }
  } catch (err) {
    console.log('[Feature Flags] Using defaults (failed to load runtime flags)');
  } finally {
    flagsLoaded = true;
    notifyFlagsLoaded();
  }
}

/**
 * Register callback for when flags are loaded
 */
export function onFlagsLoaded(callback: () => void): void {
  if (flagsLoaded) {
    callback();
  } else {
    flagsLoadedCallbacks.push(callback);
  }
}

/**
 * Notify all callbacks that flags are loaded
 */
function notifyFlagsLoaded(): void {
  flagsLoadedCallbacks.forEach(cb => {
    try {
      cb();
    } catch (err) {
      console.error('[Feature Flags] Callback error:', err);
    }
  });
  flagsLoadedCallbacks.length = 0;
}

/**
 * Get a specific flag value
 */
export function getFlag<K extends keyof FeatureFlags>(name: K): FeatureFlags[K] {
  return FLAGS[name];
}

/**
 * Check if user is in rollout percentage
 */
export function isUserInRollout(): boolean {
  const percent = FLAGS.REPORTING_UNIFIED_PERCENT;
  
  if (percent >= 100) return true;
  if (percent <= 0) return false;

  // Deterministic sampling based on user ID or session
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const userId = user._id || user.id || '';
      
      // Simple hash to number 0-99
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash = hash & hash;
      }
      const bucket = Math.abs(hash) % 100;
      
      return bucket < percent;
    }
  } catch (err) {
    // Fallback to random sampling
  }

  // Random sampling if no user ID
  return Math.random() * 100 < percent;
}

/**
 * Auto-load flags on module import
 */
if (typeof window !== 'undefined') {
  loadRuntimeFlags();
}

/**
 * Log current feature flags (development only)
 */
if (import.meta.env.DEV) {
  onFlagsLoaded(() => {
    console.log('[Feature Flags] Current configuration:', FLAGS);
    
    if (isLegacyKilled()) {
      console.warn('[Feature Flags] Legacy reporting is DISABLED');
    }
  });
}

export default FLAGS;
