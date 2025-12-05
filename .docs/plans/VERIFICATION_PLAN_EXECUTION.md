# Verification Plan - Execution Checklist

**Status:** Configuration Complete ✅  
**Date:** December 3, 2025  
**Goal:** Execute the 4-phase verification plan and validate email/SMS systems

---

## Phase 1: Wire Up Config ✅ COMPLETE

### What Was Done
- [x] `SENDGRID_API_KEY` set in `server/.env`
- [x] `SENDGRID_VERIFICATION_TEMPLATE_ID` = `d-e6e34f349f364529a046d530ba3e03bd`
- [x] `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` = `d-0f8c1353d4d44599bff28635cd39c167`
- [x] `SENDGRID_TEAM_INVITE_TEMPLATE_ID` = `d-04a0746f62e04d9bbd63f8f70ff7897b`
- [x] `EMAIL_FROM` = `noreply@varsityhub.app`
- [x] `APP_BASE_URL` = `http://localhost:3000`
- [x] `TWILIO_*` vars documented (optional)

### Verification Points
- Backend `server/src/routes/auth.ts` line 48: sendVerificationEmail called
- Backend `server/src/routes/auth.ts` line 689: resend endpoint ready
- Backend `server/src/routes/auth.ts` line 721: confirm endpoint ready
- Helper `server/src/lib/email.ts` line 41: checks for API key + template ID
- Twilio helper `server/src/lib/twilio.ts` line 8: isTwilioConfigured() ready

---

## Phase 2: Run Health Probe ⏳ READY TO EXECUTE

### Command
```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Check health
curl http://localhost:4000/health | jq .integrations
```

### Expected Output
```json
{
  "database": true,
  "jwt": true,
  "cloudinary": true,
  "twilio": false,
  "stripe": true,
  "sendgrid": true,
  "googleOAuth": true,
  "googleMaps": true,
  "sentry": false
}
```

### Success Criteria
- [ ] `sendgrid: true` (API key + template ID present)
- [ ] `twilio: false` (optional, not configured yet)
- [ ] Overall `ready: true` (all required services present)

### If sendgrid is false
1. Check `server/.env` has `SENDGRID_API_KEY`
2. Check `SENDGRID_VERIFICATION_TEMPLATE_ID` is set
3. Verify no typos in env var names
4. Restart `npm run dev`

---

## Phase 3: Exercise Email End-to-End ⏳ READY TO EXECUTE

### Step 1: Register Fresh Account
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test-'$(date +%s)'@varsityhub.app",
    "password":"TestPass123!",
    "display_name":"Test User"
  }'
```

### Step 2: Watch Server Logs
Look for line 98 in `server/src/routes/auth.ts`:
```
[email] Verification email sent successfully
```

Expected timing: < 5 seconds

### Step 3: Verify Email Arrives
- Check inbox within 30 seconds
- From: `noreply@varsityhub.app`
- Contains: 6-digit code
- Contains: "expires in 30 minutes"

**Save the response:**
- `access_token` → Use for next requests
- `dev_verification_code` → Use in dev mode OR wait for email

### Step 4: Test with Dev Code (Dev Mode)
```bash
curl -X POST http://localhost:4000/auth/verify/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"code":"<dev_verification_code>"}'
```

Expected response:
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

### Step 5: Verify Database Updated
```bash
npx prisma studio
# Users table → Find test user
# email_verified should be: true
# email_verification_code should be: (empty)
# email_verification_expires should be: (empty)
```

### Step 6: Test Production Mode (Dev Shortcuts Disabled)
```bash
# Stop current server (Ctrl+C)
export NODE_ENV=production
npm run dev

# Register again
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test-prod@example.com","password":"Test123!","display_name":"Prod"}'

# IMPORTANT: Response should NOT include dev_verification_code
# You MUST receive real email to proceed
```

### Step 7: Test in Expo App
1. Launch app: `npm start` from root
2. Go to Sign Up screen
3. Enter email and password
4. Hit Create Account
5. Should auto-route to `app/verify-email.tsx` (line 14)
6. Check inbox for email
7. Enter code from email
8. Should show "✅ Email verified successfully!"
9. Should auto-redirect to onboarding/feed

---

## Phase 4: Use Test Hooks for Diagnostics ⏳ READY TO EXECUTE

### Test Email Endpoint
When you want to isolate SendGrid from auth:

```bash
curl -X POST http://localhost:4000/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'
```

### Response Codes
- **200**: `{ "success": true }` → Email sent successfully ✅
- **503**: `{ "error": "SendGrid not configured" }` → Missing API key or template ❌
- **500**: Error details → SendGrid API failure ❌

### When to Use
- After updating SendGrid config, before testing auth flow
- To verify API key is valid
- To test different email addresses
- To confirm rate limiting isn't affecting email sending

---

## Regression Checklist Before Release ⏳ READY TO EXECUTE

Run these tests before any production deployment:

### Test 1: Register → Email Delivery
- [ ] Register new account via `/auth/register`
- [ ] Check server logs: `[email] Verification email sent successfully`
- [ ] Check inbox: Email arrives within 30 seconds
- [ ] Email from: `noreply@varsityhub.app`
- [ ] Email contains: 6-digit code

### Test 2: Rate Limiting (Resend)
Reference: `server/src/routes/auth.ts` line 699

```bash
# Request 1: Success (HTTP 200)
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"

