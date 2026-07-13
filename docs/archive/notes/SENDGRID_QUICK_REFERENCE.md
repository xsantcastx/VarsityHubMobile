# SendGrid Templates - Quick Reference Card

> **Print this or keep it open while configuring your SendGrid templates**

## 🔐 SECURITY EMAILS (5)

| #   | Template Name      | Template ID Env Var                     | Subject                               | Key Tokens                                                                  |
| --- | ------------------ | --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Password Reset     | `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`   | "Your VarsityHub Password Reset Link" | USERNAME, RESET_LINK, expires_in, reset_code                                |
| 2   | Password Changed   | `SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID` | "Your Password Has Been Changed"      | USERNAME, CHANGE_DATE, USER_EMAIL                                           |
| 3   | Account Recovery   | `SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID` | "Account Recovery Notification"       | USERNAME, ACCOUNT_EMAIL, RECOVERY_DATE                                      |
| 4   | Email Verification | `SENDGRID_VERIFICATION_TEMPLATE_ID`     | "Verify Your Email Address"           | verification_code, verification_link, user_name                             |
| 5   | Login New Device   | `SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID` | "New Login Detected"                  | user_name, device_type, device_location, login_date, login_time, ip_address |

---

## 🏢 ORGANIZATION & TEAM (10)

| #   | Template Name       | Template ID Env Var                            | Subject                                 | Key Tokens                                                                              |
| --- | ------------------- | ---------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 6   | Org Invitation      | `SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID` | "You're Invited to {organization_name}" | recipient_name, organization_name, inviter_name, role, accept_link, decline_link        |
| 7   | Team Invitation     | `SENDGRID_TEAM_INVITATION_TEMPLATE_ID`         | "Join {team_name}"                      | recipient_name, team_name, inviter_name, role, accept_link, decline_link                |
| 8   | Athlete Invitation  | `SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID`      | "You're Invited to {team_name}"         | athlete_name, team_name, coach_name, sport, accept_link, decline_link                   |
| 9   | Role Assignment     | `SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID`         | "Your Role Updated: {new_role}"         | user_name, new_role, team_name, assigned_by, assigned_date, dashboard_link              |
| 10  | Roster Threshold    | `SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID`        | "Roster Limit Alert"                    | coach_name, team_name, current_roster_count, max_roster_count, upgrade_link             |
| 11  | Invitation Declined | `SENDGRID_INVITATION_DECLINED_TEMPLATE_ID`     | "Invitation Declined"                   | sender_name, declined_by_name, team_name, role, declined_date, reason_provided          |
| 12  | Roster Update       | `SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID`      | "Roster Update: {team_name}"            | coach_name, team_name, update_type, player_name, update_date, view_roster_link          |
| 13  | Staff Member Joined | `SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID`     | "{new_member_name} Joined {team_name}"  | recipient_name, new_member_name, member_role, team_name, joined_date, organization_name |
| 14  | Member Removed      | `SENDGRID_MEMBER_REMOVED_TEMPLATE_ID`          | "Removed from {team_name}"              | user_name, team_name, organization_name, removed_by, removal_date, removal_reason       |
| 15  | User Confirmation   | `SENDGRID_USER_CONFIRMATION_TEMPLATE_ID`       | "Welcome - Confirm Your Account"        | user_name, confirmation_link, expires_in                                                |

---

## 💳 BILLING (2)

| #   | Template Name         | Template ID Env Var                          | Subject                            | Key Tokens                                                                         |
| --- | --------------------- | -------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| 16  | Payment Failed        | `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`        | "Payment Failed - Action Required" | user_name, payment_method_last4, failed_amount, failed_date, plan_name, retry_date |
| 17  | Subscription Expiring | `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID` | "Your {plan_name} Expires Soon"    | user_name, plan_name, expires_date, days_remaining, renewal_price, features_losing |

---

## 📅 EVENTS (7)

| #   | Template Name    | Template ID Env Var                              | Subject                        | Key Tokens                                                                                                        |
| --- | ---------------- | ------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 18  | Event Submission | `SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID` | "Event Submission Received"    | coach_name, event_name, event_date, event_time, event_location, submission_date, organization_name                |
| 19  | Event Approved   | `SENDGRID_EVENT_APPROVED_TEMPLATE_ID`            | "Event Approved: {event_name}" | coach_name, event_name, event_date, event_time, event_location, opponent, organization_name, approval_notes       |
| 20  | Event Denied     | `SENDGRID_EVENT_DENIED_TEMPLATE_ID`              | "Event Denied: {event_name}"   | coach_name, event_name, event_date, denial_reason, resubmit_link, support_link, organization_name                 |
| 21  | Event Reminder   | `SENDGRID_EVENT_REMINDER_TEMPLATE_ID`            | "Event Reminder Tomorrow"      | recipient_name, event_name, event_date, event_time, event_location, opponent, organization_name, check_in_link    |
| 22  | Event Updated    | `SENDGRID_EVENT_UPDATED_TEMPLATE_ID`             | "{event_name} Updated"         | recipient_name, event_name, event_date, event_time, event_location, organization_name, updated_at, change_summary |
| 23  | Event Cancelled  | `SENDGRID_EVENT_CANCELED_TEMPLATE_ID`            | "{event_name} Cancelled"       | recipient_name, event_name, event_date, event_time, event_location, canceled_at, organization_name, cancel_reason |
| 24  | Event RSVP       | `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`      | "RSVP Confirmed: {event_name}" | user_name, event_name, event_date, event_time, event_location, rsvp_confirmed_at, organization_name               |

