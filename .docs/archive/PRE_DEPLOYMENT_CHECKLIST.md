# Final Pre-Deployment Checklist

Complete this before merging `chore/deploy-checklist` → main.

---

## ✅ Phase 1: Environment Setup (5 min)

### 1.1 Verify .env has all SendGrid template IDs

```bash
# From the project root, check these exist:
grep "SENDGRID_.*_TEMPLATE_ID" .env | sort

# Expected output: 30+ SENDGRID_*_TEMPLATE_ID entries
# If < 30, get missing IDs from SendGrid UI → Templates → copy Template IDs
```

**Action:** If any are missing, copy the template ID from SendGrid UI:
- Settings → API Keys (verify you have a key)
- Templates → select template → copy ID (format: `d-...`)
- Add to .env: `SENDGRID_TEMPLATE_NAME_TEMPLATE_ID=d-xxxxxxxx`

### 1.2 Verify SendGrid API key

```bash
# Check it exists
grep "SENDGRID_API_KEY=" .env

# Test connectivity
node -e "
const https = require('https');
const key = process.env.SENDGRID_API_KEY;
https.request({hostname:'api.sendgrid.com', path:'/v3/api_keys', method:'GET', headers:{Authorization:\`Bearer \${key}\`}}, 
  res => console.log(res.statusCode === 200 ? '✅ API Key Valid' : '❌ Invalid')
).end();
"
```

---

## ✅ Phase 2: Smoke Test (10 min)

### 2.1 Run smoke test for all templates

```bash
cd sendgrid-templates

# Dry run first (preview payloads without sending)
node smoke-test.js --dry-run --template password-reset

# Then send test emails
node smoke-test.js --to your-test-email@gmail.com
```

**Expected Output:**
- ✅ Total Templates: 39
- ✅ Tests Run: 35-39 (depending on config)
- ✅ Missing Config: 0-4 (acceptable if intentional)
- ✅ Failed: 0

**If failed:**
- Check error message for template ID or data issues
- Missing ID? Add to .env and retry
- Missing test data? Run: `ls test-data/ | wc -l` (should be ~30)
- API error? Check key is valid (Phase 1.2)

### 2.2 Check your test inbox

After smoke test completes, check inbox:

```bash
# Examples of what to verify
# Password Reset Email:
#   ✓ No "{{resetLink}}" visible
#   ✓ "Reset Password" button is clickable link
#   ✓ Footer has Privacy Policy and social icons

# Event Reminder Email:
#   ✓ No "{{eventName}}" visible
#   ✓ All CTAs work: "Check In", "Add to Calendar", "Get Directions"
#   ✓ Event details populated

# Ad Payment Required Email:
#   ✓ No "{{hours_remaining}}" visible
#   ✓ "Update ad reservation" button works
#   ✓ Shows correct cost and zip code
```

---

## ✅ Phase 3: Code Review (5 min)

### 3.1 Verify tracking suppression

```bash
# All templates should have data-analytics="false"
cd sendgrid-templates
grep -r 'data-analytics="false"' *.html | wc -l

# Expected: 390+ (avg 10 anchors × 39 templates)
```

### 3.2 Check template IDs match backend code

```bash
# Search for template ID references in backend
grep -r "SENDGRID_.*_TEMPLATE_ID" server/ --include="*.ts" --include="*.js" | head -10

# Verify env var names match exactly (case-sensitive)
# Example: SENDGRID_PASSWORD_RESET_TEMPLATE_ID (not SENDGRID_PASSWORD_RESET_TEMPLATE or SENDGRID_passwordReset_TEMPLATE_ID)
```

### 3.3 Verify payload casing

```bash
# Check a template for camelCase variables
head -50 sendgrid-templates/test-data/password-reset.json

# Compare with backend code that calls sendEmail()
grep -A 20 "sendEmail\|sendgrid" server/ -r --include="*.ts" | grep -i "resetlink\|recipientname" | head -5

# Ensure they match: if template uses {{resetLink}}, backend sends { resetLink: "..." }
```

---

## ✅ Phase 4: Railway Deployment (5 min)

### 4.1 Verify env vars in Railway

```bash
# In Railway dashboard:
# 1. Go to Project → Environment → Variables
# 2. Check these are SET (non-empty):
#    - SENDGRID_API_KEY
#    - SENDGRID_PASSWORD_RESET_TEMPLATE_ID
#    - SENDGRID_EVENT_REMINDER_TEMPLATE_ID
#    - SENDGRID_AD_PAYMENT_REQUIRED_TEMPLATE_ID
#    - ... (all critical templates)

echo "Critical env vars to check in Railway:"
echo "  SENDGRID_API_KEY"
echo "  SENDGRID_PASSWORD_RESET_TEMPLATE_ID"
echo "  SENDGRID_EVENT_REMINDER_TEMPLATE_ID"
echo "  SENDGRID_AD_PAYMENT_REQUIRED_TEMPLATE_ID"
echo "  SENDGRID_AD_RESERVATION_CONFIRMATION_TEMPLATE_ID"
echo "  SENDGRID_AD_GOES_LIVE_TEMPLATE_ID"
echo "  SENDGRID_ORG_INVITE_TEMPLATE_ID"
echo "  SENDGRID_REPORT_RESOLVED_TEMPLATE_ID"
```

