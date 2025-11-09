/**
 * Input Validation Middleware
 * Prevents NoSQL injection and validates user inputs
 */

const validator = require('validator');

/**
 * Sanitize MongoDB query operators to prevent NoSQL injection
 * @param {*} obj - Object to sanitize
 * @returns {*} Sanitized object
 */
function sanitizeMongoQuery(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeMongoQuery(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      // Remove keys that start with $ (MongoDB operators)
      if (key.startsWith('$')) {
        console.warn(`⚠️  Blocked potential NoSQL injection attempt: ${key}`);
        continue;
      }
      sanitized[key] = sanitizeMongoQuery(obj[key]);
    }
    return sanitized;
  }

  // Return primitives as-is
  return obj;
}

/**
 * Validate and sanitize request body
 */
function validateRequestBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeMongoQuery(req.body);
  }
  next();
}

/**
 * Validate and sanitize query parameters
 */
function validateQueryParams(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeMongoQuery(req.query);
  }
  next();
}

/**
 * Validate and sanitize route parameters
 */
function validateRouteParams(req, res, next) {
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeMongoQuery(req.params);
  }
  next();
}

/**
 * Comprehensive input validation middleware
 */
function inputValidationMiddleware(req, res, next) {
  try {
    // Sanitize all inputs
    validateRequestBody(req, res, () => {});
    validateQueryParams(req, res, () => {});
    validateRouteParams(req, res, () => {});
    
    next();
  } catch (error) {
    console.error('Input validation error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid input data',
      error: 'Input validation failed'
    });
  }
}

/**
 * Validate specific field types
 */
const fieldValidators = {
  /**
   * Validate email address
   */
  email: (value) => {
    if (!value) return { valid: false, message: 'Email is required' };
    if (!validator.isEmail(value)) {
      return { valid: false, message: 'Invalid email format' };
    }
    return { valid: true };
  },

  /**
   * Validate MongoDB ObjectId
   */
  objectId: (value) => {
    if (!value) return { valid: false, message: 'ID is required' };
    if (!validator.isMongoId(value)) {
      return { valid: false, message: 'Invalid ID format' };
    }
    return { valid: true };
  },

  /**
   * Validate phone number
   */
  phone: (value) => {
    if (!value) return { valid: false, message: 'Phone number is required' };
    // Allow international format
    if (!validator.isMobilePhone(value, 'any', { strictMode: false })) {
      return { valid: false, message: 'Invalid phone number format' };
    }
    return { valid: true };
  },

  /**
   * Validate URL
   */
  url: (value) => {
    if (!value) return { valid: false, message: 'URL is required' };
    if (!validator.isURL(value, { protocols: ['http', 'https'], require_protocol: true })) {
      return { valid: false, message: 'Invalid URL format' };
    }
    return { valid: true };
  },

  /**
   * Validate date
   */
  date: (value) => {
    if (!value) return { valid: false, message: 'Date is required' };
    if (!validator.isISO8601(value)) {
      return { valid: false, message: 'Invalid date format (use ISO 8601)' };
    }
    return { valid: true };
  },

  /**
   * Validate alphanumeric string
   */
  alphanumeric: (value) => {
    if (!value) return { valid: false, message: 'Value is required' };
    if (!validator.isAlphanumeric(value, 'en-US', { ignore: '-_' })) {
      return { valid: false, message: 'Value must be alphanumeric' };
    }
    return { valid: true };
  },

  /**
   * Validate integer
   */
  integer: (value) => {
    if (value === null || value === undefined) {
      return { valid: false, message: 'Value is required' };
    }
    if (!validator.isInt(String(value))) {
      return { valid: false, message: 'Value must be an integer' };
    }
    return { valid: true };
  },

  /**
   * Validate float
   */
  float: (value) => {
    if (value === null || value === undefined) {
      return { valid: false, message: 'Value is required' };
    }
    if (!validator.isFloat(String(value))) {
      return { valid: false, message: 'Value must be a number' };
    }
    return { valid: true };
  },

  /**
   * Validate boolean
   */
  boolean: (value) => {
    if (value === null || value === undefined) {
      return { valid: false, message: 'Value is required' };
    }
    if (!validator.isBoolean(String(value))) {
      return { valid: false, message: 'Value must be true or false' };
    }
    return { valid: true };
  },

  /**
   * Validate string length
   */
  stringLength: (value, min = 0, max = 1000) => {
    if (!value) return { valid: false, message: 'Value is required' };
    if (!validator.isLength(value, { min, max })) {
      return { valid: false, message: `Value must be between ${min} and ${max} characters` };
    }
    return { valid: true };
  }
};

/**
 * Create a validation middleware for specific fields
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
function createValidator(schema) {
  return (req, res, next) => {
    const errors = [];
    const data = { ...req.body, ...req.query, ...req.params };

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Check required fields
      if (rules.required && (value === null || value === undefined || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      // Skip validation if field is optional and not provided
      if (!rules.required && (value === null || value === undefined || value === '')) {
        continue;
      }

      // Validate field type
      if (rules.type && fieldValidators[rules.type]) {
        const result = rules.type === 'stringLength'
          ? fieldValidators[rules.type](value, rules.min, rules.max)
          : fieldValidators[rules.type](value);

        if (!result.valid) {
          errors.push({ field, message: result.message });
        }
      }

      // Custom validation function
      if (rules.custom && typeof rules.custom === 'function') {
        const result = rules.custom(value);
        if (!result.valid) {
          errors.push({ field, message: result.message });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
}

module.exports = {
  inputValidationMiddleware,
  sanitizeMongoQuery,
  validateRequestBody,
  validateQueryParams,
  validateRouteParams,
  fieldValidators,
  createValidator
};
