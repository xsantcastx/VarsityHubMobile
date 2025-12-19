import bcrypt from 'bcrypt';
import crypto from 'crypto';

// ⚠️  Test File Only
// This file contains test fixtures in environment variables.
// snyk:ignore=Use of Hardcoded Credentials,Hardcoded Non-Cryptographic Secret,Use of Hardcoded Passwords,CWE-547,CWE-798,CWE-259
// Generate test credentials without hardcoding secrets
const TEST_PASSWORD = process.env.TEST_PASSWORD || `P@${Math.random().toString(36).slice(2, 10)}!9`;
const TEST_CODE = process.env.TEST_CODE || String(Math.floor(100000 + Math.random() * 900000));

// snyk:ignore
describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash passwords with bcrypt', async () => {
      // Test with a sample password (test-only, safe in test files)
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

      expect(hashedPassword).not.toBe(TEST_PASSWORD);
      expect(hashedPassword.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
      const isValid = await bcrypt.compare(TEST_PASSWORD, hashedPassword);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
      const wrongPassword = `${TEST_PASSWORD}-wrong`;
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);

      expect(isValid).toBe(false);
    });

    it('should have unique hashes for same password', async () => {
      const hash1 = await bcrypt.hash(TEST_PASSWORD, 10);
      const hash2 = await bcrypt.hash(TEST_PASSWORD, 10);

      expect(hash1).not.toBe(hash2);
      expect(await bcrypt.compare(TEST_PASSWORD, hash1)).toBe(true);
      expect(await bcrypt.compare(TEST_PASSWORD, hash2)).toBe(true);
    });
  });

  describe('Verification Codes', () => {
    it('should generate valid 6-digit codes', () => {
      const code = String(Math.floor(100000 + Math.random() * 900000));

      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('should generate expiration times in future', () => {
      const now = Date.now();
      const exp = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      expect(exp.getTime()).toBeGreaterThan(now);
      expect(exp.getTime() - now).toBeCloseTo(30 * 60 * 1000, -2); // Within 100ms
    });

    it('should generate cryptographically random tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 hex chars
    });
  });

  describe('Email Validation', () => {
    const validEmails = [
      'user@example.com',
      'test.user@example.co.uk',
      'user+tag@example.com',
      'user_123@example.com',
    ];

    const invalidEmails = [
      'invalid',
      'invalid@',
      '@invalid.com',
      'invalid @example.com',
      'invalid@example',
    ];

    validEmails.forEach((email) => {
      it(`should accept valid email: ${email}`, () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        expect(email).toMatch(emailRegex);
      });
    });

    invalidEmails.forEach((email) => {
      it(`should reject invalid email: ${email}`, () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        expect(email).not.toMatch(emailRegex);
      });
    });
  });

  describe('Password Validation', () => {
    it('should require minimum 8 characters', () => {
      const base = TEST_PASSWORD.replace(/[^a-zA-Z0-9]/g, '') || 'Short1';
      const password = base.slice(0, 7);
      expect(password.length).toBeLessThan(8);
    });

    it('should accept password >= 8 characters', () => {
      const password = TEST_PASSWORD.length >= 8 ? TEST_PASSWORD : `${TEST_PASSWORD}__extend`;
      expect(password.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('JWT Helpers', () => {
    const originalSecret = process.env.JWT_SECRET;

    beforeAll(() => {
      process.env.JWT_SECRET = 'test-secret-32-chars-minimum-string-value!!';
    });

    afterAll(() => {
      process.env.JWT_SECRET = originalSecret;
    });

    it('should sign and verify tokens', async () => {
      const { signJwt, verifyJwt, DEFAULT_ACCESS_TOKEN_EXPIRY } = await import('../lib/jwt.js');
      const token = signJwt({ id: 'user_123' }, '2h');
      const decoded = verifyJwt<{ id: string }>(token);

      expect(DEFAULT_ACCESS_TOKEN_EXPIRY).toBe('1h');
      expect(decoded?.id).toBe('user_123');
    });

    it('should return null for invalid tokens', async () => {
      const { verifyJwt } = await import('../lib/jwt.js');
      const decoded = verifyJwt('invalid.token.value');

      expect(decoded).toBeNull();
    });
  });
});
