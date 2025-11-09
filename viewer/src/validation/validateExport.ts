/**
 * Export Validation
 * Validates DICOM SR and FHIR exports before download
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import dicomSrSchema from './dicom-sr.schema.json';
import fhirReportSchema from './fhir-report.schema.json';

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Compile schemas
const validateDicomSrCompiled = ajv.compile(dicomSrSchema);
const validateFhirCompiled = ajv.compile(fhirReportSchema);

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
  }>;
}

/**
 * Validate DICOM Structured Report
 */
export function validateDicomSr(data: any): ValidationResult {
  try {
    const valid = validateDicomSrCompiled(data);

    if (valid) {
      return { valid: true };
    }

    const errors = (validateDicomSrCompiled.errors || []).map(err => ({
      path: err.instancePath || err.dataPath || 'root',
      message: err.message || 'Validation error',
      keyword: err.keyword,
    }));

    return {
      valid: false,
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }],
    };
  }
}

/**
 * Validate FHIR DiagnosticReport
 */
export function validateFhir(data: any): ValidationResult {
  try {
    const valid = validateFhirCompiled(data);

    if (valid) {
      return { valid: true };
    }

    const errors = (validateFhirCompiled.errors || []).map(err => ({
      path: err.instancePath || err.dataPath || 'root',
      message: err.message || 'Validation error',
      keyword: err.keyword,
    }));

    return {
      valid: false,
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }],
    };
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationResult['errors']): string {
  if (!errors || errors.length === 0) {
    return 'Unknown validation error';
  }

  const firstError = errors[0];
  const path = firstError.path === 'root' ? '' : ` at ${firstError.path}`;
  const message = firstError.message;

  if (errors.length === 1) {
    return `${message}${path}`;
  }

  return `${message}${path} (and ${errors.length - 1} more error${errors.length > 2 ? 's' : ''})`;
}

/**
 * Validate export data based on format
 */
export function validateExport(format: string, data: any): ValidationResult {
  switch (format.toLowerCase()) {
    case 'dicom-sr':
    case 'dicom':
      return validateDicomSr(data);
    
    case 'fhir':
    case 'fhir-json':
      return validateFhir(data);
    
    case 'pdf':
    case 'docx':
      // Binary formats - skip validation
      return { valid: true };
    
    default:
      return {
        valid: false,
        errors: [{
          path: 'format',
          message: `Unsupported export format: ${format}`,
        }],
      };
  }
}

export default {
  validateDicomSr,
  validateFhir,
  validateExport,
  formatValidationErrors,
};
