# VarsityHub SendGrid Email Implementation Checklist

**Status:** Ready for Railway Deployment  
**Last Updated:** December 16, 2025  
**Total Templates:** 29 email types  
**Backend Functions:** 27 fully implemented + 3 patched  
**Snyk Security Scan:** ✅ PASSED (no email-related issues)

---

## 📋 QUICK SETUP GUIDE

### Step 1: Copy Template IDs from SendGrid
Go to SendGrid > Templates and copy the ID for each template you see in your dashboard.

### Step 2: Update Railway Environment Variables
Add these variables to your Railway environment with the corresponding template IDs:

```bash
# Core Email Config
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@varsityhub.app  # Or your verified sender

# Security & Auth Emails
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxx...
SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID=d-6f11ea...
SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID=d-36ff3...
SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxx...
SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID=d-5fe2c4...

# Organization & Team Management
SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID=d-bc3bd0a...
SENDGRID_TEAM_INVITATION_TEMPLATE_ID=d-xxx...
SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID=d-363b04e...
SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID=d-c0e6564...
SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID=d-bf680d9...
SENDGRID_INVITATION_DECLINED_TEMPLATE_ID=d-38eecf0...
SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID=d-c3473a8...
SENDGRID_MEMBER_REMOVED_TEMPLATE_ID=d-xxx...
SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID=d-a049985...
SENDGRID_USER_CONFIRMATION_TEMPLATE_ID=d-584a4a9...

# Billing & Payments
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=d-4f9bb91...
SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID=d-9e31f68...

# Event Management
SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID=d-5a9d812...
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-e76de06...
SENDGRID_EVENT_DENIED_TEMPLATE_ID=d-50343dd...
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=d-2822ef2...
SENDGRID_EVENT_UPDATED_TEMPLATE_ID=d-3c7d547...
SENDGRID_EVENT_CANCELED_TEMPLATE_ID=d-1df595a...
SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=d-511e46f...

# Moderation & Account Actions
SENDGRID_REPORT_DISMISSED_TEMPLATE_ID=d-9211e4a...
SENDGRID_REPORT_RESOLVED_TEMPLATE_ID=d-7bee5cf...
SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID=d-1548d111...
SENDGRID_CONTENT_REMOVED_TEMPLATE_ID=d-b27c753...
SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID=d-d357a641...
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=d-094101923...
SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID=d-4f388da...
```

### Step 3: Test Templates Before Deploy
Use SendGrid's "Test Data" feature on each template with the provided test payloads from SENDGRID_TEMPLATE_VALIDATION.md

### Step 4: Deploy to Railway
Push your changes to main branch and Railway will automatically deploy.

---

## ✅ TEMPLATE CHECKLIST

### Security & Authentication (5 templates)

