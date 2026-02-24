# Email Environment Variables

This document explains all environment variables related to the email system.

---

## Required Variables

### Core Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | ✅ Yes |
| `EMAIL_FROM` or `FROM_EMAIL` | Sender email address (Twilio SendGrid) | `noreply@varsityhub.app` | ✅ Yes |
| `APP_BASE_URL` | Base URL for links in emails | `https://varsityhub.app` | ✅ Yes |

**How to get Twilio SendGrid API Key:**
1. Go to [Twilio SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to Settings → API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the key (starts with `SG.`)

**Note**: Twilio owns SendGrid. Use your Twilio account to access SendGrid.

**Sender Email:**
- Default: `noreply@varsityhub.app` (already configured)
- Must be verified in Twilio SendGrid
- For production, ensure the domain is verified in SendGrid
- Current production sender: `noreply@varsityhub.app`

---

## Template IDs (Required)

SendGrid uses dynamic templates. Each template needs a Template ID configured:

| Variable | Template | Required |
|----------|----------|----------|
| `SENDGRID_VERIFICATION_TEMPLATE_ID` | Email verification | ✅ Yes |
| `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` | Password reset | ✅ Yes |
| `SENDGRID_TEAM_INVITE_TEMPLATE_ID` | Team invitations | ✅ Yes |
| `SENDGRID_ORG_INVITE_TEMPLATE_ID` | Organization invitations | ✅ Yes |
| `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID` | Join request (admin) | ✅ Yes |
| `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID` | Join request approved | ✅ Yes |
| `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID` | Join request denied | ✅ Yes |

**How to get Template IDs:**
1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to Email API → Dynamic Templates
3. Create or select a template
4. Copy the Template ID (e.g., `d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

---

## Optional Template IDs

| Variable | Template | Required |
|----------|----------|----------|
| `SENDGRID_ABUSE_REPORT_TEMPLATE_ID` | Abuse reports | No |
| `SENDGRID_ORG_APPROVAL_TEMPLATE_ID` | Organization approval | No |
| `SENDGRID_ORG_DENIAL_TEMPLATE_ID` | Organization denial | No |
| `SENDGRID_CONTENT_MODERATION_TEMPLATE_ID` | Content moderation | No |
| `SENDGRID_BILLING_NOTICE_TEMPLATE_ID` | Billing notices | No |

---

## Email Service Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_PROVIDER` | Email provider to use | `sendgrid` | No |
| `EMAIL_TIMEOUT_MS` | Request timeout (milliseconds) | `10000` | No |
| `EMAIL_RETRY_ATTEMPTS` | Number of retry attempts | `2` | No |
| `EMAIL_RETRY_DELAY_MS` | Delay between retries (milliseconds) | `1000` | No |
| `EMAIL_ENABLE_LOGGING` | Enable structured logging | `true` | No |
| `EMAIL_ENABLE_QUEUE` | Enable queue-based sending | `false` | No |

---

## Other Email-Related Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CUSTOMER_SERVICE_EMAIL` | Email for abuse reports | `customerservice@varsityhub.app` | No |
| `REDIS_URL` | Redis URL for email queue | - | No (only if using queue) |

---

## Environment-Specific Configuration

### Development

```bash
EMAIL_PROVIDER=test  # Use test provider (logs emails instead of sending)
EMAIL_ENABLE_LOGGING=true
EMAIL_TIMEOUT_MS=10000
```

### Production

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-production-key
EMAIL_FROM=noreply@varsityhub.app
EMAIL_ENABLE_LOGGING=true
EMAIL_RETRY_ATTEMPTS=2
EMAIL_TIMEOUT_MS=10000
```

---

## Validation

The email service validates configuration at startup:

- ✅ API key format (must start with `SG.`)
- ✅ Sender email format (must be valid email)
- ✅ Required template IDs are present

If validation fails, warnings are logged but the service still initializes (to allow graceful degradation).

---

## Security Notes

⚠️ **Never commit these values to version control!**

- All email-related secrets should be in environment variables
- Use different keys for development and production
- Rotate API keys regularly
- Restrict API key permissions in SendGrid (only "Mail Send" needed)

---

## Troubleshooting

### "Email service not configured"
- Check `SENDGRID_API_KEY` is set
- Check `EMAIL_FROM` is set
- Verify API key is valid in SendGrid dashboard

### "Template ID not configured"
- Check template ID environment variables are set
- Verify template IDs exist in SendGrid
- Check template IDs are correct (format: `d-...`)

### "Email send failed"
- Check SendGrid API key permissions
- Verify sender email is verified in SendGrid
- Check SendGrid account status (not suspended)
- Review error logs for specific error codes

---

## See Also

- [EMAIL_GUIDE.md](./EMAIL_GUIDE.md) - Complete email system guide
- [EMAIL_AUDIT.md](./EMAIL_AUDIT.md) - Email system audit
