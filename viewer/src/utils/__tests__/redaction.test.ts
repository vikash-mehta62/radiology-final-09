import { describe, it, expect } from 'vitest';
import {
  redactPII,
  redactPIIFromObject,
  maskString,
  maskEmail,
  maskPhone,
  containsPII,
} from '../redaction';

describe('redaction', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for details';
      const redacted = redactPII(text);
      expect(redacted).toBe('Contact me at [EMAIL_REDACTED] for details');
      expect(redacted).not.toContain('john.doe@example.com');
    });

    it('should redact multiple emails', () => {
      const text = 'Email john@test.com or jane@test.org';
      const redacted = redactPII(text);
      expect(redacted).toBe('Email [EMAIL_REDACTED] or [EMAIL_REDACTED]');
    });

    it('should redact US phone numbers', () => {
      const tests = [
        { input: 'Call (123) 456-7890', expected: 'Call [PHONE_REDACTED]' },
        { input: 'Phone: 123-456-7890', expected: 'Phone: [PHONE_REDACTED]' },
        { input: 'Mobile 1234567890', expected: 'Mobile [PHONE_REDACTED]' },
      ];

      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact MRN patterns', () => {
      const tests = [
        { input: 'MRN: ABC123456', expected: '[MRN_REDACTED]' },
        { input: 'Patient MRN XY9876543', expected: 'Patient [MRN_REDACTED]' },
        { input: 'Record AB123456789', expected: 'Record [MRN_REDACTED]' },
      ];

      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      const redacted = redactPII(text);
      expect(redacted).toBe('SSN: [SSN_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const tests = [
        { input: '1234-5678-9012-3456', expected: '[CARD_REDACTED]' },
        { input: '1234 5678 9012 3456', expected: '[CARD_REDACTED]' },
      ];

      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact IP addresses', () => {
      const text = 'Server IP: 192.168.1.100';
      const redacted = redactPII(text);
      expect(redacted).toBe('Server IP: [IP_REDACTED]');
    });

    it('should handle empty or null input', () => {
      expect(redactPII('')).toBe('');
      expect(redactPII(null as any)).toBe(null);
      expect(redactPII(undefined as any)).toBe(undefined);
    });

    it('should support custom patterns', () => {
      const text = 'Account: ACC-12345';
      const redacted = redactPII(text, {
        customPatterns: [
          { pattern: /ACC-\d{5}/g, replacement: '[ACCOUNT_REDACTED]' },
        ],
      });
      expect(redacted).toBe('Account: [ACCOUNT_REDACTED]');
    });

    it('should allow selective redaction', () => {
      const text = 'Email: test@example.com, Phone: 123-456-7890';
      
      // Only redact emails
      const emailOnly = redactPII(text, { redactEmails: true, redactPhones: false });
      expect(emailOnly).toContain('[EMAIL_REDACTED]');
      expect(emailOnly).toContain('123-456-7890');
      
      // Only redact phones
      const phoneOnly = redactPII(text, { redactEmails: false, redactPhones: true });
      expect(phoneOnly).toContain('test@example.com');
      expect(phoneOnly).toContain('[PHONE_REDACTED]');
    });
  });

  describe('redactPIIFromObject', () => {
    it('should redact PII in object values', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
      };

      const redacted = redactPIIFromObject(obj);
      expect(redacted.name).toBe('John Doe');
      expect(redacted.email).toBe('[EMAIL_REDACTED]');
      expect(redacted.phone).toBe('[PHONE_REDACTED]');
    });

    it('should redact sensitive field names', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        apiKey: 'key-12345',
      };

      const redacted = redactPIIFromObject(obj);
      expect(redacted.username).toBe('john');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          email: 'test@example.com',
          profile: {
            phone: '123-456-7890',
          },
        },
      };

      const redacted = redactPIIFromObject(obj);
      expect(redacted.user.email).toBe('[EMAIL_REDACTED]');
      expect(redacted.user.profile.phone).toBe('[PHONE_REDACTED]');
    });

    it('should handle arrays', () => {
      const obj = {
        emails: ['test1@example.com', 'test2@example.com'],
      };

      const redacted = redactPIIFromObject(obj);
      expect(redacted.emails).toEqual(['[EMAIL_REDACTED]', '[EMAIL_REDACTED]']);
    });
  });

  describe('maskString', () => {
    it('should mask string showing last N characters', () => {
      expect(maskString('1234567890', 4)).toBe('******7890');
      expect(maskString('secret', 2)).toBe('****et');
    });

    it('should not mask short strings', () => {
      expect(maskString('abc', 4)).toBe('abc');
      expect(maskString('ab', 2)).toBe('ab');
    });
  });

  describe('maskEmail', () => {
    it('should mask email local part', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j*******@example.com');
      expect(maskEmail('a@example.com')).toBe('a@example.com');
    });

    it('should handle invalid emails', () => {
      expect(maskEmail('notanemail')).toBe('notanemail');
      expect(maskEmail('')).toBe('');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone showing last 4 digits', () => {
      expect(maskPhone('123-456-7890')).toBe('***-***-7890');
      expect(maskPhone('(123) 456-7890')).toBe('***-***-7890');
      expect(maskPhone('1234567890')).toBe('***-***-7890');
    });

    it('should handle short numbers', () => {
      expect(maskPhone('123')).toBe('123');
    });
  });

  describe('containsPII', () => {
    it('should detect PII in text', () => {
      expect(containsPII('Email: test@example.com')).toBe(true);
      expect(containsPII('SSN: 123-45-6789')).toBe(true);
      expect(containsPII('Phone: 123-456-7890')).toBe(true);
      expect(containsPII('MRN: ABC123456')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(containsPII('This is a clean message')).toBe(false);
      expect(containsPII('Patient has chest pain')).toBe(false);
    });

    it('should handle empty input', () => {
      expect(containsPII('')).toBe(false);
      expect(containsPII(null as any)).toBe(false);
    });
  });

  describe('integration', () => {
    it('should redact complex medical report text', () => {
      const report = `
        Patient: John Doe
        MRN: AB1234567
        Email: john.doe@hospital.com
        Phone: (555) 123-4567
        SSN: 123-45-6789
        
        Clinical findings indicate...
      `;

      const redacted = redactPII(report);
      
      expect(redacted).not.toContain('AB1234567');
      expect(redacted).not.toContain('john.doe@hospital.com');
      expect(redacted).not.toContain('(555) 123-4567');
      expect(redacted).not.toContain('123-45-6789');
      
      expect(redacted).toContain('[MRN_REDACTED]');
      expect(redacted).toContain('[EMAIL_REDACTED]');
      expect(redacted).toContain('[PHONE_REDACTED]');
      expect(redacted).toContain('[SSN_REDACTED]');
      expect(redacted).toContain('Clinical findings indicate');
    });
  });
});
