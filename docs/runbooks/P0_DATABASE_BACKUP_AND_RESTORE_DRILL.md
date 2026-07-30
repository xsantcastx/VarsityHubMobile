# P0 Database Backup and Restore Drill

Objective: prove backups are automated and restorable before broad launch.

---

## 0) How this app's backup actually works (read first)

DR here is **not** provider snapshots. The `db-backup-sync` scheduler job
(`server/src/jobs/scheduler.ts`, every 6h) replicates the primary Postgres
(`Postgres-TnGR`) into a **second live Postgres instance** table-by-table via
`syncDatabaseBackup()` (`server/src/lib/dbBackupSync.ts`), pointed at by the
`DATABASE_BACKUP_URL` env var on the `api` service. If that var is unset the job
**silently skips** — so an unset `DATABASE_BACKUP_URL` means there is no backup.

Because the backup is a live replica, "restorable" means: it is connectable and
holds complete, current data. The fast drill below proves exactly that; the full
monthly exercise in section 2 still applies when validating end-to-end recovery.

### Fast automated drill (run monthly, or in CI/ops)

```bash
cd server
# Get both public proxy URLs from Railway (Postgres-TnGR = primary, Postgres = backup):
#   railway variables --service Postgres-TnGR --kv | grep DATABASE_PUBLIC_URL
#   railway variables --service Postgres        --kv | grep DATABASE_PUBLIC_URL
DATABASE_URL="<Postgres-TnGR DATABASE_PUBLIC_URL>" \
DATABASE_BACKUP_URL="<Postgres DATABASE_PUBLIC_URL>" \
npm run verify:backup-freshness
```

It connects to both databases, compares every backed-up table
(`TABLES_IN_ORDER`), and exits nonzero if the backup is unconfigured,
unreachable, missing a table, or stale beyond the drift budget
(`BACKUP_MAX_DRIFT_PCT`, default 10% — normal 6-hourly lag passes). Capture its
output as the "verification command/test outputs" evidence in section 3.

### Continuous automated alert (no action needed — runs in prod)

The drill only catches a stalled sync **when you run it**. To cover the gap
between runs, the `db-backup-freshness-check` scheduler job runs the same check
(`checkBackupFreshness` in `server/src/lib/backupFreshness.ts` — the shared
pass/fail definition behind both) at `0 3,9,15,21 * * *`, ~3h after each 6-hourly
`db-backup-sync`. If the backup is missing a table, unreachable, or past the
drift budget, it `captureException`s to Sentry (context `db_backup_freshness_stale`)
so a silently stopped sync surfaces within one cycle instead of at restore time.
It stays silent when `DATABASE_BACKUP_URL` is unset (the sync skips too, so there
is nothing to alert on). Tune the cadence/threshold via the job's `cron` and
`BACKUP_MAX_DRIFT_PCT`.

---

## 1) Required baseline

- Automated daily backups enabled in hosting provider.
- Retention policy documented (for example: 7/14/30 days).
- At least one successful restore drill completed in last 30 days.

---

## 2) Monthly restore drill (required)

1. Pick latest backup snapshot.
2. Restore to isolated non-production database.
3. Point staging API to restored DB.
4. Run sanity checks:
   - auth works
   - feed query works
   - recent transactions present
   - key admin reports load
5. Record duration and issues.

---

## 3) Evidence to capture

- backup job status screenshot
- snapshot ID used for drill
- restore start/end timestamps
- verification command/test outputs
- final pass/fail and owner sign-off

---

## 4) Recovery time targets

- Backup discovery time: < 10 minutes
- Restore start time: < 20 minutes
- Service recovery for critical read paths: < 60 minutes

---

## 5) Failure handling

If restore drill fails:

1. Mark release gate as blocked.
2. Open incident and assign owner.
3. Fix restore path and re-run drill.
4. Do not broaden rollout until successful drill evidence exists.
