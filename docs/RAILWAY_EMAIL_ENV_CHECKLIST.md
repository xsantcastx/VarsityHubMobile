# Railway email environment checklist

Use this when verifying production (Railway) configuration against the server email implementation in [`server/src/lib/email.ts`](../server/src/lib/email.ts) and [`server/src/services/email/providers/SendGridProvider.ts`](../server/src/services/email/providers/SendGridProvider.ts).

## Provider (must send anything)

| Variable | Purpose |
|----------|---------|
| `SENDGRID_API_KEY` | Required. Without it, `sgMail` is not configured and template sends fail. |
| `EMAIL_FROM` or `FROM_EMAIL` | Sender address. `SendGridProvider` treats missing or invalid `defaultFrom` as not configured (`isConfigured()` false). |
| `SUPPORT_REPLY_TO` | Optional. Reply-To on template sends; defaults to `support@varsityhub.app`. |

## Startup fatal (production exit if missing)

Defined in `REQUIRED_TEMPLATE_KEYS` in [`email.ts`](../server/src/lib/email.ts). If any are unset, `initEmailService()` logs and **`process.exit(1)`** in production.

| Template key | Env var(s) |
|--------------|------------|
| `VERIFICATION` | `SENDGRID_VERIFICATION_TEMPLATE_ID` **or** `SENDGRID_USER_CONFIRMATION_TEMPLATE_ID` (first non-empty wins) |
| `PASSWORD_RESET` | `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` |
| `TEAM_INVITE` | `SENDGRID_TEAM_INVITE_TEMPLATE_ID` |
| `ORG_INVITE` | `SENDGRID_ORG_INVITE_TEMPLATE_ID` |

## Coach / league approval flows (template-only; no HTML fallback)

`JOIN_REQUEST_ADMIN` is resolved from **either** of:

- `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`
- `SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID`

If both are empty, `sendJoinRequestAdminTemplate` logs an error and returns `false`. This ID backs:

- League super-admin approval request (`sendLeagueApprovalRequestEmail`) — sent to **all** addresses from [`getAllAdminEmails()`](../server/src/lib/adminEmails.ts) (from `ADMIN_EMAILS`, or fallback `customerservice@varsityhub.app`).
- Coach join request to org owner (`sendCoachJoinRequestEmail`).
- Coach application to admin (`sendCoachApplicationAdminEmail`).

Also set for coach approval UX:

| Variable | Used for |
|----------|----------|
| `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID` | `sendCoachApprovedEmail` |
| `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID` | `sendCoachRejectedEmail` |

## Admin recipients

| Variable | Behavior |
|----------|----------|
| `ADMIN_EMAILS` | Comma-separated list; parsed in [`adminEmails.ts`](../server/src/lib/adminEmails.ts). `getAllAdminEmails()` returns these or `['customerservice@varsityhub.app']` if empty. |

## Events and billing (templates in `TEMPLATE_IDS`)

| Variable | Notes |
|----------|--------|
| `SENDGRID_EVENT_APPROVED_TEMPLATE_ID` | Required for event-approved emails. |
| `SENDGRID_EVENT_DENIED_TEMPLATE_ID` | Required for event-denied emails. |
| `SENDGRID_EVENT_CANCELED_TEMPLATE_ID` or `SENDGRID_EVENT_CANCELLATION_TEMPLATE_ID` | Either spelling accepted. |
| `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID` | Used when `sendBillingNoticeEmail({ type: 'payment_failed' })`. |
| `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID` | Used when `sendBillingNoticeEmail({ type: 'trial_ending' })`. |

Other `sendBillingNoticeEmail` types are **blocked** by policy (`blockUnapprovedEmail`) until an approved template exists.

## Observability

- Search logs/Sentry for: `[email] Template ID not configured for:` (missing resolved template ID).
- Search for: `[email] Missing SENDGRID_` (explicit guards on specific flows).
- Search for: `Email service not configured` / `template email dropped`.

## Policy notes (v1.0.1+)

- **Generic HTML email** (`sendEmail`) is **blocked** in production — only approved SendGrid templates may be sent.
- Many non-catalog email types call `blockUnapprovedEmail` and log to Sentry in production.
