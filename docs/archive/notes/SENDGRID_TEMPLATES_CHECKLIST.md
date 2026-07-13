# SendGrid Templates: Action Items

## Active Templates ✅

Only these templates are supported and configured:

| Template         | ID (stored in secret manager)      | Use Case                              |
| ---------------- | ---------------------------------- | ------------------------------------- |
| Password Reset   | d-97a704ec6a35434195364e0ed9dfaf21 | Password recovery flow                |
| Password Changed | d-6f11ea835053413296e159c91204b658 | Security notice after password change |
| Account Recovery | d-36ff36687ae8433ba49ae88e533904d6 | Confirm account recovery completion   |

All other SendGrid templates are removed/disabled. If you add a new email flow in the future, create a new template and store its ID in secrets before enabling it in code.

## Refreshing IDs

1. Login to SendGrid → Marketing → Dynamic Templates.
2. Open the template, copy the Template ID (format `d-...`).
3. Update secret manager / env vars (Railway, GitHub Actions, local `.env`).
4. Restart/redeploy the service so the new ID loads.

## Health Checks

- Backend boot should log missing-template warnings only if an ID is absent.
- Test send: `curl -X POST http://localhost:4000/auth/test-email -d '{"email":"you@example.com"}' -H 'Content-Type: application/json'`.
