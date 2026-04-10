# Email Audit

## Summary

The email system is backend-owned and primarily uses SendGrid. The mobile app triggers auth-related email flows through API endpoints. The server also sends transactional and moderation emails, and there are queue workers for background delivery. The current architecture is close to being centralized, but provider logic still leaks into `server/src/lib/email.ts`.

## Current Sending Path

Primary runtime path today:

```text
Expo app trigger
  -> app-side API client (`api/auth.ts`)
  -> Express route (`server/src/routes/auth.ts`, `server/src/routes/test-emails.ts`, other server routes/workers)
  -> email helper layer (`server/src/lib/email.ts`)
  -> partially centralized service (`server/src/services/email/*`)
  -> SendGrid (`@sendgrid/mail`)
```

Secondary path:

```text
Background job
  -> queue worker (`server/src/jobs/workers/emailWorker.ts` or `server/src/workers/emailWorker.ts`)
  -> `server/src/lib/email.ts` or `EmailService`
  -> SendGrid
```

## Email-Related Code Inventory

Frontend triggers:

- `api/auth.ts`
  - `requestEmailVerification()`
  - `verifyEmail()`
  - `requestPasswordReset()`
  - `resetPassword()`
  - `changePassword()`
- `app/sign-up.tsx`
- `app/verify.tsx`
- `app/verify-identity.tsx`
- `app/forgot-password.tsx`
- `app/reset-password.tsx`
- onboarding screens that request verification status or resend codes

Backend endpoints:

- `server/src/routes/auth.ts`
  - registration verification email
  - resend verification code
  - password reset email
  - password changed confirmation
- `server/src/routes/test-emails.ts`
  - manual email test endpoints

Server email implementation:

- `server/src/lib/email.ts`
  - compatibility layer
  - many exported transactional helpers
  - some direct SendGrid calls
- `server/src/services/email/EmailService.ts`
- `server/src/services/email/service.ts`
- `server/src/services/email/providers/SendGridProvider.ts`
- `server/src/services/email/types.ts`

Workers and queues:

- `server/src/jobs/workers/emailWorker.ts`
- `server/src/workers/emailWorker.ts`
- `server/src/lib/queue.ts`
- `server/src/jobs/queues.ts`

Provider/template assets:

- `sendgrid-templates/*.html`
- `sendgrid-templates/*.json`
- `server/scripts/verify-email-config.ts`
- `server/scripts/verify-email-templates.ts`
- `server/scripts/test-all-emails.sh`

## Email Categories In Use

Auth and security:

- Email verification
- Password reset
- Password changed
- Account recovery
- Login from new device

Transactional:

- Team invite
- Organization invite
- Join request approval/denial/admin notice
- Event submission, approval, denial, reminder, update, cancel, RSVP confirmation
- Billing notice
- Payment failed
- Subscription expiring
- Transaction report

Trust and moderation:

- Report resolved/dismissed
- Account warning
- Content removed
- Suspension and permanent ban notices

Marketing:

- No dedicated marketing email system was found in active runtime code.

## Providers Used

Current primary provider:

- SendGrid via `@sendgrid/mail`

Configured but not actively used as the primary path:

- `nodemailer` is installed in `server/package.json` but not used in the audited sending path
- Twilio is used for SMS, not email

## Where Failures Can Happen

- Frontend triggers can fail due to auth/session issues or network timeouts.
- Auth routes currently race email sends against a local timeout during registration. This protects the API response, but it can hide whether delivery actually completed.
- `server/src/lib/email.ts` still has direct `sgMail.send()` calls, which bypass the service abstraction, shared logging, and shared validation.
- Template IDs can be missing. Some flows fall back to inline HTML/text, but others simply return `false`.
- Env naming is inconsistent:
  - `FROM_EMAIL`
  - `EMAIL_FROM`
  - `EMAIL_PROVIDER`
- Config validation currently marks SMTP as the required email setup even though SendGrid is the actual path in use.
- Queue-based delivery depends on Redis and worker availability. Without Redis, some worker-based patterns are disabled.
- Inline HTML templates are embedded in code, which makes consistency and reuse harder.

## Environment Variables Involved

Current relevant variables:

- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `FROM_EMAIL`
- `CUSTOMER_SERVICE_EMAIL`
- `EMAIL_TIMEOUT_MS`
- `EMAIL_RETRY_ATTEMPTS`
- `EMAIL_RETRY_DELAY_MS`
- `EMAIL_ENABLE_QUEUE`
- `EMAIL_ENABLE_LOGGING`
- `SENDGRID_API_KEY`
- all `SENDGRID_*_TEMPLATE_ID` values
- `APP_BASE_URL`
- `REDIS_URL` for queued delivery

## Security Risks

- Provider-specific sending is duplicated in `server/src/lib/email.ts`, which makes it easier for new code to bypass centralized safeguards.
- Two sender env names are accepted, which invites config drift between environments.
- The root repo has both root and server env examples; they overlap and can drift.
- Some routes log send outcomes loudly, which is useful, but correlation IDs are not propagated uniformly across compatibility helpers.
- Queue/idempotency safeguards are basic. A retry after timeout can cause duplicate sends if SendGrid accepted the first attempt but the response was lost.
- The workspace contains a local `server/.env` file. It is ignored by Git, but maintainers need clear docs to avoid relying on local-only secrets.

## Missing or Incomplete Features

- One authoritative email template registry
- One authoritative template rendering location for fallback HTML/text
- Full provider centralization
- Startup validation aligned to the real provider
- Consistent correlation ID logging across all paths
- Clear sandbox/test mode documentation
- Explicit welcome email template in the service layer
- CI coverage for server email-adjacent type/build validation

## Recommended Provider Decision

Keep SendGrid as the primary provider.

Why:

- It is already integrated and referenced across runtime code and template assets.
- The app depends on dynamic template IDs already provisioned in SendGrid.
- Replacing providers would create unnecessary migration risk for auth and transactional flows.

SMTP should not be treated as the primary path unless an actual SMTP provider implementation is added and validated.

## Target Architecture

```text
server/src/services/email/
├── EmailService.ts
├── providers/
│   ├── SendGridProvider.ts
│   └── index.ts
├── templates/
│   ├── shared.ts
│   ├── welcome.ts
│   ├── verification.ts
│   ├── passwordReset.ts
│   ├── teamInvite.ts
│   └── index.ts
├── service.ts
├── types.ts
└── index.ts
```

Compatibility rule:

- Existing exports in `server/src/lib/email.ts` can remain to avoid breaking callers.
- Those exports should delegate to the email service and template helpers instead of importing `@sendgrid/mail` directly.

## Refactor Priorities

1. Remove direct SendGrid calls from `server/src/lib/email.ts`.
2. Add template helper functions for fallback HTML/text generation.
3. Normalize env usage around `EMAIL_FROM`.
4. Validate SendGrid config at startup using the real provider path.
5. Keep auth and transactional route contracts unchanged.
