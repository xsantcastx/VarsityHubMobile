# SendGrid Template Matrix

**Date:** December 3, 2025  
**Scope:** VarsityHub transactional + lifecycle email templates  
**Source of truth:** `server/src/lib/email.ts`

---

---

## 🟢 Phase 1: Production-Ready Templates (No Backend Changes Needed)

| Template | Env Var | Status | Dynamic Fields | Note |
|----------|---------|--------|-----------------|------|
| Email Verification | `SENDGRID_VERIFICATION_TEMPLATE_ID` | ✅ Implemented | `verification_link`, `verification_code`, `user_name` | Core auth |
| Password Reset | `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` | ✅ Implemented | `reset_code`, `expires_in` | Core auth |
| Team Invite | `SENDGRID_TEAM_INVITE_TEMPLATE_ID` | ✅ Implemented | `team_name`, `org_name`, `role`, `inviter_name`, `invite_url`, `hero_image`, `logo_image`, `primary_color` | Onboarding |
| Organization Invite | `SENDGRID_ORG_INVITE_TEMPLATE_ID` | ✅ Implemented | `org_name`, `role`, `inviter_name`, `invite_url`, `logo_image`, `primary_color` | Admin panel |
| **Join Request → Admin** | `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID` | 🟡 Ready to ship | `admin_name`, `requester_name`, `requester_email`, `org_name`, `message`, `requested_at`, `approve_url`, `deny_url`, `logo_image` | **→ See `docs/EMAIL_TEMPLATES_PHASE1.md`** |
| **Join Request Approved** | `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID` | 🟡 Ready to ship | `user_name`, `org_name`, `admin_name`, `org_url`, `logo_image` | **→ See `docs/EMAIL_TEMPLATES_PHASE1.md`** |
| **Join Request Denied** | `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID` | 🟡 Ready to ship | `user_name`, `org_name`, `reason`, `logo_image` | **→ See `docs/EMAIL_TEMPLATES_PHASE1.md`** |

All Phase 1 templates:
- ✅ Use only current database fields
- ✅ Require no calculations or aggregations
- ✅ Have test endpoints in `server/src/routes/test-emails.ts`
- ⏳ Three join-request templates need to be un-stubbed in email.ts (ready for implementation)

---

## 🔵 Phase 2: Future Enhancements (Requires Backend Changes)

These templates require additional schema changes, calculations, or new features. **Not blockers for MVP launch.**

| Template | Status | What's Needed | Target | Reference |
|----------|--------|---------------|--------|-----------|
| Join Request → Admin (Enhanced) | 📋 Designed | Team context, seat tracking, plan info, role selection, expiration | Q2 2026 | `docs/EMAIL_TEMPLATES_PHASE2_VISION.md` |
| Team Invitation (New) | 📋 Designed | Role-based invites, expiration, accept/decline tracking | Q2 2026 | Phase 2 Vision |
| Role Assignment Notification (New) | 📋 Designed | Permission matrix, role change logging | Q2 2026 | Phase 2 Vision |
| Subscription Status (New) | 📋 Designed | Billing portal integration, renewal tracking, seat adjustments | Q3 2026 | Phase 2 Vision |
| Rejection Follow-Up (New) | 📋 Designed | Organization recommendations, reapply cooldown | Q3 2026 | Phase 2 Vision |

---

## Required Templates

