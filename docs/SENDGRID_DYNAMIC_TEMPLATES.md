# SendGrid Dynamic Templates Integration

**Status**: ✅ Integrated  
**Date**: December 2, 2025

---

## Overview

VarsityHub now sends emails using **SendGrid Dynamic Templates** for branded, consistent messaging. The system automatically falls back to SMTP if templates fail.

---

## Environment Variables

Add these to your Railway/backend environment:

```bash
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=no-reply@yourdomain.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_api_key_here  # Same as SENDGRID_API_KEY
```

---

## Template Configuration

### Current Template ID
- **Template ID**: `d-e4a32dd538ee42358d1d5aba509445ac`
- **Name**: VarsityHub
- **Last Edited**: Dec 2, 2025

### Template Variables

Your Dynamic Template should include these variables:

```handlebars
{{verification_code}}   # 6-digit verification code
{{subject}}            # Email subject (optional override)
```

**Example Template Design:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Verify Your VarsityHub Account</h2>
  <p>Your verification code is:</p>
  <div style="background: #f4f4f4; padding: 20px; text-align: center;">
    <h1 style="font-size: 32px; letter-spacing: 4px;">{{verification_code}}</h1>
  </div>
  <p>This code will expire in 30 minutes.</p>
</div>
```

---

## How It Works

### Email Sending Flow

1. **SendGrid API (Primary)**:
   - Checks for `SENDGRID_API_KEY` or `SMTP_PASS` starting with `SG.`
   - Sends email using `sendEmailWithTemplate()` with Dynamic Template
   - Passes `verification_code` as dynamic data

2. **SMTP Fallback**:
   - If SendGrid fails or API key is missing
   - Uses nodemailer with SMTP credentials
   - Sends plain text email

### Code Integration

**Email Sending (`server/src/lib/email.ts`):**
```typescript
import sendgridMail from '@sendgrid/mail';

sendgridMail.setApiKey(SENDGRID_API_KEY);

export async function sendEmailWithTemplate(params: {
  to: string;
  templateId?: string;
  dynamicData: Record<string, any>;
}) {
  const msg = {
    to,
    from: process.env.FROM_EMAIL || 'noreply@varsityhub.app',
    templateId: 'd-e4a32dd538ee42358d1d5aba509445ac',
    dynamicTemplateData: dynamicData,
  };
  
  await sendgridMail.send(msg);
}
```

**Verification Email (`server/src/routes/auth.ts`):**
```typescript
await sendEmailWithTemplate({
  to: userEmail,
  dynamicData: {
    verification_code: '123456',
    subject: 'Verify your VarsityHub account',
  },
});
```

---

## Testing

### 1. Test Email Sending

Register a new account and check for the verification email:

```bash
curl -X POST https://your-api.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "display_name": "Test User"
  }'
```

### 2. Check Logs

Look for these log messages in Railway:

```
[email] Sending verification email via SendGrid Dynamic Template...
[email] ✅ Verification email sent successfully via SendGrid to test@example.com
```

### 3. Verify in SendGrid Dashboard

- Go to **Activity** in SendGrid dashboard
- Search for recipient email
- Check delivery status and open/click rates

---

## Adding More Templates

### Password Reset Template

1. Create a new Dynamic Template in SendGrid
2. Add template ID to environment:
   ```bash
   SENDGRID_TEMPLATE_PASSWORD_RESET=d-your-template-id
   ```
3. Update `server/src/lib/email.ts`:
   ```typescript
   const SENDGRID_TEMPLATES = {
     VERIFICATION: 'd-e4a32dd538ee42358d1d5aba509445ac',
     PASSWORD_RESET: 'd-your-password-reset-template-id',
     GENERAL: 'd-e4a32dd538ee42358d1d5aba509445ac',
   };
   ```

### Welcome Email Template

Variables to include:
```handlebars
{{user_name}}
{{verification_link}}
{{app_url}}
```

---

## Troubleshooting

### Emails Not Sending

1. **Check API Key**:
   ```bash
   echo $SENDGRID_API_KEY
   # Should start with SG.
   ```

2. **Verify Sender Authentication**:
   - Go to SendGrid → Settings → Sender Authentication
   - Ensure `FROM_EMAIL` domain is verified

3. **Check Logs**:
   ```bash
   railway logs --tail 100
   ```

4. **Test SendGrid API**:
   ```bash
   curl -X POST https://api.sendgrid.com/v3/mail/send \
     -H "Authorization: Bearer $SENDGRID_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "personalizations": [{"to": [{"email": "test@example.com"}]}],
       "from": {"email": "no-reply@yourdomain.com"},
       "subject": "Test Email",
       "content": [{"type": "text/plain", "value": "Test"}]
     }'
   ```

### Template Not Rendering

1. **Check Template ID**:
   - Verify in SendGrid → Dynamic Templates
   - Copy exact template ID

2. **Check Dynamic Data**:
   - Ensure all required variables are passed
   - Variable names must match template placeholders

3. **Test Template**:
   - Use SendGrid's Template Preview feature
   - Send test email from SendGrid dashboard

---

## Production Checklist

- [ ] SendGrid API key configured in Railway
- [ ] Sender domain verified in SendGrid
- [ ] `FROM_EMAIL` set to verified address
- [ ] Dynamic Template tested and active
- [ ] Fallback SMTP credentials configured
- [ ] Test email delivery end-to-end
- [ ] Monitor SendGrid Activity dashboard

---

## Resources

- [SendGrid Dynamic Templates Docs](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-templates)
- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [Sender Authentication Guide](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication)

