# Email Testing Guide

This guide explains how to test and verify that emails are working correctly in VarsityHub.

## Quick Test Options

### 1. **Test Email Configuration** (No Server Required)

Check if email configuration is set up correctly:

```bash
# Check environment variables
cd server
grep -E "SENDGRID_API_KEY|EMAIL_FROM|SENDGRID_.*_TEMPLATE_ID" .env
```

**What to check:**
- ✅ `SENDGRID_API_KEY` is set (should start with `SG.`)
- ✅ `EMAIL_FROM` is set (e.g., `noreply@varsityhub.app`)
- ✅ Required template IDs are configured:
  - `SENDGRID_VERIFICATION_TEMPLATE_ID`
  - `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
  - `SENDGRID_TEAM_INVITE_TEMPLATE_ID`
  - `SENDGRID_ORG_INVITE_TEMPLATE_ID`

### 2. **Test via API Endpoints** (Server Running)

The server includes test email endpoints at `/test-emails/*`. These allow you to send test emails without triggering real user flows.

#### Start the server:
```bash
cd server
npm run dev
```

#### Test endpoints:

**Verification Email:**
```bash
curl -X POST http://localhost:3001/test-emails/verification \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "token": "123456",
    "name": "Test User"
  }'
```

**Password Reset Email:**
```bash
curl -X POST http://localhost:3001/test-emails/password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "code": "654321"
  }'
```

**Team Invite Email:**
```bash
curl -X POST http://localhost:3001/test-emails/team-invite \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "teamName": "Dallas Lady Tigers",
    "organizationName": "Texas Elite Sports",
    "role": "player",
    "inviterName": "Coach Smith"
  }'
```

**Organization Invite Email:**
```bash
curl -X POST http://localhost:3001/test-emails/org-invite \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "organizationName": "Texas Elite Sports",
    "role": "coach",
    "inviterName": "Director Johnson"
  }'
```

**Transaction Report:**
```bash
curl -X POST http://localhost:3001/test-emails/transaction-report \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "date": "2025-01-12"
  }'
```

### 3. **Comprehensive Email Test Suite**

Run the comprehensive test script that tests all email templates:

```bash
npx tsx scripts/test-all-emails.ts
```

This will:
- Test all 40+ email templates
- Send test emails to your configured test email
- Generate a `test-results.json` report
- Show pass/fail status for each email type

**Output:**
- ✅ Green checkmarks for successful sends
- ❌ Red X for failed sends
- Summary with pass rate percentage

### 4. **Automated Email System Test**

Run the automated email system test:

```bash
npx tsx scripts/test-email-system.ts
```

This will:
- ✅ Check SendGrid API key configuration
- ✅ Verify email template IDs
- ✅ Test email library functions
- ✅ Test API endpoints
- ✅ Generate detailed report

### 5. **Test Real User Flows**

#### Test Email Verification:
1. Create a new user account (or use existing unverified account)
2. Request verification code: `POST /auth/verify/request`
3. Check your email for verification code

#### Test Password Reset:
1. Go to forgot password flow
2. Enter your email: `POST /auth/password/request-reset`
3. Check your email for reset code

#### Test Team Invite:
1. Create a team invitation
2. Send invite via API or UI
3. Check invitee's email for invite link

## Verification Checklist

Use this checklist to verify emails are working:

- [ ] SendGrid API key is configured in `server/.env`
- [ ] Email from address is verified in SendGrid
- [ ] All required SendGrid templates are created and IDs are set
- [ ] Server can access SendGrid API (no firewall blocks)
- [ ] Test email endpoints return `{ "ok": true }`
- [ ] Test emails appear in inbox (check spam folder)
- [ ] Email links work correctly
- [ ] Email templates render correctly with dynamic data

## Troubleshooting

### Emails not sending?

1. **Check SendGrid Status:**
   ```bash
   # In server directory
   node -e "console.log(process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Missing')"
   ```

2. **Check Server Logs:**
   Look for email-related errors:
   - `[email] Failed to send...`
   - `[email] SendGrid not configured...`
   - `[email] Missing template...`

3. **Check SendGrid Dashboard:**
   - Visit https://app.sendgrid.com
   - Check "Activity" tab for sent emails
   - Verify API key is active
   - Check email deliverability stats

4. **Test Configuration:**
   ```bash
   cd server
   node -e "
     import('./src/lib/email.js').then(({ isSendGridConfigured, getMissingEmailTemplates }) => {
       console.log('SendGrid configured:', isSendGridConfigured());
       console.log('Missing templates:', getMissingEmailTemplates());
     });
   "
   ```

### Emails going to spam?

1. **Verify sender domain** in SendGrid
2. **Set up SPF records** for your domain
3. **Set up DKIM** authentication
4. **Set up DMARC** policy
5. **Use verified sender email** address

### Template errors?

1. **Check template IDs** match in SendGrid dashboard
2. **Verify template variables** match dynamic template data
3. **Test template** directly in SendGrid UI
4. **Check template status** (should be "Active")

## Email Types Tested

The system includes tests for:

### Auth & Security (5 emails)
- ✅ Email verification
- ✅ Password reset
- ✅ Password changed
- ✅ Account recovery
- ✅ Login from new device

### Moderation & Trust (7 emails)
- ✅ Report resolved
- ✅ Report dismissed
- ✅ Account warning
- ✅ Content removed
- ✅ Account suspension (7 days)
- ✅ Account suspension (45 days)
- ✅ Permanent ban

### Events (7 emails)
- ✅ Event submission received
- ✅ Event approved
- ✅ Event denied
- ✅ Event reminder
- ✅ Event updated
- ✅ Event canceled
- ✅ RSVP confirmed

### Team & Organization (9 emails)
- ✅ Organization invitation
- ✅ Team invitation
- ✅ Athlete invitation
- ✅ Role assignment
- ✅ Roster threshold
- ✅ Invitation declined
- ✅ Team roster update
- ✅ Staff member joined
- ✅ User confirmation

### Billing (2+ emails)
- ✅ Payment failed
- ✅ Subscription expiring
- ✅ Payment succeeded (via Stripe webhook)
- ✅ Ad reservation received
- ✅ Ad payment required

## Environment Variables Reference

```bash
# Required
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@varsityhub.app

# Template IDs (required for core flows)
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_ORG_INVITE_TEMPLATE_ID=d-xxxxxxxxxxxxx

# Optional template IDs
SENDGRID_ABUSE_REPORT_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_ORG_APPROVAL_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_ORG_DENIAL_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_CONTENT_MODERATION_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_BILLING_NOTICE_TEMPLATE_ID=d-xxxxxxxxxxxxx

# Base URL for email links
APP_BASE_URL=https://varsityhub.app
```

## Next Steps

After verifying emails work:

1. ✅ Monitor SendGrid dashboard for delivery rates
2. ✅ Set up email analytics tracking
3. ✅ Configure email webhooks for bounces/complaints
4. ✅ Set up automated email testing in CI/CD
5. ✅ Review email templates for branding consistency
