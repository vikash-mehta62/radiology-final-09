/**
 * PACS Security Configuration
 * Whitelist/blacklist for modalities, IPs, and access control
 */

module.exports = {
  // ============================================================================
  // WHITELIST: Allowed Modalities (AE Titles)
  // ============================================================================
  allowedModalities: {
    'CT_SCANNER_1': {
      aet: 'CT_SCANNER_1',
      description: 'CT Scanner Room 1',
      type: 'CT',
      ip: '192.168.1.100',
      enabled: true,
      maxRequestsPerMinute: 100
    },
    'CT_SCANNER_2': {
      aet: 'CT_SCANNER_2',
      description: 'CT Scanner Room 2',
      type: 'CT',
      ip: '192.168.1.101',
      enabled: true,
      maxRequestsPerMinute: 100
    },
    'MRI_MAIN': {
      aet: 'MRI_MAIN',
      description: 'Siemens MRI Main',
      type: 'MR',
      ip: '192.168.1.102',
      enabled: true,
      maxRequestsPerMinute: 100
    },
    'XRAY_ROOM_A': {
      aet: 'XRAY_ROOM_A',
      description: 'X-Ray Room A',
      type: 'CR',
      ip: '192.168.1.103',
      enabled: true,
      maxRequestsPerMinute: 100
    },
    'XRAY_ROOM_B': {
      aet: 'XRAY_ROOM_B',
      description: 'X-Ray Room B',
      type: 'DX',
      ip: '192.168.1.104',
      enabled: true,
      maxRequestsPerMinute: 100
    },
    'ULTRASOUND_1': {
      aet: 'ULTRASOUND_1',
      description: 'Ultrasound Room 1',
      type: 'US',
      ip: '192.168.1.105',
      enabled: true,
      maxRequestsPerMinute: 50
    }
  },

  // ============================================================================
  // BLACKLIST: Blocked Modalities (Patterns)
  // ============================================================================
  blockedModalities: [
    'PRINTER_*',        // All printers
    'PRINT_*',          // Print servers
    'WORKSTATION_*',    // All workstations
    'WS_*',             // Workstation abbreviation
    'ARCHIVE_*',        // Archive servers
    'BACKUP_*',         // Backup systems
    'QA_*',             // QA workstations
    'TEACHING_*'        // Teaching stations
  ],

  // ============================================================================
  // IP WHITELIST: Allowed IP Addresses
  // ============================================================================
  allowedIPs: [
    '192.168.1.100',    // CT Scanner 1
    '192.168.1.101',    // CT Scanner 2
    '192.168.1.102',    // MRI
    '192.168.1.103',    // X-Ray A
    '192.168.1.104',    // X-Ray B
    '192.168.1.105',    // Ultrasound
    '127.0.0.1',        // Localhost (for testing)
    '::1'               // IPv6 localhost
  ],

  // ============================================================================
  // MODALITY TYPE FILTER: Allowed Modality Types
  // ============================================================================
  allowedModalityTypes: [
    'CT',   // Computed Tomography
    'MR',   // Magnetic Resonance
    'CR',   // Computed Radiography
    'DX',   // Digital Radiography
    'US',   // Ultrasound
    'XA',   // X-Ray Angiography
    'MG',   // Mammography
    'PT',   // Positron Emission Tomography
    'NM',   // Nuclear Medicine
    'RF',   // Radiofluoroscopy
    'OT'    // Other
  ],

  // ============================================================================
  // YOUR SYSTEM IDENTITY
  // ============================================================================
  systemAET: 'RADREPORT_SYS',
  systemPort: 11112,
  systemDescription: 'Radiology Reporting System',

  // ============================================================================
  // RATE LIMITS (requests per minute)
  // ============================================================================
  rateLimits: {
    default: 100,           // Default for imaging devices
    printer: 10,            // Printers (if allowed)
    workstation: 50,        // Workstations (if allowed)
    archive: 200,           // Archive servers (if allowed)
    emergency: 500          // Emergency override
  },

  // ============================================================================
  // TIME-BASED ACCESS CONTROL
  // ============================================================================
  businessHours: {
    enabled: false,         // Set to true to enable
    start: 7,               // 7 AM
    end: 19,                // 7 PM
    timezone: 'America/New_York',
    restrictedDevices: [    // Only these devices restricted
      'PRINTER_*',
      'TEACHING_*'
    ]
  },

  // ============================================================================
  // READ-ONLY DEVICES (Query only, no storage)
  // ============================================================================
  readOnlyDevices: [
    'WORKSTATION_*',
    'TEACHING_*',
    'QA_*'
  ],

  // ============================================================================
  // SECURITY SETTINGS
  // ============================================================================
  security: {
    enforceIPWhitelist: true,       // Enforce IP filtering
    enforceAETWhitelist: true,      // Enforce AE Title filtering
    enforceModalityFilter: true,    // Enforce modality type filtering
    logAllAttempts: true,           // Log all connection attempts
    alertOnBlocked: true,           // Send alerts for blocked attempts
    requireAuthentication: true     // Require HTTP auth for REST API
  },

  // ============================================================================
  // ALERT THRESHOLDS
  // ============================================================================
  alerts: {
    blockedAttemptsThreshold: 5,    // Alert after N blocked attempts
    timeWindow: 300000,             // 5 minutes
    alertEmail: 'admin@hospital.com',
    alertWebhook: null              // Optional webhook URL
  }
};
