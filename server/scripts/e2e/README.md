# Production E2E Scripts

Three bash scripts that drive real HTTP against the production API to verify
end-to-end behavior. Run after every deploy to confirm nothing regressed.

Each script creates its own test users + data and cleans up on exit. The coach
approval and cross-system scripts now log into an existing verified admin
account instead of deleting/recreating the canonical admin email.

## Scripts

### `test-coach-application-flow.sh`

Walks the complete coach approval flow:

1. Register as fan
2. Upgrade to coach (bumps `approval_status=PENDING`)
3. Submit CoachApplication
4. Admin approves via `/admin/coaches/:id/approve`
5. Accept coach agreement
6. Create real organization (final setup)
7. Create team
8. Verify `account_state=coach_active`, coach tools unlocked

**Exit 0 when the canonical state machine works front-to-back.**

### `test-single-session.sh`

Verifies the current access-token invalidation policy:

1. Register → token A
2. Login → token B, token A still remains valid
3. Change password → token A and token B both return 401
4. Login with new password → token C works

### `test-integration-crossmatrix.sh`

Cross-system boundary test:

- OAuth 409 contract smoke (rejects fake Google token)
- `linked_providers` correctly exposed on `/auth/me`
- Password change invalidates old access token immediately
- Approved coach can create team + event (tools unlocked post-setup)
- Ad lifecycle draft → pending → admin-approved
- Single-session holds through cross-system writes

## Requirements

- `curl`, `jq`, `psql` installed locally
- **`DATABASE_URL` env var is optional**. If you set it, it must be a temporary
  admin connection string created outside the repo. Do not commit it, store it
  in scripts, or normalize a public DB URL as the default production path.
- **`ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars must be set** for
  `test-coach-application-flow.sh` and `test-integration-crossmatrix.sh`.
- Optional `API_URL` env var to override the API host (defaults to production).

## Running after a deploy

```bash
# Only set DATABASE_URL if you intentionally created a temporary admin URL:
# export DATABASE_URL='postgresql://postgres:<redacted>@<temporary-host>:<port>/railway'
export ADMIN_EMAIL='your-admin@example.com'
export ADMIN_PASSWORD='your-admin-password'

# All three, sequentially:
for s in test-coach-application-flow test-single-session test-integration-crossmatrix; do
  bash server/scripts/e2e/${s}.sh || { echo "FAIL: $s"; exit 1; }
done
```

Exit 0 on all three = safe to call the deploy verified.

## Running from GitHub Actions

Use the manual workflow at `.github/workflows/production-e2e.yml` when you want
the same production checks without putting admin credentials in a local shell.

Required GitHub Actions secrets:

- `RAILWAY_TOKEN` if the workflow needs Railway CLI access
- `PROD_ADMIN_EMAIL` for the existing verified admin account
- `PROD_ADMIN_PASSWORD` for that admin account

The workflow is `workflow_dispatch` only, runs the three scripts as a matrix
with `fail-fast: false`, enforces a 5-minute timeout per script, uploads each
log as an artifact, and writes the last 50 log lines into the job summary when
one fails.

## When a script fails

- Check `railway deployment list --service api` — a FAILED deployment is the
  #1 cause of E2E regression (fix hasn't actually reached prod).
- Check `railway logs --service api` for server-side errors at the failing
  step's timestamp.
- Run the underlying assertion manually with the test user's token to isolate
  client-side vs server-side causes.
