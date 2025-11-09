/**
 * Internationalization (i18n) Strings
 * Default language: en-US
 * 
 * To add a new language:
 * 1. Create a new file: strings.{locale}.ts (e.g., strings.es-ES.ts)
 * 2. Copy this structure and translate all values
 * 3. Import and register in i18n/index.ts
 */

export interface I18nStrings {
  // Common
  common: {
    save: string;
    cancel: string;
    close: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    confirm: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  };

  // Report Editor
  editor: {
    title: string;
    draftReport: string;
    preliminaryReport: string;
    finalReport: string;
    saveManually: string;
    finalize: string;
    sign: string;
    export: string;
    addAddendum: string;
    applyAI: string;
    addFinding: string;
    deleteFinding: string;
    saving: string;
    saved: string;
    unsaved: string;
    offline: string;
    reconnecting: string;
    readOnly: string;
    cannotEditFinal: string;
  };

  // Form Fields
  fields: {
    clinicalIndication: string;
    clinicalIndicationPlaceholder: string;
    technique: string;
    techniquePlaceholder: string;
    findings: string;
    findingsPlaceholder: string;
    impression: string;
    impressionPlaceholder: string;
    addendum: string;
    addendumPlaceholder: string;
  };

  // Status Messages
  status: {
    draft: string;
    preliminary: string;
    final: string;
    amended: string;
    corrected: string;
  };

  // Actions
  actions: {
    createReport: string;
    selectTemplate: string;
    searchTemplates: string;
    exportPDF: string;
    exportDOCX: string;
    exportJSON: string;
    exportFHIR: string;
  };

  // Errors
  errors: {
    failedToSave: string;
    failedToLoad: string;
    failedToFinalize: string;
    failedToSign: string;
    failedToExport: string;
    networkError: string;
    versionConflict: string;
    validationError: string;
    requiredField: string;
    invalidFormat: string;
  };

  // Validation
  validation: {
    indicationRequired: string;
    findingsRequired: string;
    impressionRequired: string;
    signatureRequired: string;
  };

  // Accessibility
  a11y: {
    saveStatus: string;
    reportStatus: string;
    findingNumber: string;
    deleteFindingButton: string;
    offlineIndicator: string;
    loadingIndicator: string;
  };
}

/**
 * Default English (US) strings
 */
export const strings: I18nStrings = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    confirm: 'Confirm',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
  },

  editor: {
    title: 'Report Editor',
    draftReport: 'Draft Report',
    preliminaryReport: 'Preliminary Report',
    finalReport: 'Final Report',
    saveManually: 'Save report manually',
    finalize: 'Finalize report',
    sign: 'Sign report',
    export: 'Export report format',
    addAddendum: 'Add addendum to final report',
    applyAI: 'Apply AI analysis findings',
    addFinding: 'Add new finding',
    deleteFinding: 'Delete finding',
    saving: 'Saving...',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    offline: 'Offline',
    reconnecting: 'Reconnecting...',
    readOnly: 'Read-only',
    cannotEditFinal: 'Cannot edit finalized report',
  },

  fields: {
    clinicalIndication: 'Clinical Indication',
    clinicalIndicationPlaceholder: 'Enter clinical indication',
    technique: 'Technique',
    techniquePlaceholder: 'Enter technique used',
    findings: 'Findings',
    findingsPlaceholder: 'Describe finding...',
    impression: 'Impression',
    impressionPlaceholder: 'Enter impression',
    addendum: 'Addendum',
    addendumPlaceholder: 'Enter addendum text',
  },

  status: {
    draft: 'Draft',
    preliminary: 'Preliminary',
    final: 'Final',
    amended: 'Amended',
    corrected: 'Corrected',
  },

  actions: {
    createReport: 'Create New Report',
    selectTemplate: 'Select Report Template',
    searchTemplates: 'Search templates by name, modality, or body part...',
    exportPDF: 'Export as PDF',
    exportDOCX: 'Export as DOCX',
    exportJSON: 'Export as JSON',
    exportFHIR: 'Export as FHIR',
  },

  errors: {
    failedToSave: 'Failed to save report',
    failedToLoad: 'Failed to load report',
    failedToFinalize: 'Failed to finalize report',
    failedToSign: 'Failed to sign report',
    failedToExport: 'Failed to export report',
    networkError: 'Network connection error',
    versionConflict: 'Version conflict detected',
    validationError: 'Validation error',
    requiredField: 'This field is required',
    invalidFormat: 'Invalid format',
  },

  validation: {
    indicationRequired: 'Clinical indication is required',
    findingsRequired: 'At least one finding is required',
    impressionRequired: 'Impression is required',
    signatureRequired: 'Signature is required',
  },

  a11y: {
    saveStatus: 'Save status',
    reportStatus: 'Report status',
    findingNumber: 'Finding {number}',
    deleteFindingButton: 'Delete finding {number}',
    offlineIndicator: 'Network offline indicator',
    loadingIndicator: 'Loading indicator',
  },
};

/**
 * Get localized string
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = strings;

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      console.warn(`Missing translation key: ${key}`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation key is not a string: ${key}`);
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, param) => {
      return params[param]?.toString() || match;
    });
  }

  return value;
}

/**
 * Get current locale
 */
export function getCurrentLocale(): string {
  return 'en-US'; // TODO: Implement locale detection
}

/**
 * Set locale
 */
export function setLocale(locale: string): void {
  // TODO: Implement locale switching
  console.log(`Locale set to: ${locale}`);
}

export default strings;
