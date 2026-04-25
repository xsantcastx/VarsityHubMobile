# Deploy procedure — `20260424220000_team_org_required`

This migration realigns `Team.organization_id` to the schema:
- Column becomes `NOT NULL`
- FK switches from `ON DELETE SET NULL` → `ON DELETE RESTRICT`
- Orphan rows (`NULL organization_id`) are deleted up to a safety threshold of 100

## Why this matters

The DB column has been `text NULL` with `ON DELETE SET NULL` since at least
v1.0.1. The Prisma schema declares non-null + `Restrict`. This drift means:

1. Any Organization delete leaks orphan Team rows (NULL org_id).
2. Prisma client refuses to materialize those rows — every `Team.findMany`
   that touches one throws `Error converting field "organization_id" of
   expected non-nullable type "String"`.
3. `access-matrix` and `api-teams` test suites have been red because of this.

CLAUDE.md already states the invariant: "Teams MUST have organization_id —
no orphaned teams." Production should have zero orphans. Local test DBs may
have a handful from event-cancel suites that delete orgs.

## Pre-flight (REQUIRED before push)

```bash
cd server

# Against production:
DATABASE_URL=$(railway variables --service "Postgres-TnGR" --kv | grep '^DATABASE_URL' | cut -d= -f2-) \
  npx tsx scripts/preflight-team-org-required.ts

# Against local:
DATABASE_URL=postgresql://localhost:5432/varsityhub_test \
  npx tsx scripts/preflight-team-org-required.ts
```

Expected outcomes:

- **Exit 0, "Safe to migrate. No orphan Team rows."** → Deploy.
- **Exit 0, "N orphan row(s) will be deleted"** with N small (< 100) → Inspect
  the listed IDs. If they're test data or known orphans, deploy. If anything
  looks like real teams, **stop and investigate** before pushing.
- **Exit 1, "ABORT. N exceeds threshold"** → Do NOT push the migration.
  Find what's creating orphans first.
- **Exit 2** → Connection / config error. Fix and re-run.

## Deploy sequence

Railway runs `prisma migrate deploy` from `server/start.sh` BEFORE the
server starts. So the failure mode is "deploy fails, previous version
keeps serving" — not "production runs with broken schema."

1. Pre-flight against prod (above). Confirm exit 0.
2. `git push origin main`. Railway picks up the commit.
3. Watch the Railway deploy logs for one of:
   - `[migrate] Applied 20260424220000_team_org_required` — success
   - `RAISE EXCEPTION ... orphan rows found` — pre-flight didn't catch
     it (race between pre-flight and deploy?). Migration auto-aborts;
     deploy fails; previous version keeps serving. Re-run pre-flight,
     decide.
4. After deploy succeeds, verify:
   ```
   psql $DATABASE_URL -c '\d "Team"' | grep organization_id
   # Expect: organization_id  text  not null
   #         "Team_organization_id_fkey" ... ON DELETE RESTRICT
   ```

## What changes for the app

After this lands, deleting an Organization that still has child Teams will
**fail with a Prisma `P2003` foreign-key error** instead of silently
nulling the teams. This matches the design intent. Admin tooling and
`wipeProduction.ts` already delete teams before orgs, so they won't break.
There's no user-facing org-delete endpoint to update.

If you ever need to delete an org with teams, the correct sequence is:
1. Delete or transfer the child teams first.
2. Then delete the org.

## Rollback

The migration is forward-compatible and can be hand-reverted:

```sql
ALTER TABLE "Team" ALTER COLUMN "organization_id" DROP NOT NULL;
ALTER TABLE "Team" DROP CONSTRAINT "Team_organization_id_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;
```

The deleted orphan rows are gone — they were already broken (un-readable
by Prisma), so this is intentional. If for some reason you need to keep
them, take a `pg_dump` of the `Team` table before deploying.

## Test impact

After the migration is applied to the test DB, `access-matrix.test.ts` and
`api-teams.test.ts` should both go green. They're red right now because
the existing 1 orphan row in the local test DB blows up team-list queries.
