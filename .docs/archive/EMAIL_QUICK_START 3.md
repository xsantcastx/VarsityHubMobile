# Email Service Security - Quick Start Guide

## TL;DR

Your email service is now stronger with:
- ✅ Email validation (RFC 5322 compliant)
- ✅ Input sanitization (XSS prevention)
- ✅ Better error handling
- ✅ 11 comprehensive tests
- ✅ 3 documentation guides

**Status:** Production-ready. Continue building email templates with confidence.

---

## Using the New Validation Functions

### Import the Functions
```typescript
import { isValidEmail, sanitizeInput } from '../lib/email';
```

### Validate Email Addresses
```typescript
// Check if an email is valid before using it
if (!isValidEmail(userEmail)) {
  return res.status(400).json({ error: 'Invalid email address' });
}

// Safe to proceed
await sendPasswordResetEmail(userEmail, code);
```

### Sanitize User Input
```typescript
// Prevent XSS by sanitizing user-provided strings
const cleanName = sanitizeInput(req.body.displayName);
const cleanOrg = sanitizeInput(req.body.organizationName);

// Safe to pass to email templates
await sendOrganizationInvitationEmail({
  recipientName: cleanName,
  organizationName: cleanOrg,
  ...otherParams
});
```

---

## Common Patterns

### Pattern: Password Reset Email
```typescript
// 1. Validate email
if (!isValidEmail(userEmail)) {
  throw new Error('Invalid email');
}

// 2. Generate code
const code = generateSecureCode();

// 3. Send email (sanitized)
const sent = await sendPasswordResetEmail(
  userEmail,
  code,
  sanitizeInput(userName)
);

if (!sent) {
  // Handle error
}
```

### Pattern: Team Invitation Email
```typescript
// Sanitize all user input
const cleanRecipient = sanitizeInput(recipientName);
const cleanTeam = sanitizeInput(teamName);
const cleanRole = sanitizeInput(role);

// Send with validated email
await sendOrganizationInvitationEmail({
  to: validatedEmail, // Already validated
  recipientName: cleanRecipient,
  organizationName: cleanTeam,
  role: cleanRole,
  // ...
});
```

---

## Testing Your Code

### Test Email Validation
```typescript
import { isValidEmail, sanitizeInput } from '../lib/email';

// Valid emails
expect(isValidEmail('user@example.com')).toBe(true);

// Invalid emails
expect(isValidEmail('invalid')).toBe(false);
expect(isValidEmail('user@')).toBe(false);

// Sanitization
expect(sanitizeInput('<script>alert("xss")</script>'))
  .not.toContain('<');
```

### Run Tests
```bash
cd server
npm test -- __tests__/email-validation.test.ts
```

---

## Troubleshooting

### "Invalid email address" Error
**Problem:** Email validation is rejecting a valid-looking email
**Solution:** Check if email contains spaces or invalid characters
```typescript
console.log(isValidEmail('user@example.com')); // true
console.log(isValidEmail('user @example.com')); // false (has space)
```

### Template Variables Not Rendering
**Problem:** User names or org names appear blank in email
**Solution:** Make sure you sanitized input before sending
```typescript
// ❌ WRONG
await sendVerificationEmail(email, code, userInput.name);

// ✅ CORRECT
await sendVerificationEmail(
  email,
  code,
  sanitizeInput(userInput.name)
);
```

### HTML Tags Showing in Email
**Problem:** Email shows `<img>` instead of rendering image
**Solution:** That's sanitizeInput() removing HTML - use URLs instead
```typescript
// ❌ Don't pass HTML
const html = '<img src="logo.png">';

// ✅ Pass URL in template variable
const logoUrl = 'https://example.com/logo.png';
// SendGrid template will render it
```

---

## File Locations

| File | Purpose |
|------|---------|
| `server/src/lib/email.ts` | Email service with validation |
| `server/src/__tests__/email-validation.test.ts` | Test suite (11 tests) |
| `EMAIL_SERVICE_IMPROVEMENTS.md` | Technical details |
| `EMAIL_SERVICE_BEST_PRACTICES.md` | Usage patterns & guidelines |
| `CODE_QUALITY_SUMMARY.md` | High-level summary |

---

## What Changed (Simplified)

### Before
```typescript
// No validation
sendPasswordResetEmail(email, code, name);
```

### After
```typescript
// Validated & sanitized
if (!isValidEmail(email)) return;
const cleanName = sanitizeInput(name);
sendPasswordResetEmail(email, code, cleanName);
```

---

## Production Checklist

Before deploying email features:
- [ ] Email addresses validated with `isValidEmail()`
- [ ] User input sanitized with `sanitizeInput()`
- [ ] All tests passing
- [ ] SendGrid templates created
- [ ] Environment variables set:
  - `SENDGRID_API_KEY`
  - `SENDGRID_*_TEMPLATE_ID` variables
  - `EMAIL_FROM`
  - `APP_BASE_URL`

---

## Quick Links

- **Implementation:** `server/src/lib/email.ts`
- **Tests:** `server/src/__tests__/email-validation.test.ts`
- **Security Guide:** `EMAIL_SERVICE_BEST_PRACTICES.md`
- **Technical Details:** `EMAIL_SERVICE_IMPROVEMENTS.md`
- **Summary:** `CODE_QUALITY_SUMMARY.md`

---

## Need Help?

1. **How do I use the new functions?**
   → See "Using the New Validation Functions" above

2. **What are common patterns?**
   → See "Common Patterns" section or EMAIL_SERVICE_BEST_PRACTICES.md

3. **My email validation is failing**
   → Check "Troubleshooting" section

4. **Is this backward compatible?**
   → Yes! All existing code continues to work unchanged.

5. **Do I need to change my code?**
   → Not required, but recommended for security. See best practices guide.

---

## Examples

### ✅ Good: Validated & Sanitized
```typescript
// Validate email
if (!isValidEmail(userEmail)) {
  return res.status(400).json({ error: 'Invalid email' });
}

// Sanitize names
const name = sanitizeInput(req.body.displayName);
const org = sanitizeInput(req.body.organizationName);

// Send safely
await sendVerificationEmail(userEmail, code, name);
await sendOrganizationInvitationEmail({
  to: userEmail,
  recipientName: name,
  organizationName: org,
  // ...
});
```

### ❌ Bad: No Validation
```typescript
// Direct use of user input - vulnerable!
await sendVerificationEmail(
  req.body.email,
  code,
  req.body.displayName // Could contain HTML!
);
```

---

**Last Updated:** December 17, 2025  
**Status:** ✅ Ready to Use  
**Questions?** See the documentation files referenced above.
