# VarsityHub Server - New Features Documentation

This document outlines the new features added to the VarsityHub backend:
- **Twilio SMS Integration** - SMS-based verification
- **Sentry Error Tracking** - Production error monitoring
- **Swagger API Documentation** - Interactive API docs
- **Jest Unit Tests** - Core test suite

---

## 🔔 Twilio SMS Integration

### Overview
Optional SMS verification system using Twilio. Can be used alongside email verification for enhanced security.

### Features
- Send SMS verification codes
- Password reset via SMS
- Generic SMS notifications
- Graceful fallback if not configured

### Setup

#### 1. Install Twilio
Dependencies are already in `package.json`. Run:
```bash
cd server
npm install
```

#### 2. Configure Twilio Credentials
Add to `.env` or Railway environment variables:
```env
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_PHONE=+1234567890
```

Get these from: https://console.twilio.com

#### 3. Usage in Code

**Send SMS Verification Code:**
```typescript
import { sendSmsVerificationCode } from './lib/twilio.js';

// In your route
const phoneNumber = '+12345678900'; // E.164 format
const code = String(Math.floor(100000 + Math.random() * 900000));
const sent = await sendSmsVerificationCode(phoneNumber, code);
```

**Send Password Reset SMS:**
```typescript
import { sendSmsPasswordReset } from './lib/twilio.js';

const sent = await sendSmsPasswordReset(phoneNumber, resetCode);
```

**Generic Notification:**
```typescript
import { sendSmsNotification } from './lib/twilio.js';

const sent = await sendSmsNotification(phoneNumber, 'Your message here');
```

### Benefits
- ✅ Two-factor authentication
- ✅ Backup verification method if email fails
- ✅ Higher conversion rate for sensitive operations
- ✅ International support (E.164 format)

### Monitoring
Check SMS delivery in Twilio Dashboard: https://console.twilio.com/monitor/logs/sms

---

## 🎯 Sentry Error Tracking

### Overview
Production error monitoring and performance tracking. Automatically captures exceptions, logs, and performance metrics.

### Features
- Automatic exception tracking
- Breadcrumb trail for debugging
- User context tracking
- Performance monitoring
- Profiling (optional)
- Filtered health check requests

### Setup

#### 1. Create Sentry Account
1. Sign up at https://sentry.io
2. Create new project (select Node.js)
3. Copy DSN (format: `https://key@sentry.io/project-id`)

#### 2. Configure
Add to `.env`:
```env
SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_PROFILING_ENABLED=1  # Optional, for performance profiling
```

#### 3. Automatic Error Capture
Errors are automatically captured by Sentry middleware:
- Unhandled exceptions
- Request errors
- API errors
- Database errors

#### 4. Manual Error Capture
```typescript
import { captureException, captureMessage, setUserContext, addBreadcrumb } from './lib/sentry.js';

// Capture an error
try {
  // some code
} catch (error) {
  captureException(error, { userId: user.id });
}

// Capture a message
captureMessage('Something important happened', 'warning');

// Track user for errors
setUserContext(userId, email, username);

// Add debugging breadcrumb
addBreadcrumb('User clicked submit', 'user-action', 'info', { orderId: '123' });
```

### Dashboard
View errors at: https://sentry.io/organizations/your-org/issues/

### Performance
- Development: 100% sampling (all requests)
- Production: 10% sampling (1 in 10 requests)
- Adjust in `server/src/lib/sentry.ts` if needed

---

## 📚 Swagger API Documentation

### Overview
Interactive API documentation at `/api-docs` endpoint. Auto-generated from OpenAPI 3.0 spec.

### Access
Visit in development:
```
http://localhost:4000/api-docs
```

In production:
```
https://api-production-8ac3.up.railway.app/api-docs
```

### Features
- ✅ Try API endpoints directly in browser
- ✅ Auto-populated with JWT authentication
- ✅ Request/response examples
- ✅ Parameter documentation
- ✅ Error code reference

### Schema
Located in `server/src/lib/swagger.ts`

