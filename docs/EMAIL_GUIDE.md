# Email System Guide

Complete guide to the VarsityHub email system.

**Email Provider**: Twilio SendGrid  
**Default Sender**: `noreply@varsityhub.app`

---

## Architecture

### Overview

The email system uses a **provider abstraction pattern** with the following components:

```
Application Code
    ↓
EmailService (Centralized Service)
    ↓
EmailProvider (SendGridProvider)
    ↓
SendGrid API
```

### Components

1. **EmailService** (`server/src/services/email/EmailService.ts`)
   - Centralized email sending interface
   - Retry logic with exponential backoff
   - Structured logging with correlation IDs
   - Input validation
   - Error classification

2. **EmailProvider** (`server/src/services/email/providers/`)
   - Provider abstraction layer
   - Currently: SendGridProvider
   - Easy to add new providers (SMTP, Mailgun, etc.)

3. **Legacy Wrappers** (`server/src/lib/email.ts`)
   - Backward-compatible functions
   - Wraps EmailService for existing code
   - Maintains existing function signatures

---

## How It Works

### Sending an Email

1. **Direct Call** (Synchronous)

   ```typescript
   import { sendVerificationEmail } from '../lib/email.js';

   await sendVerificationEmail(email, code, userName);
   ```

2. **Using EmailService** (Recommended for new code)

   ```typescript
   import { getEmailService } from '../services/email/service.js';

   const service = getEmailService();
   const result = await service.send({
     to: 'user@example.com',
     subject: 'Welcome!',
     text: 'Welcome to VarsityHub',
     html: '<h1>Welcome to VarsityHub</h1>',
   });
   ```

3. **Template Email**
   ```typescript
   const result = await service.send({
     to: 'user@example.com',
     subject: 'Verify your account',
     templateId: 'd-xxxxxxxxxxxx',
     templateData: {
       verification_code: '123456',
       user_name: 'John',
     },
   });
   ```

### Retry Logic

- **Default**: 2 retry attempts
- **Backoff**: Exponential (1s, 2s, 4s...)
- **Retryable Errors**: Network errors, timeouts, rate limits
- **Non-retryable**: Invalid recipient, configuration errors

### Logging

All emails are logged with:

- Correlation ID (for tracking)
- Provider name
- Success/failure status
- Error codes (if failed)

Example log:

```
[EmailService] Sending email (attempt 1/2) {
  correlationId: 'email-1234567890-1',
  to: 'user@example.com',
  subject: 'Welcome',
  provider: 'sendgrid'
}
```

---

## Adding a New Email

### Step 1: Create Template in SendGrid

1. Go to SendGrid Dashboard → Dynamic Templates
2. Create a new template
3. Copy the Template ID (e.g., `d-xxxxxxxxxxxx`)

### Step 2: Add Template ID to Environment

Add to `.env`:

```bash
SENDGRID_NEW_EMAIL_TEMPLATE_ID=d-xxxxxxxxxxxx
```

### Step 3: Add Template ID Constant

In `server/src/lib/email.ts`:

```typescript
const TEMPLATE_IDS = {
  // ... existing templates
  NEW_EMAIL: process.env.SENDGRID_NEW_EMAIL_TEMPLATE_ID || '',
};
```

### Step 4: Create Function

In `server/src/lib/email.ts`:

```typescript
export async function sendNewEmail(params: {
  to: string;
  userName: string;
  // ... other params
}): Promise<boolean> {
  return sendTemplateEmail(
    TEMPLATE_IDS.NEW_EMAIL,
    params.to,
    'Your Subject',
    {
      user_name: params.userName,
      // ... template data
    },
    `New email sent to ${params.to}`
  );
}
```

### Step 5: Use in Code

```typescript
import { sendNewEmail } from '../lib/email.js';

await sendNewEmail({
  to: user.email,
  userName: user.name,
});
```

---

## Switching Providers

### Current: SendGrid

The system currently uses SendGrid. To switch providers:

