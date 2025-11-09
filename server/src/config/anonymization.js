/**
 * Anonymization Service Configuration
 * 
 * Configuration settings for the anonymization engine, audit trail,
 * and policy management components.
 */

module.exports = {
  // Main service configuration
  service: {
    defaultPolicy: process.env.ANONYMIZATION_DEFAULT_POLICY || 'standard',
    requireApprovedPolicies: process.env.ANONYMIZATION_REQUIRE_APPROVED !== 'false',
  },

  // Anonymization engine configuration
  engine: {
    pseudonymizationSalt: process.env.ANONYMIZATION_SALT || process.env.ANONYMIZATION_PSEUDONYM_SALT || 'local-dev-salt-please-change',
    // Additional engine-specific settings can be added here
  },

  // Audit trail configuration
  audit: {
    storageType: process.env.AUDIT_STORAGE_TYPE || 'file',
    auditPath: process.env.AUDIT_PATH || './logs/anonymization-audit',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 2555, // 7 years
    encryptAuditLogs: process.env.AUDIT_ENCRYPT !== 'false',
    encryptionKey: process.env.AUDIT_ENCRYPTION_KEY,
  },

  // Policy manager configuration
  policyManager: {
    storageType: process.env.POLICY_STORAGE_TYPE || 'file',
    policyPath: process.env.POLICY_PATH || './config/anonymization-policies',
    backupPath: process.env.POLICY_BACKUP_PATH || './config/anonymization-policies/backups',
    requireApproval: process.env.POLICY_REQUIRE_APPROVAL !== 'false',
    approvalWorkflow: process.env.POLICY_APPROVAL_WORKFLOW || 'dual', // 'single', 'dual', 'committee'
    emergencyBypass: process.env.POLICY_EMERGENCY_BYPASS === 'true',
    auditEnabled: process.env.POLICY_AUDIT_ENABLED !== 'false',
  },

  // Default policies (can be overridden by policy manager)
  defaultPolicies: {
    standard: {
      name: 'Standard HIPAA Anonymization',
      version: '1.0',
      description: 'Standard anonymization policy removing all HIPAA identifiers',
      approved: false,
      approvedBy: null,
      approvedDate: null,
      tags: {
        remove: [
          // Patient identification
          '(0010,0010)', // Patient Name
          '(0010,0020)', // Patient ID
          '(0010,0030)', // Patient Birth Date
          '(0010,0040)', // Patient Sex
          '(0010,1000)', // Other Patient IDs
          '(0010,1001)', // Other Patient Names
          '(0010,1010)', // Patient Age
          '(0010,1020)', // Patient Size
          '(0010,1030)', // Patient Weight
          '(0010,1040)', // Patient Address
          '(0010,1050)', // Insurance Plan Identification
          '(0010,1060)', // Patient Mother Birth Name
          '(0010,2154)', // Patient Telephone Numbers
          '(0010,2160)', // Patient Ethnic Group
          '(0010,21B0)', // Additional Patient History
          '(0010,4000)', // Patient Comments
          
          // Study identification
          '(0008,0050)', // Accession Number
          '(0008,0080)', // Institution Name
          '(0008,0081)', // Institution Address
          '(0008,0090)', // Referring Physician Name
          '(0008,0092)', // Referring Physician Address
          '(0008,0094)', // Referring Physician Telephone
          '(0008,1010)', // Station Name
          '(0008,1030)', // Study Description
          '(0008,103E)', // Series Description
          '(0008,1040)', // Institutional Department Name
          '(0008,1048)', // Physician(s) of Record
          '(0008,1050)', // Performing Physician Name
          '(0008,1060)', // Name of Physician(s) Reading Study
          '(0008,1070)', // Operators Name
          '(0008,1080)', // Admitting Diagnoses Description
          '(0008,1155)', // Referenced SOP Instance UID
          '(0008,2111)', // Derivation Description
          
          // Equipment identification
          '(0018,1000)', // Device Serial Number
          '(0018,1020)', // Software Version(s)
        ],
        pseudonymize: [
          // UIDs that need to be consistent but anonymized
          '(0020,000D)', // Study Instance UID
          '(0020,000E)', // Series Instance UID
          '(0008,0018)', // SOP Instance UID
          '(0020,0052)', // Frame of Reference UID
          
          // Dates (shifted by consistent offset)
          '(0008,0020)', // Study Date
          '(0008,0021)', // Series Date
          '(0008,0022)', // Acquisition Date
          '(0008,0023)', // Content Date
          '(0008,0030)', // Study Time
          '(0008,0031)', // Series Time
          '(0008,0032)', // Acquisition Time
          '(0008,0033)', // Content Time
        ],
        preserve: [
          // Essential medical data
          '(0028,0010)', // Rows
          '(0028,0011)', // Columns
          '(0028,0100)', // Bits Allocated
          '(0028,0101)', // Bits Stored
          '(0028,0102)', // High Bit
          '(0028,0103)', // Pixel Representation
          '(0028,1050)', // Window Center
          '(0028,1051)', // Window Width
          '(0018,0050)', // Slice Thickness
          '(0018,0088)', // Spacing Between Slices
          '(0020,0032)', // Image Position Patient
          '(0020,0037)', // Image Orientation Patient
          '(0028,0030)', // Pixel Spacing
          '(7FE0,0010)', // Pixel Data
          
          // Study organization
          '(0020,0010)', // Study ID
          '(0020,0011)', // Series Number
          '(0020,0013)', // Instance Number
          '(0020,0012)', // Acquisition Number
          
          // Image characteristics
          '(0008,0008)', // Image Type
          '(0008,0016)', // SOP Class UID
          '(0008,0060)', // Modality
          '(0018,0015)', // Body Part Examined
          '(0018,5100)', // Patient Position
          '(0020,0020)', // Patient Orientation
        ]
      }
    }
  }
};