# Email System - Quick Start

**Provider**: Twilio SendGrid  
**Default Sender**: `noreply@varsityhub.app`

---

## ✅ Step 1: Verify Configuration

Run the verification script:

```bash
cd server
npm run verify:email
```

This will check:
- ✅ SendGrid API key is set
- ✅ Email sender (`noreply@varsityhub.app`) is configured
- ✅ Required template IDs are set
- ✅ Service is ready to use

---

## ✅ Step 2: Check Environment Variables

Make sure these are set in your `.env` file:

```bash
# Required
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@varsityhub.app
APP_BASE_URL=https://varsityhub.app

# Required Template IDs
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxxxxxxxxx
SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-xxxxxxxxxxxx
SENDGRID_ORG_INVITE_TEMPLATE_ID=d-xxxxxxxxxxxx
```

---

## ✅ Step 3: Test Email Sending

Start your server:

```bash
cd server
npm run dev
```

You should see:
```
✅ Email service initialized successfully
```

Test sending an email:

```bash
curl -X POST http://localhost:4000/api/test-emails/verification \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com", "name": "Test User"}'
```

---

## ✅ Step 4: Verify in Twilio SendGrid

1. Go to [Twilio SendGrid Dashboard](https://app.sendgrid.com)
2. Check **Activity Feed** for sent emails
3. Verify `noreply@varsityhub.app` is verified as sender

---

## Troubleshooting

### "Email service not configured"
- Check `SENDGRID_API_KEY` is set
- Verify API key is valid in Twilio SendGrid
- Run `npm run verify:email` to see specific issues

### "Template ID not configured"
- Check template ID environment variables are set
- Verify templates exist in Twilio SendGrid
- Template IDs should start with `d-`

### Emails not sending
- Check Twilio SendGrid account status
- Verify sender email (`noreply@varsityhub.app`) is verified
- Check server logs for error messages

---

## Next Steps

- See [EMAIL_GUIDE.md](./EMAIL_GUIDE.md) for complete documentation
- See [EMAIL_ENV.md](./EMAIL_ENV.md) for all environment variables
