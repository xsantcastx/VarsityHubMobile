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

| Phase | Required result                                                                                  | Current status                                                                      |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1     | Unmodified repaired backup passes migration startup; daily check active; guarded mirror deployed | Passed: deployed mirror, as-is local restore and independent scheduled-runner drill |
| 2     | Durable account-bound purchase intent and re-authentication reconciliation                       | Open; no new charge should occur silently for an unpaid remainder                   |
| 3     | Explicit provider/coverage health, including unsupported leagues                                 | Open                                                                                |
| 4     | Native dSYM delivery and physical/TestFlight lifetime/session evidence                           | Open; seven-day evidence cannot be manufactured in one session                      |

Whole-service failover, external storage/Redis recovery and ownership/ACL provisioning remain distinct from this database restore drill. Existing PushTicket data remains an intentional ephemeral exclusion.

## Phase 1 operational acceptance

- Server commit `5a0cd1d24b3b2db56ee6b28c6e7c6ff9ac32f78b`, successful Railway deployment `bbedd21a-99b0-4b59-ba57-e1554b79b393`. Runtime gate passed after deployment.
- Live scheduler job `forensic-backup-5a0cd1d2-20260906` completed (processedOn `1788722884510`, finishedOn `1788722904281`).
- Unmodified backup local restore: 59 tables / 4,335 rows, content matched, migration deploy and application constraint probes passed; cleaned up at 2026-09-06T19:22:44.717Z. No repair option used.
- Independent GitHub runner [34054960934](https://github.com/emilmancero-dev/VarsityHubMobile/actions/runs/34054960934) succeeded using the dedicated read-only roles. Aggregate artifact `backup-restore-report` retained for 30 days; no raw database artifact uploaded.
- Daily schedule: 07:23 UTC, active in the writable fork default branch through workflow-only commit `e8c1696d`. It checks out the tested server commit above. The application source on fork main was not promoted. Update this pin after future verified production releases; upstream still requires an account with merge access.
- Client regressions: 151 tests; expanded server regressions: 102 tests. The full local release gate and final targeted PostgreSQL/type checks passed.

## Phase 2 implementation and verification

- Added an account-owned `AdPurchaseIntent` and product/receipt ledger before StoreKit checkout. The server derives quantities and prices; Apple `appAccountToken` binds signed receipts to the intent. Unique receipt IDs, one open intent per ad, foreign keys and completion checks enforce storage invariants.
- Receipt storage commits before fulfillment. Inventory, Apple claims, completed transaction log and intent completion share the same serializable transaction. The existing BullMQ scheduler reconciles ready intents every five minutes; authenticated recovery and signed Apple `ONE_TIME_CHARGE` notifications reuse that service.
- One root mobile provider processes unfinished Apple transactions on login, foreground and reconnect. It acknowledges consumables only after authenticated server acceptance and ignores superseded account responses. Recovery never purchases an unpaid remainder automatically. Explicit checkout resumes remaining quantities; the calendar can restore saved dates.
- Found and reproduced a separate receipt trust defect: issuer-name checks accepted a self-signed certificate claiming Apple's name. Replaced that verifier with Apple's official server library pinned to the actual Apple Root CA G3 certificate. Verification checks signatures, certificate purpose, bundle and environment. Offline verification uses signed-date validity; online OCSP was not exercised.
- Real isolated PostgreSQL tests passed: failure injected at intent completion leaves receipts durable and fulfillment rolled back; a fresh Node process finishes recovery; five concurrent receipt deliveries produce one fulfillment; cross-account receipt submission and missing ledger references are rejected. Existing payment/finalization regressions also passed (22 tests across four suites, including the real-crypto forgery test).
- Seven mobile logic tests passed: delayed/failed durability never acknowledges, an account change invalidates a slow result, re-login recovery does not charge, intent creation precedes checkout, duplicate callbacks coalesce, and a superseded account cannot start checkout. These substitute the native StoreKit boundary and are not physical-device interruption evidence.
- Revert proof: premature acknowledgement causes three client test failures. Moving fulfillment back into a separate transaction makes the PostgreSQL fresh-process recovery test fail. Restoring both fixes passes.
- The restore drill now runs the PostgreSQL purchase recovery/finalization suites inside its disposable restored database, after migration startup.

Remaining purchase gates: a legitimate sandbox/TestFlight signed transaction and physical force-kill/re-login sequence; confirmation of App Store Server Notification delivery configuration; self-service resolution for expired/full booking dates; legacy partial receipts without an intent. No App Store Server API key is configured, so server polling of missing Apple receipts is not claimed. Legacy receipt data is preserved. Do not describe these remaining cases as automatically recovered.

Migration rollout: additive migration `20260906194000_durable_ad_purchase_intents`; apply to backup and primary before mobile publication, refresh backup and repeat the as-is restore gate. A brief parity mismatch safely refuses backup clearing. Rollback must retain these tables and receipts; stop new checkout publication and keep the reconciliation service available. Never drop the purchase ledger to roll back client behavior.

## Phase 3 catalog and post-migration restore correction

- Catalog tests failed before the fix because unsupported entries were active. Catalog construction now enables entries only when provider metadata exists. The migration disables empty, providerless database entries while preserving all events and seeded coverage; the isolated clone reports 13 active and 60 disabled entries, zero empty providerless entries still active.
- The API derives `catalog_status` from the configured adapter, latest bounded ingestion record, current events and explicit current-season dates. States include ACTIVE_SYNCING, UNSUPPORTED_PROVIDER, OFFSEASON_NO_EVENTS, STALE_IMPORT, EMPTY_UNVERIFIED and SEEDED_EVENTS. A successful zero import with unknown season dates cannot claim offseason. Old visible events do not conceal a failed/stale import.
- Empty successful imports emit structured `schedule_empty_unverified` telemetry with provider, league, run and window. Missing provider configuration rejects an apply run. Existing per-league failure isolation remains.
- MiLB and MLS NEXT Pro remain unsupported/disabled, not newly imported. Youth MLS NEXT is separate and still has no catalog/provider integration. This is honest coverage handling, not a claim those schedules have been added.
- 22 focused catalog/ingestion tests pass. A stale structural feed test was aligned to the existing shared `fetchDiscoveryItems` contract rather than its retired query-key name.
- The first restore after adding purchase checks failed strict schema parity despite matching contents. A minimal real PostgreSQL dump/restore reproduced `varchar` IN-array deparser normalization. New additive migration `20260906203500_canonical_purchase_predicates` uses explicit text predicates that round-trip identically; it preserves the constraints and unique-index semantics. Historical migration SQL was not edited and parity validation was not relaxed. Acceptance requires rerunning the actual backup drill after this correction is deployed.
