/**
 * XSS Protection Middleware
 * Sanitizes user input to prevent Cross-Site Scripting attacks
 */

const xss = require('xss');
const createDOMPurify = require('isomorphic-dompurify');

/**
 * XSS filter options
 */
const xssOptions = {
  whiteList: {
    // Allow only safe HTML tags for medical reports
    p: ['class', 'style'],
    br: [],
    strong: [],
    em: [],
    u: [],
    span: ['class', 'style'],
    div: ['class', 'style'],
    ul: ['class'],
    ol: ['class'],
    li: ['class'],
    table: ['class', 'border', 'cellpadding', 'cellspacing'],
    thead: [],
    tbody: [],
    tr: [],
    th: ['class'],
    td: ['class', 'colspan', 'rowspan'],
    h1: ['class'],
    h2: ['class'],
    h3: ['class'],
    h4: ['class'],
    h5: ['class'],
    h6: ['class']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: {
    whiteList: {
      'color': true,
      'background-color': true,
      'font-size': true,
      'font-weight': true,
      'text-align': true,
      'margin': true,
      'padding': true
    }
  }
};

/**
 * Sanitize string to prevent XSS
 * @param {string} str - String to sanitize
 * @param {boolean} allowHTML - Whether to allow safe HTML tags
 * @returns {string} Sanitized string
 */
function sanitizeString(str, allowHTML = false) {
  if (typeof str !== 'string') {
    return str;
  }

  if (allowHTML) {
    // Use xss library for HTML content (like report text)
    return xss(str, xssOptions);
  } else {
    // Strip all HTML for non-HTML fields
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

/**
 * Recursively sanitize object
 * @param {*} obj - Object to sanitize
 * @param {Array<string>} htmlFields - Fields that allow HTML
 * @returns {*} Sanitized object
 */
function sanitizeObject(obj, htmlFields = []) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, htmlFields));
  }

  // Handle objects
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if this field allows HTML
      const allowHTML = htmlFields.includes(key);
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, allowHTML);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, htmlFields);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj, false);
  }

  // Return other types as-is
  return obj;
}

/**
 * XSS protection middleware
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.htmlFields - Fields that allow HTML content
 * @param {Array<string>} options.excludePaths - Paths to exclude from XSS protection
 */
function xssProtectionMiddleware(options = {}) {
  const {
    htmlFields = [
      'findings',
      'impression',
      'clinicalHistory',
      'technique',
      'comparison',
      'content',
      'description',
      'notes',
      'comments'
    ],
    excludePaths = ['/health', '/metrics']
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, htmlFields);
      }

      // Sanitize query parameters (never allow HTML in query params)
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, []);
      }

      // Sanitize route parameters (never allow HTML in route params)
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, []);
      }

      next();
    } catch (error) {
      console.error('XSS protection error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        error: 'XSS protection failed'
      });
    }
  };
}

/**
 * Set security headers to prevent XSS
 */
function setSecurityHeaders(req, res, next) {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline'", // Allow inline styles
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  next();
}

/**
 * Sanitize output before sending to client
 */
function sanitizeResponse(data, htmlFields = []) {
  return sanitizeObject(data, htmlFields);
}

module.exports = {
  xssProtectionMiddleware,
  setSecurityHeaders,
  sanitizeString,
  sanitizeObject,
  sanitizeResponse
};
