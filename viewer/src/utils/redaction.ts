/**
 * PII Redaction Utilities
 * Redacts personally identifiable information from strings before logging or telemetry
 */

export interface RedactionConfig {
  redactEmails?: boolean;
  redactPhones?: boolean;
  redactMRN?: boolean;
  redactSSN?: boolean;
  redactCreditCards?: boolean;
  redactIPAddresses?: boolean;
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>;
}

const DEFAULT_CONFIG: RedactionConfig = {
  redactEmails: true,
  redactPhones: true,
  redactMRN: true,
  redactSSN: true,
  redactCreditCards: true,
  redactIPAddresses: true,
  customPatterns: [],
};

/**
 * Redact PII from text
 */
export function redactPII(
  text: string,
  config: RedactionConfig = DEFAULT_CONFIG
): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  // Email addresses
  if (config.redactEmails !== false) {
    redacted = redacted.replace(
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );
  }

  // Phone numbers (US format)
  if (config.redactPhones !== false) {
    // (123) 456-7890
    redacted = redacted.replace(
      /\(\d{3}\)\s*\d{3}-\d{4}/g,
      '[PHONE_REDACTED]'
    );
    // 123-456-7890
    redacted = redacted.replace(
      /\b\d{3}-\d{3}-\d{4}\b/g,
      '[PHONE_REDACTED]'
    );
    // 1234567890
    redacted = redacted.replace(
      /\b\d{10}\b/g,
      '[PHONE_REDACTED]'
    );
    // +1 (123) 456-7890
    redacted = redacted.replace(
      /\+1\s*\(\d{3}\)\s*\d{3}-\d{4}/g,
      '[PHONE_REDACTED]'
    );
  }

  // Medical Record Numbers (MRN)
  if (config.redactMRN !== false) {
    // MRN: ABC123456
    redacted = redacted.replace(
      /\bMRN[:\s]*[A-Z0-9]{6,10}\b/gi,
      '[MRN_REDACTED]'
    );
    // Common MRN patterns: 2-3 letters followed by 6-10 digits
    redacted = redacted.replace(
      /\b[A-Z]{2,3}\d{6,10}\b/g,
      '[MRN_REDACTED]'
    );
  }

  // Social Security Numbers
  if (config.redactSSN !== false) {
    // 123-45-6789
    redacted = redacted.replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      '[SSN_REDACTED]'
    );
    // 123456789
    redacted = redacted.replace(
      /\b\d{9}\b/g,
      '[SSN_REDACTED]'
    );
  }

  // Credit Card Numbers
  if (config.redactCreditCards !== false) {
    // 1234-5678-9012-3456 or 1234 5678 9012 3456
    redacted = redacted.replace(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      '[CARD_REDACTED]'
    );
  }

  // IP Addresses
  if (config.redactIPAddresses !== false) {
    // IPv4
    redacted = redacted.replace(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      '[IP_REDACTED]'
    );
    // IPv6 (simplified)
    redacted = redacted.replace(
      /\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
      '[IP_REDACTED]'
    );
  }

  // Custom patterns
  if (config.customPatterns && config.customPatterns.length > 0) {
    config.customPatterns.forEach(({ pattern, replacement }) => {
      redacted = redacted.replace(pattern, replacement);
    });
  }

  return redacted;
}

/**
 * Redact PII from objects (recursively)
 */
export function redactPIIFromObject(
  obj: any,
  config: RedactionConfig = DEFAULT_CONFIG
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactPII(obj, config);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIFromObject(item, config));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Redact sensitive field names entirely
        if (isSensitiveField(key)) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = redactPIIFromObject(obj[key], config);
        }
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Check if field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apikey',
    'api_key',
    'accesstoken',
    'access_token',
    'privatekey',
    'private_key',
    'ssn',
    'social_security',
    'creditcard',
    'credit_card',
    'cvv',
    'pin',
  ];

  const lowerField = fieldName.toLowerCase();
  return sensitiveFields.some(sensitive => lowerField.includes(sensitive));
}

/**
 * Mask string (show only last N characters)
 */
export function maskString(str: string, visibleChars: number = 4): string {
  if (!str || str.length <= visibleChars) {
    return str;
  }

  const masked = '*'.repeat(str.length - visibleChars);
  const visible = str.slice(-visibleChars);
  return masked + visible;
}

/**
 * Mask email (show first char and domain)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [local, domain] = email.split('@');
  if (local.length <= 1) {
    return email;
  }

  const maskedLocal = local[0] + '*'.repeat(local.length - 1);
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number (show last 4 digits)
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) {
    return phone;
  }

  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Validate that text doesn't contain PII
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for common PII patterns
  const piiPatterns = [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, // Email
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{3}-\d{3}-\d{4}\b/, // Phone
    /\bMRN[:\s]*[A-Z0-9]{6,10}\b/i, // MRN
  ];

  return piiPatterns.some(pattern => pattern.test(text));
}

/**
 * Safe console.log with PII redaction
 */
export function safeLog(message: string, ...args: any[]): void {
  const redactedMessage = redactPII(message);
  const redactedArgs = args.map(arg =>
    typeof arg === 'string' ? redactPII(arg) : redactPIIFromObject(arg)
  );

  console.log(redactedMessage, ...redactedArgs);
}

/**
 * Safe console.error with PII redaction
 */
export function safeError(message: string, ...args: any[]): void {
  const redactedMessage = redactPII(message);
  const redactedArgs = args.map(arg =>
    typeof arg === 'string' ? redactPII(arg) : redactPIIFromObject(arg)
  );

  console.error(redactedMessage, ...redactedArgs);
}

export default {
  redactPII,
  redactPIIFromObject,
  maskString,
  maskEmail,
  maskPhone,
  containsPII,
  safeLog,
  safeError,
};
