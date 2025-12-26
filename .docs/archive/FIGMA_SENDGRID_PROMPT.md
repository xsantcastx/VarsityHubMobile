# 📧 FIGMA PROMPT - SendGrid Email Template Updates

Copy and paste this into your Figma AI chat or use as a reference while updating templates:

---

## FIGMA AI PROMPT

```
I'm updating SendGrid email templates for production. I need help with the following:

TASK 1: EMAIL TEMPLATE SUBJECT LINES
Add these subject lines to each corresponding SendGrid template in the Settings → Subject field:

Auth & Security:
- Verification: "Verify your VarsityHub account"
- Password Reset: "Reset your VarsityHub password"
- Password Changed: "Your VarsityHub password was changed"
- Account Recovery: "Recover your VarsityHub account"
- Login New Device: "VarsityHub login from new device"

Moderation:
- Account Warning: "Account warning from VarsityHub"
- Content Removed: "Your content was removed"
- Suspension 7d: "Your account has been suspended for 7 days"
- Suspension 45d: "Your account has been suspended for 45 days"
- Permanent Ban: "Your VarsityHub account has been permanently banned"

Events:
- Event RSVP Confirmed: "Your RSVP for {{eventName}} is confirmed"
- Event Approved: "Your event {{eventName}} was approved"
- Event Denied: "Your event {{eventName}} was denied"
- Event Reminder: "Reminder: {{eventName}} is coming up"
- Event Updated: "{{eventName}} details have been updated"
- Event Canceled: "{{eventName}} has been canceled"

Teams & Organization:
- Team Invite: "You're invited to join {{teamName}}"
- Organization Invite: "You're invited to join {{organizationName}}"
- Athlete Invitation: "You've been invited to {{teamName}}"
- Role Assignment: "You've been assigned {{roleName}} at {{organizationName}}"

---

TASK 2: FIX IMAGE URLS (HTTP → HTTPS)
In each template HTML editor:
1. Find all <img src="http://..." /> tags
2. Change http:// to https://
3. Test with preview
4. Save

Example:
❌ OLD: <img src="http://res.cloudinary.com/dws2t/image/upload/v1/logo.png" />
✅ NEW: <img src="https://res.cloudinary.com/dws2t/image/upload/v1/logo.png" />

Verified HTTPS URLs:
- Logo: https://res.cloudinary.com/dws2t/image/upload/v1/varsityhub-logo
- Checkmark: https://res.cloudinary.com/dws2t/image/upload/v1/checkmark-green.png
- Icons: https://img.icons8.com/ (any icons8.com image)

For buttons, use CSS instead of images:
<a href="{{link}}" style="display:inline-block;padding:12px 24px;background-color:#2563EB;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Click Here</a>

---

TASK 3: FIX CRITICAL TEMPLATE VARIABLES
These 3 templates are returning HTTP 400 errors. Update the variable names:

TEMPLATE 1: Team Invitation (d-14788def39174bb66bf186716cce166fa)
Expected variables in template HTML:
- {{recipientName}}
- {{teamName}}
- {{inviterName}}
- {{role}}
- {{acceptLink}}
- {{declineLink}}
- {{privacyPolicyUrl}}
- {{communityGuidelinesUrl}}

TEMPLATE 2: Account Suspension 45d (d-0941019230d9459b81ff602d937f7aa04)
Expected variables in template HTML:
- {{userName}}
- {{reportId}}
- {{violationType}}
- {{suspensionDays}}
- {{suspensionDuration}}
- {{suspensionDate}}
- {{reinstatementDate}}
- {{suspensionReason}}
- {{appealUrl}}
- {{communityGuidelinesUrl}}
- {{privacyPolicyUrl}}

TEMPLATE 3: Event RSVP Confirmed (d-511e46f4646f974f18a8f33c12564de14b)
Expected variables in template HTML:
- {{userName}}
- {{eventName}}
- {{eventDate}}
- {{eventTime}}
- {{eventLocation}}
- {{rsvpConfirmedAt}}
- {{organizationName}}
- {{eventDetailLink}}
- {{calendarLink}}
- {{cancelRsvpLink}}
- {{privacyPolicyUrl}}
- {{communityGuidelinesUrl}}

---

TESTING CHECKLIST:
☐ All 40 templates now have subject lines
☐ All image URLs are HTTPS (not HTTP)
☐ Preview each template with sample data
☐ The 3 critical templates accept the variable names listed above
☐ Save and publish all templates

After this, we'll test sending real emails to verify everything works!
```

---

## QUICK COPY-PASTE SUBJECT LINES

If you want to add them all at once, here's the complete list:

```
Verify your VarsityHub account
Reset your VarsityHub password
Your VarsityHub password was changed
Recover your VarsityHub account
VarsityHub login from new device
Account warning from VarsityHub
Your content was removed
Your account has been suspended for 7 days
Your account has been suspended for 45 days
Your VarsityHub account has been permanently banned
Your RSVP for {{eventName}} is confirmed
Your event {{eventName}} was approved
Your event {{eventName}} was denied
Reminder: {{eventName}} is coming up
{{eventName}} details have been updated
{{eventName}} has been canceled
You're invited to join {{teamName}}
You're invited to join {{organizationName}}
You've been invited to {{teamName}}
You've been assigned {{roleName}} at {{organizationName}}
```

---

## SENDGRID DASHBOARD WORKFLOW

1. **Go to:** SendGrid → Dynamic Templates
2. **For EACH template:**
   - Click template name
   - Click "Edit"
   - Go to "Settings" tab
   - Find "Subject" field
   - Paste appropriate subject line from above
   - Go back to template HTML editor
   - Find all `<img src="http://` and change to `https://`
   - Test with preview (top right button)
   - Save
3. **Return to templates list**
4. **Repeat for all 40 templates**

---

## TIME ESTIMATE

- Subject lines: 3-4 hours (5 min per template × 40)
- Image URLs: 1 hour (Find/Replace)
- Variable fixes: 15-30 min (only 3 templates)
- **Total: ~5 hours** (or 1.5 hours if you batch operations)

---

Status: ⚙️ **IN PROGRESS - You're doing this now**
