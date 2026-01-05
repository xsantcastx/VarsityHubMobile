import { isValidEmail, sanitizeInput } from '../lib/email';

describe('Email Validation & Sanitization', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@example.co.uk',
        'test+tag@domain.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'plainaddress',
        'user@',
        '@example.com',
        'user@.com',
        'user @example.com',
        'user@example',
        'a'.repeat(255) + '@example.com', // Too long
      ];

      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    it('should reject non-string values', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });

    it('should enforce maximum email length of 254 characters', () => {
      const tooLong = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(tooLong)).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove leading and trailing whitespace', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
      expect(sanitizeInput('\n\ttab and newline\n')).toBe('tab and newline');
    });

    it('should remove HTML-like tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('<img src="x" />')).toBe('img src="x" /');
      expect(sanitizeInput('Hello <b>World</b>')).toBe('Hello bWorld/b');
    });

    it('should handle null and undefined values', () => {
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });

    it('should preserve normal text', () => {
      expect(sanitizeInput('John Doe')).toBe('John Doe');
      expect(sanitizeInput('user@example.com')).toBe('user@example.com');
      expect(sanitizeInput('Test 123')).toBe('Test 123');
    });

    it('should handle mixed content safely', () => {
      const input = '  John <html> Doe  ';
      const output = sanitizeInput(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('John');
      expect(output).toContain('Doe');
    });
  });

  describe('Email Security', () => {
    it('should prevent injection through user names', () => {
      const maliciousNames = [
        '<img src=x onerror="alert(1)">',
        '"; DROP TABLE users; --',
        '<script>alert("xss")</script>',
      ];

      maliciousNames.forEach((name) => {
        const sanitized = sanitizeInput(name);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });

    it('should maintain data integrity for legitimate long strings', () => {
      const longName = 'Verylongname' + 'x'.repeat(100);
      const sanitized = sanitizeInput(longName);
      expect(sanitized).toContain('Verylongname');
    });
  });
});