- [ ] **Password Reset**
  - Template ID: `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
  - Tokens: USERNAME, RESET_LINK, expires_in, reset_code, privacy_policy_url, community_guidelines_url
  - Subject: "Your VarsityHub Password Reset Link"
  - Backend: ✅ PATCHED (added privacy/community URLs)

- [ ] **Password Changed**
  - Template ID: `SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID`
  - Tokens: USERNAME, CHANGE_DATE, USER_EMAIL, privacy_policy_url, community_guidelines_url
  - Subject: "Your VarsityHub Password Has Been Changed"
  - Backend: ✅ PATCHED (added privacy/community URLs)

- [ ] **Account Recovery**
  - Template ID: `SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID`
  - Tokens: USERNAME, ACCOUNT_EMAIL, RECOVERY_DATE, privacy_policy_url, community_guidelines_url
  - Subject: "Your VarsityHub Account Recovery Notification"
  - Backend: ✅ PATCHED (added privacy/community URLs)

- [ ] **Email Verification**
  - Template ID: `SENDGRID_VERIFICATION_TEMPLATE_ID`
  - Tokens: verification_code, verification_link, user_name
  - Subject: "Verify Your VarsityHub Email Address"
  - Backend: ✅ Ready

- [ ] **Login from New Device**
  - Template ID: `SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID`
  - Tokens: user_name, device_type, device_location, login_date, login_time, ip_address, secure_account_link, change_password_link, contact_support_link, privacy_policy_url, community_guidelines_url
  - Subject: "New Login Detected on Your VarsityHub Account"
  - Backend: ✅ Ready

---

### Organization & Team Management (10 templates)

- [ ] **Organization Invitation**
  - Template ID: `SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID`
  - Tokens: recipient_name, organization_name, inviter_name, role, accept_link, decline_link, privacy_policy_url, community_guidelines_url
  - Subject: "You're Invited to Join {organization_name}"
  - Backend: ✅ Ready

- [ ] **Team Invitation**
  - Template ID: `SENDGRID_TEAM_INVITATION_TEMPLATE_ID`
  - Tokens: recipient_name, team_name, inviter_name, role, accept_link, decline_link, privacy_policy_url, community_guidelines_url
  - Subject: "Join {team_name} - Team Invitation"
  - Backend: ✅ Ready

- [ ] **Athlete Invitation**
  - Template ID: `SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID`
  - Tokens: athlete_name, team_name, coach_name, sport, accept_link, decline_link, privacy_policy_url, community_guidelines_url
  - Subject: "You're Invited to Join {team_name}"
  - Backend: ✅ Ready

- [ ] **Role Assignment**
  - Template ID: `SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID`
  - Tokens: user_name, new_role, team_name, assigned_by, assigned_date, dashboard_link, privacy_policy_url, community_guidelines_url
  - Subject: "Your Role Has Been Updated: {new_role}"
  - Backend: ✅ Ready

- [ ] **Roster Threshold**
  - Template ID: `SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID`
  - Tokens: coach_name, team_name, current_roster_count, max_roster_count, upgrade_link, privacy_policy_url, community_guidelines_url
  - Subject: "Roster Limit Alert: {team_name}"
  - Backend: ✅ Ready

- [ ] **Invitation Declined**
  - Template ID: `SENDGRID_INVITATION_DECLINED_TEMPLATE_ID`
  - Tokens: sender_name, declined_by_name, team_name, role, declined_date, reason_provided, view_team_url, resend_invitation_url, privacy_policy_url, community_guidelines_url
  - Subject: "Invitation Declined: {team_name}"
  - Backend: ✅ Ready

- [ ] **Team Roster Update**
  - Template ID: `SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID`
  - Tokens: coach_name, team_name, update_type, player_name, update_date, view_roster_link, privacy_policy_url, community_guidelines_url
  - Subject: "Roster Update: {team_name}"
  - Backend: ✅ Ready

- [ ] **Staff Member Joined**
  - Template ID: `SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID`
  - Tokens: recipient_name, new_member_name, member_role, team_name, joined_date, organization_name, view_team_link, manage_staff_link, privacy_policy_url, community_guidelines_url
  - Subject: "{new_member_name} Has Joined {team_name}"
  - Backend: ✅ Ready

- [ ] **Member Removed**
  - Template ID: `SENDGRID_MEMBER_REMOVED_TEMPLATE_ID`
  - Tokens: user_name, team_name, organization_name, removed_by, removal_date, removal_reason, contact_email, privacy_policy_url, community_guidelines_url
  - Subject: "You've Been Removed from {team_name}"
  - Backend: ✅ Ready

- [ ] **User Confirmation (Onboarding)**
  - Template ID: `SENDGRID_USER_CONFIRMATION_TEMPLATE_ID`
  - Tokens: user_name, confirmation_link, expires_in, privacy_policy_url, community_guidelines_url
  - Subject: "Welcome to VarsityHub - Confirm Your Account"
  - Backend: ✅ Ready

---

### Billing & Payments (2 templates)

- [ ] **Payment Failed**
  - Template ID: `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`
  - Tokens: user_name, payment_method_last4, failed_amount, failed_date, plan_name, retry_date, update_payment_link, contact_support_link, privacy_policy_url, community_guidelines_url
  - Subject: "Payment Failed - Action Required"
  - Backend: ✅ Ready

- [ ] **Subscription Expiring**
  - Template ID: `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID`
  - Tokens: user_name, plan_name, expires_date, days_remaining, renewal_price, features_losing (array), renew_link, manage_subscription_link, privacy_policy_url, community_guidelines_url
  - Subject: "Your {plan_name} Plan Expires Soon"
  - Backend: ✅ Ready

---

### Event Management (7 templates)

- [ ] **Event Submission Received**
  - Template ID: `SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID`
  - Tokens: coach_name, event_name, event_date, event_time, event_location, submission_date, organization_name, status_link, privacy_policy_url, community_guidelines_url
  - Subject: "Event Submission Received: {event_name}"
  - Backend: ✅ Ready

- [ ] **Event Approved**
  - Template ID: `SENDGRID_EVENT_APPROVED_TEMPLATE_ID`
  - Tokens: coach_name, event_name, event_date, event_time, event_location, opponent, organization_name, approval_notes, event_link, manage_link, privacy_policy_url, community_guidelines_url
  - Subject: "Event Approved: {event_name}"
  - Backend: ✅ Ready

- [ ] **Event Denied**
  - Template ID: `SENDGRID_EVENT_DENIED_TEMPLATE_ID`
  - Tokens: coach_name, event_name, event_date, denial_reason, resubmit_link, support_link, organization_name, privacy_policy_url, community_guidelines_url
  - Subject: "Event Submission Denied: {event_name}"
  - Backend: ✅ Ready

- [ ] **Event Reminder (24H)**
  - Template ID: `SENDGRID_EVENT_REMINDER_TEMPLATE_ID`
  - Tokens: recipient_name, event_name, event_date, event_time, event_location, opponent, organization_name, check_in_link, calendar_link, directions_link, preferences_link, privacy_policy_url, community_guidelines_url
  - Subject: "Reminder: {event_name} Tomorrow at {event_time}"
  - Backend: ✅ Ready

- [ ] **Event Updated**
  - Template ID: `SENDGRID_EVENT_UPDATED_TEMPLATE_ID`
  - Tokens: recipient_name, event_name, event_date, event_time, event_location, organization_name, updated_at, change_summary, event_detail_link, calendar_link, privacy_policy_url, community_guidelines_url
  - Subject: "{event_name} Has Been Updated"
  - Backend: ✅ Ready

- [ ] **Event Cancelled**
  - Template ID: `SENDGRID_EVENT_CANCELED_TEMPLATE_ID`
  - Tokens: recipient_name, event_name, event_date, event_time, event_location, canceled_at, organization_name, cancel_reason, reschedule_info, upcoming_events_link, contact_organizer_link, privacy_policy_url, community_guidelines_url
  - Subject: "{event_name} Has Been Cancelled"
  - Backend: ✅ Ready

- [ ] **Event RSVP Confirmation**
  - Template ID: `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
  - Tokens: user_name, event_name, event_date, event_time, event_location, rsvp_confirmed_at, organization_name, event_detail_link, calendar_link, cancel_rsvp_link, privacy_policy_url, community_guidelines_url
  - Subject: "RSVP Confirmed: {event_name}"
  - Backend: ✅ Ready