# Request 2 (immediate): Rate limited (HTTP 429)
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"

# After 31 seconds: Success again (HTTP 200)
sleep 31
curl -X POST http://localhost:4000/auth/verify/request \
  -H "Authorization: Bearer <token>"

# Make 5 requests within hour: All succeed
# 6th request: HTTP 429
```

- [ ] Immediate resend returns HTTP 429
- [ ] After 31s, can resend successfully
- [ ] After 5 requests, 6th returns HTTP 429

### Test 3: Invalid/Expired Code
Reference: `server/src/routes/auth.ts` line 730

```bash
# Wrong code
curl -X POST http://localhost:4000/auth/verify/confirm \
  -H "Authorization: Bearer <token>" \
  -d '{"code":"000000"}'
# Expected: HTTP 400, message: "Invalid code"

# Wait 31 minutes, try original code
# Expected: HTTP 400, message: "Code expired"
```

- [ ] Invalid code returns HTTP 400 with clear error
- [ ] Expired code (> 30 min) returns HTTP 400 with clear error
- [ ] Error messages are user-friendly

### Test 4: Production Mode (Dev Helpers)
```bash
export NODE_ENV=production
npm run dev

# Register and check response
curl -X POST http://localhost:4000/auth/register ...
# Result: Response should NOT include dev_verification_code
```

- [ ] `NODE_ENV=production` disables dev_verification_code
- [ ] Must rely on email delivery
- [ ] No shortcuts available in production

### Test 5: Verify Screen UX (App)
- [ ] Register in Expo app
- [ ] Auto-routes to verify-email.tsx
- [ ] Code input accepts 6 digits
- [ ] Submit button shows loading state
- [ ] Success message appears
- [ ] Auto-redirects to onboarding/feed
- [ ] Can click "Resend Code" (rate limited)
- [ ] Can skip verification (optional)

---

## SMS Setup (Optional - When Needed) ⏸️

### Current Status
Twilio helpers exist in `server/src/lib/twilio.ts` but are NOT wired into auth routes.

### To Enable SMS
1. Get Twilio credentials from https://www.twilio.com/console
2. Add to `server/.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_FROM_PHONE=+1234567890
   ```
3. Wire helpers into `server/src/routes/auth.ts`:
   - Line after code generation in `/register`
   - Line after code generation in `/verify/request`
   - Line after code generation in `/password/forgot`
4. Create SMS verification screen (new file: `app/verify-sms.tsx`)
5. Add SMS input to verification flow in AuthProvider

### Test When Implemented
- [ ] SMS code delivery within 10 seconds
- [ ] SMS rate limiting (same as email)
- [ ] Invalid/expired SMS code handling
- [ ] Twilio delivery logs show 0 failures

---

## Observability & Monitoring ⏸️

### What to Monitor
- SendGrid delivery dashboard
- Email bounce rate (target: < 5%)
- Verification success rate (target: > 99%)
- Code expiration enforcement
- Rate limit accuracy

### Recommended Alerts
- SendGrid bounce rate > 10% → Alert
- Email delivery latency > 2 minutes → Alert
- `/auth/verify/confirm` failure rate > 5/min → Alert
- `NODE_ENV != production` but dev_code in response → Alert

### Webhook Integration (Optional)
- SendGrid event webhooks → Sentry
- Twilio delivery webhooks → Database/Sentry
- Monitor for silent failures

---

## Sign-Off Checklist

**Before Deploying to Production, Verify:**

### Configuration
- [ ] Health probe shows `sendgrid: true`
- [ ] All email templates are configured in SendGrid
- [ ] `SENDGRID_API_KEY` has mail.send permission
- [ ] `APP_BASE_URL` matches deployed environment

### Email Flow
- [ ] Registration email arrives within 30 seconds
- [ ] Code verification marks user as email_verified
- [ ] Database is updated correctly
- [ ] Rate limiting prevents spam

### Error Handling
- [ ] Invalid codes return 400 with clear error
- [ ] Expired codes return 400 with clear error
- [ ] Rate limit returns 429 on 6th request
- [ ] SendGrid failures are logged and handled gracefully

### Production Mode
- [ ] NODE_ENV=production hides dev shortcuts
- [ ] Verification works with real email only
- [ ] No dev codes in production response

### Monitoring
- [ ] SendGrid dashboard accessible
- [ ] Error logs configured
- [ ] Alerts set for high bounce/failure rates

---

## Next Steps

1. **Immediate (Execute Now)**
   ```bash
   # Terminal 1
   cd server && npm run dev
   
   # Terminal 2
   ./scripts/email-verification-test.sh
   ```

2. **Before Production Merge**
   - Run full regression checklist
   - Test with NODE_ENV=production
   - Get QA sign-off
   - Monitor SendGrid for 24 hours

3. **Future (Optional)**
   - Wire Twilio SMS integration
   - Add email bounce handling
   - Set up webhook monitoring
   - Create integration tests

---

**Status:** Ready for testing  
**Configuration:** Complete  
**Documentation:** Available  
**Test Script:** `scripts/email-verification-test.sh`

Start testing: `./scripts/email-verification-test.sh`
