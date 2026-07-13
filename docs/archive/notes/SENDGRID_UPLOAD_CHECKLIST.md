# ✅ SendGrid Upload Checklist

Use this after running `node scripts/exportForSendGrid.js` (creates `sendgrid-templates/`).

## Step 1 — Run Export (2 minutes)

```bash
node scripts/exportForSendGrid.js
```

- Generates `sendgrid-templates/` with cleaned HTML for every template
- Normalizes variables to camelCase
- Upgrades HTTP images to HTTPS
- Applies curated subject lines
- Writes `export-summary.json` + `sendgrid-templates/README.md`

## Step 2 — Upload to SendGrid (30 minutes)

For each generated file:

- [ ] Open SendGrid → Dynamic Templates
- [ ] Select the matching template name
- [ ] Click **Edit** → replace HTML with generated file
- [ ] Copy subject from file header and paste into **Settings → Subject**
- [ ] Save & Publish

**Templates covered (30 keys):**

- Verification, Password Reset, Password Changed, Account Recovery, Login New Device
- Report Resolved, Report Dismissed, Account Warning, Content Removed, Suspension 7d, Suspension 45d, Permanent Ban
- Event Submission Received, Event Approved, Event Denied, Event Reminder, Event Updated, Event Canceled, Event RSVP Confirmed
- Organization Invitation, Team Invitation, Athlete Invitation, Role Assignment, Roster Threshold, Invitation Declined, Team Roster Update, Staff Member Joined
- User Confirmation, Payment Failed, Subscription Expiring

## Step 3 — Update Environment Variables (10 minutes)

- [ ] Copy the final SendGrid Template IDs
- [ ] Update both `.env` and `server/.env` to match
- [ ] Run alignment check: `node scripts/check-env-alignment.js`
- [ ] Commit `.env.example` updates (not secrets) if keys changed

## Step 4 — Verify Templates (5-10 minutes)

```bash
npx tsx scripts/verify-sendgrid-templates.ts
```

- Confirms subjects exist, variables present, and HTTPS images
- Outputs `template-verification-results.json`

## Step 5 — Send Test Emails (2-3 minutes)

```bash
npx tsx scripts/test-all-emails.ts
```

- Sends all email types to test inbox
- Writes `test-results.json`

## Done? ✅

- [ ] All templates uploaded
- [ ] Env IDs updated
- [ ] Verification script passes
- [ ] Test emails look correct in inbox
