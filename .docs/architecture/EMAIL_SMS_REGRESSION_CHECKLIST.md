# Email & SMS Verification - Regression Checklist

**Purpose:** Verify email and SMS verification systems work correctly before each release  
**Frequency:** Before every deployment to production  
**Estimated Time:** 10-15 minutes

---

## Pre-Flight Checks

### Environment Configuration
- [ ] `SENDGRID_API_KEY` set in server/.env
- [ ] `SENDGRID_VERIFICATION_TEMPLATE_ID` set
- [ ] `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` set  
- [ ] `EMAIL_FROM` set to valid domain
- [ ] `APP_BASE_URL` matches deployed environment
- [ ] (Optional) `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE` set

### Health Check
```bash
curl http://localhost:4000/health | jq .integrations
```
Expected output:
```json
{
  "sendgrid": true,
  "twilio": false  // or true if configured
}
```

---

## Test Matrix: Email Verification

### Test 1: Registration → Email Delivery
**What:** User registers and receives verification email  
**When:** Immediately after registration

**Steps:**
1. Register a new user via app or API:
   ```bash
   curl -X POST http://localhost:4000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","display_name":"Tester"}'
   ```

2. Check logs for SendGrid confirmation:
   ```
   [email] Verification email sent successfully
   ```

3. Check inbox for email within 30 seconds
   - From: `noreply@varsityhub.app`
   - Subject: Includes verification code
   - Body: Contains 6-digit code

**Expected:** ✅ Email arrives in inbox within 30 seconds  
**If Failed:** 
- Check SendGrid API status
- Verify SENDGRID_API_KEY has mail.send permission
- Check SendGrid template ID is valid

---

### Test 2: Verify Code → Account Activation
**What:** User submits verification code and account is marked verified  
**When:** After receiving email

**Steps:**
1. Copy code from email (or use dev_verification_code from registration response in dev mode)

2. Submit code via app or API:
   ```bash
   curl -X POST http://localhost:4000/auth/verify/confirm \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"code":"123456"}'
   ```

3. Check Prisma Studio:
   ```bash
   npx prisma studio
   # Navigate to users table
   # Find test user → email_verified should be TRUE
   # email_verification_code should be NULL
   # email_verification_expires should be NULL
   ```

**Expected:** 
- ✅ Code accepted (HTTP 200)
- ✅ User record updated in DB
- ✅ User can log in without "needs_verification" flag

**If Failed:**
- Code expired? Check timestamp vs 30-min window
- Wrong code? Verify you're using most recent resend
- Database issue? Check Prisma connection

---

### Test 3: Resend Code → Rate Limiting
**What:** System rate limits resend requests  
**When:** User requests code multiple times

**Steps:**
1. Request new code once:
   ```bash
   curl -X POST http://localhost:4000/auth/verify/request \
     -H "Authorization: Bearer <token>"
   ```
   Expected: HTTP 200 ✅

2. Request immediately again:
   ```bash
   curl -X POST http://localhost:4000/auth/verify/request \
     -H "Authorization: Bearer <token>"
   ```
   Expected: HTTP 429 (Too many requests) ✅

3. Wait 31 seconds, request again:
   ```bash
   curl -X POST http://localhost:4000/auth/verify/request \
     -H "Authorization: Bearer <token>"
   ```
   Expected: HTTP 200 ✅

4. Request 5 times within 1 hour:
   Expected: After 5th request → HTTP 429 for rest of hour

**Expected:** Rate limiting prevents abuse  
**If Failed:**
- Check rate limiting logic in server/src/routes/auth.ts (line ~699)
- Verify verifyRate map is tracking requests per user

---

### Test 4: Invalid/Expired Code → Proper Errors
**What:** System rejects invalid or expired codes  
**When:** User enters wrong code or waits too long

**Steps:**
1. Try with wrong code:
   ```bash
   curl -X POST http://localhost:4000/auth/verify/confirm \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"code":"000000"}'
   ```
   Expected: HTTP 400 with error "Invalid code" ✅

2. Wait 31 minutes, try with original code:
   ```bash
   # Wait 31 minutes...
   curl -X POST http://localhost:4000/auth/verify/confirm \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{"code":"123456"}'
   ```
   Expected: HTTP 400 with error "Code expired" ✅

**Expected:** Clear error messages for UX  
**If Failed:**
- Check expiration logic (should be 30 min from generation)
- Verify database timestamps are accurate

---

### Test 5: Production Mode (Dev Helpers Disabled)
**What:** Dev shortcuts are disabled in production  
**When:** Before deploying to production

**Steps:**
1. Set NODE_ENV=production locally:
   ```bash
   export NODE_ENV=production
   npm run dev
   ```

2. Register a new account:
   ```bash
   curl -X POST http://localhost:4000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test-prod@example.com","password":"Test123!","display_name":"Prod Tester"}'
   ```

3. Check response:
   ```json
   {
     "access_token": "...",
     "user": {...},
     "dev_verification_code": "SHOULD NOT BE HERE"
   }
   ```
   Expected: No `dev_verification_code` field ✅

4. You MUST receive email or be stuck on verify screen
   Expected: Email arrives or user cannot proceed ✅

