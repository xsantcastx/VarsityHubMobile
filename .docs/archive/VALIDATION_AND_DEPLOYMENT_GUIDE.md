# Frontend + Backend Validation & Deployment Guide

**Status:** Ready for Validation  
**Date:** December 20, 2025  
**Branch:** `chore/deploy-checklist`  
**Components:** Frontend (39 SendGrid templates) + Backend (email service)

---

## 📊 System Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Frontend Templates** | ✅ Ready | 39 templates with click-tracking disabled (`data-analytics="false"`) |
| **Backend Email Service** | ✅ Ready | All email functions implemented in `server/src/lib/email.ts` |
| **Template IDs** | ✅ Configured | 49 SENDGRID_*_TEMPLATE_ID vars in `.env` (all required templates covered) |
| **Smoke Test Script** | ✅ Ready | `sendgrid-templates/smoke-test.js` — automated testing for all templates |
| **GitHub Actions** | ✅ Fixed | Snyk & Expo Doctor workflows passing; secrets properly gated |
| **Documentation** | ✅ Complete | 4 guides (quick-start, pre-deployment, validation, smoke-test) |

---

## 🔄 Validation Flow (Frontend + Backend Integration)

### Phase 1: Environment Setup & Verification (5 minutes)

#### 1.1 Verify Local Environment
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Check .env has SendGrid API key
grep "SENDGRID_API_KEY=" .env

# Check template IDs are configured (should see 49)
grep -c "SENDGRID_" .env

# List all configured template IDs
grep "SENDGRID_.*_TEMPLATE_ID=" .env | head -10
```

**Expected Output:**
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
49
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxxxxxxxxxx
...
```

#### 1.2 Verify Backend is Ready
```bash
# Check email.ts has all template IDs mapped
grep -c "SENDGRID_" server/src/lib/email.ts | head -20

# Verify sendTemplateEmail function exists
grep -A 5 "async function sendTemplateEmail" server/src/lib/email.ts
```

**Expected Output:**
```
const TEMPLATE_IDS = {
  // Auth & Security
  VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID || '',
  PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID || '',
  ...
```

---

### Phase 2: Frontend Template Validation (10 minutes)

#### 2.1 Run Smoke Test - All Templates
```bash
cd sendgrid-templates

# Test all templates (requires valid SENDGRID_API_KEY)
# Replace your-email@example.com with your test inbox
node smoke-test.js --to your-email@example.com
```

**Expected Output:**
```
============================================================
SendGrid Template Smoke Test
============================================================

🚀 Testing ALL 39 templates...
[Rate limiting: 100ms between requests]

✅ password-reset: Sent successfully
✅ password-changed: Sent successfully
✅ verification-email: Sent successfully
✅ event-reminder: Sent successfully
...
✅ subscription-expiring: Sent successfully

============================================================
✅ All 39 templates tested successfully!
Check your inbox (your-email@example.com) for test emails.

Summary:
  Total templates: 39
  Sent: 39
  Failed: 0
  Missing config: 0
============================================================
```

#### 2.2 Verify Inbox - Check for Placeholder Issues
Check your test inbox for a few sample emails. For EACH email, verify:

**✅ Good signs:**
- Email arrived within 1 minute
- Subject line is populated (e.g., "Password Reset Request" not "{{subject}}")
- Dynamic content is rendered (names, dates, codes are real values)
- Links are direct URLs (e.g., `https://varsityhub.app/reset/...` NOT `https://click.sendgrid.net/...`)
- NO `{{token}}` placeholders visible in body
- All footer links work (Privacy Policy, Community Guidelines, social icons)

**🚨 Bad signs (if you see these, stop and debug):**
- Email didn't arrive → API key issue or rate limiting
- `{{recipientName}}` or `{{eventName}}` visible → template ID mismatch
- Links wrapped in `click.sendgrid.net` → `data-analytics="false"` not applied
- Subject shows `{{subject}}` → template not found

#### 2.3 Run Smoke Test - Subset (Quick Validation)
```bash
# Test only authentication templates (password reset, verification, etc.)
node smoke-test.js --to your-email@example.com --template password

# Test only event templates
node smoke-test.js --to your-email@example.com --template event

# Dry run (shows payloads without sending)
node smoke-test.js --dry-run --template password-reset
```

**When to use subset tests:**
- Faster iteration during debugging
- Verify specific categories work
- Check template ID changes without sending 39 emails

---

### Phase 3: Backend Integration Validation (15 minutes)

#### 3.1 Verify Email Functions Are Called
Check that backend email functions exist and are properly exported:

```bash
# Count email sending functions
grep -c "export async function send" server/src/lib/email.ts

# Verify TEMPLATE_IDS object has all keys
grep "process.env.SENDGRID_" server/src/lib/email.ts | wc -l
```

