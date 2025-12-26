# Quick Start: Validate & Deploy

**TL;DR:** Run the smoke test, check your inbox, merge when done.

---

## 🚀 3-Minute Quick Start

### Step 1: Prepare Environment (1 min)
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Ensure .env has SENDGRID_API_KEY
grep "SENDGRID_API_KEY=" .env

# If missing, get key from: https://app.sendgrid.com/settings/api_keys
```

### Step 2: Run Smoke Test (1 min)
```bash
cd sendgrid-templates

# Send test emails for ALL templates
node smoke-test.js --to your-email@example.com
```

### Step 3: Check Inbox (1 min)
```
✓ Open your email inbox
✓ Look for VarsityHub test emails (check spam folder too)
✓ Click a few links to verify they work
✓ Verify NO {{token}} placeholders visible in the emails
```

**If all pass:** Proceed to Step 4  
**If emails don't arrive:** See Troubleshooting below

---

## 🔍 What to Check in Emails

Pick any email and verify:
- [ ] Email arrived within 1 minute
- [ ] Sender is `noreply@varsityhub.app` (or YOUR_EMAIL_FROM)
- [ ] Subject line shows template name
- [ ] Dynamic content is populated (names, dates, links are real URLs)
- [ ] NO `{{recipientName}}`, `{{eventName}}`, or other `{{token}}` visible
- [ ] Links in email are direct (not wrapped like `click.sendgrid.net/...`)
- [ ] Footer has Instagram, TikTok, YouTube, Facebook, X icons
- [ ] Footer links (Privacy Policy, Community Guidelines) work
- [ ] CTA buttons are clickable and lead to real URLs

---

## ✅ Quick Checks

### Check 1: Are template IDs in Railway?
```bash
# Ask yourself:
# - Did I add SENDGRID_PASSWORD_RESET_TEMPLATE_ID to Railway?
# - Did I add SENDGRID_EVENT_REMINDER_TEMPLATE_ID to Railway?
# - Did I restart the service after adding them?

# If yes → proceed
# If no → add them now and restart, then re-run smoke test
```

### Check 2: Do emails have test data populated?
```bash
# Example password-reset email should show:
# - Recipient name: "John Doe" (not {{recipientName}})
# - Reset link: real URL like https://varsityhub.app/reset/xyz
# - Expire time: "24 hours" (not {{expiresIn}})

# If yes → tracking suppression is working ✓
# If no → check template ID is correct in SendGrid UI
```

### Check 3: Do links work?
```bash
# Click a link in one of the emails
# It should load a page (your local app or staging server)
# It should NOT show SendGrid tracking redirect

# If links work → deployment ready ✓
# If links broken → check env vars in Railway match SendGrid IDs
```

---

## 🚨 Troubleshooting

### "No emails arrived in inbox"
1. Check spam/junk folder
2. Verify SendGrid API key is correct: `grep "SENDGRID_API_KEY=" .env`
3. Verify domain is authenticated in SendGrid:
   - https://app.sendgrid.com → Settings → Sender Authentication
   - Should show "Verified" next to your domain
4. Re-run smoke test: `node smoke-test.js --to your-email@example.com`

### "Script says 'Env var X not set'"
1. Copy template ID from SendGrid UI:
   - https://app.sendgrid.com → Templates → select template
   - Copy Template ID (format: `d-xxxxxxxxxxxxxxxx`)
2. Add to `.env`: `SENDGRID_TEMPLATE_NAME_TEMPLATE_ID=d-xxxxxxx`
3. Re-run: `node smoke-test.js --to your-email@example.com`

### "Email shows {{recipientName}} placeholder"
1. Check template ID in `PRE_DEPLOYMENT_CHECKLIST.md` Phase 1.1
2. Verify it matches SendGrid UI exactly (case-sensitive)
3. Check `.env` file: `grep "SENDGRID_" .env | sort`
4. If changed, restart Railway service
5. Re-run smoke test

### "Links in email are broken"
1. Check if links are wrapped: `https://click.sendgrid.net/...`
   - If yes: data-analytics="false" failed (shouldn't happen, but check)
   - If no: might be a real URL issue
2. Click the link manually
3. Check that the app is running (local or staging)
4. Ask: Is the target URL correct? (e.g., does reset endpoint exist?)

---

## 📋 Minimal Deployment Checklist

- [ ] Smoke test completed: `node smoke-test.js --to your-email@example.com`
- [ ] Test emails arrived in inbox
- [ ] Emails have no {{tokens}} (dynamic content populated)
- [ ] Links in emails work
- [ ] Railway env vars set (all SENDGRID_*_TEMPLATE_ID)
- [ ] Railway service restarted

If all checked: **Ready to merge!**

```bash
git checkout main
git pull origin main
git merge chore/deploy-checklist
git push origin main
```

---

## 🔗 Full Documentation

| Doc | Purpose |
|-----|---------|
| `DEPLOYMENT_READY.md` | Overview of all changes |
| `PRE_DEPLOYMENT_CHECKLIST.md` | **Detailed 7-phase validation** |
| `SENDGRID_VALIDATION_CHECKLIST.md` | Template-by-template guide |
| `sendgrid-templates/SMOKE_TEST_README.md` | Script usage & troubleshooting |

**Start with:** `PRE_DEPLOYMENT_CHECKLIST.md`

---

## 📞 Still Stuck?

1. Check error message in smoke test output
2. Look up error in `sendgrid-templates/SMOKE_TEST_README.md` Troubleshooting section
3. Verify phase 1 of `PRE_DEPLOYMENT_CHECKLIST.md` (environment setup)
4. Check `.env` file exists and has all SENDGRID_* vars
5. Ask: "Did I restart Railway after changing env vars?"

---

**You've got this! 🎉**

```bash
# Let's go:
node sendgrid-templates/smoke-test.js --to your-email@example.com
```
