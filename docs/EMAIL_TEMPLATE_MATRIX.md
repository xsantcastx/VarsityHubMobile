# SendGrid Template Matrix

**Date:** December 3, 2025  
**Scope:** VarsityHub transactional + lifecycle email templates  
**Source of truth:** `server/src/lib/email.ts`

---

## Why this exists

We now block production health on SendGrid being fully configured. This matrix documents every template ID the backend expects, where it is used, and which dynamic variables must be defined in SendGrid. Use it when creating/updating templates or troubleshooting missing content.

---

## Required Templates

| Template | Env Var | Invoked From | Dynamic Fields Sent | Notes |
|----------|---------|--------------|---------------------|-------|
| Email Verification | `SENDGRID_VERIFICATION_TEMPLATE_ID` | `sendVerificationEmail` (`/auth/register`, `/auth/verify/request`, `/auth/test-email`) | `verification_link`, `verification_code`, `user_name` | Must display both code + CTA button. |
| Password Reset | `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` | `sendPasswordResetEmail` (`/auth/password/forgot`) | `reset_code`, `expires_in` | Include support link if code fails. |
| Team Invite | `SENDGRID_TEAM_INVITE_TEMPLATE_ID` | `sendTeamInviteEmail` (onboarding step 6, manage teams) | `team_name`, `org_name`, `role`, `inviter_name`, `invite_url`, `hero_image`, `logo_image`, `primary_color` | Fallback images provided; template should guard empty strings. |
| Organization Invite | `SENDGRID_ORG_INVITE_TEMPLATE_ID` | `sendOrganizationInviteEmail` (org onboarding, admin panel) | `org_name`, `role`, `inviter_name`, `invite_url`, `logo_image`, `primary_color` | Uses `/invites` dashboard link. |
| Join Request → Admin | `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID` | `sendJoinRequestToAdmin` | `admin_name`, `requester_name`, `org_name`, `message`, `approve_url`, `deny_url`, `logo_image` | Buttons should use provided URLs. |
| Join Request Approved | `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID` | `sendJoinRequestApproved` | `user_name`, `org_name`, `admin_name`, `org_url`, `logo_image` | `org_url` defaults to `/organizations`. |
| Join Request Denied | `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID` | `sendJoinRequestDenied` | `user_name`, `org_name`, `reason`, `logo_image` | Display reason prominently. |

If any of the above IDs are missing, `/health` now reports `sendgrid: false` and lists the missing templates in `metadata.missingEmailTemplates`.

---

## Optional / Nice-to-have Templates

| Template | Env Var | Used By | Dynamic Fields | Purpose |
|----------|---------|---------|----------------|---------|
| Abuse Report | `SENDGRID_ABUSE_REPORT_TEMPLATE_ID` | `sendAbuseReportNotification` | `reporter_name`, `reporter_email`, `subject`, `message`, `user_id`, `submitted_at` | Internal alerts. |
| Organization Approval | `SENDGRID_ORG_APPROVAL_TEMPLATE_ID` | `sendOrganizationApprovalEmail` | `org_name`, `dashboard_url`, `logo_image` | Notify admins when org is approved. |
| Organization Denial | `SENDGRID_ORG_DENIAL_TEMPLATE_ID` | `sendOrganizationDenialEmail` | `org_name`, `reason`, `logo_image` | Provide clear next steps. |
| Content Moderation | `SENDGRID_CONTENT_MODERATION_TEMPLATE_ID` | `sendContentModerationEmail` | `action`, `post_id`, `reason`, `next_steps` | Communicates moderation outcomes. |
| Billing Notice | `SENDGRID_BILLING_NOTICE_TEMPLATE_ID` | `sendBillingNoticeEmail` | `notice_type`, `plan_name`, `amount`, `manage_url`, `team_name`, `org_name`, `perks[]` | Trial ending, payment success/failure, etc. |

Optional templates do not block `/health`, but missing IDs will cause those flows to return `false` and log warnings.

---

## Verification Checklist

1. `railway variables list` includes every template ID above.
2. Each SendGrid template references all fields in the “Dynamic Fields” column (case-sensitive).
3. Run `curl -X POST https://<api>/auth/test-email -d '{"email":"you@example.com"}'` to validate verification template.
4. Use `server/src/routes/test-emails.ts` endpoints (via REST client) to preview any template with sample payloads.
5. `/health` response shows `"sendgrid": true` and `metadata.missingEmailTemplates: []`.

Keep this file updated whenever a new email type is added or a dynamic field changes.
