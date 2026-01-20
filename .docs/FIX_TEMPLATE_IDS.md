# How to Fix the Three Missing SendGrid Template IDs

## Problem
Three email templates are returning 404 errors:
- `ACCOUNT_SUSPENSION_45_DAYS` 
- `EVENT_RSVP_CONFIRMED`
- `TEAM_INVITE`

## Solution Options

### Option 1: Find Existing Templates (Recommended)

1. **Go to SendGrid Dashboard**
   - Navigate to https://mc.sendgrid.com/dynamic-templates
   - Log in to your SendGrid account

2. **Find Each Template**
   
   **For TEAM_INVITE:**
   - Look for a template named something like:
     - "Team Invitation"
     - "Team Invite"
     - "You've been invited to join a team"
   - Click on it to view details
   - Copy the Template ID (starts with `d-...`)
   
   **For ACCOUNT_SUSPENSION_45_DAYS:**
   - Look for a template named:
     - "Account Suspension 45 Days"
     - "Your account has been suspended for 45 days"
   - Copy the Template ID
   
   **For EVENT_RSVP_CONFIRMED:**
   - Look for a template named:
     - "Event RSVP Confirmed"
     - "RSVP Confirmation"
     - "Your RSVP was confirmed"
   - Copy the Template ID

3. **Update Environment Variables**
   
   **Locally (`.env` file):**
   ```bash
   SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-YOUR_NEW_TEMPLATE_ID_HERE
   SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=d-YOUR_NEW_TEMPLATE_ID_HERE
   SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=d-YOUR_NEW_TEMPLATE_ID_HERE
   ```
   
   **On Railway (Production):**
   ```bash
   railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-YOUR_NEW_TEMPLATE_ID_HERE"
   railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID "d-YOUR_NEW_TEMPLATE_ID_HERE"
   railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID "d-YOUR_NEW_TEMPLATE_ID_HERE"
   ```

4. **Restart Server**
   - Restart your local development server
   - Railway will automatically restart on variable change

---

### Option 2: Create New Templates

If the templates don't exist in SendGrid:

1. **Go to SendGrid Dashboard**
   - Navigate to https://mc.sendgrid.com/dynamic-templates
   - Click "Create a Dynamic Template"

2. **Create TEAM_INVITE Template**
   - **Template Name:** "Team Invitation"
   - **Subject:** `You've been invited to join {{teamName}}`
   - **Use HTML from:** `sendgrid-templates/athlete-invitation.html` (or similar)
   - **Template Variables Needed:**
     - `recipient_name`
     - `team_name`
     - `org_name`
     - `role`
     - `inviter_name`
     - `invite_url`
   - **Copy the Template ID** after saving

3. **Create ACCOUNT_SUSPENSION_45_DAYS Template**
   - **Template Name:** "Account Suspension 45 Days"
   - **Subject:** `Your account has been suspended for 45 days`
   - **Use HTML from:** `sendgrid-templates/account-suspension-7-days.html` (adapt it)
   - **Template Variables Needed:**
     - `user_name`
     - `violation_type`
     - `suspension_days` (set to 45)
     - `appeal_url`
   - **Copy the Template ID** after saving

4. **Create EVENT_RSVP_CONFIRMED Template**
   - **Template Name:** "Event RSVP Confirmed"
   - **Subject:** `Your RSVP for {{eventName}} is confirmed`
   - **Create HTML content** (or use a similar event template)
   - **Template Variables Needed:**
     - `recipient_name`
     - `event_name`
     - `event_date`
     - `event_time`
     - `event_location`
     - `event_link`
   - **Copy the Template ID** after saving

5. **Update Environment Variables** (same as Option 1, step 3)

---

### Option 3: Use Existing Similar Templates

If you have similar templates that can work:

**For TEAM_INVITE:**
- Check if `ATHLETE_INVITATION` template exists and works
- You could temporarily use: `SENDGRID_TEAM_INVITE_TEMPLATE_ID=${SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID}`

**For ACCOUNT_SUSPENSION_45_DAYS:**
- Check if `ACCOUNT_SUSPENSION_7_DAYS` exists (it does based on the report)
- You could temporarily use: `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=${SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID}`

**For EVENT_RSVP_CONFIRMED:**
- Check other event templates like `EVENT_REMINDER`
- You could temporarily use: `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=${SENDGRID_EVENT_REMINDER_TEMPLATE_ID}`

---

## Verify the Fix

1. **Check Server Logs**
   ```bash
   # Look for email initialization messages
   # Should see: "✅ Email service initialized successfully"
   ```

2. **Test Email Sending**
   - Try triggering one of the emails (team invite, RSVP confirmation, etc.)
   - Check SendGrid Activity Feed: https://mc.sendgrid.com/activity
   - Verify email was sent successfully (not bounced/blocked)

3. **Check for Errors**
   - Look for any "404" or "template not found" errors in logs
   - The code will fallback to generic emails if templates fail

---

## Quick Command Reference

### Check Current Template IDs (in code):
```bash
grep -r "SENDGRID_TEAM_INVITE_TEMPLATE_ID\|SENDGRID_ACCOUNT_SUSPENSION_45_DAYS\|SENDGRID_EVENT_RSVP_CONFIRMED" server/src/
```

### Update Railway Variables:
```bash
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-XXXXXXXXXX"
railway variables set SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID "d-XXXXXXXXXX"
railway variables set SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID "d-XXXXXXXXXX"
```

### Verify Template Exists (requires SendGrid API):
```bash
# You can use the verify script if it exists
npm run verify:sendgrid-templates
```

---

## Important Notes

- **Template IDs must start with `d-`** (SendGrid dynamic template format)
- **The code has fallback handling** - if templates fail, generic emails will still be sent
- **Changes take effect immediately** after server restart
- **Always test in development** before updating production variables

---

## Need Help?

- **SendGrid Support:** https://support.sendgrid.com
- **Template Documentation:** https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-transactional-templates
- **Your Template Files:** Check `sendgrid-templates/` directory for HTML versions