**Expected:** Dev shortcuts removed, only email works  
**If Failed:**
- Check line 75 in server/src/routes/auth.ts
- Verify NODE_ENV=production is being read

---

## Test Matrix: SMS Verification (If Configured)

> **Note:** Only perform if Twilio is configured (TWILIO_ACCOUNT_SID is set)

### Test 6: SMS Code Delivery
**What:** User receives verification code via SMS  
**When:** If SMS flow is wired into registration

**Steps:**
1. Register with phone number:
   ```bash
   # (If SMS registration is implemented)
   curl -X POST http://localhost:4000/auth/register \
     -d '{"email":"...","password":"...","phone":"+15551234567"}'
   ```

2. Check Twilio logs:
   ```
   https://www.twilio.com/console/sms/logs
   ```

3. Check phone for SMS within 10 seconds
   - Body includes 6-digit code
   - "Code expires in 30 minutes"

**Expected:** ✅ SMS arrives within 10 seconds  
**If Failed:**
- Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct
- Check that TWILIO_FROM_PHONE is valid and SMS-enabled
- Check Twilio account balance (needs credits for SMS)
- Monitor Twilio error logs for delivery failures

---

### Test 7: SMS Rate Limiting & Retry
**What:** System handles SMS rate limits gracefully  
**When:** User requests code multiple times

**Steps:**
1. Request code 3 times in quick succession
   Expected: Last 2 requests rejected with 429 ✅

2. Check phone for SMS count (should be ≤1)
   Expected: Only 1 SMS sent despite multiple requests ✅

3. Wait 31 seconds, request again
   Expected: New SMS sent successfully ✅

**Expected:** SMS not wasted on rate-limited requests  
**If Failed:**
- Check rate limiting applies to SMS same as email
- Verify deduplication logic

---

## Observability Checklist

### Monitoring Points
- [ ] SendGrid delivery dashboard shows emails as "Delivered"
- [ ] SendGrid bounce rate is < 5%
- [ ] Twilio delivery logs show successful sends (if configured)
- [ ] Server logs contain [email] and [twilio] messages for each send
- [ ] No error logs about API key/template ID missing
- [ ] Response times for /auth/verify/confirm < 200ms

### Alert Thresholds (Recommended)
- [ ] SendGrid bounce rate > 10% → Alert
- [ ] Email delivery latency > 2 minutes → Alert
- [ ] /auth/verify/confirm fails > 5 times/minute → Alert
- [ ] Twilio SMS delivery failure rate > 5% → Alert

### Dashboard Queries (If using Sentry/Datadog)
```
# Email send failures
service=backend AND path=/auth/register AND error="SendGrid"

# Verification failures
service=backend AND endpoint=/auth/verify/confirm AND status=400

# Rate limit hits
service=backend AND status=429 AND endpoint=/auth/verify/request
```

---

## Regression Test Script

Run this before each release:

```bash
# 1. Start backend
cd server && npm run dev &

# 2. Wait for startup
sleep 5

# 3. Run full test suite
chmod +x ../scripts/email-verification-test.sh
../scripts/email-verification-test.sh

# 4. Manual smoke test
# - Check inbox for test email
# - Visit verify-email screen in app
# - Submit code successfully

# 5. Stop backend
fg
Ctrl+C
```

---

## Sign-Off Template

**Before Deploying to Production:**

```markdown
# Email Verification Regression - Sign-Off

Date: _______________  
Tested By: _______________

## Core Tests
- [ ] Health check shows sendgrid=true
- [ ] Registration → email received in < 30s
- [ ] Code submission → account marked verified
- [ ] Rate limiting triggers at 5 resends
- [ ] Invalid code rejected with clear error
- [ ] Expired code rejected with clear error
- [ ] NODE_ENV=production hides dev shortcuts

## SMS Tests (if configured)
- [ ] SMS received within 10s of request
- [ ] SMS rate limiting prevents duplicates
- [ ] Twilio logs show 0 delivery failures

## Monitoring
- [ ] SendGrid dashboard shows all emails delivered
- [ ] No errors in server logs about SendGrid
- [ ] Sentry shows no verification-related errors

**Status:** ✅ APPROVED FOR PRODUCTION
```

---

## Troubleshooting

### Email Not Arriving
1. Check SendGrid API key is valid: `curl -H "Authorization: Bearer SG.xxx" https://api.sendgrid.com/v3/mail/validate`
2. Check template ID exists in SendGrid dashboard
3. Check spam/junk folder
4. Check SendGrid bounce logs for hard bounces
5. Verify EMAIL_FROM domain is verified in SendGrid

### Code Not Verifying
1. Check database has correct code: `select email_verification_code from users where email='test@example.com'`
2. Check code hasn't expired: `select now() - email_verification_expires`
3. Check user was actually created in DB
4. Verify JWT token is valid

### Rate Limiting Not Working
1. Check verifyRate map isn't cleared on restart
2. Verify hour window calculation in code
3. Check multiple users aren't sharing same limit

### SMS Not Sending
1. Verify Twilio credentials are correct
2. Check TWILIO_FROM_PHONE is valid (must include country code)
3. Check account has SMS credits
4. Verify phone number format (E.164: +15551234567)
5. Check Twilio logs for error codes

---

**Last Updated:** December 3, 2025  
**Next Review:** Before next production release