**Expected Output:**
```
~27 (email sending functions)
~39 (template ID env vars)
```

#### 3.2 Check Email Integration Points
Verify that email functions are called from the right routes:

```bash
# Find all email function calls
grep -r "send.*Email" server/src/routes/ | head -10

# Verify job queue is properly wired
grep -r "emailQueue\|bull\|redis" server/src/lib/email.ts
```

**Expected Output:**
```
server/src/routes/auth.ts:sendVerificationEmail(email, code, userName)
server/src/routes/events.ts:sendEventReminderEmail(...)
server/src/routes/ads.ts:sendAdPaymentRequiredEmail(...)
server/src/routes/payments.ts:sendPaymentReceiptEmail(...)
...
```

#### 3.3 Test Real Flow (Optional - Full Stack)
If you want to test end-to-end without deploying:

**Sign-up Flow:**
1. Start backend: `npm run dev:server`
2. Start frontend: `npm start`
3. Sign up with test account → check inbox for verification email
4. Click verification link
5. Expected: No errors in server logs, email arrived with proper formatting

**Event RSVP Flow:**
1. Create an event in app
2. RSVP as athlete
3. Expected: Event reminder email arrives before event date
4. Check: Dynamic content (event name, date, time) populated correctly

**Payment Flow:**
1. Try to buy an ad or service
2. Complete payment
3. Expected: Payment receipt email arrives within 1 minute
4. Check: Receipt details (amount, date, order ID) visible

---

### Phase 4: Railway Deployment Verification (10 minutes)

#### 4.1 Verify Railway Environment Variables
Before merging, ensure Railway has all template IDs:

```bash
# Navigate to Railway Dashboard
# Settings → Environment Variables

# Should see:
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=d-xxxxxxxxxxxxx
... (39 total SENDGRID_*_TEMPLATE_ID)
```

**If missing:**
```bash
# You can add them one-by-one in Railway UI or via CLI:
railway variables set SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxx

# Restart service after adding variables
railway restart
```

#### 4.2 Check Service is Healthy
```bash
# Check Railway logs for email initialization
# Railway Dashboard → Service → Logs

# Look for this message (means email service initialized):
# ✅ SendGrid email service initialized (password reset, password changed, account recovery)

# If you see warnings like:
# ⚠️ SendGrid template IDs missing: verification, password_reset
# → The env vars didn't load; check Railway dashboard
```

#### 4.3 Verify HTTPS/SSL Configuration
SendGrid requires HTTPS. Verify:
- App is served over HTTPS (Railway default: yes)
- No redirect loops or mixed content
- API calls to `api.sendgrid.com` work (no firewall blocks)

---

## ✅ Pre-Merge Checklist

Before running: `git merge chore/deploy-checklist`

- [ ] **Phase 1:** All env vars verified (SENDGRID_API_KEY + 39 template IDs)
- [ ] **Phase 2:** Smoke test runs without errors (`✅ All 39 templates tested successfully!`)
- [ ] **Phase 2:** Test inbox has 39 emails (or subset of tested templates)
- [ ] **Phase 2:** Spot-check 3 emails: dynamic content populated, no {{tokens}}, links work
- [ ] **Phase 3:** Backend email functions verified in code
- [ ] **Phase 3:** (Optional) Real flow test passed (sign up, RSVP, payment)
- [ ] **Phase 4:** Railway env vars match `.env` (39 SENDGRID_*_TEMPLATE_ID)
- [ ] **Phase 4:** No warnings in Railway logs about missing template IDs
- [ ] **All Docs:** Reviewed QUICK_START.md and PRE_DEPLOYMENT_CHECKLIST.md
- [ ] **Ready to Merge:** All above boxes checked

---

## 🚀 Deployment Steps

Once all checklist items verified:

### Step 1: Merge to Main
```bash
git checkout main
git pull origin main
git merge chore/deploy-checklist
git push origin main
```

### Step 2: Verify GitHub Actions Run
```bash
# Check GitHub Actions
# https://github.com/xsantcastx/VarsityHubMobile/actions

# Workflows should run:
# ✅ Expo Doctor (verifies mobile build)
# ✅ Snyk Security (verifies no new vulnerabilities)

# Both should complete without errors
```

### Step 3: Railway Auto-Deploy
Once push to `main` completes:
1. Railway automatically detects the push
2. Rebuilds and redeploys the service
3. New code + env vars are live

**Verify:**
```bash
# Check Railway logs for deployment completion
# Railway Dashboard → Service → Deployments

# Look for: "✅ Deployment successful"
# Service should be "Running" (green)
```

### Step 4: Post-Deployment Validation
After deployed to production:

