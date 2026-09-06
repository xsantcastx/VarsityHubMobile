# Production hardening protocol — September 6, 2026

Work proceeds in the requested order. No native or purchase gate is closed by a database test.

## Phase 1: database repair and repeatable restore

- Restored four missing successful migration files from Git with exact production checksums. Restored two historical files whose comments had changed their checksums. The fifth missing migration-history entry is rolled back; no applied history was fabricated.
- Rehearsed the backup-only SQL repair against a complete isolated restore. The old backup fails schema parity; the repaired clone passes migration deploy and application write/unique/FK probes.
- Applied the same reviewed repair to the configured production backup, with primary/backup metadata preconditions, exclusive destination locks and one transaction. Repaired extension, function, indexes, policies/RLS, and three enum definitions/order.
- Updated the atomic mirror to require PostgreSQL object parity before clearing data; include migration history in the same snapshot and destination transaction; reject incomplete source migrations and unsupported sequences; preserve timestamp microseconds.
- Production refresh copied 59 tables and 4,335 rows, including 156 migration-history rows. Primary and backup migration histories now match exactly by content fingerprint.
- Added a standalone restore script and daily GitHub Actions workflow using PostgreSQL 17. The target must be loopback and explicitly marked `varsity.restore_isolated=on`. Archives remain in memory and disposable databases are removed. Only aggregate evidence is retained.
- Configured dedicated `varsity_restore_reader` roles for primary and backup: SELECT only, default read-only, BYPASSRLS so the backup can be read consistently without granting writes. Reader secrets are scoped to the writable fork's GitHub Actions. Existing API credentials were not rotated or exposed.

Regression proof:

- Reverting `dbBackupSync` to `da61c1f4` makes the updated real-PostgreSQL test fail because the backup retains `old-history` instead of copying `new-history`.
- The timestamp test failed with `.123` versus `.123456`, then passed after preserving PostgreSQL timestamp text.
- The real database test covers middle-table failure rollback of both data/history, successful joint replacement, missing-index refusal and missing-column refusal.
- Schema tests cover columns, constraints, indexes, RLS, policies, triggers, functions, enum order and extensions. Immutable migration tests preserve restored historical checksums.
- Local release gate passed. Both client/server typechecks passed; final focused checks cover subsequent timestamp handling and the expanded server regression list. No skipped typecheck is counted as a pass.

See [backup repair procedure](../../server/backup-migrations/README.md). Scheduled acceptance must run without `RESTORE_REPAIR_SQL`; applying a repair inside every drill would hide a defective backup.

## Remaining ordered gates

| Phase | Required result                                                                                  | Current status                                                    |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1     | Unmodified repaired backup passes migration startup; daily check active; guarded mirror deployed | Final operational validation in progress                          |
| 2     | Durable account-bound purchase intent and re-authentication reconciliation                       | Open; no new charge should occur silently for an unpaid remainder |
| 3     | Explicit provider/coverage health, including unsupported leagues                                 | Open                                                              |
| 4     | Native dSYM delivery and physical/TestFlight lifetime/session evidence                           | Open; seven-day evidence cannot be manufactured in one session    |

Whole-service failover, external storage/Redis recovery and ownership/ACL provisioning remain distinct from this database restore drill. Existing PushTicket data remains an intentional ephemeral exclusion.