| Template | Env Var | Invoked From | Dynamic Fields Sent | Notes |
|----------|---------|--------------|---------------------|-------|
| Email Verification | `SENDGRID_VERIFICATION_TEMPLATE_ID` | `sendVerificationEmail` (`/auth/register`, `/auth/verify/request`, `/auth/test-email`) | `verification_link`, `verification_code`, `user_name` | Must display both code + CTA button. |
| Password Reset | `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` | `sendPasswordResetEmail` (`/auth/password/forgot`) | `reset_code`, `expires_in` | Include support link if code fails. |
| Team Invite | `SENDGRID_TEAM_INVITE_TEMPLATE_ID` | `sendTeamInviteEmail` (onboarding step 6, manage teams) | `team_name`, `org_name`, `role`, `inviter_name`, `invite_url`, `hero_image`, `logo_image`, `primary_color` | Fallback images provided; template should guard empty strings. |
| Organization Invite | `SENDGRID_ORG_INVITE_TEMPLATE_ID` | `sendOrganizationInviteEmail` (org onboarding, admin panel) | `org_name`, `role`, `inviter_name`, `invite_url`, `logo_image`, `primary_color` | Uses `/invites` dashboard link. |
| Join Request → Admin | `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID` | `sendJoinRequestToAdmin` | **Phase 1**: `admin_name`, `requester_name`, `requester_email`, `org_name`, `message`, `requested_at`, `approve_url`, `deny_url`, `logo_image`. **Phase 2** (future): adds `role_requested`, `team_name`, `requested_by`, `expires_in`, `current_seats`, `seat_limit`, `plan_name`, `billing_model` | Phase 1 shipped; Phase 2 requires team/role/seat tracking. See EMAIL_TEMPLATE_FUTURE_PHASE2.md |
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
| Billing Notice | `SENDGRID_BILLING_NOTICE_TEMPLATE_ID` | `sendBillingNoticeEmail` | `notice_type`, `plan_name`, `amount`, `manage_url`, `team_name`, `org_name`, `perks[]` | Payment success/failure and subscription changes (no trials offered). |

Optional templates do not block `/health`, but missing IDs will cause those flows to return `false` and log warnings.

---

## Implementation Status by Phase

### Phase 1: Ready for MVP

✅ **Email Functions Status**:
- `sendPasswordResetEmail` — ✅ Fully implemented
- `sendPasswordChangedEmail` — ✅ Fully implemented
- `sendAccountRecoveryEmail` — ✅ Fully implemented
- `sendVerificationEmail` — ❌ Stubbed (template removed)
- `sendTeamInviteEmail` — ❌ Stubbed (template removed)
- `sendOrganizationInviteEmail` — ❌ Stubbed (template removed)
- `sendJoinRequestToAdmin` — ❌ **Stubbed - Ready to implement** ⏳
- `sendJoinRequestApproved` — ❌ **Stubbed - Ready to implement** ⏳
- `sendJoinRequestDenied` — ❌ **Stubbed - Ready to implement** ⏳

✅ **Phase 1 Join Request Emails - Implementation Checklist**:
1. ✅ Template designs complete → `docs/EMAIL_TEMPLATES_PHASE1.md`
2. ✅ Dynamic field list finalized → No schema changes needed
3. ✅ Test endpoints ready → `server/src/routes/test-emails.ts`
4. ⏳ **TODO**: Un-stub `sendJoinRequestToAdmin()` with Stripe call to `sgMail.send()`
5. ⏳ **TODO**: Wire email call into `POST /organizations/join-requests` route
6. ⏳ **TODO**: Un-stub `sendJoinRequestApproved()` with Stripe call
7. ⏳ **TODO**: Wire email call into `POST /organizations/join-requests/:id/approve` route
8. ⏳ **TODO**: Un-stub `sendJoinRequestDenied()` with Stripe call
9. ⏳ **TODO**: Wire email call into `POST /organizations/join-requests/:id/deny` route

### Phase 2: Future Enhancements

Phase 2 requires backend schema extensions. See `docs/EMAIL_TEMPLATES_PHASE2_VISION.md` for:
- Enhanced join request emails with seat/team/role tracking
- New team invitation workflow
- Role assignment notifications
- Subscription status emails
- Rejection follow-up workflow

**Phase 2 blockers**:
- ❌ Team-level join requests (currently org-only)
- ❌ Role selection in join flow
- ❌ Organization subscription plan tracking
- ❌ Seat limit enforcement logic
- ❌ Request expiration TTL
- ❌ Email preference center

**Current behavior**: Org admins receive **only in-app notifications** when coaches request access. No emails sent yet (functions stubbed).

---

## Verification Checklist

1. `railway variables list` includes every template ID above.
2. Each SendGrid template references all fields in the "Dynamic Fields" column (case-sensitive).
3. Run `curl -X POST https://<api>/auth/test-email -d '{"email":"you@example.com"}'` to validate verification template.
4. Use `server/src/routes/test-emails.ts` endpoints (via REST client) to preview any template with sample payloads.
5. **Check implementation status** before assuming template is production-ready (see Known Implementation Gaps).
5. `/health` response shows `"sendgrid": true` and `metadata.missingEmailTemplates: []`.

Keep this file updated whenever a new email type is added or a dynamic field changes.
