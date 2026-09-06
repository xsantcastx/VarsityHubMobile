# Purchase date recovery — September 6, 2026

An interrupted Apple ad purchase could retain both paid receipts yet never fulfill after its booking dates expired. Re-entering checkout with replacement dates returned `RESUME_EXISTING_PURCHASE_DATES`; the calendar offered support only.

The authenticated owner can now explicitly replace the dates on the same unfinished intent. The server preserves the exact weekday/weekend product quantities, receipts and transaction identity. A serializable transaction checks approval, ownership, expected old dates and replacement inventory, moves only that intent's temporary holds, and writes an `AdPurchaseIntentRevision` audit record. Completed purchases cannot move. Full payment is reconciled without another StoreKit request; partial payment still requires explicit checkout for unpaid products. Existing paid reservations are never removed.

Verification completed before publication:

- Real isolated PostgreSQL, restored from the actual backup, applied migration `20260906220000_ad_intent_date_revisions` successfully. This is an additive audit table; rollback the application while retaining the table/history.
- Six intent database tests pass, including five concurrent replacement retries producing one revision and one fulfillment, partial payment preservation, wrong-account rejection, product mismatch, stale revisions, completed-purchase immutability, inventory rollback and structured failure capture.
- Regression proof: disabling the date-revision transaction while retaining reconciliation makes the expired fully paid purchase test fail with `BOOKING_DATES_EXPIRED`. Restoring the transaction passes. The test separately confirms that the original create-intent path rejects replacement dates.
- All 24 real-database purchase finalization/invariant/recovery tests pass. Apple signature verification is mocked only in the intent suite; these tests do not execute StoreKit charges or claim physical process-death coverage.
- Full local release workflow passed, including client and server TypeScript, lint, navigation and guardrails; 162 client regression tests and 125 server regression tests.
- Additional map/client discovery suites: 38 tests pass. Additional server discovery/filter/pagination/conservative-ingestion suites: 28 tests pass. These verify application behavior, not native marker lifetimes.
- Native symbol verification: four tests pass. They check UUID/full-debug matching and Expo build-phase preservation; no native archive or device test was run.

Remaining limits are explicit:

- The user cannot provide a device now and requested tests only. Physical-device UAT and the confirmed native crash investigations remain unverified. Inspection of the published react-native-maps 1.29.0 package shows a different Fabric mounting path, but `AIRMap` still inserts into its child array without a nil guard. Source inspection does not prove that an upgrade prevents the observed lifetime failure. No dependency upgrade was installed or published.
- Legacy unbound receipts, missing receipt payloads and purchases requiring ad approval/refund adjudication are not automatically resolved by date replacement. Date replacement does not authorize an additional charge.
- Production currently exposes only `PRO_SCHEDULE_PROVIDER=espn` and its rolling enable flag among the inspected sports-provider configuration keys. MiLB/MLS NEXT/MLS NEXT Pro are not connected by this change. A permitted source is still required; MLB's published data terms require prior authorization beyond individual noncommercial nonbulk use: https://gdx.mlb.com/components/copyright.txt . No private provider credentials were printed or changed.
- Symbol upload checks, test coverage and successful OTA publication do not constitute seven days of crash-free TestFlight evidence.

Local evidence: `/tmp/vh-reschedule-before.log`, `/tmp/vh-reschedule-db-final.log`, `/tmp/vh-reschedule-local.log`, `/tmp/vh-reschedule-map-tests.log`, `/tmp/vh-reschedule-discovery-tests.log`, `/tmp/vh-reschedule-native-gates.log`.

## Restore round-trip correction

The first actual-backup restore after deploying `55248b5c` matched all data but failed strict schema parity on the new combined date constraint. Independent run [34061950505](https://github.com/emilmancero-dev/VarsityHubMobile/actions/runs/34061950505) also failed. No OTA was published while that gate was failing.

PostgreSQL dump/reparse regroups the combined BETWEEN/AND expression. Additive migration `20260906223000_canonical_date_revision_constraints` splits it into one bound check per array, preserving both NOT NULL requirements and the same 1–56 limits. The already-applied migration is unchanged, and schema comparison remains strict. A complete isolated dump/restore with this correction passes content equality, schema parity, migration deploy, all purchase recovery tests and application constraints; temporary target cleaned up. Evidence: `/tmp/vh-reschedule-before-restore.json` and `/tmp/vh-reschedule-canonical-local-restore.json`.

## Verified publication

- Production server source `8398649d6b78ed251c171885b8d1bfa1c80c4cee`; Railway deployment `d4e86fed-9544-4b7e-ac19-d0bc5f87836a` reports SUCCESS. Runtime checks passed; the live date-revision endpoint rejects unauthenticated requests with 401.
- Final backup refresh: 63 tables / 4,341 rows / 161 migration-history entries, with exact primary/backup migration-history fingerprints. Both the local actual-backup drill and independent [GitHub run 34062244395](https://github.com/emilmancero-dev/VarsityHubMobile/actions/runs/34062244395) pass. The CI report finished at `2026-09-06T21:51:31.898Z` with content match, migration startup, purchase recovery, application constraints and cleanup all true. Daily workflow pin updated by fork-main commit `4d341255` to the verified source.
- Production OTA [584ca69f-7a69-4a79-8338-da314511522c](https://expo.dev/accounts/varsity-hub/projects/varsityhub/updates/584ca69f-7a69-4a79-8338-da314511522c), runtime `1.0.5`, exact source `8398649d6b78ed251c171885b8d1bfa1c80c4cee`. iOS update `01a078b6-84d6-71c8-b0ed-9b87685edec4`; Android `01a078b6-84d6-7de6-b277-7123193d31da`. Guarded publication and Sentry source-map upload exited 0; EAS update-view independently confirmed both platform IDs and source.
- Build readiness passed with four warnings and no blocking errors. This did not execute a native archive. No simulator or physical-device checks were run, per the user's test-only direction.
- Fresh Sentry lookup still reports 3T count 12 (latest `2026-09-06T06:41:24Z`) and 49 count 2 (latest `2026-09-06T15:40:49Z`); 3M's latest-event lookup returns 404. Unchanged counts do not prove native resolution.
- Temporary PostgreSQL cluster and restored customer data removed. Only aggregate restore reports retained. PR #281 remains open/mergeable; upstream merge access is unchanged.

Native crash reproduction, authorized missing-league sources, legacy receipt exceptions and physical/TestFlight evidence remain open. No production execution of an actual StoreKit exception was claimed from these tests.
