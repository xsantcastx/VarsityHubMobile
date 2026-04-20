# Audit claim verification (canonical)

This document records how prior third-party audit claims map to **current `main`**, so reviews do not rely on stale line numbers or pre–email-policy behavior.

## Git reference

| Item | Value |
|------|--------|
| Remote | `https://github.com/xsantcastx/VarsityHubMobile` |
| **Local `main` at verification** | `3f46fbaf` — *Ship v1.0.1 hardening and email policy* |
| Prior local tip (before pull) | `ba9c165d` — *fix: revert LazyRedisStore — was crashing all rate-limited endpoints* |

If your clone is still at `ba9c165d`, run `git pull origin main` to match GitHub; behavior below reflects post–v1.0.1 email policy.

## `sendTemplateEmail` location and behavior

- Implementation: [`server/src/lib/email.ts`](../server/src/lib/email.ts) — `sendTemplateEmail` begins near **line 455** (was ~1100 before the email slim-down; older audits citing “line 462” referred to an intermediate refactor).
- If `templateId` is falsy: logs `[email] Template ID not configured for: …`, Sentry at **error** in production / **warning** in dev, returns `false`.
- If email service not configured: logs, Sentry in production, returns `false` (no throw).

## Required template keys (startup)

**Four** keys are in `REQUIRED_TEMPLATE_KEYS`: `VERIFICATION`, `PASSWORD_RESET`, `TEAM_INVITE`, `ORG_INVITE`. Missing any causes **`process.exit(1)`** in production during `initEmailService`.

`VERIFICATION` accepts **`SENDGRID_USER_CONFIRMATION_TEMPLATE_ID`** as an alias for `SENDGRID_VERIFICATION_TEMPLATE_ID`.

Older audits that listed five required keys including `BILLING_NOTICE` described **pre–v1.0.1** `email.ts`; billing notice is no longer a startup gate (billing emails use `PAYMENT_FAILED` / `SUBSCRIPTION_EXPIRING` where implemented; other billing types may be blocked by policy).

## `JOIN_REQUEST_ADMIN` vs `LEAGUE_PENDING_APPROVAL`

**Current behavior:** `TEMPLATE_IDS.JOIN_REQUEST_ADMIN` is the **first non-empty** of:

1. `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`
2. `SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID`

So setting **only** `SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID` can satisfy coach/league “join request admin” template usage if the dedicated admin ID is unset. Audits that claimed these were unrelated env vars described an **older** `TEMPLATE_IDS` map.

## HTML fallbacks

**Removed for policy:** `sendEmail` now **blocks** generic HTML sends (`blockUnapprovedEmail`). Join/coach/league flows rely on **SendGrid templates only** for those paths; missing template IDs no longer fall back to raw HTML through `sendEmail`.

## `ADMIN_EMAILS`

**Current:** [`server/src/lib/adminEmails.ts`](../server/src/lib/adminEmails.ts) — `getPrimaryAdminEmail()` and `getAllAdminEmails()` default to **`customerservice@varsityhub.app`** if `ADMIN_EMAILS` is empty (not a silent empty recipient list).

## Coach re-apply API

**Present on current `main`.**

| Layer | Location |
|-------|-----------|
| Client | [`api/entities.ts`](../api/entities.ts) — `User.reapplyCoach: () => httpPost('/auth/coach/reapply', {})` |
| UI | [`app/onboarding/pending-approval.tsx`](../app/onboarding/pending-approval.tsx) — calls `User.reapplyCoach()` |
| Server | [`server/src/routes/auth.ts`](../server/src/routes/auth.ts) — `POST /auth/coach/reapply` with `requireAuth`, `requireVerified`, `asyncHandler` |

Introduced in the v1.0.1 hardening merge (`3f46fbaf`); `reapplyCoach` in `api/entities.ts` also appears in commit `4589dae5` (audit hardening pass).

## Naming: coach request email

Older revisions used **`sendNewCoachRequestEmail`**. Current code exports **`sendCoachJoinRequestEmail`** (plus `sendCoachApplicationAdminEmail`) — see [`email.ts`](../server/src/lib/email.ts) league/coach section (~650+).

## Related docs

- [Railway email env checklist](./RAILWAY_EMAIL_ENV_CHECKLIST.md)
- [Audit methodology](./AUDIT_METHODOLOGY.md)
- [Audit review gate](./AUDIT_REVIEW_GATE.md)
