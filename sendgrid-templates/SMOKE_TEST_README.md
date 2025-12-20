# SendGrid Template Smoke Test Script

Automated script to test all SendGrid templates by sending test emails to your inbox.

## Purpose

Verifies:
- ✅ Template IDs match between environment variables and SendGrid
- ✅ Dynamic template data renders correctly (no `{{tokens}}` visible)
- ✅ Links are NOT wrapped with SendGrid tracking URLs (thanks to `data-analytics="false"`)
- ✅ All required fields in test data match template expectations
- ✅ SendGrid API connectivity and authentication

## Prerequisites

1. **Environment variables** set in `.env`:
   ```bash
   SENDGRID_API_KEY=your_api_key_here
   EMAIL_FROM=noreply@varsityhub.app
   SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-...
   SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID=d-...
   # ... (all other SENDGRID_*_TEMPLATE_ID vars)
   ```

2. **Test data** files in `sendgrid-templates/test-data/`:
   ```bash
   test-data/password-reset.json
   test-data/event-reminder.json
   test-data/ad-payment-required.json
   # ... (one for each template)
   ```

3. **Node.js** installed locally

## Usage

### Test All Templates
```bash
cd sendgrid-templates
node smoke-test.js --to your-test-email@gmail.com
```

### Test Single Template
```bash
node smoke-test.js --to your-test-email@gmail.com --template password-reset
```

### Dry Run (Preview Payloads Without Sending)
```bash
node smoke-test.js --dry-run --template event-reminder
# Shows what data would be sent, without actually sending emails
```

### Filter by Template Name Pattern
```bash
node smoke-test.js --to your-test-email@gmail.com --template event
# Tests all templates matching "event" (event-reminder, event-canceled, etc.)
```

## What to Check After Running

### 1. Inbox Verification
- [ ] Emails arrive in your test inbox
- [ ] No `{{recipientName}}`, `{{eventName}}`, or other token placeholders visible
- [ ] Dynamic content is populated (names, dates, links are real URLs)
- [ ] Links are NOT obscured (no redirects through `click.sendgrid.net` or similar)

### 2. Template ID Configuration
If you see "Env var X not set":
- Check `.env` file has the variable
- Ensure the template ID from SendGrid UI matches exactly
- Check for typos (IDs usually start with `d-`)
- Restart your app/rebuild if vars changed

### 3. SendGrid API Errors
**"401 Unauthorized"**
- API key is incorrect or expired
- Get a new key from [SendGrid Settings](https://app.sendgrid.com/settings/api_keys)

**"403 Forbidden"**
- API key doesn't have permission to send emails
- Check key has "Mail Send" permission

**"404 Not Found"**
- Template ID doesn't exist in SendGrid
- Check ID in SendGrid UI matches exactly (typo in env var?)

**"400 Bad Request: Missing required field"**
- Test data is missing a field the template expects
- Compare test data with template's `{{variable}}` references
- Ensure field naming is camelCase (e.g., `recipientName` not `recipient_name`)

### 4. Link Testing
Click a few links in the received emails:
- [ ] Reset password link works
- [ ] RSVP link works
- [ ] Event details link works
- [ ] Ad checkout link works
- [ ] Calendar add-to-calendar link works
- [ ] Footer links (Privacy, Social) work

## Example Output

```
============================================================
SendGrid Template Smoke Test
============================================================

Test Email: test@example.com
Dry Run: No (emails will be sent)

============================================================
Authentication
============================================================

Template: password-reset
ℹ️  Template ID: d-1a2b3c4d5e6f7g8h9i0j
ℹ️  Test data loaded (8 fields)
✅ Email sent successfully

Template: password-changed
ℹ️  Template ID: d-9i8h7g6f5e4d3c2b1a0z
ℹ️  Test data loaded (7 fields)
✅ Email sent successfully

... (more templates) ...

============================================================
Test Summary
============================================================

Total Templates: 39
Tests Run: 35
Missing Config: 4
Failed: 0

✅ All 35 templates tested successfully!

Check your inbox (test@example.com) for test emails.
Verify each email has:
  ✓ No {{token}} or {{variable}} placeholders visible
  ✓ All links work (not wrapped with SendGrid tracking URLs)
  ✓ Dynamic content populated correctly (names, dates, links)
```

## Troubleshooting

### Script fails with "SENDGRID_API_KEY not found"
```bash
# Add to .env
echo "SENDGRID_API_KEY=your_key_here" >> .env
```

### "No templates found matching filter"
```bash
# Check template names
ls test-data/
# Then use exact name
node smoke-test.js --to you@example.com --template event-reminder
```

### Emails not arriving
- Check spam/junk folder
- Verify SendGrid domain is authenticated (in SendGrid Settings → Sender Authentication)
- Check SendGrid bounce list (Settings → Suppression Management)
- Look at SendGrid Activity feed for delivery errors

### Template shows old content
- Clear SendGrid cache: re-open template in UI, save (without changes), close
- Wait a minute for updates to propagate
- Try sending again

## Advanced: Testing Against Production Railway

To test against your actual backend service:

```bash
# 1. Set env vars from Railway
export $(cat .env | grep SENDGRID)

# 2. Run smoke test
node smoke-test.js --to your-test-email@gmail.com

# 3. Check Railway logs for SendGrid API calls
# In Railway UI: Service → Logs → search "sendgrid" or "template_id"
```

## Next Steps

After all tests pass:
1. **Merge** `chore/deploy-checklist` → main
2. **Deploy** backend with updated template IDs
3. **Monitor** production logs for SendGrid errors (24 hours)
4. **Spot-check** real user flows (sign up, event RSVP, etc.)

## Reference

- [SendGrid Template Variables](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-using-dynamic-templates)
- [SendGrid API Error Codes](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [Template IDs in VarsityHub](../README.md)