```bash
# Test production email flow
# Sign up with test account at https://varsityhub.app
# Check inbox for verification email (should arrive within 1 minute)

# If email doesn't arrive:
# 1. Check Railway logs for errors
# 2. Verify SENDGRID_API_KEY is set in Railway
# 3. Check SendGrid dashboard → Activity → look for failed sends
# 4. Rollback if needed: git revert (last commit)
```

---

## 🔍 Troubleshooting Reference

### "Smoke Test: Command not found"
```bash
cd sendgrid-templates
node smoke-test.js --to test@example.com
# Make sure you're in the right directory
```

### "Error: SENDGRID_API_KEY not found"
```bash
# Solution: Add API key to .env
echo "SENDGRID_API_KEY=SG.xxxxxxxxxxxxx" >> .env

# Get API key from: https://app.sendgrid.com/settings/api_keys
```

### "Error: Missing template ID for X"
```bash
# Solution: Add missing template ID to .env
# Format: SENDGRID_[NAME]_TEMPLATE_ID=d-xxxxx

# List missing:
node sendgrid-templates/smoke-test.js --dry-run | grep "Missing\|Error"

# Add from SendGrid dashboard:
# https://app.sendgrid.com/dynamic_templates
```

### "Emails show {{token}} placeholders"
```bash
# Problem: Template ID in .env doesn't match SendGrid
# Solution:
# 1. Go to SendGrid dashboard
# 2. Find the template
# 3. Copy the CORRECT Template ID (format: d-xxxxx...)
# 4. Update .env with correct ID
# 5. Re-run smoke test
```

### "Links are wrapped in click.sendgrid.net"
```bash
# Problem: data-analytics="false" not applied to anchors
# Solution:
# 1. Check template HTML file in sendgrid-templates/
# 2. Verify it has: <a href="..." data-analytics="false">
# 3. If missing, add attribute manually
# 4. Re-upload to SendGrid
# 5. Re-test
```

### "Railway deployment failed"
```bash
# Check deployment logs:
# Railway Dashboard → Service → Deployments → (click failed deployment)

# Common issues:
# - Build failed → check syntax errors in code
# - Env vars missing → check if variables were saved (click Save button)
# - Port not open → check Railway service port (usually 3000)

# Roll back if needed:
git revert <commit-hash>
git push origin main
# Railway will re-deploy
```

---

## 📋 Template Categories (For Reference)

When spot-checking emails, sample from each category:

| Category | Templates | Example |
|----------|-----------|---------|
| **Auth** | verification, password-reset, password-changed, account-recovery, login-from-new-device, security-alert | Verify no code visible (code should be in link) |
| **Events** | event-reminder, event-canceled, event-updated, event-approved, event-denied, event-rsvp-confirmed, event-submission-received | Verify event name, date, time, location dynamic |
| **Billing/Ads** | ad-payment-required, ad-reservation-confirmation, ad-goes-live, payment-receipt, subscription-canceled, subscription-expiring, billing-notice | Verify price, amount, billing cycle dynamic |
| **Moderation** | account-warning, content-removed, report-resolved, report-dismissed, account-suspension-*, permanent-ban | Verify user context and action links |
| **Organization** | organization-invitation, athlete-invitation, role-assignment, staff-member-joined, team-roster-update, coach-onboarding, invitation-declined, roster-threshold | Verify team/org name and invite links |
| **Misc** | user-confirmation, plan-limit-warning, (others) | Verify user-specific content |

---

## 📞 Getting Help

If something goes wrong:

1. **Check logs first:**
   ```bash
   # Local backend logs
   npm run dev:server 2>&1 | grep -i email
   
   # Railway logs
   railway logs --follow
   ```

2. **Re-run smoke test with debug:**
   ```bash
   node smoke-test.js --to test@example.com --dry-run | head -50
   ```

3. **Verify SendGrid dashboard:**
   - Go to https://app.sendgrid.com/dynamic_templates
   - Make sure templates you're testing exist and are active
   - Check Activity feed for delivery status

4. **Review documentation:**
   - `QUICK_START.md` — 3-minute overview
   - `PRE_DEPLOYMENT_CHECKLIST.md` — detailed 7-phase guide
   - `SENDGRID_VALIDATION_CHECKLIST.md` — template-by-template reference
   - `SMOKE_TEST_README.md` — script usage and troubleshooting

---

## 🎯 Key Takeaway

**Frontend:** 39 templates hardened with `data-analytics="false"` to prevent click-tracking  
**Backend:** All email functions implemented and ready to call SendGrid  
**Integration:** Smoke test validates both frontend (templates) and backend (template IDs, data)  
**Deployment:** Merge to main → GitHub Actions validates → Railway auto-deploys  
**Validation:** Real inbox testing confirms dynamic content renders and links work

**You're ready to deploy!** 🚀