---

### Moderation & Account Actions (7 templates)

- [ ] **Report Dismissed**
  - Template ID: `SENDGRID_REPORT_DISMISSED_TEMPLATE_ID`
  - Tokens: user_name, report_id, report_type, resolution_status ("dismissed"), resolution_reason, appeal_url, submit_date, resolution_date, report_detail_link, privacy_policy_url, community_guidelines_url
  - Subject: "Report Dismissed: {report_type}"
  - Backend: ✅ Ready

- [ ] **Report Resolved**
  - Template ID: `SENDGRID_REPORT_RESOLVED_TEMPLATE_ID`
  - Tokens: user_name, report_id, report_type, resolution_status ("resolved"), resolution_reason, appeal_url, submit_date, resolution_date, report_detail_link, privacy_policy_url, community_guidelines_url
  - Subject: "Report Resolved: {report_type}"
  - Backend: ✅ Ready

- [ ] **Account Warning**
  - Template ID: `SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID`
  - Tokens: user_name, report_id, violation_type, warning_reason, appeal_url, community_guidelines_url, privacy_policy_url
  - Subject: "Account Warning: {violation_type}"
  - Backend: ✅ Ready

- [ ] **Content Removed**
  - Template ID: `SENDGRID_CONTENT_REMOVED_TEMPLATE_ID`
  - Tokens: user_name, report_id, content_type, report_type, removal_date, content_preview, removal_reason, appeal_url, community_guidelines_url, privacy_policy_url
  - Subject: "Your Content Has Been Removed"
  - Backend: ✅ Ready

