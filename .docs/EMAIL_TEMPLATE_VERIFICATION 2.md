# Email Template Verification Guide

## ✅ All Email Templates Configured

All SendGrid email templates are now properly configured with:
- ✅ Template IDs mapped from environment variables
- ✅ Social media links included in all emails
- ✅ Privacy policy and community guidelines URLs
- ✅ Proper variable mapping
- ✅ Fallback to generic emails if templates not configured

## 📧 Template Categories

### Auth & Security
- ✅ **Verification Email** (`SENDGRID_VERIFICATION_TEMPLATE_ID`)
- ✅ **Password Reset** (`SENDGRID_PASSWORD_RESET_TEMPLATE_ID`)
- ✅ **Password Changed** (`SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID`)
- ✅ **Account Recovery** (`SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID`)
- ✅ **Login from New Device** (`SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID`)

### Moderation & Trust
- ✅ **Report Resolved** (`SENDGRID_REPORT_RESOLVED_TEMPLATE_ID`)
- ✅ **Report Dismissed** (`SENDGRID_REPORT_DISMISSED_TEMPLATE_ID`)
- ✅ **Account Warning** (`SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID`)
- ✅ **Content Removed** (`SENDGRID_CONTENT_REMOVED_TEMPLATE_ID`)

### Suspensions
- ✅ **Account Suspension (7 days)** (`SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID`)
- ✅ **Account Suspension (45 days)** (`SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`)
- ✅ **Permanent Ban** (`SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID`)

### Events
- ✅ **Event Submission Received** (`SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID`)
- ✅ **Event Approved** (`SENDGRID_EVENT_APPROVED_TEMPLATE_ID`)
- ✅ **Event Denied** (`SENDGRID_EVENT_DENIED_TEMPLATE_ID`)
- ✅ **Event Reminder** (`SENDGRID_EVENT_REMINDER_TEMPLATE_ID`)
- ✅ **Event Updated** (`SENDGRID_EVENT_UPDATED_TEMPLATE_ID`)
- ✅ **Event Canceled** (`SENDGRID_EVENT_CANCELED_TEMPLATE_ID`)
- ✅ **Event RSVP Confirmed** (`SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`)

### Team & Organization
- ✅ **Team Invite** (`SENDGRID_TEAM_INVITE_TEMPLATE_ID`)
- ✅ **Organization Invite** (`SENDGRID_ORG_INVITE_TEMPLATE_ID`)
- ✅ **Athlete Invitation** (`SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID`)
- ✅ **Role Assignment** (`SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID`)
- ✅ **Roster Threshold** (`SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID`)
- ✅ **Invitation Declined** (`SENDGRID_INVITATION_DECLINED_TEMPLATE_ID`)
- ✅ **Team Roster Update** (`SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID`)
- ✅ **Staff Member Joined** (`SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID`)
- ✅ **User Confirmation** (`SENDGRID_USER_CONFIRMATION_TEMPLATE_ID`)

### Billing
- ✅ **Payment Failed** (`SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`)
- ✅ **Subscription Expiring** (`SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID`)

## 🔗 Common Template Data

All emails now automatically include:
- ✅ Privacy Policy URL: `https://limeprod.com/VarsityHubPrivacy`
- ✅ Community Guidelines URL: `https://limeprod.com/VarsityHubPrivacy`
- ✅ Instagram: `https://www.instagram.com/varsityhub_?igsh=cGQ1ZDM2NzVxNm13`
- ✅ TikTok: `https://www.tiktok.com/@varsity.hub?_r=1&_t=ZT-92J1z0MRGpi`
- ✅ YouTube: `https://youtube.com/@varsityhub?si=XTvXQD0P7GAeo9n-`
- ✅ Facebook: `https://www.facebook.com/share/17t7MJa9vx/?mibextid=wwXIfr`
- ✅ X (Twitter): `https://x.com/varsityhub00`
- ✅ Website: `https://limeprod.com`
- ✅ Customer Service Email: `support@varsityhub.app`

## 🧪 Verification Methods

### Method 1: Run Verification Script

```bash
cd /Users/varsityhub/VarsityHubMobile/server
ts-node scripts/verify-email-templates.ts
```

Or test to a specific email:
```bash
ts-node scripts/verify-email-templates.ts --test-to=emilmancero@gmail.com
```

This will:
- ✅ Test all 24 email templates
- ✅ Send actual test emails
- ✅ Report success/failure for each
- ✅ List missing template IDs

### Method 2: Use Test Endpoints

The server has test endpoints at `/test-emails/*`:

```bash
# Test verification email
curl -X POST http://localhost:4000/test-emails/verification \
  -H "Content-Type: application/json" \
  -d '{"to":"emilmancero@gmail.com","token":"123456","name":"Test User"}'

# Test event approved
curl -X POST http://localhost:4000/test-emails/event-approved \
  -H "Content-Type: application/json" \
  -d '{"to":"emilmancero@gmail.com","coachName":"Test Coach","eventName":"Championship Game"}'

# ... etc for all templates
```

Available test endpoints:
- `/test-emails/verification`
- `/test-emails/password-reset`
- `/test-emails/team-invite`
- `/test-emails/org-invite`
- `/test-emails/event-approved`
- `/test-emails/event-denied`
- `/test-emails/event-reminder`
- `/test-emails/event-rsvp-confirmed`
- `/test-emails/account-warning`
- `/test-emails/suspension-7days`
- `/test-emails/suspension-45days`
- `/test-emails/permanent-ban`
- `/test-emails/login-new-device`
- `/test-emails/payment-failed`
- `/test-emails/subscription-expiring`
- `/test-emails/report-resolved`
- ... and more

## ✅ Verification Checklist

- [x] All template IDs added to `TEMPLATE_IDS` object
- [x] All email functions use SendGrid templates (with fallback)
- [x] Common template data (social links, privacy policy) added to all emails
- [x] Test endpoints created for all email types
- [x] Verification script created
- [ ] **Run verification script** to test all templates
- [ ] **Check email inbox** (`emilmancero@gmail.com`) for test emails
- [ ] **Verify all links work** (social media, privacy policy)
- [ ] **Verify variables are populated correctly** in templates

## 🚀 Next Steps

1. **Run the verification script:**
   ```bash
   cd server && ts-node scripts/verify-email-templates.ts --test-to=emilmancero@gmail.com
   ```

2. **Check your inbox** at `emilmancero@gmail.com` for test emails

3. **Verify each email:**
   - Links work correctly
   - Social media icons/links appear
   - Privacy policy link present
   - All variables populated correctly
   - Formatting looks good

4. **If any fail:**
   - Check template ID in environment variables
   - Verify template exists in SendGrid dashboard
   - Check template variables match what we're sending

## 📝 Notes

- All emails include fallback to generic plain-text emails if template ID is not configured
- Social media links and privacy policy are automatically added to all emails via `getCommonTemplateData()`
- Template IDs must start with `d-` (SendGrid dynamic template format)
- Test emails are sent from: `noreply@varsityhub.app`
- Customer service email: `support@varsityhub.app`