Currently includes:
- User schema
- Post schema
- Game schema
- Team schema
- Auth responses
- Error responses

### Extend Documentation
To add more endpoints:

```typescript
// In swagger.ts
components: {
  schemas: {
    Post: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        // ... more properties
      }
    }
  }
}
```

### Benefits
- Reduces API documentation maintenance
- Developers can test endpoints before coding
- Clear contract between frontend/backend
- Automatic spec updates

---

## 🧪 Jest Unit Tests

### Overview
Core unit tests for authentication, payments, and ads. Currently at ~50% code coverage.

### Setup

#### 1. Install Dependencies
```bash
cd server
npm install
```

#### 2. Run Tests
```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Files

#### Authentication Tests (`src/__tests__/auth.test.ts`)
- Password hashing with bcrypt
- Password verification
- Verification code generation
- Email format validation
- Password strength validation

#### Payment Tests (`src/__tests__/payments.test.ts`)
- Price calculation (weekday/weekend rates)
- Membership plan validation
- Transaction status validation
- Payment amount validation
- Stripe integration checks

#### Ad Tests (`src/__tests__/ads.test.ts`)
- Ad creation validation
- Contact email validation
- Geographic validation (ZIP codes)
- Ad status transitions
- Banner URL validation
- Payment status tracking

### Coverage Report
```bash
npm run test:coverage
```

Generates HTML report in `coverage/index.html`

### Writing New Tests

Example test structure:
```typescript
describe('Feature Name', () => {
  describe('Specific Behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test data';
      
      // Act
      const result = processData(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Best Practices
- ✅ One assertion per test when possible
- ✅ Descriptive test names (use "should...")
- ✅ Group related tests with `describe`
- ✅ Use beforeEach/afterEach for setup/teardown
- ✅ Test edge cases and error conditions

### Integration Tests (Future)
Consider adding:
- Database integration tests
- API endpoint tests
- Authentication flow tests
- Payment workflow tests

---

## Environment Variables Summary

Add to `.env` in server directory:

```env
# Twilio (Optional - SMS verification)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_PHONE=+1234567890

# Sentry (Optional - Error tracking)
SENTRY_DSN=https://key@sentry.io/project-id
SENTRY_PROFILING_ENABLED=0

# Existing variables (unchanged)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
STRIPE_SECRET_KEY=sk_...
CLOUDINARY_CLOUD_NAME=...
```

---

## Deployment Checklist

Before production deployment:

- [ ] **Twilio**: Configure account SID, auth token, phone number
- [ ] **Sentry**: Create project, add DSN to environment variables
- [ ] **Tests**: Run `npm run test:coverage` - aim for >50% coverage
- [ ] **Swagger**: Verify `/api-docs` endpoint is accessible
- [ ] **Logs**: Check that Sentry is receiving errors

---

## Troubleshooting

### Twilio SMS not sending
1. Verify Twilio account is active (not trial with restrictions)
2. Check phone number format (must be E.164: +1234567890)
3. Ensure FROM_PHONE is verified in Twilio
4. Check Twilio logs: https://console.twilio.com/monitor/logs/sms

### Sentry not capturing errors
1. Verify DSN is correct
2. Check that `initSentry()` is called before other middleware
3. Test with manual `captureException()` call
4. Check network tab for sentry.io requests

### Tests failing
1. Run `npm install` to ensure all dependencies installed
2. Check that `@types/jest` is installed
3. Verify `.env` has test database URL
4. Try running single test: `npm test -- auth.test.ts`

---

## Next Steps

1. **Twilio**: Add SMS verification endpoint to auth routes
2. **Tests**: Expand coverage to include integration tests
3. **Swagger**: Add endpoint-level documentation
4. **Sentry**: Set up alerts for critical errors
5. **Performance**: Add database query profiling

---

## Resources

- [Twilio Docs](https://www.twilio.com/docs)
- [Sentry Docs](https://docs.sentry.io/platforms/node/)
- [Swagger/OpenAPI](https://swagger.io/)
- [Jest Documentation](https://jestjs.io/)
