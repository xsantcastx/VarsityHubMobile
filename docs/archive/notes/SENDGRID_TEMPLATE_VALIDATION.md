# SendGrid Email Template Validation Guide

**Last Updated:** December 16, 2025  
**Status:** In Progress - Validating all 30 email templates against backend contracts

## Quick Reference: Template IDs & Environment Variables

All template IDs must be configured in Railway environment as `SENDGRID_[TEMPLATE]_TEMPLATE_ID`.

---

## ✅ SECURITY EMAILS

### 1. Password Reset - VH

- **Backend Function:** `sendPasswordResetEmail(email, code, userName?, resetLink?, expiresInLabel)`
- **Template ID Env Var:** `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
- **Subject Tag Required:** Yes - `<subject>Your VarsityHub Password Reset Link</subject>`
- **Required Tokens:**
  - `USERNAME` (maps to userName param, defaults to 'VarsityHub member')
  - `RESET_LINK` (maps to resetLink param or auto-generated from code)
  - `expires_in` (defaults to '1 hour')
  - `reset_code` (the token code)
  - `privacy_policy_url` (NOT in current backend - needs addition)
  - `community_guidelines_url` (NOT in current backend - needs addition)

**Test Payload:**

```json
{
  "USERNAME": "John Coach",
  "RESET_LINK": "https://varsityhub.app/reset/eyJhbGciOiJIUzI1NiIs",
  "expires_in": "1 hour",
  "reset_code": "eyJhbGciOiJIUzI1NiIs",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

**Fixes Needed:**

- [ ] Add privacy_policy_url and community_guidelines_url to dynamicTemplateData in sendPasswordResetEmail
- [ ] Verify <subject> tag present in SendGrid template

---

### 2. Password Changed - VH

- **Backend Function:** `sendPasswordChangedEmail(email, userName?, changeDate?)`
- **Template ID Env Var:** `SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID`
- **Subject Tag Required:** Yes
- **Required Tokens:**
  - `USERNAME`
  - `CHANGE_DATE` (formatted, defaults to Chicago time)
  - `USER_EMAIL`
  - `privacy_policy_url` (NOT in backend - needs addition)
  - `community_guidelines_url` (NOT in backend - needs addition)

**Test Payload:**

```json
{
  "USERNAME": "John Coach",
  "CHANGE_DATE": "Dec 16, 2025, 2:30 PM CT",
  "USER_EMAIL": "john@example.com",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

**Fixes Needed:**

- [ ] Add privacy_policy_url and community_guidelines_url to sendPasswordChangedEmail
- [ ] Verify <subject> tag

---

### 3. Account Recovery - VH

- **Backend Function:** `sendAccountRecoveryEmail(email, userName?, recoveryDate?)`
- **Template ID Env Var:** `SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID`
- **Subject Tag Required:** Yes
- **Required Tokens:**
  - `USERNAME`
  - `ACCOUNT_EMAIL`
  - `RECOVERY_DATE`
  - `privacy_policy_url` (NOT in backend - needs addition)
  - `community_guidelines_url` (NOT in backend - needs addition)

**Test Payload:**

```json
{
  "USERNAME": "John Coach",
  "ACCOUNT_EMAIL": "john@example.com",
  "RECOVERY_DATE": "Dec 16, 2025, 2:30 PM CT",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

**Fixes Needed:**

- [ ] Add privacy_policy_url and community_guidelines_url
- [ ] Verify <subject> tag

---

### 4. Log in from new device - VH

- **Backend Function:** `sendLoginFromNewDeviceEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete with all required tokens
- **Required Tokens:**
  - `user_name`
  - `device_type`
  - `device_location`
  - `login_date`
  - `login_time`
  - `ip_address`
  - `secure_account_link`
  - `change_password_link`
  - `contact_support_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "device_type": "iPhone 15 Pro",
  "device_location": "Chicago, IL",
  "login_date": "Dec 16, 2025",
  "login_time": "2:30 PM CT",
  "ip_address": "192.168.1.100",
  "secure_account_link": "https://varsityhub.app/settings/security",
  "change_password_link": "https://varsityhub.app/settings/password",
  "contact_support_link": "https://varsityhub.app/support",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 🏢 ORGANIZATION & TEAM MANAGEMENT

### 5. Organization Invitation - VH

- **Backend Function:** `sendOrganizationInvitationEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `recipient_name`
  - `organization_name`
  - `inviter_name`
  - `role`
  - `accept_link`
  - `decline_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "recipient_name": "Jane Smith",
  "organization_name": "Lincoln High Wildcats",
  "inviter_name": "Coach Mike Johnson",
  "role": "Coach",
  "accept_link": "https://varsityhub.app/invitations/org/abc123/accept",
  "decline_link": "https://varsityhub.app/invitations/org/abc123/decline",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 6. Role Assignment - VH

- **Backend Function:** `sendRoleAssignmentEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `new_role`
  - `team_name`
  - `assigned_by`
  - `assigned_date`
  - `dashboard_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "new_role": "Head Coach",
  "team_name": "Varsity Football",
  "assigned_by": "Director Admin",
  "assigned_date": "Dec 16, 2025",
  "dashboard_link": "https://varsityhub.app/dashboard/team/xyz",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 7. Athlete invitation - VH

- **Backend Function:** `sendAthleteInvitationEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `athlete_name`
  - `team_name`
  - `coach_name`
  - `sport`
  - `accept_link`
  - `decline_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "athlete_name": "Sarah Johnson",
  "team_name": "Varsity Volleyball",
  "coach_name": "Coach Mike",
  "sport": "Volleyball",
  "accept_link": "https://varsityhub.app/invitations/athlete/def456/accept",
  "decline_link": "https://varsityhub.app/invitations/athlete/def456/decline",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 8. Roster Threshold - VH

- **Backend Function:** `sendRosterThresholdEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `coach_name`
  - `team_name`
  - `current_roster_count`
  - `max_roster_count`
  - `upgrade_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "coach_name": "Coach Mike Johnson",
  "team_name": "Varsity Football",
  "current_roster_count": 48,
  "max_roster_count": 50,
  "upgrade_link": "https://varsityhub.app/upgrade/plan",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 9. Invitation Declined - VH

- **Backend Function:** `sendInvitationDeclinedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_INVITATION_DECLINED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `sender_name`
  - `declined_by_name`
  - `team_name`
  - `role`
  - `declined_date`
  - `reason_provided` (optional)
  - `view_team_url`
  - `resend_invitation_url`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "sender_name": "Coach Mike",
  "declined_by_name": "Jane Smith",
  "team_name": "Varsity Football",
  "role": "Assistant Coach",
  "declined_date": "Dec 16, 2025",
  "reason_provided": "Not available this season",
  "view_team_url": "https://varsityhub.app/teams/xyz",
  "resend_invitation_url": "https://varsityhub.app/teams/xyz/invite-staff",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 10. Team Roster Update - VH

- **Backend Function:** `sendTeamRosterUpdateEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `coach_name`
  - `team_name`
  - `update_type` ("joined" or "left")
  - `player_name`
  - `update_date`
  - `view_roster_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "coach_name": "Coach Mike Johnson",
  "team_name": "Varsity Football",
  "update_type": "joined",
  "player_name": "Marcus Wilson",
  "update_date": "Dec 16, 2025",
  "view_roster_link": "https://varsityhub.app/teams/xyz/roster",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 11. Staff member joined - VH

- **Backend Function:** `sendStaffMemberJoinedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `recipient_name`
  - `new_member_name`
  - `member_role`
  - `team_name`
  - `joined_date`
  - `organization_name`
  - `view_team_link`
  - `manage_staff_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "recipient_name": "Coach Mike",
  "new_member_name": "Sarah Johnson",
  "member_role": "Assistant Coach",
  "team_name": "Varsity Football",
  "joined_date": "Dec 16, 2025",
  "organization_name": "Lincoln High School",
  "view_team_link": "https://varsityhub.app/teams/xyz",
  "manage_staff_link": "https://varsityhub.app/teams/xyz/staff",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 📋 MEMBERSHIP & ONBOARDING

### 12. User Confirmation - VH

- **Backend Function:** `sendUserConfirmationEmail(params: {to, userName, confirmationLink, expiresIn})`
- **Template ID Env Var:** `SENDGRID_USER_CONFIRMATION_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `confirmation_link`
  - `expires_in`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "confirmation_link": "https://varsityhub.app/confirm-email?token=ghi789&email=john@example.com",
  "expires_in": "24 hours",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 💳 BILLING & PAYMENTS

### 13. Payment Failed - VH

- **Backend Function:** `sendPaymentFailedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `payment_method_last4`
  - `failed_amount`
  - `failed_date`
  - `plan_name`
  - `retry_date`
  - `update_payment_link`
  - `contact_support_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "payment_method_last4": "4242",
  "failed_amount": "$29.99",
  "failed_date": "Dec 16, 2025",
  "plan_name": "Premium Plus",
  "retry_date": "Dec 17, 2025",
  "update_payment_link": "https://varsityhub.app/billing/payment-method",
  "contact_support_link": "https://varsityhub.app/support",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 14. Subscription Expiring - VH

- **Backend Function:** `sendSubscriptionExpiringEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `plan_name`
  - `expires_date`
  - `days_remaining`
  - `renewal_price`
  - `features_losing` (array of feature names)
  - `renew_link`
  - `manage_subscription_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "plan_name": "Premium Plus",
  "expires_date": "Dec 23, 2025",
  "days_remaining": "7",
  "renewal_price": "$29.99",
  "features_losing": ["Roster Analytics", "Team Highlights", "Premium Support"],
  "renew_link": "https://varsityhub.app/billing/renew",
  "manage_subscription_link": "https://varsityhub.app/settings/subscription",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 📣 EVENT MANAGEMENT

### 15. Event Submission Recieved - VH

- **Backend Function:** `sendEventSubmissionReceivedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `coach_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `submission_date`
  - `organization_name`
  - `status_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "coach_name": "Coach Mike Johnson",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:00 PM CT",
  "event_location": "Lincoln High Stadium, Chicago, IL",
  "submission_date": "Dec 16, 2025 · 2:30 PM CT",
  "organization_name": "Lincoln High School",
  "status_link": "https://varsityhub.app/events/abc123/status",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 16. Event Approved - VH

- **Backend Function:** `sendEventApprovedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_APPROVED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `coach_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `opponent` (optional)
  - `organization_name`
  - `approval_notes` (optional)
  - `event_link`
  - `manage_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "coach_name": "Coach Mike Johnson",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:00 PM CT",
  "event_location": "Lincoln High Stadium",
  "opponent": "Central High Wildcats",
  "organization_name": "Lincoln High School",
  "approval_notes": "Your event has been approved. Great work!",
  "event_link": "https://varsityhub.app/events/abc123",
  "manage_link": "https://varsityhub.app/events/abc123/manage",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 17. Event Denied - VH

- **Backend Function:** `sendEventDeniedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_DENIED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `coach_name`
  - `event_name`
  - `event_date`
  - `denial_reason`
  - `resubmit_link`
  - `support_link`
  - `organization_name`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "coach_name": "Coach Mike Johnson",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "denial_reason": "Venue conflict detected. Please resolve and resubmit.",
  "resubmit_link": "https://varsityhub.app/events/abc123/resubmit",
  "support_link": "https://varsityhub.app/support",
  "organization_name": "Lincoln High School",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 18. event reminder 24H - VH

- **Backend Function:** `sendEventReminderEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_REMINDER_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `recipient_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `opponent` (optional)
  - `organization_name`
  - `check_in_link`
  - `calendar_link`
  - `directions_link`
  - `preferences_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "recipient_name": "John Coach",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:00 PM CT",
  "event_location": "Lincoln High Stadium, Chicago, IL",
  "opponent": "Central High Wildcats",
  "organization_name": "Lincoln High School",
  "check_in_link": "https://varsityhub.app/events/abc123/check-in",
  "calendar_link": "https://varsityhub.app/events/abc123/calendar",
  "directions_link": "https://varsityhub.app/events/abc123/directions",
  "preferences_link": "https://varsityhub.app/settings/notifications",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 19. Event updated - VH

- **Backend Function:** `sendEventUpdatedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_UPDATED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `recipient_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `organization_name`
  - `updated_at`
  - `change_summary`
  - `event_detail_link`
  - `calendar_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "recipient_name": "John Coach",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:30 PM CT",
  "event_location": "Lincoln High Stadium, Chicago, IL",
  "organization_name": "Lincoln High School",
  "updated_at": "Dec 16, 2025 · 1:45 PM CT",
  "change_summary": "Start time changed from 7:00 PM to 7:30 PM CT",
  "event_detail_link": "https://varsityhub.app/events/abc123",
  "calendar_link": "https://varsityhub.app/events/abc123/calendar",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 20. Event Cancelled - VH

- **Backend Function:** `sendEventCanceledEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_CANCELED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `recipient_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `canceled_at`
  - `organization_name`
  - `cancel_reason`
  - `reschedule_info` (optional)
  - `upcoming_events_link`
  - `contact_organizer_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "recipient_name": "John Coach",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:00 PM CT",
  "event_location": "Lincoln High Stadium",
  "canceled_at": "Dec 16, 2025 · 1:30 PM CT",
  "organization_name": "Lincoln High School",
  "cancel_reason": "Weather conditions unsafe for play",
  "reschedule_info": "We will reschedule for Saturday, January 25 at 10:00 AM CT",
  "upcoming_events_link": "https://varsityhub.app/calendar",
  "contact_organizer_link": "https://varsityhub.app/support",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 21. Event RSVP confirmation - VH

- **Backend Function:** `sendEventRsvpConfirmedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `event_name`
  - `event_date`
  - `event_time`
  - `event_location`
  - `rsvp_confirmed_at`
  - `organization_name`
  - `event_detail_link`
  - `calendar_link`
  - `cancel_rsvp_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "event_name": "Varsity Football vs Central High",
  "event_date": "Friday, January 24, 2025",
  "event_time": "7:00 PM CT",
  "event_location": "Lincoln High Stadium",
  "rsvp_confirmed_at": "Dec 16, 2025 · 10:00 AM CT",
  "organization_name": "Lincoln High School",
  "event_detail_link": "https://varsityhub.app/events/abc123",
  "calendar_link": "https://varsityhub.app/events/abc123/calendar",
  "cancel_rsvp_link": "https://varsityhub.app/events/abc123/rsvp/cancel",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 🚨 MODERATION & ACCOUNT ACTIONS

### 22. Report Dismissed - VH

- **Backend Function:** `sendReportResolutionEmail(params: {..., resolutionStatus: 'dismissed'})`
- **Template ID Env Var:** `SENDGRID_REPORT_DISMISSED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `report_type`
  - `resolution_status` (value: "dismissed")
  - `resolution_reason`
  - `appeal_url`
  - `submit_date`
  - `resolution_date`
  - `report_detail_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "Sarah Johnson",
  "report_id": "RPT-123456",
  "report_type": "Inappropriate Comment",
  "resolution_status": "dismissed",
  "resolution_reason": "After review, this content does not violate our Community Guidelines.",
  "appeal_url": "https://varsityhub.app/appeals/rpt-123456",
  "submit_date": "Dec 10, 2025",
  "resolution_date": "Dec 16, 2025",
  "report_detail_link": "https://varsityhub.app/reports/rpt-123456",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 23. Report Resolution - VH

- **Backend Function:** `sendReportResolutionEmail(params: {..., resolutionStatus: 'resolved'})`
- **Template ID Env Var:** `SENDGRID_REPORT_RESOLVED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `report_type`
  - `resolution_status` (value: "resolved")
  - `resolution_reason`
  - `appeal_url`
  - `submit_date`
  - `resolution_date`
  - `report_detail_link`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "report_id": "RPT-789012",
  "report_type": "Harassment",
  "resolution_status": "resolved",
  "resolution_reason": "Violation confirmed. Content has been removed and user has been warned.",
  "appeal_url": "https://varsityhub.app/appeals/rpt-789012",
  "submit_date": "Dec 12, 2025",
  "resolution_date": "Dec 16, 2025",
  "report_detail_link": "https://varsityhub.app/reports/rpt-789012",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

### 24. Account Warning - VH

- **Backend Function:** `sendAccountWarningEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `violation_type`
  - `warning_reason`
  - `appeal_url`
  - `community_guidelines_url`
  - `privacy_policy_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "report_id": "RPT-345678",
  "violation_type": "Harassment",
  "warning_reason": "Your account received a warning for violating our Community Guidelines. Further violations may result in suspension or permanent ban.",
  "appeal_url": "https://varsityhub.app/appeals/rpt-345678",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines",
  "privacy_policy_url": "https://varsityhub.app/privacy"
}
```

---

### 25. Content Removed - VH

- **Backend Function:** `sendContentRemovedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_CONTENT_REMOVED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `content_type`
  - `report_type` (optional)
  - `removal_date`
  - `content_preview` (optional)
  - `removal_reason`
  - `appeal_url`
  - `community_guidelines_url`
  - `privacy_policy_url`

**Test Payload:**

```json
{
  "user_name": "Sarah Johnson",
  "report_id": "RPT-567890",
  "content_type": "Post",
  "report_type": "Policy Violation",
  "removal_date": "Dec 16, 2025",
  "content_preview": "Your post about team members...",
  "removal_reason": "This content violates our Community Guidelines regarding harassment.",
  "appeal_url": "https://varsityhub.app/appeals/rpt-567890",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines",
  "privacy_policy_url": "https://varsityhub.app/privacy"
}
```

---

### 26. 7 day suspension - VH

- **Backend Function:** `sendAccountSuspensionEmail(params: {..., suspensionDays: 7})`
- **Template ID Env Var:** `SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `violation_type`
  - `suspension_days` (value: 7)
  - `suspension_duration` (value: "7 days")
  - `suspension_date`
  - `reinstatement_date`
  - `suspension_reason`
  - `report_type`
  - `appeal_url`
  - `community_guidelines_url`
  - `privacy_policy_url`

**Test Payload:**

```json
{
  "user_name": "John Coach",
  "report_id": "RPT-901234",
  "violation_type": "Harassment",
  "suspension_days": 7,
  "suspension_duration": "7 days",
  "suspension_date": "Dec 16, 2025",
  "reinstatement_date": "Dec 23, 2025",
  "suspension_reason": "Multiple violations of Community Guidelines regarding harassment",
  "report_type": "Harassment",
  "appeal_url": "https://varsityhub.app/appeals/rpt-901234",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines",
  "privacy_policy_url": "https://varsityhub.app/privacy"
}
```

---

### 27. 45 day suspension - VH

- **Backend Function:** `sendAccountSuspensionEmail(params: {..., suspensionDays: 45})`
- **Template ID Env Var:** `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `violation_type`
  - `suspension_days` (value: 45)
  - `suspension_duration` (value: "45 days")
  - `suspension_date`
  - `reinstatement_date`
  - `suspension_reason`
  - `report_type`
  - `appeal_url`
  - `community_guidelines_url`
  - `privacy_policy_url`

**Test Payload:**

```json
{
  "user_name": "Jane Smith",
  "report_id": "RPT-234567",
  "violation_type": "Abuse and Harassment",
  "suspension_days": 45,
  "suspension_duration": "45 days",
  "suspension_date": "Dec 16, 2025",
  "reinstatement_date": "Jan 30, 2026",
  "suspension_reason": "Severe and repeated violations of Community Guidelines",
  "report_type": "Abuse and Harassment",
  "appeal_url": "https://varsityhub.app/appeals/rpt-234567",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines",
  "privacy_policy_url": "https://varsityhub.app/privacy"
}
```

---

### 28. Permanent Ban - VH

- **Backend Function:** `sendAccountPermanentBanEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `report_id`
  - `violation_type`
  - `report_type`
  - `ban_date`
  - `ban_reason`
  - `appeal_url`
  - `support_email`
  - `community_guidelines_url`
  - `privacy_policy_url`

**Test Payload:**

```json
{
  "user_name": "Marcus Williams",
  "report_id": "RPT-345678",
  "violation_type": "Severe Abuse",
  "report_type": "Severe Abuse",
  "ban_date": "Dec 16, 2025 2:30 PM CT",
  "ban_reason": "Your account has been permanently banned due to severe and repeated violations of our Community Guidelines.",
  "appeal_url": "https://varsityhub.app/appeals/rpt-345678",
  "support_email": "customerservice@varsityhub.app",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines",
  "privacy_policy_url": "https://varsityhub.app/privacy"
}
```

---

## 📋 ADDITIONAL MEMBERSHIP

### 29. Member Removed Notification

- **Backend Function:** `sendMemberRemovedEmail(params: {...})`
- **Template ID Env Var:** `SENDGRID_MEMBER_REMOVED_TEMPLATE_ID`
- **Status:** ✅ Backend contract complete
- **Required Tokens:**
  - `user_name`
  - `team_name`
  - `organization_name`
  - `removed_by`
  - `removal_date`
  - `removal_reason` (optional)
  - `contact_email`
  - `privacy_policy_url`
  - `community_guidelines_url`

**Test Payload:**

```json
{
  "user_name": "Sarah Johnson",
  "team_name": "Varsity Football",
  "organization_name": "Lincoln High School",
  "removed_by": "Coach Mike Johnson",
  "removal_date": "Dec 16, 2025",
  "removal_reason": "Season ended - roster finalized",
  "contact_email": "athletics@lincolnhigh.edu",
  "privacy_policy_url": "https://varsityhub.app/privacy",
  "community_guidelines_url": "https://varsityhub.app/community-guidelines"
}
```

---

## 🔧 BACKEND PATCHES NEEDED

The following functions need to be updated to include `privacy_policy_url` and `community_guidelines_url` in their dynamicTemplateData objects:

- [ ] `sendPasswordResetEmail` - Add privacy/community URLs
- [ ] `sendPasswordChangedEmail` - Add privacy/community URLs
- [ ] `sendAccountRecoveryEmail` - Add privacy/community URLs

All other functions already include these tokens.

---

## ✅ SENDGRID ENVIRONMENT VARIABLES CHECKLIST

Before deploying to Railway, ensure all these environment variables are set:

```bash
# Security & Auth
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=<template-id>
SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID=<template-id>
SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID=<template-id>
SENDGRID_VERIFICATION_TEMPLATE_ID=<template-id>
SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID=<template-id>

# Organizations & Teams
SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID=<template-id>
SENDGRID_TEAM_INVITATION_TEMPLATE_ID=<template-id>
SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID=<template-id>
SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID=<template-id>
SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID=<template-id>
SENDGRID_INVITATION_DECLINED_TEMPLATE_ID=<template-id>
SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID=<template-id>
SENDGRID_MEMBER_REMOVED_TEMPLATE_ID=<template-id>
SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID=<template-id>
SENDGRID_USER_CONFIRMATION_TEMPLATE_ID=<template-id>

# Billing & Payments
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=<template-id>
SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID=<template-id>

# Events
SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_DENIED_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_UPDATED_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_CANCELED_TEMPLATE_ID=<template-id>
SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=<template-id>

# Moderation & Account Actions
SENDGRID_REPORT_DISMISSED_TEMPLATE_ID=<template-id>
SENDGRID_REPORT_RESOLVED_TEMPLATE_ID=<template-id>
SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID=<template-id>
SENDGRID_CONTENT_REMOVED_TEMPLATE_ID=<template-id>
SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID=<template-id>
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=<template-id>
SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID=<template-id>
```

---

## 📝 NOTES

- All template subjects should use the format: `<subject>Your Message Here</subject>`
- Footer links must use the provided `privacy_policy_url` and `community_guidelines_url` tokens
- Dates should be formatted consistently (e.g., "Dec 16, 2025" or "Friday, January 24, 2025")
- Times should include timezone abbreviation (e.g., "7:00 PM CT")
- Arrays (like `features_losing`) use Handlebars iteration: `{{#each features_losing}}...{{/each}}`
- Optional fields can use Handlebars conditionals: `{{#if field}}...{{/if}}`
