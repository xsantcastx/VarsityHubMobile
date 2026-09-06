# Remaining systems investigation — September 6, 2026

Investigated source `855a07a0` using fresh read-only production Sentry/database queries, official provider responses, installed native source, and an actual backup restore into disposable local PostgreSQL 17.11. No simulator, production database mutation, real purchase, deployment, or Sentry issue closure was performed. Earlier documents are claims to reconcile, not proof of completion.

## Outcome and priorities

| Area                                     | Classification                                                    | Evidence and consequence                                                                                                                                                                                                                  | Closure gate                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Disaster recovery promotion              | **Open bug; highest operational priority**                        | Backup restores and application data matches, but ordinary migration startup fails. Backup lacks production integrity/performance indexes and RLS configuration. Outage recovery could remain unavailable or run with weaker constraints. | Reviewed schema and migration-baseline reconciliation, then repeat restore, migration startup and application read/write tests.         |
| Incomplete multi-part Apple ad purchases | **Open bug**                                                      | Durable receipts survive, but the purchase intent is initially in memory; restart cannot associate/resume the remaining products. A charged customer can remain blocked awaiting support.                                                 | Durable account-bound intent, transaction reconciliation, explicit continuation of unpaid remainder, sandbox interruption/replay tests. |
| Missing league schedules                 | **Deferred integrations plus a misleading coverage presentation** | 60 active catalog entries have no provider, event or ingest run. MiLB source data exists; MLS NEXT youth and NEXT Pro are distinct unsupported integrations.                                                                              | Adapter/identity/taxonomy integration plus real payload, ingestion, filter and feed/map parity tests.                                   |
| Native crashes                           | **Open investigations**                                           | Confirmed native failure boundaries; no proven lifetime/root-cause correction. Potential app termination and loss of in-progress work.                                                                                                    | Device/native evidence for the same failing sequence and candidate, followed by affected-flow production monitoring.                    |

Priority considers exposure, blast radius and recoverability: restore failures have broad outage impact; interrupted purchases affect charged customers; native crashes terminate sessions; missing providers undermine discovery completeness. These are not a whole-app grade or certification.

## 1. Fresh native evidence

Sentry issue and latest-event endpoints were queried directly; credentials remained in memory.