### 4.2 Restart/redeploy service

```bash
# In Railway dashboard:
# 1. Select Service
# 2. Click "Redeploy" (or "Trigger Deploy" if auto-deploy off)
# 3. Wait for "Running" status
# 4. Check Logs tab for errors:
#    - Search: "sendgrid" (should be quiet or show successful sends)
#    - Search: "error" (should not mention missing template IDs)
```

---

## ✅ Phase 5: Real Flow Testing (15 min)

### 5.1 Authentication Flow

```bash
# In your app (staging or local):
# 1. Sign up with new email → check for verification email
# 2. Click "Verify Email" link → should redirect
# 3. Forgot Password → check for reset email
# 4. Click reset link → should redirect
# 5. Change Password → check for confirmation email

# What to verify:
# ✓ Email arrives within 30 seconds
# ✓ No {{token}} placeholders visible
# ✓ Links are not wrapped (direct, not click.sendgrid.net)
# ✓ Footer links work
```

### 5.2 Event Flow

```bash
# In your app:
# 1. Create/publish an event
# 2. User RSVPs → check for confirmation email
# 3. Update event details → check for notification email
# 4. Cancel event → check for cancellation email

# Verify:
# ✓ Event name, date, location populated
# ✓ CTAs (Check In, Add to Calendar, Get Directions) work
# ✓ No unsubscribe/tracking noise in links
```

### 5.3 Billing/Ad Flow

```bash
# In your app:
# 1. Reserve ad slot → check for reservation confirmation
# 2. Wait 15 min → check for payment reminder (hours_remaining: 1)
# 3. Make payment → check for receipt
# 4. Ad goes live → check for live notification

# Verify:
# ✓ Reservation email has working "Update Reservation" link
# ✓ Payment reminder shows correct hours_remaining count
# ✓ Receipt shows correct total cost
# ✓ Live notification has working analytics dashboard link
```

### 5.4 Moderation Flow

```bash
# In your app (or as admin):
# 1. Submit a report → check for acknowledgment email
# 2. Resolve report → check for resolution email
# 3. Remove content → check for notification email

# Verify:
# ✓ All content removes properly (no {{token}} visible)
# ✓ Links to report details work
```

---

## ✅ Phase 6: Server Logs Review (5 min)

### 6.1 Check for SendGrid errors

```bash
# In Railway, Logs tab:
# Search for:
grep "sendgrid\|template\|EMAIL_ERROR" logs.txt

# Should see:
# ✓ Successful sends (2xx responses)
# ✗ NOT: "missing template ID"
# ✗ NOT: "invalid dynamic_template_data"
# ✗ NOT: "401 Unauthorized"
```

### 6.2 Monitor production logs (24h window)

```bash
# After deployment, monitor for:
# - First 1 hour: any verification/auth emails working?
# - First 24 hours: any SendGrid errors in logs?
# - Sample real flows: sign up, RSVP, payment, report

# If issues arise:
# 1. Check Railway logs for specific error
# 2. Compare template ID in log with SendGrid UI
# 3. Check test data field names match template placeholders
# 4. Redeploy service if env vars changed
```

---

## 🚀 Phase 7: Merge & Deploy

### 7.1 Merge chore/deploy-checklist

```bash
git checkout main
git pull origin main
git merge chore/deploy-checklist
git push origin main
```

### 7.2 Monitor deployment

```bash
# After merge to main:
# 1. GitHub Actions runs CI (lint, build, test)
# 2. Railway auto-deploys (if configured)
# 3. Monitor Logs for any errors
# 4. Run spot-check test: sign up → verify email
```

---

## 🔍 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| "Template ID not found" | Copy ID from SendGrid UI, add to .env, redeploy |
| Email doesn't arrive | Check SendGrid bounce list, verify domain authenticated |
| Email has {{token}} placeholder | Template variable name doesn't match payload |
| Link is wrapped/broken | Ensure `data-analytics="false"` is on the anchor (already done) |
| "401 Unauthorized" from SendGrid | API key is wrong or expired, get new one from SendGrid Settings |
| Script says "Missing Config" | Set SENDGRID_*_TEMPLATE_ID in .env |

---

## ✅ Final Sign-Off

- [ ] Phase 1: .env setup complete
- [ ] Phase 2: Smoke test all pass, emails verified in inbox
- [ ] Phase 3: Code review passed (tracking suppression, casing)
- [ ] Phase 4: Railway env vars set, service restarted
- [ ] Phase 5: Real flows tested (sign up, RSVP, payment, etc.)
- [ ] Phase 6: Server logs clean (no SendGrid errors)
- [ ] Phase 7: Code merged to main, deployment successful

**Ready to deploy?** When all boxes checked:

```bash
git checkout main && git pull && git merge chore/deploy-checklist && git push
```

---

## 📚 Reference Docs

- `SENDGRID_VALIDATION_CHECKLIST.md` — Template-by-template validation guide
- `SMOKE_TEST_README.md` — Detailed smoke test troubleshooting
- `sendgrid-templates/test-data/` — Sample payloads for each template
- `.github/workflows/snyk-security.yml` — CI/CD configuration

Good luck! 🚀
