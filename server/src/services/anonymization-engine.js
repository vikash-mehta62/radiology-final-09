/**
 * Anonymization Engine Service
 * 
 * Provides configurable anonymization policies for DICOM data processing.
 * Implements tag removal and pseudonymization methods with validation
 * to ensure complete PHI removal according to healthcare compliance requirements.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AnonymizationEngine {
  constructor(config = {}) {
    this.config = {
      // Default anonymization policy
      defaultPolicy: 'standard',
      // Salt for pseudonymization
      pseudonymizationSalt: config.pseudonymizationSalt || process.env.ANONYMIZATION_SALT || crypto.randomBytes(32).toString('hex'),
      // Policy definitions
      policies: config.policies || this.getDefaultPolicies(),
      ...config
    };
    
    this.validateConfiguration();
  }

  /**
   * Get default anonymization policies
   */
  getDefaultPolicies() {
    return {
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
            '(0008,1010)', // Station Name
            '(0008,1090)', // Manufacturer Model Name
            '(0018,1000)', // Device Serial Number
            '(0018,1020)', // Software Version(s)
            
            // Dates and times (will be shifted, not removed)
            // '(0008,0020)', // Study Date - handled by pseudonymize
            // '(0008,0021)', // Series Date - handled by pseudonymize
            // '(0008,0022)', // Acquisition Date - handled by pseudonymize
            // '(0008,0023)', // Content Date - handled by pseudonymize
            // '(0008,0030)', // Study Time - handled by pseudonymize
            // '(0008,0031)', // Series Time - handled by pseudonymize
            // '(0008,0032)', // Acquisition Time - handled by pseudonymize
            // '(0008,0033)', // Content Time - handled by pseudonymize
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
          ]
        }
      },
      research: {
        name: 'Research Anonymization',
        version: '1.0',
        description: 'Enhanced anonymization for research use with additional PHI removal',
        approved: false,
        approvedBy: null,
        approvedDate: null,
        tags: {
          remove: [
            // All standard tags plus additional research-specific removals
            // ... (would include all standard tags plus more)
          ],
          pseudonymize: [
            // Same as standard but with additional research considerations
          ],
          preserve: [
            // Essential medical data for research
          ]
        }
      }
    };
  }

  /**
   * Validate engine configuration
   */
  validateConfiguration() {
    if (!this.config.pseudonymizationSalt) {
      throw new Error('Pseudonymization salt is required for anonymization engine');
    }
    
    if (!this.config.policies || Object.keys(this.config.policies).length === 0) {
      throw new Error('At least one anonymization policy must be defined');
    }
    
    // Validate each policy
    for (const [policyName, policy] of Object.entries(this.config.policies)) {
      this.validatePolicy(policyName, policy);
    }
  }

  /**
   * Validate a single policy configuration
   */
  validatePolicy(policyName, policy) {
    const requiredFields = ['name', 'version', 'description', 'tags'];
    for (const field of requiredFields) {
      if (!policy[field]) {
        throw new Error(`Policy '${policyName}' missing required field: ${field}`);
      }
    }
    
    const requiredTagTypes = ['remove', 'pseudonymize', 'preserve'];
    for (const tagType of requiredTagTypes) {
      if (!policy.tags[tagType] || !Array.isArray(policy.tags[tagType])) {
        throw new Error(`Policy '${policyName}' missing or invalid tag type: ${tagType}`);
      }
    }
    
    // Validate DICOM tag format
    const tagRegex = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/;
    const allTags = [
      ...policy.tags.remove,
      ...policy.tags.pseudonymize,
      ...policy.tags.preserve
    ];
    
    for (const tag of allTags) {
      if (!tagRegex.test(tag)) {
        throw new Error(`Invalid DICOM tag format in policy '${policyName}': ${tag}`);
      }
    }
  }

  /**
   * Apply anonymization policy to DICOM metadata
   */
  async anonymize(dicomMetadata, policyName = null, options = {}) {
    const policy = this.getPolicy(policyName || this.config.defaultPolicy);
    
    if (!policy.approved && !options.allowUnapproved) {
      throw new Error(`Policy '${policyName}' has not been approved for use`);
    }
    
    const result = {
      originalMetadata: { ...dicomMetadata },
      anonymizedMetadata: { ...dicomMetadata },
      policy: {
        name: policy.name,
        version: policy.version,
        applied: new Date().toISOString()
      },
      operations: [],
      validation: {
        phiRemoved: false,
        errors: [],
        warnings: []
      }
    };
    
    try {
      // Apply tag removal
      for (const tag of policy.tags.remove) {
        if (result.anonymizedMetadata[tag]) {
          const originalValue = result.anonymizedMetadata[tag];
          delete result.anonymizedMetadata[tag];
          result.operations.push({
            operation: 'remove',
            tag: tag,
            originalValue: originalValue,
            newValue: null
          });
        }
      }
      
      // Apply pseudonymization
      for (const tag of policy.tags.pseudonymize) {
        if (result.anonymizedMetadata[tag]) {
          const originalValue = result.anonymizedMetadata[tag];
          const pseudonymizedValue = this.pseudonymizeValue(tag, originalValue);
          result.anonymizedMetadata[tag] = pseudonymizedValue;
          result.operations.push({
            operation: 'pseudonymize',
            tag: tag,
            originalValue: originalValue,
            newValue: pseudonymizedValue
          });
        }
      }
      
      // Validate anonymization completeness
      result.validation = this.validateAnonymization(result.anonymizedMetadata, policy);
      
      return result;
      
    } catch (error) {
      result.validation.errors.push(`Anonymization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pseudonymize a value based on tag type
   */
  pseudonymizeValue(tag, value) {
    // Create consistent hash for the value
    const hash = crypto.createHmac('sha256', this.config.pseudonymizationSalt)
      .update(`${tag}:${value}`)
      .digest('hex');
    
    // Handle different tag types
    if (this.isUIDTag(tag)) {
      // Generate consistent UID
      return this.generatePseudonymUID(hash);
    } else if (this.isDateTag(tag)) {
      // Shift date by consistent offset
      return this.shiftDate(value, hash);
    } else if (this.isTimeTag(tag)) {
      // Shift time by consistent offset
      return this.shiftTime(value, hash);
    } else {
      // Generic pseudonymization
      return `ANON_${hash.substring(0, 8).toUpperCase()}`;
    }
  }

  /**
   * Check if tag is a UID tag
   */
  isUIDTag(tag) {
    const uidTags = [
      '(0020,000D)', // Study Instance UID
      '(0020,000E)', // Series Instance UID
      '(0008,0018)', // SOP Instance UID
      '(0020,0052)', // Frame of Reference UID
    ];
    return uidTags.includes(tag);
  }

  /**
   * Check if tag is a date tag
   */
  isDateTag(tag) {
    const dateTags = [
      '(0008,0020)', // Study Date
      '(0008,0021)', // Series Date
      '(0008,0022)', // Acquisition Date
      '(0008,0023)', // Content Date
    ];
    return dateTags.includes(tag);
  }

  /**
   * Check if tag is a time tag
   */
  isTimeTag(tag) {
    const timeTags = [
      '(0008,0030)', // Study Time
      '(0008,0031)', // Series Time
      '(0008,0032)', // Acquisition Time
      '(0008,0033)', // Content Time
    ];
    return timeTags.includes(tag);
  }

  /**
   * Generate pseudonymized UID
   */
  generatePseudonymUID(hash) {
    // Use hash to create consistent UID
    const prefix = '1.2.826.0.1.3680043.8.498.'; // Example root for anonymized UIDs
    const suffix = hash.substring(0, 16);
    return `${prefix}${suffix}`;
  }

  /**
   * Shift date by consistent offset
   */
  shiftDate(dateString, hash) {
    try {
      // Parse DICOM date format (YYYYMMDD)
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6));
      const day = parseInt(dateString.substring(6, 8));
      
      const date = new Date(year, month - 1, day);
      
      // Generate consistent offset from hash (±365 days)
      const offsetDays = (parseInt(hash.substring(0, 8), 16) % 730) - 365;
      date.setDate(date.getDate() + offsetDays);
      
      // Format back to DICOM date
      const newYear = date.getFullYear().toString().padStart(4, '0');
      const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
      const newDay = date.getDate().toString().padStart(2, '0');
      
      return `${newYear}${newMonth}${newDay}`;
    } catch (error) {
      // If date parsing fails, return generic pseudonym
      return `ANON_DATE_${hash.substring(0, 8)}`;
    }
  }

  /**
   * Shift time by consistent offset
   */
  shiftTime(timeString, hash) {
    try {
      // Parse DICOM time format (HHMMSS or HHMMSS.FFFFFF)
      const timeParts = timeString.split('.');
      const timeBase = timeParts[0];
      const fraction = timeParts[1] || '';
      
      const hours = parseInt(timeBase.substring(0, 2));
      const minutes = parseInt(timeBase.substring(2, 4));
      const seconds = parseInt(timeBase.substring(4, 6));
      
      // Generate consistent offset from hash (±12 hours in seconds)
      const offsetSeconds = (parseInt(hash.substring(8, 16), 16) % 86400) - 43200;
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds + offsetSeconds;
      const normalizedSeconds = ((totalSeconds % 86400) + 86400) % 86400;
      
      const newHours = Math.floor(normalizedSeconds / 3600);
      const newMinutes = Math.floor((normalizedSeconds % 3600) / 60);
      const newSecondsOnly = normalizedSeconds % 60;
      
      const timeStr = `${newHours.toString().padStart(2, '0')}${newMinutes.toString().padStart(2, '0')}${newSecondsOnly.toString().padStart(2, '0')}`;
      
      return fraction ? `${timeStr}.${fraction}` : timeStr;
    } catch (error) {
      // If time parsing fails, return generic pseudonym
      return `ANON_TIME_${hash.substring(0, 6)}`;
    }
  }

  /**
   * Validate anonymization completeness
   */
  validateAnonymization(anonymizedMetadata, policy) {
    const validation = {
      phiRemoved: true,
      errors: [],
      warnings: [],
      removedTags: [],
      pseudonymizedTags: [],
      preservedTags: []
    };
    
    // Check that all required tags were removed
    for (const tag of policy.tags.remove) {
      if (anonymizedMetadata[tag]) {
        validation.errors.push(`PHI tag ${tag} was not removed`);
        validation.phiRemoved = false;
      } else {
        validation.removedTags.push(tag);
      }
    }
    
    // Check that pseudonymized tags were processed
    for (const tag of policy.tags.pseudonymize) {
      if (anonymizedMetadata[tag]) {
        validation.pseudonymizedTags.push(tag);
      }
    }
    
    // Check that preserved tags are still present
    for (const tag of policy.tags.preserve) {
      if (anonymizedMetadata[tag]) {
        validation.preservedTags.push(tag);
      }
    }
    
    // Look for potential PHI in remaining tags
    const potentialPhiPatterns = [
      /patient/i,
      /physician/i,
      /doctor/i,
      /hospital/i,
      /clinic/i,
      /address/i,
      /phone/i,
      /telephone/i
    ];
    
    for (const [tag, value] of Object.entries(anonymizedMetadata)) {
      if (typeof value === 'string') {
        for (const pattern of potentialPhiPatterns) {
          if (pattern.test(value)) {
            validation.warnings.push(`Potential PHI detected in tag ${tag}: ${value}`);
          }
        }
      }
    }
    
    return validation;
  }

  /**
   * Get policy by name
   */
  getPolicy(policyName) {
    const policy = this.config.policies[policyName];
    if (!policy) {
      throw new Error(`Anonymization policy '${policyName}' not found`);
    }
    return policy;
  }

  /**
   * List available policies
   */
  listPolicies() {
    return Object.keys(this.config.policies).map(name => ({
      name,
      ...this.config.policies[name]
    }));
  }

  /**
   * Check if policy is approved
   */
  isPolicyApproved(policyName) {
    const policy = this.getPolicy(policyName);
    return policy.approved === true && policy.approvedBy && policy.approvedDate;
  }
}

module.exports = AnonymizationEngine;