- [ ] **7-Day Account Suspension**
  - Template ID: `SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID`
  - Tokens: user_name, report_id, violation_type, suspension_days (7), suspension_duration ("7 days"), suspension_date, reinstatement_date, suspension_reason, report_type, appeal_url, community_guidelines_url, privacy_policy_url
  - Subject: "Account Suspended - 7 Days"
  - Backend: ✅ Ready

- [ ] **45-Day Account Suspension**
  - Template ID: `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`
  - Tokens: user_name, report_id, violation_type, suspension_days (45), suspension_duration ("45 days"), suspension_date, reinstatement_date, suspension_reason, report_type, appeal_url, community_guidelines_url, privacy_policy_url
  - Subject: "Account Suspended - 45 Days"
  - Backend: ✅ Ready

- [ ] **Permanent Account Ban**
  - Template ID: `SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID`
  - Tokens: user_name, report_id, violation_type, report_type, ban_date, ban_reason, appeal_url, support_email, community_guidelines_url, privacy_policy_url
  - Subject: "Account Permanently Banned"
  - Backend: ✅ Ready

---

## 🔍 VALIDATION STEPS

### For Each Template in SendGrid:

1. **Open the template editor** and verify:
   - [ ] `<subject>...</subject>` tag is present at the top
   - [ ] Subject text is descriptive and professional
   - [ ] All required tokens are referenced in the template body
   - [ ] Token syntax is correct: `{{token_name}}` (not `{token_name}`)
   - [ ] Optional fields use conditionals: `{{#if field}}...{{/if}}`
   - [ ] Arrays use iteration: `{{#each array}}...{{/each}}`
   - [ ] Footer links use `privacy_policy_url` and `community_guidelines_url` tokens
   - [ ] Template is marked as "Dynamic" (not transactional)

2. **Test the template** in SendGrid:
   - [ ] Click "Test Data" button
   - [ ] Paste the corresponding JSON payload from SENDGRID_TEMPLATE_VALIDATION.md
   - [ ] Preview the rendered email
   - [ ] Verify all tokens populated correctly
   - [ ] Check links work (they should show protocol + domain)
   - [ ] Verify formatting and styling matches your design

3. **Save & Activate**:
   - [ ] Click "Save" to save changes
   - [ ] Copy the template ID (format: `d-xxxxxxxxxxxxx`)
   - [ ] Add to Railway environment variables

---

## 📝 SENDGRID TEMPLATE REQUIREMENTS

All templates must follow this structure:

```html
<subject>Your Email Subject Here</subject>

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Your CSS styles here */
  </style>
</head>
<body>
  <!-- Your email content -->
  <p>Hello {{recipient_name}},</p>
  
  <p>Your message content with {{token_name}} tokens.</p>
  
  {{#if optional_field}}
    <p>Optional content only shows if optional_field has a value</p>
  {{/if}}
  
  {{#each array_field}}
    <li>{{this}}</li>
  {{/each}}
  
  <!-- Footer with policy links -->
  <footer>
    <p>
      <a href="{{privacy_policy_url}}">Privacy Policy</a> | 
      <a href="{{community_guidelines_url}}">Community Guidelines</a>
    </p>
  </footer>
</body>
</html>
```

### Key Points:
- **Subject tag must be on first line** - SendGrid requires this
- **Use snake_case for all tokens** - matches backend contract
- **Handlebars syntax** - Uses `{{}}` not `{{}}`
- **No hardcoded links** - Always use token URLs from backend
- **Privacy/Community URLs required** - All templates must include footer links
- **UTF-8 charset** - Required for international support

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to Railway:

