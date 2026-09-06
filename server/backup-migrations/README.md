# Backup-only repairs

These are reviewed repairs for a mirror that historically received `prisma db push` rather than the primary migration chain. They are **not primary application migrations** and must never be included in `prisma migrate deploy` on the primary.

`20260906_schema_parity.sql` restores the primary's missing extension, function, indexes and policies, RLS flags, and enum definitions/order. It rebuilds three enum types inside one transaction; a stored value absent from the primary enum causes a rollback rather than data deletion. The script requires the audited September 6 schema and should not be replayed after later schema changes without a new comparison. Do not append migration-history inserts to this SQL.

Rehearse with `RESTORE_REPAIR_SQL` pointing at this file using `scripts/verify-backup-restore.ts`. The rehearsal applies it only to a newly created database on a PostgreSQL instance explicitly configured with `varsity.restore_isolated=on`. After schema equality is established it copies primary migration history into that disposable database and verifies startup. Scheduled acceptance drills leave the repair option unset.

The real backup repair is applied transactionally with a 5-second lock timeout and exclusive locks on its tables, after checking both databases still match the rehearsed metadata snapshot. The guarded `syncDatabaseBackup` subsequently copies migration history and application data from one primary snapshot into one destination transaction. Failed schema checks, incomplete primary migrations, unsupported sequences or failed row inserts leave the old data intact. Timestamps are transferred as PostgreSQL text with explicit casts to retain microseconds.

For future migrations, apply reviewed migrations to the now-reconciled backup through a controlled release step as well as the primary, and verify object parity before refreshing. Do not restore automatic `db push --accept-data-loss`. A failed parity check is an operational failure, not permission to mark migrations applied or discard schema objects automatically.

Restore drill environment:

- `RESTORE_SOURCE_URL`: read-only backup connection.
- `RESTORE_PRIMARY_URL`: read-only primary connection for schema comparison.
- `RESTORE_ADMIN_URL`: loopback connection to a disposable PostgreSQL 17 instance, provisioned with `-c varsity.restore_isolated=on`. No URL query overrides are accepted.
- `PG_BIN`: optional PostgreSQL 17 client binary directory.
- `RESTORE_REPORT_PATH`: optional aggregate JSON output. No archives or customer rows are uploaded.

Example local isolated instance provisioning uses `initdb -c varsity.restore_isolated=on` and a dedicated loopback port. The script creates a unique database, restores, checks all table content fingerprints, compares schema, runs Prisma migrations, exercises application write constraints, and drops that database in `finally`. Do not use an existing application database as an intended restore destination. Whole-service failover, owners/ACL provisioning, external media and Redis recovery remain separate operational gates.

Historical provenance: four successfully applied migration files were recovered byte-for-byte from Git; the two altered historical files were restored to production-recorded checksums. One production migration record with a missing source file is rolled back, not successfully applied. `prisma/migration-checksums.json` and the release regression test guard the restored historical files against deletion or rewriting; add new migrations instead.
