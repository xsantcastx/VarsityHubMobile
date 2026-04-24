# Production E2E Scripts

Three bash scripts that drive real HTTP against the production API to verify
end-to-end behavior. Run after every deploy to confirm nothing regressed.

Each script creates its own test users + data and cleans up on exit. Safe to
run repeatedly against production.

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

Verifies the single-active-session enforcement:

1. Register → token A (se=0)
2. Login → token B (se=1), token A invalidated
3. Login → token C (se=2), token B invalidated
4. Confirms `session_epoch` increments and old tokens return 401

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
- Admin password (baked into the scripts as `AdminTest123!`); scripts register
  a temp admin via the public register endpoint and clean up after.
- Read+write access to production Postgres (see `DB` constant; matches
  `Postgres-TnGR` service per memory note).

## Running after a deploy

```bash
# All three, sequentially:
for s in test-coach-application-flow test-single-session test-integration-crossmatrix; do
  bash server/scripts/e2e/${s}.sh || { echo "FAIL: $s"; exit 1; }
done
```

Exit 0 on all three = safe to call the deploy verified.

## When a script fails

- Check `railway deployment list --service api` — a FAILED deployment is the
  #1 cause of E2E regression (fix hasn't actually reached prod).
- Check `railway logs --service api` for server-side errors at the failing
  step's timestamp.
- Run the underlying assertion manually with the test user's token to isolate
  client-side vs server-side causes.
