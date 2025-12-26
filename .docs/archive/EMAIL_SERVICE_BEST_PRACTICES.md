# Email Service Best Practices Guide

## Overview

This guide provides best practices for using the email service in VarsityHub backend, with emphasis on security and reliability.

## Security First

### 1. Always Validate User Input

Before calling any email function, validate the input data:

```typescript
// ❌ BAD - No validation
sendPasswordResetEmail(userEmail, code, userName);

// ✅ GOOD - With validation
if (isValidEmail(userEmail) && code && code.length > 0) {
  sendPasswordResetEmail(userEmail, code, userName);
}
```

### 2. Use Sanitized User Names

User names come from user input and must be sanitized:

```typescript
import { sanitizeInput } from './email';

// ❌ BAD - Direct user input
const userName = req.body.displayName;
sendVerificationEmail(email, code, userName);

// ✅ GOOD - Sanitized input
const userName = sanitizeInput(req.body.displayName);
sendVerificationEmail(email, code, userName);
```

### 3. Never Log Sensitive Data

Never log emails, tokens, or codes with user info:

```typescript
// ❌ BAD - Logs sensitive info
console.log(`Sending reset email to ${email} with code ${code}`);

// ✅ GOOD - Generic logging
debugLog(`Password reset email sent to ${email}`);
```

## Common Patterns

### Pattern 1: Password Reset Flow

```typescript
// 1. Validate email
if (!isValidEmail(userEmail)) {
  return res.status(400).json({ error: 'Invalid email' });
}

// 2. Generate secure code
const resetCode = generateSecureCode();

// 3. Store reset token with expiration
await prisma.passwordReset.create({
  data: {
    email: userEmail,
    code: hashCode(resetCode), // Hash before storing
    expiresAt: addHours(new Date(), 1),
  },
});

// 4. Send email
const sent = await sendPasswordResetEmail(userEmail, resetCode, userName);
if (!sent) {
  return res.status(500).json({ error: 'Failed to send email' });
}

return res.json({ message: 'Check your email for reset link' });
```

### Pattern 2: Verification Email

```typescript
// 1. Generate code
const verificationCode = generateVerificationCode();

// 2. Store code in database
await prisma.emailVerification.create({
  data: {
    userId: user.id,
    code: hashCode(verificationCode),
    expiresAt: addMinutes(new Date(), 15),
  },
});

// 3. Send email with sanitized name
const sent = await sendVerificationEmail(
  email,
  verificationCode,
  sanitizeInput(user.firstName)
);

if (!sent) {
  throw new Error('Failed to send verification email');
}
```

### Pattern 3: Organizational Invitations

```typescript
// ❌ AVOID - Complex template data
const sent = await sendOrganizationInvitationEmail({
  to: email,
  recipientName: userInput.name, // Unsanitized!
  organizationName: org.name,
  inviterName: inviter.name,
  role: userInput.role, // Unsanitized!
  acceptLink: generateLink(token),
  declineLink: generateLink(token),
});

// ✅ GOOD - Sanitize before passing
const sent = await sendOrganizationInvitationEmail({
  to: email,
  recipientName: sanitizeInput(userInput.name),
  organizationName: sanitizeInput(org.name),
  inviterName: sanitizeInput(inviter.name),
  role: sanitizeInput(userInput.role),
  acceptLink: generateLink(token),
  declineLink: generateLink(token),
});
```

## Error Handling

### Check Send Results

```typescript
// ❌ BAD - Fire and forget
sendPasswordResetEmail(email, code, name);

// ✅ GOOD - Check result
const sent = await sendPasswordResetEmail(email, code, name);
if (!sent) {
  // Log error and notify user
  console.error(`Failed to send password reset email to ${email}`);
  // Consider: retry, alternative delivery, user notification
}
```

### Graceful Degradation

```typescript
// If emails fail in development, still allow flow to continue
const emailSent = await sendVerificationEmail(email, code, name);

// App works without email in dev
if (!emailSent && process.env.NODE_ENV === 'production') {
  throw new Error('Email service unavailable');
}

// Continue flow even if email fails in non-production
```

## Template Variable Guidelines

### Standard Variable Naming

VarsityHub templates use snake_case variables:

```typescript
// ✅ CORRECT - snake_case for SendGrid templates
const data = {
  user_name: 'John Doe',
  reset_link: 'https://...',
  org_name: 'My Organization',
};

// ❌ WRONG - camelCase for SendGrid
const data = {
  userName: 'John Doe',  // ❌ Template won't render
  resetLink: 'https://...',
};
```

### Required vs Optional

```typescript
// Check TEMPLATE_IDS configuration
import { TEMPLATE_IDS, isSendGridConfigured } from './email';

if (!isSendGridConfigured()) {
  console.warn('SendGrid not configured, emails disabled');
}

// Provide defaults for optional fields
const emailData = {
  user_name: userName || 'VarsityHub User',
  org_logo: logoUrl || undefined, // Skip if not provided
};
```

## Testing Email Functions

### Unit Test Example

```typescript
import { isValidEmail, sanitizeInput } from '../lib/email';

describe('Email Security', () => {
  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should sanitize HTML in user input', () => {
    const result = sanitizeInput('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});
```

### Integration Test Example

```typescript
describe('Password Reset Email', () => {
  it('should send email with valid inputs', async () => {
    const result = await sendPasswordResetEmail(
      'user@example.com',
      'ABC123',
      'John Doe'
    );
    expect(result).toBe(true);
  });

  it('should reject invalid email', async () => {
    const result = await sendPasswordResetEmail(
      'invalid-email',
      'ABC123',
      'John Doe'
    );
    expect(result).toBe(false);
  });
});
```

## Configuration Checklist

Before deploying email features:

- [ ] All `SENDGRID_*_TEMPLATE_ID` env vars set in production
- [ ] `SENDGRID_API_KEY` configured
- [ ] `EMAIL_FROM` set to verified sender address
- [ ] `APP_BASE_URL` correct for environment
- [ ] SendGrid templates created and tested
- [ ] Template variables match function parameters
- [ ] No hardcoded template IDs in code
- [ ] Error logging configured
- [ ] Rate limiting considered (future)
- [ ] Email queue tested with real SendGrid

## Troubleshooting

### Template Not Found Error

```
[email] SendGrid template (PASSWORD_RESET) not configured
```

**Fix:** Check environment variables
```bash
echo $SENDGRID_PASSWORD_RESET_TEMPLATE_ID
```

### Invalid Email Address

```
[email] Invalid email address for password reset: invalid@email
```

**Fix:** Validate email before calling email function
```typescript
if (!isValidEmail(email)) {
  throw new Error('Invalid email address');
}
```

### SendGrid API Key Not Configured

```
[email] SendGrid API key not configured
```

**Fix:** Set environment variable
```bash
export SENDGRID_API_KEY="SG.xxxxx"
```

## References

- [SendGrid Dynamic Templates](https://sendgrid.com/dynamic-templates/)
- [RFC 5322 Email Format](https://tools.ietf.org/html/rfc5322)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- `server/src/lib/email.ts` - Implementation
- `server/src/__tests__/email-validation.test.ts` - Tests

---

**Last Updated:** December 17, 2025
**Maintained By:** VarsityHub Development Team