1. **Create New Provider**

   ```typescript
   // server/src/services/email/providers/NewProvider.ts
   export class NewProvider implements EmailProvider {
     // Implement interface
   }
   ```

2. **Update Service Configuration**

   ```typescript
   // In service.ts
   const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
   ```

3. **Set Environment Variable**
   ```bash
   EMAIL_PROVIDER=newprovider
   ```

The EmailService will automatically use the new provider.

---

## Testing Emails

### Development Mode

Set `EMAIL_PROVIDER=test` to log emails instead of sending:

```bash
EMAIL_PROVIDER=test npm run server:dev
```

Emails will be logged to console instead of being sent.

### Test Endpoint

Use the test email endpoint:

```bash
curl -X POST http://localhost:4000/api/test-emails/verification \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "name": "Test User"}'
```

### Manual Testing

1. Set up SendGrid sandbox mode
2. Use test email addresses
3. Check SendGrid activity feed

---

## Debugging Failures

### Check Logs

Look for correlation IDs in logs:

```
[EmailService] Email send failed after all retries {
  correlationId: 'email-1234567890-1',
  attempts: 2,
  lastError: 'SendGrid request timed out'
}
```

### Common Issues

1. **"Email service not configured"**
   - Check `SENDGRID_API_KEY` is set
   - Check `EMAIL_FROM` is set

2. **"Template ID not configured"**
   - Check template ID env var is set
   - Verify template exists in SendGrid

3. **"Invalid recipient"**
   - Check email address format
   - Verify email is not blocked

4. **"Rate limit exceeded"**
   - SendGrid has rate limits
   - Use queue for high-volume sends
   - Wait and retry

5. **"Timeout"**
   - Network issues
   - SendGrid API slow
   - Increase `EMAIL_TIMEOUT_MS`

### SendGrid Dashboard

Check SendGrid dashboard for:

- API key status
- Template status
- Activity feed
- Bounce/spam reports

---

## Queue-Based Sending

For high-volume or non-critical emails, use the queue:

```typescript
import { queueEmail } from '../jobs/queues.js';

await queueEmail({
  to: 'user@example.com',
  subject: 'Notification',
  text: 'Your notification',
});
```

Benefits:

- Async processing
- Built-in retry logic
- Rate limiting
- Better for high volume

---

## Security Best Practices

1. **Never expose API keys**
   - Use environment variables only
   - Never log API keys
   - Rotate keys regularly

2. **Validate inputs**
   - Email addresses are validated
   - Template data is sanitized
   - No XSS in email content

3. **Rate limiting**
   - Queue-based sends have rate limiting
   - Direct sends should be limited by application logic

4. **Error handling**
   - Don't expose internal errors to users
   - Log errors for debugging
   - Graceful degradation

---

## Performance

### Optimization Tips

1. **Use Queue for Non-Critical Emails**
   - Better for high volume
   - Doesn't block request handling

2. **Batch Sends**
   - SendGrid supports batch sending
   - More efficient for multiple recipients

3. **Template Caching**
   - Templates are cached by SendGrid
   - No performance impact

4. **Timeout Configuration**
   - Set appropriate timeout
   - Balance between reliability and speed

---

## Monitoring

### Health Check

Check email service health:

```bash
curl http://localhost:4000/api/health
```

Response includes:

```json
{
  "integrations": {
    "sendgrid": true,
    "missingTemplates": []
  }
}
```

### Metrics to Monitor

- Email send success rate
- Average send time
- Retry rate
- Error types
- Rate limit hits

---

## Migration Notes

### From Old System

The new system is **backward compatible**. Existing code continues to work:

```typescript
// Old code still works
await sendVerificationEmail(email, code, userName);
```

### New Code

Use EmailService directly for better control:

```typescript
const service = getEmailService();
const result = await service.send({ ... });
```

---

## See Also

- [EMAIL_AUDIT.md](./EMAIL_AUDIT.md) - System audit
- [EMAIL_ENV.md](./EMAIL_ENV.md) - Environment variables
- [SendGrid Documentation](https://docs.sendgrid.com/)
