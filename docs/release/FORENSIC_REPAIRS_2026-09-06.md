# Forensic repairs — September 6, 2026

## Changes

- Ad receipt recovery uses serialized storage mutations; finishing one retry no longer replaces the whole queue or deletes a newly enqueued receipt. Storage errors propagate; unreadable and old receipts are retained. Receipt bundles are journaled before StoreKit consumption is acknowledged. Complete bundles can retry activation after restart; incomplete bundles remain saved and report a support-recovery state. New checkout is blocked while that ad has an unresolved purchase. This does not provide automatic completion of interrupted multi-product purchases.
- Backup refresh checks table/column coverage before clearing data, keeps backup writes in one destination transaction, and rolls back on table/deferred-FK failure. Unlisted primary tables now abort the refresh. Missing-column drift cannot be silently omitted. Primary reads remain RepeatableRead. Existing enum reconciliation occurs before replacement and sequence handling remains outside the data transaction; this is not a complete point-in-time recovery system.
- Startup no longer runs destructive backup schema convergence. Backup schema additions are now reviewed operations; the backup job refuses incomplete coverage.
- Backup scheduler failures now propagate to the worker instead of being swallowed and logged as completed.
- Backup count checks no longer offset one table's deficit with another's surplus, reject emptied populated tables, and no longer claim byte-for-byte equality. These conservative checks may alert on a newly populated table between snapshots; counts alone cannot distinguish that from data loss or prove restoration.
- Organization search invalidates superseded/cleared/unmounted requests; malformed responses fail and are captured. Onboarding displays search errors rather than a false empty/test-slate message.
- ESPN rejects missing/non-array event envelopes, preserving legitimate empty schedules. Fetches have explicit 30-second abort signals. Ingestion run reporting receives schema failures through the existing failure path. This does not add MiLB/MLS NEXT/MLS NEXT Pro providers or guarantee detection of all per-record schema drift.
- Video preview sessions are keyed by source, start thumbnail work once, ignore stale completions, and show errors/deadlines. Trim requests have a two-minute UI deadline. Native work remains exclusive until it actually settles; timeout does not cancel native work or allow overlapping trims. Late trim results cannot update an unmounted/replaced session.

## Verification

- `npm run release:verify:local`: passed twice after the local database repair; subsequent purchase-timeout identity guard is also covered by the commit type/lint checks.
- `npm run release:verify:build`: passed with four nonblocking warnings.
- Focused queue/search/preview tests: 11 passed; an additional hung-trim/overlap/late-result test passed. Native trim source contract: two passed. These are JavaScript and source checks, not native crash reproductions.
- Backup verdict/SQL/order tests: 30 passed. ESPN and rolling-ingestion tests: 22 passed. Existing database-backed payment-finalization tests: 11 passed.
- Disposable PostgreSQL: injected middle-table insert failure preserved both previous backup tables; successful refresh replaced both; missing-column drift rejected refresh without clearing data. Reusable command: `DATABASE_URL=<local-postgres-url> npx tsx scripts/verify-backup-atomicity.ts` from `server/`. It creates and drops its own temporary local databases and refuses remote hosts.
- The initial access-matrix failure was traced to the local database missing existing September 3/5 migrations, including AdSlotHold. Applied those migrations locally; the access matrix subsequently passed. No primary production migration was made.

## Production schema preparation

Read-only comparison found 616 primary columns versus 606 backup columns. Nine belonged to intentionally excluded PushTicket; the remaining mismatch was User.profile_private (boolean NOT NULL DEFAULT false). Added that column to the backup only using a five-second lock timeout. The first production verification found startup subsequently removed this column via `prisma db push --accept-data-loss`. The job failed without truncating the backup and surfaced the failure correctly. Removed that destructive startup step before the final refresh. This records an actual storage-column mismatch, not proof of incorrect live profile privacy (application privacy uses preferences).

## Release status

Source commit, server deployment, runtime checks and OTA identifiers will be recorded after completion. Publication is not established by this document alone.

## Still open

Native map/SharedObject/EXC_BAD_ACCESS incident closure requires native evidence; no simulator used in this repair pass. Complete backup restore and sequence/schema recovery drills, five-concurrent-request payment certification, interrupted multi-product ad purchase automation, and missing provider integrations remain open. These repairs must not be described as all historical notes fixed or whole-app production certification.
