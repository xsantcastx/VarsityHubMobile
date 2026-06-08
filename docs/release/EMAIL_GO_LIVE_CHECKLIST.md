# Email Go-Live Checklist

Use this during Phase 3 of [RELEASE_WORKFLOW.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/RELEASE_WORKFLOW.md).

Use this once the code-side release baseline is green and the only remaining blocker is real outbound email.

Latest blocker snapshot:

- [CURRENT_RUNTIME_BLOCKERS.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/CURRENT_RUNTIME_BLOCKERS.md)

## Purpose

- Confirm the SendGrid API key is real, not a placeholder.
- Confirm every code-referenced template env var is present in Railway.
- Catch stale catalog IDs before production email silently fails.
- Provide paste-ready `railway variables set ...` commands from repo metadata.

## Commands

```bash
# 1. Audit template env coverage, stale catalog IDs, and Railway commands
npm --prefix server run verify:email-go-live

# 2. Re-check server email readiness after Railway variables are fixed
npm --prefix server run verify:email

# 3. Trigger real delivery checks to a controlled inbox
npx tsx server/scripts/email-delivery-test.ts
```

## Required operator actions

1. Replace `SENDGRID_API_KEY` in Railway if the verifier reports `placeholder`, `missing`, or `invalid`.
2. If real send attempts return `401` with `The provided authorization grant is invalid, expired, or revoked`, rotate the key in SendGrid and update Railway before doing anything else.
3. Set every missing `SENDGRID_*_TEMPLATE_ID` variable in Railway.
4. Recreate and publish any stale SendGrid templates before setting those env vars.
5. Re-run `verify:email-go-live` and `verify:email` until both are clean.
6. Send a controlled end-to-end delivery pass with `email-delivery-test.ts`.

## Historical catalog suspects

These were flagged by older repo export metadata. Do not act on this list by itself. Only treat a template as blocked if the current `verify:email-go-live` output flags it again.

- `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`
- `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
- `SENDGRID_TEAM_INVITE_TEMPLATE_ID`

## Expected exit criteria

- `verify:email-go-live` exits `0`
- `verify:email` exits `0`
- `npm run release:verify:local` exits `0`
- One real verification email is delivered
- One real invite/moderation-style email is delivered
- Railway production logs show no SendGrid `401` or `template_id must be a valid GUID` errors
