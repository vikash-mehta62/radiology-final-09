/**
 * Environment Configuration
 * Type-safe access to environment variables
 */

export interface EnvironmentConfig {
  // API Configuration
  apiUrl: string
  backendUrl: string
  appName: string

  // Session Management
  sessionTimeout: number
  sessionWarningTime: number
  tokenRefreshInterval: number
  activityUpdateInterval: number

  // Notification Settings
  notificationSoundEnabled: boolean
  notificationBrowserEnabled: boolean
  notificationPollInterval: number
  notificationMaxRetries: number

  // Export Settings
  exportPollInterval: number
  exportTimeout: number
  exportMaxFileSize: number
  exportSupportedFormats: string[]

  // Signature Settings
  signatureMinPasswordLength: number
  signatureVerificationEnabled: boolean
  signatureAutoVerify: boolean

  // Feature Flags
  enableCriticalNotifications: boolean
  enableFdaSignatures: boolean
  enableExportSystem: boolean
  enableSessionMonitoring: boolean
  enableRealTimeUpdates: boolean

  // Security Settings
  enableCsrfProtection: boolean
  enableXssProtection: boolean
  enableContentSecurityPolicy: boolean

  // Performance Settings
  apiRetryMaxAttempts: number
  apiRetryDelay: number
  apiRetryBackoffMultiplier: number
  apiRequestTimeout: number

  // Logging Settings
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  enableErrorTracking: boolean
  enablePerformanceMonitoring: boolean
}

/**
 * Parse environment variable as boolean
 */
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Parse environment variable as number
 */
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Parse environment variable as array
 */
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

/**
 * Get environment configuration
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    // API Configuration
    apiUrl: import.meta.env.VITE_API_URL || 'http://3.144.196.75:8001',
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://3.144.196.75:8001',
    appName: import.meta.env.VITE_APP_NAME || 'Medical Viewer',

    // Session Management (default: 30 minutes timeout, 5 minutes warning)
    sessionTimeout: parseNumber(import.meta.env.VITE_SESSION_TIMEOUT, 30 * 60 * 1000),
    sessionWarningTime: parseNumber(import.meta.env.VITE_SESSION_WARNING_TIME, 5 * 60 * 1000),
    tokenRefreshInterval: parseNumber(import.meta.env.VITE_TOKEN_REFRESH_INTERVAL, 10 * 60 * 1000),
    activityUpdateInterval: parseNumber(import.meta.env.VITE_ACTIVITY_UPDATE_INTERVAL, 60 * 1000),

    // Notification Settings
    notificationSoundEnabled: parseBoolean(import.meta.env.VITE_NOTIFICATION_SOUND_ENABLED, true),
    notificationBrowserEnabled: parseBoolean(import.meta.env.VITE_NOTIFICATION_BROWSER_ENABLED, true),
    notificationPollInterval: parseNumber(import.meta.env.VITE_NOTIFICATION_POLL_INTERVAL, 30 * 1000),
    notificationMaxRetries: parseNumber(import.meta.env.VITE_NOTIFICATION_MAX_RETRIES, 3),

    // Export Settings
    exportPollInterval: parseNumber(import.meta.env.VITE_EXPORT_POLL_INTERVAL, 2000),
    exportTimeout: parseNumber(import.meta.env.VITE_EXPORT_TIMEOUT, 5 * 60 * 1000),
    exportMaxFileSize: parseNumber(import.meta.env.VITE_EXPORT_MAX_FILE_SIZE, 100 * 1024 * 1024),
    exportSupportedFormats: parseArray(import.meta.env.VITE_EXPORT_SUPPORTED_FORMATS, ['pdf', 'dicom-sr', 'fhir', 'txt']),

    // Signature Settings
    signatureMinPasswordLength: parseNumber(import.meta.env.VITE_SIGNATURE_MIN_PASSWORD_LENGTH, 8),
    signatureVerificationEnabled: parseBoolean(import.meta.env.VITE_SIGNATURE_VERIFICATION_ENABLED, true),
    signatureAutoVerify: parseBoolean(import.meta.env.VITE_SIGNATURE_AUTO_VERIFY, true),

    // Feature Flags
    enableCriticalNotifications: parseBoolean(import.meta.env.VITE_ENABLE_CRITICAL_NOTIFICATIONS, true),
    enableFdaSignatures: parseBoolean(import.meta.env.VITE_ENABLE_FDA_SIGNATURES, true),
    enableExportSystem: parseBoolean(import.meta.env.VITE_ENABLE_EXPORT_SYSTEM, true),
    enableSessionMonitoring: parseBoolean(import.meta.env.VITE_ENABLE_SESSION_MONITORING, true),
    enableRealTimeUpdates: parseBoolean(import.meta.env.VITE_ENABLE_REAL_TIME_UPDATES, true),

    // Security Settings
    enableCsrfProtection: parseBoolean(import.meta.env.VITE_ENABLE_CSRF_PROTECTION, true),
    enableXssProtection: parseBoolean(import.meta.env.VITE_ENABLE_XSS_PROTECTION, true),
    enableContentSecurityPolicy: parseBoolean(import.meta.env.VITE_ENABLE_CONTENT_SECURITY_POLICY, true),

    // Performance Settings
    apiRetryMaxAttempts: parseNumber(import.meta.env.VITE_API_RETRY_MAX_ATTEMPTS, 3),
    apiRetryDelay: parseNumber(import.meta.env.VITE_API_RETRY_DELAY, 1000),
    apiRetryBackoffMultiplier: parseNumber(import.meta.env.VITE_API_RETRY_BACKOFF_MULTIPLIER, 2),
    apiRequestTimeout: parseNumber(import.meta.env.VITE_API_REQUEST_TIMEOUT, 30000),

    // Logging Settings
    logLevel: (import.meta.env.VITE_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    enableErrorTracking: parseBoolean(import.meta.env.VITE_ENABLE_ERROR_TRACKING, true),
    enablePerformanceMonitoring: parseBoolean(import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING, true),
  }
}

// Export singleton instance
export const config = getEnvironmentConfig()

// Export individual configurations for convenience
export const {
  apiUrl,
  backendUrl,
  appName,
  sessionTimeout,
  sessionWarningTime,
  tokenRefreshInterval,
  activityUpdateInterval,
  notificationSoundEnabled,
  notificationBrowserEnabled,
  notificationPollInterval,
  notificationMaxRetries,
  exportPollInterval,
  exportTimeout,
  exportMaxFileSize,
  exportSupportedFormats,
  signatureMinPasswordLength,
  signatureVerificationEnabled,
  signatureAutoVerify,
  enableCriticalNotifications,
  enableFdaSignatures,
  enableExportSystem,
  enableSessionMonitoring,
  enableRealTimeUpdates,
  enableCsrfProtection,
  enableXssProtection,
  enableContentSecurityPolicy,
  apiRetryMaxAttempts,
  apiRetryDelay,
  apiRetryBackoffMultiplier,
  apiRequestTimeout,
  logLevel,
  enableErrorTracking,
  enablePerformanceMonitoring,
} = config

export default config
