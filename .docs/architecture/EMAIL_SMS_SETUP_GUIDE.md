# Email & SMS Verification - Setup & Testing Guide

**Quick Links:**
- 📋 [Full Regression Checklist](./EMAIL_SMS_REGRESSION_CHECKLIST.md)
- 🧪 [Test Script](./scripts/email-verification-test.sh)
- 📊 [Implementation Audit](./EMAIL_SMS_VERIFICATION_AUDIT.md)
- 🧱 [Template Matrix](./docs/EMAIL_TEMPLATE_MATRIX.md)

---

## Current Status

✅ **SendGrid:** Configured  
- API Key: Set in `server/.env`
- Templates: Verification, Password Reset, Team Invite configured
- Status: Ready to send emails

🔲 **Twilio:** Not configured (optional)  
- SMS verification not enabled
- Can be added later if needed

---

## Quick Start (5 minutes)

### 1. Verify Configuration
```bash
# Check health endpoint
curl http://localhost:4000/health | jq .integrations

# Expected output:
# {
#   "sendgrid": true,
#   "twilio": false
# }
```

### 2. Start Backend
```bash
cd server
npm run dev
```

### 3. Run Test Suite
```bash
# In another terminal
./scripts/email-verification-test.sh
```

### 4. Check Results
- Email arrives in inbox within 30 seconds
- Verification code works
- Rate limiting prevents spam
- Test shows "✅ Email Verification Test Complete"

---

## Manual Testing

### Test Registration → Email Flow

**1. Register a test account:**
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test-'$(date +%s)'@varsityhub.app",
    "password":"TestPass123!",
    "display_name":"Test User"
  }'
```

**Save the response:**
- `access_token` - Use for next requests
- `dev_verification_code` - 6-digit code (dev mode only)
- `user.id` - User ID

**2. Watch for email:**
- Check inbox/spam for verification email
- Should arrive within 30 seconds
- Contains 6-digit code

**3. Submit verification code:**
```bash
# Using dev code from response:
curl -X POST http://localhost:4000/auth/verify/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"code":"<dev_verification_code>"}'

# Or using code from email:
curl -X POST http://localhost:4000/auth/verify/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"code":"123456"}'
```

**Expected response:**
```json
{
  "ok": true,
  "user": {
    "id": "...",
    "email": "test@varsityhub.app",
    "email_verified": true
  }
}
```

**4. Verify in database:**
```bash
npx prisma studio
# Users table → Find your test user
# email_verified should be: true
# email_verification_code should be: (empty)
```

---

## Testing Rate Limiting

### Resend Code Rate Limit (1 per 30s, max 5/hour)

**Test 1: 30-second window**
```bash
# First request
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"
# Result: HTTP 200

# Immediate second request
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"
# Result: HTTP 429 (Too Many Requests)

# After 31 seconds
sleep 31
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"
# Result: HTTP 200
```

**Test 2: Hourly limit (5 total)**
```bash
# Make 5 requests (waiting 31s between each)
for i in {1..5}; do
  curl -X POST http://localhost:4000/auth/verify/request \
    -H "Authorization: Bearer <token>"
  sleep 31
done
# Result: All HTTP 200

# 6th request
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"
# Result: HTTP 429
```

---

## Production Mode Testing

Before deploying to production, test with `NODE_ENV=production`:

```bash
# Start backend in production mode
cd server
export NODE_ENV=production
npm run dev
```

**Key differences:**
- ❌ No `dev_verification_code` in response
- ✅ Must rely on email delivery
- ✅ 30-minute code expiration enforced
- ✅ Proper error messages for UX

**Test registration:**
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","display_name":"Tester"}'

# Response should NOT include dev_verification_code
# Check email inbox for code
```

---

## Testing with App

### In Expo App (Mobile)

**1. Register:**
- Go to Sign Up screen
- Enter email and password
- Create account

**2. Verify:**
- Automatically routed to Verify Email screen (`app/verify-email.tsx`)
- Either:
  - Enter code from email
  - Or use dev code from console (dev mode only)

**3. Check Flow:**
- Loading state appears
- Code input shows placeholder "123456"
- Submit button enabled after 4+ digits
- Success message shows after verification
- Auto-redirected to onboarding/feed

**4. Rate Limiting:**
- Try "Resend Code" button
- Wait 30s between attempts
- After 5 attempts, get "Too many requests" error

---

## Troubleshooting

### Email Not Arriving

**Step 1: Check health endpoint**
```bash
curl http://localhost:4000/health | jq .integrations.sendgrid
# Should be: true
```

**Step 2: Check server logs**
```
# Look for:
[email] Verification email sent successfully
# Or error:
[email] SendGrid verification template not configured
```

**Step 3: Verify SendGrid config**
```bash
# Check .env
grep SENDGRID server/.env

# Should see:
SENDGRID_API_KEY=SG.xxx
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxx
```

**Step 4: Test email endpoint directly**
```bash
curl -X POST http://localhost:4000/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'

# Response:
# 200: { "success": true }
# 503: SendGrid not configured
# 500: SendGrid error (check logs)
```

### Code Not Verifying

**Check these in order:**

1. **Is code correct?**
   ```bash
   # In dev mode, check console output
   # Copy exact code (6 digits)
   ```

2. **Is code expired?** (30 min window)
   ```bash
   # Check when registered
   # Codes expire after 30 minutes
   ```

3. **Is user in database?**
   ```bash
   npx prisma studio
   # Find user by email
   # Check email_verification_code matches
   ```

4. **Is token valid?**
   ```bash
   # Make sure you're using correct access_token
   # Token from registration response
   ```

---

## Configuration Reference

### Required for Email
```bash
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxx
EMAIL_FROM=noreply@varsityhub.app
APP_BASE_URL=http://localhost:3000
```

### Optional for SMS
```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_FROM_PHONE=+1234567890
```

### To Get SendGrid Key
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up or log in
3. Settings > API Keys > Create API Key
4. Copy key (starts with `SG.`)
5. Add to `server/.env`

### To Get Twilio Key (optional)
1. Go to [twilio.com](https://twilio.com)
2. Sign up or log in
3. Console > Account info
4. Copy Account SID and Auth Token
5. Buy phone number with SMS enabled
6. Add to `server/.env`

---

## Files Modified

**Core:**
- `server/src/lib/email.ts` - SendGrid integration
- `server/src/lib/twilio.ts` - Twilio integration (optional)
- `server/src/routes/auth.ts` - Registration, verification, resend endpoints
- `app/verify-email.tsx` - Frontend verification screen

**Configuration:**
- `server/.env` - API keys and template IDs
- `server/src/routes/health.ts` - Health check for integrations

**Testing:**
- `scripts/email-verification-test.sh` - Automated test suite
- `EMAIL_SMS_REGRESSION_CHECKLIST.md` - Manual testing guide

---

## Next Steps

1. **Verify it works** (5 mins)
   ```bash
   ./scripts/email-verification-test.sh
   ```

2. **Test with app** (5 mins)
   - Register in Expo app
   - Check email
   - Enter code
   - Verify success

3. **Before production** (2 mins)
   ```bash
   export NODE_ENV=production
   npm run dev
   # Test without dev shortcuts
   ```

4. **Add to CI** (10 mins)
   - Run test script in GitHub Actions
   - Alert if SendGrid config missing
   - Prevent deploy if health check fails

5. **Optional: SMS** (30 mins)
   - Get Twilio credentials
   - Add to Railway env
   - Enable SMS in auth routes
   - Test end-to-end

---

**Last Updated:** December 3, 2025  
**Status:** ✅ Email verification ready to test
