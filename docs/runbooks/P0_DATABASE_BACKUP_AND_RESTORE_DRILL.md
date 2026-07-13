# P0 Database Backup and Restore Drill

Objective: prove backups are automated and restorable before broad launch.

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
