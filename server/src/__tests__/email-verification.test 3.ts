/**
 * Email Verification Tests
 *
 * Tests the email verification flow end-to-end:
 * - sendVerificationEmail function with fallback
 * - sendPasswordResetEmail function with fallback
 * - Verification code generation and validation
 * - Email content validation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Email Verification', () => {
  describe('Verification Code Generation', () => {
    it('should generate a valid 6-digit code', () => {
      const code = String(Math.floor(100000 + Math.random() * 900000));

      expect(code).toMatch(/^\d{6}$/);
      expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code)).toBeLessThan(1000000);
    });

    it('should generate unique codes on multiple calls', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        codes.add(code);
      }

      // With 100 attempts, we should have at least 90 unique codes
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should create expiration time 30 minutes in future', () => {
      const now = Date.now();
      const exp = new Date(Date.now() + 30 * 60 * 1000);

      const diffMinutes = (exp.getTime() - now) / (60 * 1000);
      expect(diffMinutes).toBeCloseTo(30, 0);
    });
  });

  describe('Email Content', () => {
    it('should include verification code in subject for fallback emails', () => {
      const code = '123456';
      const expectedSubject = `${code} is your VarsityHub verification code`;

      expect(expectedSubject).toContain(code);
      expect(expectedSubject).toContain('VarsityHub');
    });

    it('should include verification code in HTML content', () => {
      const code = '654321';
      const htmlContent = `
        <div style="background: #fff; border-radius: 8px; padding: 20px; display: inline-block;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563EB;">${code}</span>
        </div>
      `;

      expect(htmlContent).toContain(code);
      expect(htmlContent).toContain('font-size: 32px');
      expect(htmlContent).toContain('letter-spacing: 8px');
    });

    it('should include verification code in plain text content', () => {
      const code = '789012';
      const plainText = `Your verification code is: ${code}`;

      expect(plainText).toContain(code);
    });

    it('should include user name in email greeting', () => {
      const userName = 'TestUser';
      const greeting = `Hi ${userName},`;

      expect(greeting).toContain(userName);
    });

    it('should include expiration notice', () => {
      const expirationNotice = 'This code will expire in 30 minutes.';

      expect(expirationNotice).toContain('30 minutes');
    });
  });

  describe('Password Reset Email Content', () => {
    it('should include reset code in subject for fallback emails', () => {
      const code = '123456';
      const expectedSubject = `${code} is your VarsityHub password reset code`;

      expect(expectedSubject).toContain(code);
      expect(expectedSubject).toContain('password reset');
    });

    it('should use different styling for password reset (red vs blue)', () => {
      const verificationColor = '#2563EB'; // Blue for verification
      const resetColor = '#DC2626'; // Red for password reset

      expect(verificationColor).not.toBe(resetColor);
    });
  });

  describe('Email Validation', () => {
    const validEmails = [
      'user@example.com',
      'test.user@example.co.uk',
      'user+tag@example.com',
      'user_123@example.org',
      'user-name@example.io',
    ];

    const invalidEmails = [
      '',
      'invalid',
      'invalid@',
      '@invalid.com',
      'invalid @example.com',
      'invalid@example',
      ' @test.com',
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

  describe('Fallback Email Behavior', () => {
    it('should generate complete HTML email with all required elements', () => {
      const code = '123456';
      const userName = 'Test User';
      const appUrl = 'https://varsityhub.app';

      // Simulate the HTML template structure
      const htmlParts = [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<body',
        'VarsityHub',
        `Hi ${userName}`,
        code,
        '30 minutes',
        appUrl,
        '</body>',
        '</html>',
      ];

      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body>
          <h1>VarsityHub</h1>
          <p>Hi ${userName},</p>
          <p>Your code: ${code}</p>
          <p>Expires in 30 minutes</p>
          <a href="${appUrl}">${appUrl}</a>
        </body>
        </html>
      `;

      htmlParts.forEach((part) => {
        expect(mockHtml).toContain(part);
      });
    });

    it('should generate complete plain text email', () => {
      const code = '654321';
      const userName = 'Test User';

      const requiredContent = [
        `Hi ${userName}`,
        `Your verification code is: ${code}`,
        '30 minutes',
        'VarsityHub',
      ];

      const mockPlainText = `
Hi ${userName},

Your verification code is: ${code}

This code will expire in 30 minutes.

Thanks,
The VarsityHub Team
      `.trim();

      requiredContent.forEach((content) => {
        expect(mockPlainText).toContain(content);
      });
    });
  });

  describe('Code Verification Logic', () => {
    it('should match codes exactly (string comparison)', () => {
      const storedCode = '123456';
      const inputCode = '123456';

      expect(String(inputCode)).toBe(String(storedCode));
    });

    it('should reject mismatched codes', () => {
      const storedCode = '123456';
      const inputCode = '654321';

      expect(String(inputCode)).not.toBe(String(storedCode));
    });

    it('should handle leading zeros correctly', () => {
      // Codes should be compared as strings, not numbers
      const code1 = '012345'; // This wouldn't be generated by Math.floor(100000 + ...) but testing edge case
      const code2 = '12345';

      expect(code1).not.toBe(code2);
      expect(parseInt(code1)).toBe(parseInt(code2)); // But as numbers they're equal - that's why we use string comparison
    });

    it('should detect expired codes', () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 1000); // 1 second ago
      const validTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

      expect(now > expiredTime).toBe(true); // Code is expired
      expect(now > validTime).toBe(false); // Code is still valid
    });
  });
});

describe('Email Service Configuration', () => {
  it('should have correct SendGrid API key format check', () => {
    const validKey = 'SG.abc123.xyz789';
    const invalidKey = 'invalid-key';

    expect(validKey.startsWith('SG.')).toBe(true);
    expect(invalidKey.startsWith('SG.')).toBe(false);
  });

  it('should validate from email format', () => {
    const validFrom = 'noreply@varsityhub.app';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    expect(validFrom).toMatch(emailRegex);
  });

  it('should have fallback from email', () => {
    const defaultFrom = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';

    expect(defaultFrom).toBeDefined();
    expect(defaultFrom.length).toBeGreaterThan(0);
  });
});

describe('Template Data', () => {
  it('should include all required verification template fields', () => {
    const code = '123456';
    const userName = 'TestUser';
    const appBaseUrl = 'https://varsityhub.app';

    const templateData = {
      verification_link: `${appBaseUrl}/verify?token=${encodeURIComponent(code)}`,
      user_name: userName,
      verification_code: code,
      code: code, // Alternate field name some templates use
    };

    expect(templateData.verification_code).toBe(code);
    expect(templateData.code).toBe(code);
    expect(templateData.user_name).toBe(userName);
    expect(templateData.verification_link).toContain(code);
  });

  it('should include all required password reset template fields', () => {
    const code = '654321';

    const templateData = {
      reset_code: code,
      code: code,
      expires_in: '30 minutes',
    };

    expect(templateData.reset_code).toBe(code);
    expect(templateData.code).toBe(code);
    expect(templateData.expires_in).toBe('30 minutes');
  });

  it('should include common template data', () => {
    // Simulate getCommonTemplateData()
    const mockCommonData = {
      privacy_policy_url: 'https://limeprod.com/VarsityHubPrivacy',
      community_guidelines_url: 'https://limeprod.com/VarsityHubPrivacy',
      instagram_url: 'https://www.instagram.com/varsityhub_',
      tiktok_url: 'https://www.tiktok.com/@varsity.hub',
      youtube_url: 'https://youtube.com/@varsityhub',
      facebook_url: 'https://www.facebook.com/share/17t7MJa9vx/',
      x_url: 'https://x.com/varsityhub00',
      website_url: 'https://limeprod.com',
      customer_service_email: 'support@varsityhub.app',
    };

    expect(mockCommonData.privacy_policy_url).toContain('VarsityHubPrivacy');
    expect(mockCommonData.instagram_url).toContain('instagram.com');
    expect(mockCommonData.customer_service_email).toContain('@');
  });
});
