# Forensic repairs — September 6, 2026

## Changes

- Apple ad receipt verification counts value once per distinct transaction and rejects a receipt without an ID before fulfillment. The live handler previously counted repeated receipt values before settlement deduplicated IDs. A controlled handler test reproduced both invalid bundles reaching fulfillment; both regressions now pass, including five simultaneous attempts to use repeated receipts for an underfunded booking. A repeated receipt can still fulfill a booking covered by its unique value. This is not a real-store purchase or full database concurrency certification.
- Ad receipt recovery uses serialized storage mutations; finishing one retry no longer replaces the whole queue or deletes a newly enqueued receipt. Storage errors propagate; unreadable and old receipts are retained. Receipt bundles are journaled before StoreKit consumption is acknowledged. Complete bundles can retry activation after restart; incomplete bundles remain saved and report a support-recovery state. New checkout is blocked while that ad has an unresolved purchase. This does not provide automatic completion of interrupted multi-product purchases.
- Backup refresh checks table/column coverage before clearing data, keeps backup writes in one destination transaction, and rolls back on table/deferred-FK failure. Unlisted primary tables now abort the refresh. Missing-column drift cannot be silently omitted. Primary reads remain RepeatableRead. Existing enum reconciliation occurs before replacement and sequence handling remains outside the data transaction; this is not a complete point-in-time recovery system.
- Startup no longer runs destructive backup schema convergence. Backup schema additions are now reviewed operations; the backup job refuses incomplete coverage.
- Backup scheduler failures now propagate to the worker instead of being swallowed and logged as completed.
- Backup count checks no longer offset one table's deficit with another's surplus, reject emptied populated tables, and no longer claim byte-for-byte equality. These conservative checks may alert on a newly populated table between snapshots; counts alone cannot distinguish that from data loss or prove restoration.
- Organization search invalidates superseded/cleared/unmounted requests; malformed responses fail and are captured. Onboarding displays search errors rather than a false empty/test-slate message.
- ESPN rejects missing/non-array event envelopes, preserving legitimate empty schedules. Fetches have explicit 30-second abort signals. Ingestion run reporting receives schema failures through the existing failure path. This does not add MiLB/MLS NEXT/MLS NEXT Pro providers or guarantee detection of all per-record schema drift.
- Video preview sessions are keyed by source, start thumbnail work once, ignore stale completions, and show errors/deadlines. Trim requests have a two-minute UI deadline. Native work remains exclusive until it actually settles; timeout does not cancel native work or allow overlapping trims. Late trim results cannot update an unmounted/replaced session.

## Verification

- `npm run release:verify:local`: passed on the final repair source, including client/server typechecks and access/regression gates; commit and pre-push hooks also passed.
- `npm run release:verify:build`: passed on the final repair source with three nonblocking native submission credential warnings (Apple ID entries and Android service-account file).
- Focused queue/search/video tests: 12 passed, including hung-trim/overlap/late-result behavior. Native trim source contract: two passed. These are JavaScript and source checks, not native crash reproductions.
- Backup verdict/SQL/order tests: 30 passed. ESPN and rolling-ingestion tests: 22 passed. Existing database-backed payment-finalization tests: 11 passed. Backup scheduler/fallback tests: six passed; startup readiness tests: three passed.
- Disposable PostgreSQL: injected middle-table insert failure preserved both previous backup tables; successful refresh replaced both; missing-column drift rejected refresh without clearing data. Reusable command: `DATABASE_URL=<local-postgres-url> npx tsx scripts/verify-backup-atomicity.ts` from `server/`. It creates and drops its own temporary local databases and refuses remote hosts.
- The initial access-matrix failure was traced to the local database missing existing September 3/5 migrations, including AdSlotHold. Applied those migrations locally; the access matrix subsequently passed. No primary production migration was made.

## Production schema preparation

Read-only comparison found 616 primary columns versus 606 backup columns. Nine belonged to intentionally excluded PushTicket; the remaining mismatch was User.profile_private (boolean NOT NULL DEFAULT false). Added that column to the backup only using a five-second lock timeout. The first production verification found startup subsequently removed this column via `prisma db push --accept-data-loss`. The job failed without truncating the backup and surfaced the failure correctly. Removed that destructive startup step before the final refresh. This records an actual storage-column mismatch, not proof of incorrect live profile privacy (application privacy uses preferences).

## Release status

- Repair source: `14c6b8373bf0e6f75eaa7d176c69421dd146534a` (preceded by `4849b420` and `ae42b8c7`). Pushed to the fork; upstream PR #281 remains open and mergeable. The available upstream GitHub account has pull-only access.
- Final Railway deployment: `b9fa122e-32b1-4091-a57f-30ac2cedabb9`, status SUCCESS. Runtime verification passed after this deployment. Startup logs confirm backup schema mutations are skipped.
- Production scheduler verification job: `forensic-backup-14c6b837-20260906`, completed. Logs confirm 58 tables and 4,179 rows copied. Subsequent read-only count check: primary 4,179, backup 4,179, missing tables zero, row-count deficit zero. This is not content equality or a full restore drill.
- Production OTA group: `69ac3326-5bd1-4f44-9f00-65840275bef6`, branch production, runtime `1.0.5`, iOS and Android, repair source `14c6b837`.
- iOS update: `01a077eb-de53-7373-a8ee-9ed3ccd9b57a`; Android: `01a077eb-de53-77cc-b28f-2569f6a69fd9`.
- Sentry artifact uploads completed. iOS Debug ID: `6748a1f8-767d-4c48-8d1c-32248e117ec7`; Android: `0b796ca0-e989-489e-adaa-e25cd3ee342b`. Checked that each actual exported Hermes bundle contains its corresponding source-map Debug ID.
- Previous mobile OTA rollback candidate: `99d1b7cb-24bc-4b35-b756-db6ac525c0e5` (also runtime `1.0.5`). A server rollback must retain the backup-preservation changes; older startup code can remove primary-only backup columns again.
- Web export succeeded, but Vercel rejected deployment with **Not authorized** before domain alias changes. CLI login is `emilmancero-dev`; its accessible team list does not include the linked VarsityHub web project team. No Vercel token override is supplied by the EAS production environment. Web remains on its previous deployment. Finishing web publication requires an account/token authorized for the existing project, then the documented production web command. Do not deploy a substitute project or move its domains to work around access.

## Still open

Native map/SharedObject/EXC_BAD_ACCESS incident closure requires native evidence; no simulator used in this repair pass. Complete backup restore and sequence/schema recovery drills, five-concurrent-request payment certification, interrupted multi-product ad purchase automation, and missing provider integrations remain open. These repairs must not be described as all historical notes fixed or whole-app production certification.