---

## 🚨 MODERATION (7)

| #   | Template Name    | Template ID Env Var                               | Subject             | Key Tokens                                                                                 |
| --- | ---------------- | ------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| 25  | Report Dismissed | `SENDGRID_REPORT_DISMISSED_TEMPLATE_ID`           | "Report Dismissed"  | user_name, report_id, report_type, resolution_status, resolution_reason, appeal_url        |
| 26  | Report Resolved  | `SENDGRID_REPORT_RESOLVED_TEMPLATE_ID`            | "Report Resolved"   | user_name, report_id, report_type, resolution_status, resolution_reason, appeal_url        |
| 27  | Account Warning  | `SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID`            | "Account Warning"   | user_name, report_id, violation_type, warning_reason, appeal_url                           |
| 28  | Content Removed  | `SENDGRID_CONTENT_REMOVED_TEMPLATE_ID`            | "Content Removed"   | user_name, report_id, content_type, removal_reason, appeal_url                             |
| 29  | Suspension 7d    | `SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID`  | "Suspended 7 Days"  | user_name, report_id, violation_type, suspension_days, suspension_date, reinstatement_date |
| 30  | Suspension 45d   | `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID` | "Suspended 45 Days" | user_name, report_id, violation_type, suspension_days, suspension_date, reinstatement_date |
| 31  | Permanent Ban    | `SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID`      | "Account Banned"    | user_name, report_id, violation_type, ban_reason, appeal_url, support_email                |

---

## ✅ PRE-SENDGRID CHECKLIST

Before opening SendGrid, verify:

- [ ] You have SendGrid account with API key
- [ ] You have email sender verified (e.g., noreply@varsityhub.app)
- [ ] You have all template content ready (from your screenshots)
- [ ] You have the SENDGRID_TEMPLATE_VALIDATION.md open for reference
- [ ] You have Railway dashboard open for env var updates

---

## 🔧 RAILWAY ENV VARS TO SET

```
SENDGRID_API_KEY=SG.xxxxx...
EMAIL_FROM=noreply@varsityhub.app

# Add these 29 after copying template IDs from SendGrid:
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=
SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID=
SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID=
SENDGRID_VERIFICATION_TEMPLATE_ID=
SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID=
SENDGRID_ORGANIZATION_INVITATION_TEMPLATE_ID=
SENDGRID_TEAM_INVITATION_TEMPLATE_ID=
SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID=
SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID=
SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID=
SENDGRID_INVITATION_DECLINED_TEMPLATE_ID=
SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID=
SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID=
SENDGRID_MEMBER_REMOVED_TEMPLATE_ID=
SENDGRID_USER_CONFIRMATION_TEMPLATE_ID=
SENDGRID_PAYMENT_FAILED_TEMPLATE_ID=
SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID=
SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID=
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=
SENDGRID_EVENT_DENIED_TEMPLATE_ID=
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=
SENDGRID_EVENT_UPDATED_TEMPLATE_ID=
SENDGRID_EVENT_CANCELED_TEMPLATE_ID=
SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID=
SENDGRID_REPORT_DISMISSED_TEMPLATE_ID=
SENDGRID_REPORT_RESOLVED_TEMPLATE_ID=
SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID=
SENDGRID_CONTENT_REMOVED_TEMPLATE_ID=
SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID=
SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID=
SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID=
```

---

## 📋 SENDGRID SETUP WORKFLOW

**For each template:**

1. ✏️ **Create/Edit in SendGrid**
   - Copy your template HTML
   - Paste into SendGrid template editor
   - Add `<subject>Your Subject</subject>` at top

2. 🧪 **Test**
   - Click "Test Data"
   - Copy JSON from SENDGRID_TEMPLATE_VALIDATION.md
   - Paste and render preview
   - Verify all tokens populated

3. 💾 **Save & Activate**
   - Click "Save"
   - Note the template ID (d-xxxxx...)

4. ⚙️ **Configure Railway**
   - Add to env vars as `SENDGRID_[NAME]_TEMPLATE_ID=d-xxxxx...`

5. ✅ **Check Off List**
   - Mark template complete on this card

---

## 🎯 SUCCESS CRITERIA

✅ All steps complete when:

- [ ] All 29 templates created in SendGrid
- [ ] Each template has `<subject>` tag
- [ ] Each template tested with provided payload
- [ ] Each template ID copied and added to Railway
- [ ] Railway deployment completed
- [ ] Test email received for at least one template type
- [ ] All tokens rendered (no `{{token}}` in received email)

---

## 📞 QUICK TROUBLESHOOTING

| Problem                       | Solution                                  |
| ----------------------------- | ----------------------------------------- |
| Template won't save           | Verify `<subject>` tag is present         |
| Tokens showing as `{{token}}` | Check token spelling matches test payload |
| Test Data button grayed out   | Template might not be dynamic type        |
| Email not received            | Check SENDGRID_API_KEY in Railway         |
| Wrong template sending        | Verify correct template ID in env var     |

---

**Status: Ready for Setup** 🚀

Last verified: December 16, 2025
