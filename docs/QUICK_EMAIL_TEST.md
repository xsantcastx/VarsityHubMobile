# Quick Email Test Guide

## Run the Quick Email Test

```bash
./scripts/quick-email-test.sh
```

Or manually:

```bash
bash scripts/quick-email-test.sh
```

## What It Tests

1. **Email Configuration**
   - ✅ Checks if `SENDGRID_API_KEY` is set
   - ✅ Verifies `EMAIL_FROM` address
   - ✅ Checks required template IDs are configured

2. **API Endpoints**
   - ✅ Tests `/test-emails/verification` endpoint
   - ✅ Tests `/test-emails/password-reset` endpoint
   - ✅ Verifies server is running

## Prerequisites

1. **Server must be running:**

   ```bash
   cd server && npm run dev
   ```

2. **Environment variables** must be set in `server/.env`:
   - `SENDGRID_API_KEY` (required)
   - `EMAIL_FROM` or `FROM_EMAIL` (defaults to `noreply@varsityhub.app`)
   - `SENDGRID_VERIFICATION_TEMPLATE_ID` (required for verification emails)
   - `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` (required for password reset emails)
   - `SENDGRID_TEAM_INVITE_TEMPLATE_ID` (required for team invites)
   - `SENDGRID_ORG_INVITE_TEMPLATE_ID` (required for org invites)

3. **Optional environment variables:**
   - `API_BASE_URL` or `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3001`)
   - `TEST_EMAIL` (defaults to `emilmancero@gmail.com`)

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║              📧 EMAIL SYSTEM QUICK TEST                        ║
╚════════════════════════════════════════════════════════════════╝

🔧 STEP 1: CHECKING EMAIL CONFIGURATION
─────────────────────────────────────────────────────────────────
✅ SENDGRID_API_KEY: Configured (SG.xxxx...yyyy)
📧 EMAIL_FROM: noreply@varsityhub.app

📋 CHECKING TEMPLATE IDs:
  ✅ VERIFICATION: Configured
  ✅ PASSWORD_RESET: Configured
  ✅ TEAM_INVITE: Configured
  ✅ ORG_INVITE: Configured

🔗 STEP 2: TESTING API ENDPOINTS
─────────────────────────────────────────────────────────────────
API URL: http://localhost:3001
Test Email: emilmancero@gmail.com

✅ Server is running at http://localhost:3001

📤 Testing Verification Email Endpoint...
  ✅ Verification email sent successfully

📤 Testing Password Reset Email Endpoint...
  ✅ Password reset email sent successfully

╔════════════════════════════════════════════════════════════════╗
║                      📊 TEST SUMMARY                           ║
╚════════════════════════════════════════════════════════════════╝

📧 Check your email inbox (emilmancero@gmail.com) for test emails
📋 Check SendGrid dashboard: https://app.sendgrid.com

✅ Email test complete!
```

## Troubleshooting

### Server Not Running

```bash
# Start the server first
cd server
npm run dev
```

### SendGrid Not Configured

```bash
# Add to server/.env
SENDGRID_API_KEY=SG.your_api_key_here
```

### Missing Template IDs

```bash
# Add template IDs to server/.env
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxxxxxxxxxx
```

### Emails Not Received

1. Check spam folder
2. Verify SendGrid dashboard for delivery status
3. Check SendGrid activity log: https://app.sendgrid.com/activity
4. Verify sender email is verified in SendGrid

## Next Steps

After successful test:

1. ✅ Verify emails in inbox (check spam)
2. ✅ Check SendGrid dashboard for delivery stats
3. ✅ Test real user flows (signup, password reset)
4. ✅ Monitor email delivery rates
