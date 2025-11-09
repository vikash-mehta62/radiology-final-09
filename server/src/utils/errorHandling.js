/**
 * Enhanced Error Handling Module
 * Comprehensive error handling for medical reports
 */

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

class DataExtractionError extends Error {
  constructor(message, frameIndex = null) {
    super(message);
    this.name = 'DataExtractionError';
    this.frameIndex = frameIndex;
    this.statusCode = 422;
  }
}

class PDFGenerationError extends Error {
  constructor(message, reportId = null) {
    super(message);
    this.name = 'PDFGenerationError';
    this.reportId = reportId;
    this.statusCode = 500;
  }
}

class ImageProcessingError extends Error {
  constructor(message, frameIndex = null) {
    super(message);
    this.name = 'ImageProcessingError';
    this.frameIndex = frameIndex;
    this.statusCode = 422;
  }
}

/**
 * Handle errors with detailed logging and user-friendly messages
 */
function handleError(error, context = {}) {
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      type: error.name || 'Error',
      code: error.statusCode || 500
    },
    context: {},
    timestamp: new Date().toISOString()
  };

  // Add context information
  if (context.reportId) errorResponse.context.reportId = context.reportId;
  if (context.studyUID) errorResponse.context.studyUID = context.studyUID;
  if (context.operation) errorResponse.context.operation = context.operation;

  // Add specific error details
  if (error.details) {
    errorResponse.error.details = error.details;
  }

  if (error.frameIndex !== undefined) {
    errorResponse.error.frameIndex = error.frameIndex;
  }

  // Log error with appropriate level
  if (error.statusCode >= 500) {
    console.error('❌ Server Error:', error);
    console.error('Context:', context);
    if (error.stack) console.error('Stack:', error.stack);
  } else if (error.statusCode >= 400) {
    console.warn('⚠️  Client Error:', error.message);
    console.warn('Context:', context);
  } else {
    console.log('ℹ️  Error:', error.message);
  }

  return errorResponse;
}

/**
 * Wrap async route handlers with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(error => {
      const context = {
        operation: req.method + ' ' + req.path,
        reportId: req.params.reportId,
        studyUID: req.body.studyInstanceUID
      };

      const errorResponse = handleError(error, context);
      res.status(errorResponse.error.code).json(errorResponse);
    });
  };
}

/**
 * Validate request data with detailed error messages
 */
function validateRequest(data, schema) {
  const errors = [];

  Object.entries(schema).forEach(([field, rules]) => {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: `${field} is required`,
        rule: 'required'
      });
      return;
    }

    // Skip other checks if not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      return;
    }

    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({
          field,
          message: `${field} must be of type ${rules.type}, got ${actualType}`,
          rule: 'type'
        });
      }
    }

    // Min length check
    if (rules.minLength && value.length < rules.minLength) {
      errors.push({
        field,
        message: `${field} must have at least ${rules.minLength} items/characters`,
        rule: 'minLength'
      });
    }

    // Max length check
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push({
        field,
        message: `${field} must have at most ${rules.maxLength} items/characters`,
        rule: 'maxLength'
      });
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({
        field,
        message: `${field} format is invalid`,
        rule: 'pattern'
      });
    }

    // Custom validator
    if (rules.validator) {
      const result = rules.validator(value);
      if (result !== true) {
        errors.push({
          field,
          message: result || `${field} validation failed`,
          rule: 'custom'
        });
      }
    }
  });

  if (errors.length > 0) {
    throw new ValidationError('Request validation failed', { errors });
  }

  return true;
}

/**
 * Handle missing data gracefully
 */
function handleMissingData(field, defaultValue = 'Data unavailable') {
  return {
    value: defaultValue,
    isMissing: true,
    field
  };
}

/**
 * Safe data extraction with error handling
 */
function safeExtract(fn, fallback = null, context = '') {
  try {
    const result = fn();
    return result !== undefined && result !== null ? result : fallback;
  } catch (error) {
    console.warn(`⚠️  Error extracting ${context}:`, error.message);
    return fallback;
  }
}

/**
 * Retry operation with exponential backoff
 */
async function retryOperation(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Validate and sanitize user input
 */
function sanitizeInput(input, type = 'string') {
  if (input === null || input === undefined) {
    return null;
  }

  switch (type) {
    case 'string':
      return String(input).trim();

    case 'number':
      const num = Number(input);
      return isNaN(num) ? null : num;

    case 'boolean':
      return Boolean(input);

    case 'array':
      return Array.isArray(input) ? input : [input];

    case 'object':
      return typeof input === 'object' ? input : {};

    default:
      return input;
  }
}

/**
 * Create detailed error log entry
 */
function createErrorLog(error, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.statusCode || error.code
    },
    context: {
      ...context,
      userAgent: context.req?.headers?.['user-agent'],
      ip: context.req?.ip,
      method: context.req?.method,
      path: context.req?.path
    }
  };
}

/**
 * Format error for user display
 */
function formatUserError(error) {
  // User-friendly error messages
  const userMessages = {
    'ValidationError': 'The provided data is invalid. Please check your input and try again.',
    'DataExtractionError': 'Unable to extract data from the analysis results. Please verify the data format.',
    'PDFGenerationError': 'Failed to generate PDF report. Please try again or contact support.',
    'ImageProcessingError': 'Unable to process image data. Please check the image format.',
    'ECONNREFUSED': 'Unable to connect to the service. Please check if all services are running.',
    'ETIMEDOUT': 'The operation timed out. Please try again.',
    'ENOTFOUND': 'Service not found. Please check the configuration.'
  };

  const userMessage = userMessages[error.name] || 
                     userMessages[error.code] ||
                     'An unexpected error occurred. Please try again.';

  return {
    message: userMessage,
    technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
    errorCode: error.statusCode || 500
  };
}

/**
 * Check if error is recoverable
 */
function isRecoverableError(error) {
  const recoverableErrors = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'EHOSTUNREACH'
  ];

  return recoverableErrors.includes(error.code) || 
         error.statusCode === 503 || 
         error.statusCode === 429;
}

/**
 * Global error handler middleware
 */
function globalErrorHandler(err, req, res, next) {
  const context = {
    operation: `${req.method} ${req.path}`,
    reportId: req.params.reportId,
    studyUID: req.body?.studyInstanceUID,
    req
  };

  const errorLog = createErrorLog(err, context);
  
  // Log to console
  console.error('❌ Global Error Handler:', errorLog);

  // Format response
  const errorResponse = handleError(err, context);
  const userError = formatUserError(err);

  res.status(errorResponse.error.code).json({
    ...errorResponse,
    userMessage: userError.message,
    ...(process.env.NODE_ENV === 'development' && { 
      technicalDetails: userError.technicalDetails 
    })
  });
}

module.exports = {
  // Error classes
  ValidationError,
  DataExtractionError,
  PDFGenerationError,
  ImageProcessingError,

  // Error handling functions
  handleError,
  asyncHandler,
  validateRequest,
  handleMissingData,
  safeExtract,
  retryOperation,
  sanitizeInput,
  createErrorLog,
  formatUserError,
  isRecoverableError,
  globalErrorHandler
};
