# Email Guide

## Architecture

Runtime flow:

```text
Frontend trigger
-> API route / worker
-> server/src/lib/email.ts compatibility exports
-> server/src/services/email/EmailService.ts
-> server/src/services/email/providers/SendGridProvider.ts
-> SendGrid
```

Fallback content lives in:

```text
server/src/services/email/templates/
```

This keeps provider templates optional for core flows while still centralizing the send path.

## Where To Add A New Email

1. Add or reuse a fallback renderer in `server/src/services/email/templates/`.
2. Add the provider template ID env var if the flow will use a SendGrid dynamic template.
3. Export a helper from `server/src/lib/email.ts` that delegates through `sendTemplateEmail(...)`.
4. Call that helper from routes, workers, or jobs.
5. Update:
   - [EMAIL_AUDIT.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_AUDIT.md)
   - [EMAIL_ENV.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_ENV.md)
   - `.env.example` if a new env var is required

## Switching Providers

The current system is standardized on SendGrid.

To switch providers safely:

1. Add a new provider implementation under `server/src/services/email/providers/`.
2. Extend `EmailService.createProvider()`.
3. Keep `server/src/lib/email.ts` exports unchanged.
4. Re-run email config validation and template tests before deployment.

Do not reintroduce direct provider calls in routes or worker files.

## Local Testing

- Config only:
  - `npm --prefix server run verify:email`
- Real delivery:
  - `tsx server/scripts/verify-email-templates.ts --test-to=you@example.com`
- Auth flows:
  - register a new account
  - request resend verification
  - request password reset
  - reset password with the received code

## Common Failures

- `SENDGRID_API_KEY` missing or invalid
- sender email not verified in SendGrid
- template ID missing for a flow expected to use provider templates
- `APP_BASE_URL` missing, producing bad links
- Redis unavailable when queue-backed email is enabled
- duplicate sends after a provider timeout where delivery outcome is ambiguous

## Debugging

- Check server logs for:
  - provider name
  - correlation-like email log context
  - status code
  - provider rejection payload
- Check `/health` for sendgrid readiness and missing templates.
- If a flow falls back to HTML/text instead of a provider template, verify the associated `SENDGRID_*_TEMPLATE_ID`.