| Issue                                                       | Count | Latest event UTC    | Evidence                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [3T](https://lime-productions.sentry.io/issues/7655376217/) | 12    | 2026-09-06 06:41:24 | `NSInvalidArgumentException`, nil insertion, Fabric legacy interop → `AIRMap insertReactSubview:atIndex:`. Event `3fe572adc2a74317abf61c7b9e6097c4`, build 56, OTA `01a0755e-84b1-78a0-9569-1f931254e7ae`. |
| [49](https://lime-productions.sentry.io/issues/7714008476/) | 2     | 2026-09-06 15:40:49 | `EXC_BAD_ACCESS`; SharedObject teardown and JSI weak-object destruction. Event `e5197dda7329450c825ce13392e90ad7`, build 56, OTA `01a075af-d4ac-76c8-b431-4de276a5501c`.                                   |
| [3M](https://lime-productions.sentry.io/issues/7608932293/) | 2     | Unavailable         | Issue exists and is unresolved; latest-event endpoint returns 404. No defensible feed-clipping diagnosis.                                                                                                  |
| [4A](https://lime-productions.sentry.io/issues/7714905588/) | 1     | 2026-09-06 06:42:18 | JavaScript `Cannot Open` media incident, not itself a native crash. Old mapped Share-module stack remains unreliable given earlier source-map evidence. Event `940351bed9db4527acea20f72d872ceb`.          |

All four remain unresolved. No newer occurrence in these lookups proves neither adequate affected-flow traffic nor remediation. Latest published OTA has different IDs; do not attribute these old events to it.

Installed source confirms the specific boundaries:

- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/LegacyViewManagerInterop/RCTLegacyViewManagerInteropComponentView.mm:250`: deferred mount reads a child's `contentView`, then passes it to `insertReactSubview` without checking nil. Recycling also clears `contentView` (line 166). This supplies a possible lifetime mechanism, not proof of the order that triggers 3T.
- `node_modules/expo-modules-core/ios/Core/SharedObjects/SharedObjectRegistry.swift:186`: `clear()` asynchronously removes registry pairs. The relationship between that removal and runtime destruction needs native lifetime evidence for issue 49.
- `tracksViewChanges` does not repair this installed Apple Maps insertion path. A blind nil-drop can suppress pins and conceal broken child ordering.

Next diagnostic: on a physical diagnostic build, capture child tag/class, mount/recycle ordering, content-view lifetime and runtime/registry teardown without logging coordinates or media. Exercise loading, filtering, clustering, detail/back, and background/foreground. Compare the candidate against exactly that sequence. The no-simulator constraint was respected; neither JS tests nor a quiet counter closes these incidents.

## 2. Missing providers: exact production and source evidence

Fresh aggregate query: **73 active SportsLeague catalog entries; 60 have provider NULL, zero linked events, and zero linked ingest runs**. They comprise 15 minor, 10 major and 35 college entries. College entries include subdivisions, so this does not mean 35 distinct missing NCAA sports. The combined NCAA football entry currently has 513 events; separate FBS/FCS catalog entries have none. Provider-backed NCAA baseball currently has zero events and one run; zero alone cannot establish an outage.

Root connection gaps:

1. `server/src/lib/sportsLeagueCatalog.ts` marks catalog entries active even when provider is null.
2. `server/src/lib/proSchedule/adapters.ts` resolves ESPN + WWE; neither MiLB nor either MLS NEXT competition has a live adapter.
3. `ProLeague` in `server/prisma/schema.prisma:164` cannot represent MiLB, MLS, or MLS NEXT Pro. Adding a URL alone cannot wire these leagues through the current typed ingestion system.
4. The older `server/scripts/mlb/sync-mlb-schedule.ts:60` hardcodes `sportId=1` (MLB), uses a separate bulk path and MLB venue data. It does not import minor leagues.
5. `/events/sports-leagues` returns `schedule_status`, and `apiclient/entities.ts` declares it, but no app/component consumes that field. Users cannot distinguish catalog-only availability from real schedule coverage.
6. Provider metadata is not itself freshness proof: the FIBA entry has 24 seeded events and no rolling-ingest run.

### Actual MiLB provider probe, no writes

Queried MLB's official Stats API for inclusive calendar dates **2026-09-06 through 2026-09-20**, with `hydrate=venue(location)`. This is a provider-availability probe, not an exact timestamp/viewer-bound discovery query. Do not equate all these fixtures with expected visible app pins.

| Sport ID | Level    | Games returned / valid dates | With finite venue latitude and longitude |
| -------- | -------- | ---------------------------- | ---------------------------------------- |
| 11       | Triple-A | 195 / 195                    | 195                                      |
| 12       | Double-A | 127 / 127                    | 111                                      |
| 13       | High-A   | 38 / 38                      | 30                                       |
| 14       | Single-A | 43 / 43                      | 33                                       |
| 16       | Rookie   | 0 / 0                        | 0                                        |

All requests returned HTTP 200. **403 games**, of which **369 contain coordinates**. The 34 missing-coordinate records require venue resolution or explicit unlocated-event handling; do not invent coordinates or silently change feed/map eligibility. Rookie's valid empty result needs season/provider health context, not an automatic outage label.

Official sources: [MLB sport IDs](https://statsapi.mlb.com/api/v1/sports), [Triple-A schedule query](<https://statsapi.mlb.com/api/v1/schedule?sportId=11&startDate=2026-09-06&endDate=2026-09-20&hydrate=venue(location)>), [MLS NEXT youth schedule](https://www.mlssoccer.com/mlsnext/schedule/), [MLS NEXT Pro schedule](https://www.mlsnextpro.com/schedule/). The two MLS pages establish separate schedule surfaces; this investigation did not establish a supported bulk API for either. Public endpoint availability alone is not a provider integration or contractual approval.

Implementation path: reuse the canonical normalized fixture/ingestion pipeline; extend league identity deliberately with migrations and canonical taxonomy; key events by stable provider fixture ID; resolve venue coverage; record provider and parse failures independently from valid empty schedules. Add contract fixtures for schema changes, postponements, missing venues, duplicates and cross-league IDs. Validate both discovery surfaces against the same viewer/filter/time window after an idempotent controlled import. Keep unsupported coverage explicit until that is complete.

## 3. Actual full-table backup restore drill

Production and backup both run PostgreSQL **17.11**. The existing local server was 14; installed version-17 tooling and used a separate temporary cluster on loopback port 56441. The existing local development cluster was not replaced. Homebrew's service/link step failed; version-specific resource links were supplied for the disposable invocation. No PostgreSQL 17 background service was enabled.

Procedure executed:

1. Verified the selected backup service matched the API's configured backup hostname.
2. Opened a read-only RepeatableRead backup transaction, exported its snapshot and computed per-table content fingerprints from sorted hashes of each complete JSONB row, with UTC timestamp normalization.
3. Ran PostgreSQL 17 `pg_dump --format=custom --no-owner --no-acl --snapshot=<snapshot>` against that same snapshot. Archive remained in process memory, never a durable dump file.
4. Restored into a fresh local PostgreSQL 17.11 database using `pg_restore --exit-on-error --single-transaction --no-owner --no-acl`.
5. Compared all table fingerprints and column/type/default/nullability, constraint, index and RLS-flag metadata; exercised Prisma reads and local writes; attempted normal migration deployment against the local restore only.
6. Stopped and removed the entire disposable cluster. No restored customer records or archive were printed. Only aggregate counts, metadata and error codes were retained.

Verified result:

- **59 tables, 4,258 rows** including 79 migration-history rows; 4,179 application rows. Archive size 475,009 bytes.
- Snapshot/fingerprint/dump phase: 31.977 seconds. Restore and subsequent metadata/fingerprint comparison phase: 1.206 seconds. These are local drill timings, not production RTO.
- **Zero mismatched table fingerprints**, including migration history. The first comparison exposed timezone-sensitive JSON encoding for migration timestamps; repeating with UTC on both sides removed that comparison artifact.
- Zero differences in the compared metadata between backup and restored copy; zero unvalidated constraints.
- Prisma reads: 41 users, 2,504 events, 13 ads, 3 Apple transaction claims.
- User insertion succeeded inside a transaction; duplicate email rejected (`P2002`) and the probe insertion rolled back. Orphan team follow rejected (`P2003`).
- Restored database has zero public sequences. Sequence synchronization remains a code weakness, but no sequence-backed object was present to exercise here.

### Reproduced recovery blocker

Primary has **156 migration-history rows**; backup has **79**. The repository currently contains 151 migration directories. Counts alone do not tell which applied/rolled-back/checksum entries should be baselined; a reviewed per-migration reconciliation is required.

Running the server's Prisma 5 `migrate deploy` against the local restored database failed:

```text
Applying migration 20260323120000_add_ad_rejected_and_join_request_approved_notifications
P3018 / PostgreSQL 42710
ERROR: enum label "AD_REJECTED" already exists
```

The mirror has current enum/data changes but stale migration history, so normal startup attempts to replay already represented DDL. This is an actual restore-startup failure, not a hypothetical risk. No failed migration was written to either production database.

Additional primary→backup drift:

- **32 absent primary indexes on backed-up tables**, plus one differing index definition; four additional primary indexes belong to intentionally excluded PushTicket.
- Missing indexes include **organization normalized-name uniqueness** and **Google transaction-order uniqueness**, not just search performance indexes.
- The Apple transaction unique index exists on both databases: primary uses a non-null partial predicate; backup uses an unfiltered unique index. This is a definition mismatch, not evidence of an additional charge/fulfillment defect. It corrects the initial shorthand description of an “extra” payment index.
- RLS is enabled-not-forced on primary Message, TeamMembership, OrganizationMembership and GroupChatMember; disabled on backup. Existing owner connections bypass primary RLS, so this does not prove current production authorization exposure. A promoted backup would nevertheless lack the expected configuration.
- PushTicket is intentionally excluded. `User.profile_private` remains present in backup after the prior startup fix.

Root cause: table mirroring and additive enum sync are not full schema/migration replication; previous backup `db push` also diverged from migration-managed primary objects. Removing destructive startup reconciliation stopped further column deletion, but did not repair existing history/index/RLS drift.

Safe repair sequence: inventory applied migration identifiers/checksums and all schema objects; reconcile a disposable clone against primary; review changes to backup schema and migration baseline together; never mark all migrations applied blindly or use `db push --accept-data-loss`. Repeat the complete restore/startup drill and payment/organization constraint tests. Then test a standalone restored API with outbound integrations disabled, plus deployment roles/ACLs, media/Redis dependencies and an operator failover procedure. This drill omitted owners/ACL restoration and did not switch live traffic or certify whole-service recovery/PITR.

Reproduction driver and aggregate output are local investigative artifacts: `/tmp/vh-full-restore.cjs`, `/tmp/vh-full-restore-verified.log`. The driver deliberately restores only to its newly created local cluster and cleans it in `finally`; production connections perform read-only queries/dump. Do not substitute a production URL for the restore destination.

## 4. Incomplete multi-part purchase recovery

Source: `hooks/useAdIAP.ts`, `lib/adVerificationQueue.ts`, `/payments/apple/verify-ad-receipt`, `server/src/lib/paymentInternals.ts`, installed `react-native-iap/src/index.ts`.

The previous fixes protect serialized queue writes, preserve partial/old receipts, and journal received receipts before consumable finish. Server verification deduplicates signed transaction value and claims transaction IDs atomically. Those fixes remain distinct from automatic multi-part recovery.

| Interruption point                                                                       | Current behavior                                                            | Remaining defect                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store request accepted, before receipt callback                                          | Ad/date/product expectations exist in `pendingAdRef` only.                  | Process kill loses the association. Success callback returns immediately when no pending ref exists.                                              |
| First product received and journaled, then process dies                                  | Item survives with `ready:false`; first consumable may already be finished. | Flusher preserves it and displays support text; it never reconstructs or requests the missing product.                                            |
| Complete bundle saved, server temporarily unavailable                                    | Flusher retries on relevant screen mount/immediate recovery path.           | No global authenticated reconnect worker/backoff lifecycle; repeated verification errors reach UI but only DEV console in the per-item catch.     |
| User changes accounts                                                                    | Queue uses one installation-wide key and has no owner field.                | Current account may attempt submission for another account's ad. Server ownership check rejects this; no cross-user fulfillment was demonstrated. |
| Restart or duplicate callback supplies old transaction while another checkout is pending | Listener associates matching product IDs with the current in-memory ad.     | No persisted purchase-intent/store account token binding proves which ad the transaction belongs to.                                              |

Installed IAP exports `getPendingTransactionsIOS` and supports `appAccountToken`; the ad flow uses neither. Inspecting available APIs is not proof that already-finished consumables can be reconstructed from StoreKit. Apple documents the [unfinished transaction sequence](https://developer.apple.com/documentation/storekit/transaction/unfinished); completed transactions and missing purchase intent require separate reconciliation.

Required root fix design:

1. Persist an authenticated, server-recognized purchase intent **before** asking StoreKit to charge: stable intent ID, owner, ad, dates, expected product quantities and per-part state. Bind a supported account token to that intent without trusting a client-supplied owner.
2. At authenticated startup/reconnect, reconcile journal + unfinished StoreKit transactions + server claim/fulfillment status. Match identity and signed transaction IDs before changing state. Serialize this through one recovery coordinator.
3. Persist each verified received part durably; record server acceptance before considering the whole booking fulfilled. Finish/ACK handling must be idempotent and recoverable from every boundary.
4. Automatically verify already-purchased complete bundles. For genuinely unpaid missing parts, show an explicit “continue remaining purchase” action; do not initiate another charge silently. Legacy unbound partial records require support reconciliation, not guessed ownership or fabricated receipts.
5. Handle dates becoming ineligible, lost inventory, changed ad approval, account switching and terminal provider errors explicitly. Keep an auditable unresolved state rather than endlessly reporting generic retry success.
6. Test process death before callback, after journal, after finish, between products, after server commit/before response, concurrent callbacks, stale callbacks, logout/login, offline reconnect and five concurrent receipt submissions. StoreKit sandbox evidence remains necessary for native behavior; pure JS tests cannot certify it.

## Verification and boundaries

Fresh targeted run: `npx jest --runInBand __tests__/ad-verification-queue.test.ts components/__tests__/EventMap.test.ts` — **2 suites, 16 tests passed**. Queue tests specifically verify partial bundles are retained and not submitted, concurrent writes survive, and corrupt/failed storage is reported. Map tests execute mocked native components. No new client/server typecheck or native crash reproduction is claimed for this documentation-only investigation.

Production was queried read-only. No production fix was shipped in this investigation. The four domains remain open with more precise evidence; full-table data restore is now demonstrated, while ordinary recovery startup is demonstrably blocked.