- [ ] All 29 templates created in SendGrid
- [ ] All templates have subject tags
- [ ] All templates tested with provided payloads
- [ ] All template IDs copied
- [ ] All environment variables added to Railway
- [ ] Backend patches applied (✅ DONE - privacy/community URLs added)
- [ ] Snyk security scan passed (✅ PASSED)
- [ ] Code committed and pushed to main branch
- [ ] Railway deployment triggered
- [ ] Test emails sent from staging environment
- [ ] Production email service activated

---

## 🧪 TESTING IN PRODUCTION

After deployment, test each email type:

```typescript
// Example: Test password reset email
import { sendPasswordResetEmail } from './lib/email.js';

await sendPasswordResetEmail(
  'test@example.com',
  'test-reset-code-123',
  'Test User',
  'https://varsityhub.app/reset/test-reset-code-123',
  '1 hour'
);

// Check your email inbox - should receive the email within 5 seconds
```

---

## 📞 TROUBLESHOOTING

### Email Not Sending
- [ ] Check `SENDGRID_API_KEY` is set in Railway
- [ ] Verify template IDs are correct (format: `d-xxxxx...`)
- [ ] Check SendGrid dashboard for bounces/errors
- [ ] Verify email address is not on suppression list

### Tokens Not Rendering
- [ ] Verify token names match backend contract (snake_case)
- [ ] Check template uses `{{token_name}}` syntax
- [ ] Ensure backend sends token in dynamicTemplateData
- [ ] Review SendGrid template editor error messages

### Template Not Activating
- [ ] Confirm `<subject>` tag is present
- [ ] Check template doesn't have syntax errors
- [ ] Try saving as new version if stuck
- [ ] Contact SendGrid support if issue persists

---

## 📊 BACKEND FUNCTIONS STATUS

✅ = Ready  
⚠️ = Needs setup  
❌ = Not implemented

| Function | Status | Notes |
|----------|--------|-------|
| sendPasswordResetEmail | ✅ | Patched with privacy URLs |
| sendPasswordChangedEmail | ✅ | Patched with privacy URLs |
| sendAccountRecoveryEmail | ✅ | Patched with privacy URLs |
| sendVerificationEmail | ✅ | Ready |
| sendOrganizationInvitationEmail | ✅ | Ready |
| sendTeamInvitationEmail | ✅ | Ready |
| sendAthleteInvitationEmail | ✅ | Ready |
| sendRoleAssignmentEmail | ✅ | Ready |
| sendRosterThresholdEmail | ✅ | Ready |
| sendInvitationDeclinedEmail | ✅ | Ready |
| sendTeamRosterUpdateEmail | ✅ | Ready |
| sendUserConfirmationEmail | ✅ | Ready |
| sendMemberRemovedEmail | ✅ | Ready |
| sendPaymentFailedEmail | ✅ | Ready |
| sendReportResolutionEmail | ✅ | Ready |
| sendEventSubmissionReceivedEmail | ✅ | Ready |
| sendEventApprovedEmail | ✅ | Ready |
| sendEventDeniedEmail | ✅ | Ready |
| sendEventReminderEmail | ✅ | Ready |
| sendEventUpdatedEmail | ✅ | Ready |
| sendEventCanceledEmail | ✅ | Ready |
| sendAccountWarningEmail | ✅ | Ready |
| sendContentRemovedEmail | ✅ | Ready |
| sendAccountSuspensionEmail | ✅ | Ready |
| sendAccountPermanentBanEmail | ✅ | Ready |
| sendEventRsvpConfirmedEmail | ✅ | Ready |
| sendLoginFromNewDeviceEmail | ✅ | Ready |
| sendStaffMemberJoinedEmail | ✅ | Ready |
| sendSubscriptionExpiringEmail | ✅ | Ready |

---

## 🔐 Security Notes

- ✅ All hardcoded URLs use canonical domain (`varsityhub.app`)
- ✅ No sensitive data in email templates
- ✅ All URLs parameterized from backend
- ✅ Appeal/recovery links are secure tokens
- ✅ Snyk code scan: PASSED

---

**Ready to deploy!** 🎉
