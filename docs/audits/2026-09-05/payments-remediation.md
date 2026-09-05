# Ad/payment remediation handoff — September 5, 2026

Implementation for ADS-01–05 and PAY-01–02 is complete in the shared working tree. No commit, push, deployment, real provider payment/refund, outbound message, or production mutation was performed by the payment lane. The release owner handles integration and deployment; deployed status must be verified separately. Independent source review by the privacy lane found four further interactions; all four were corrected and re-reviewed as resolved. The reviewer read the actual DB logs but did not independently rerun the tests.

## Findings and fixes

| ID     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADS-01 | ZIP edits check every campaign reservation and live purchase hold inside SERIALIZABLE before changing targeting. The shared capacity query counts distinct campaigns across reservations plus unexpired holds, without the previous first-100-ads truncation. Both ordinary availability and alternative-ZIP suggestions use that same query; alternative ZIP counts are batched in one SQL query.                                                                | Real authenticated HTTP full destination rejects 409 with original ZIP/reservations retained. A deterministic separate-connection booking/retarget race commits one side and aborts the other with P2034; destination stays at two campaigns.         |
| ADS-02 | New `AdSlotHold` rows represent pending purchase inventory separately from `AdReservation` paid delivery dates. Holds carry a provider purchase reference and expiry. Run Again keeps existing active/paid state and dates. Checkout Session, PaymentIntent and Apple success add only the purchased dates. Stripe inventory and COMPLETED accounting commit together. Cancel/failure/expiry and SLOT_FULL recovery release only the identified purchase's holds. | Actual DB cancel, overlapping attempts, expiry, rollback, Checkout Session/PI success, duplicate callback and lifecycle cleanup tests. Paid delivery remains eligible; paid rows never become temporary holds.                                        |
| PAY-01 | Refund/dispute accounting still records the provider action, but subscription downgrade requires the current matching Stripe subscription identity and the shared Apple/Google migration guard. Ad refunds delete only reservations stamped with that purchase; another paid run survives. Another live hold preserves approved/hold state so its later settlement succeeds.                                                                                      | Locally signed real HTTP refunds/disputes preserve newer Stripe/Apple/Google entitlements; matching-current refund downgrades as intended. Actual DB separate-run refund and surviving-hold settlement.                                               |
| PAY-02 | Inner refund DB errors propagate to retryable non-2xx; the event remains unprocessed. Refund accounting stores the provider event ID so crash-after-commit replay does not repeat effects. Refund/settlement both use SERIALIZABLE and refunded history is terminal inside settlement.                                                                                                                                                                            | Injected transaction outage gives 500/unprocessed, retry commits once, duplicate is unchanged. Injected event-marker failure after refund commit remains retryable. Concurrent refund/settlement cannot overwrite REFUNDED or restore refunded dates. |
| ADS-03 | Fully complimentary web checkout navigates directly to ad confirmation instead of requiring a Stripe URL.                                                                                                                                                                                                                                                                                                                                                         | The actual ad-calendar handler is extracted and executed; `{free:true}` reaches confirmation with the promo amount and no error alert. This is a handler test, not mounted browser UAT.                                                               |
| ADS-04 | Stripe configuration is checked only after the iOS Apple branch.                                                                                                                                                                                                                                                                                                                                                                                                  | Actual handler execution calls Apple successfully with missing build/server Stripe keys and never asks Stripe for configuration. No device/provider transaction was attempted.                                                                        |
| ADS-05 | One real-calendar YYYY-MM-DD Zod schema protects quote, web checkout, PaymentSheet and Apple ad receipt dates before pricing/provider work. Impossible dates and timestamp strings reject 400.                                                                                                                                                                                                                                                                    | Actual authenticated HTTP covers malformed/impossible dates on all four routes, duplicate-date pricing, yesterday/day57 rejection and day56 acceptance.                                                                                               |

Additional review fixes: refunded Checkout Session/PI replay cannot resurrect dates, even after late expiry/cancellation; the ledger cannot be downgraded by a late failed/canceled event. Apple repeat purchases have distinct accounting, exact receipt/date idempotency, reject partial reuse of old receipts, and give any matching refunded history precedence over a newer duplicate completed record. A refunded receipt plus a fresh receipt cannot fund a new run; the fresh claim rolls back on rejection. Stripe fallback checkout idempotency now includes the selected dates/promo and user/ad scope, so another date selection in the same hour does not collide with the old checkout.

The old ad-state-invariants structural suite was replaced with behavior tests. Full-suite review also replaced the stale ads.test ZIP regex with a real PostgreSQL assertion covering exact-ZIP isolation and overlap deduplication; AdSlotHold was added to the backup table list in FK-safe order. The stale PaymentIntent structural assertion now follows the shared guarded pipeline; its security behavior is also covered by signed HTTP PaymentIntent tests. SLOT_FULL automatic refund and moderation refund recovery were retained. This lane makes no refund-policy wording decision.

## Payment verification actually run

The initial payment-lane execution used the dedicated local PostgreSQL database `varsityhub_audit_20260905_ads`, with inherited environment cleared:

```sh
env -i PATH="$PATH" HOME="$HOME" \
  VARSITYHUB_ENV_PATH=/dev/null DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL=postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_20260905_ads \
  JWT_SECRET=audit-local-test-secret-32-chars-minimum NODE_ENV=test \
  node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  --runInBand --watchman=false --runTestsByPath src/__tests__/<suite>.test.ts
```

Working directory for these commands: `server/`. Each suite ran in its own process because a combined 17-suite run exposed the repository's Jest VM-module registry collision (`module is already linked`), including existing unrelated tests. No suite was skipped or replaced with a stub. Jest maps Stripe to the installed SDK's equivalent CommonJS entry to avoid the isolated SDK linking collision; signature verification still uses the real Stripe SDK. The four forensic tests were converted into expected-safe acceptance tests.

The isolated sweep passed 161 tests across 17 suites, zero skipped. After the final Apple review change, the two affected suites were rerun and passed 18 tests, including one added regression: 162 distinct passing tests represented by the final evidence. This is a mixture of actual HTTP/DB, handler/helper and retained structural tests, not 162 provider end-to-end scenarios.

| Suite                                | Passing tests at final evidence |
| ------------------------------------ | ------------------------------: |
| audit-ads-db-repro-2026-09-05        |                              15 |
| audit-ads-boundaries-2026-09-05      |                               9 |
| audit-ad-client-handler-2026-09-05   |                               2 |
| audit-stripe-refund-repro-2026-09-05 |                              12 |
| ad-state-invariants                  |                               7 |
| payments-finalization                |                              11 |
| payment-ad-slots                     |                               2 |
| ad-geofencing.integration            |                               4 |
| ad-engagement-metrics                |                               2 |
| ad-alternative-zips                  |                               1 |
| stripe-webhook-signature             |                               3 |
| stripe-subscription-guard            |                               8 |
| google-play-unverified-fallback      |                               7 |
| payments-invariants                  |                              48 |
| ad-approval-security                 |                              24 |
| ads-route-gating                     |                               4 |
| ad-approval-race                     |                               3 |

Evidence: `payment-tests/results-final.json` and matching logs under this directory, plus `/tmp/apple-review-fixes.log` (the final affected-suite rerun). `/tmp/refund-review-fixes.log` preserves the signed refund/race review regressions. The receipt/retry tests do not call live Stripe/Apple/Google or send email; provider credentials were absent/fixture-only.

The final integrated server typecheck passed with zero errors (`server-integrated-tsc-final.log`). Final payment formatting and the actual worktree error-envelope guard passed. New payment errors now use canonical `sendError`; additive `extraFields` preserve existing top-level `dates` and `canceled` response fields. A direct compatibility check verified empty/nonempty dates, `canceled: false`, canonical error precedence, existing code/details aliases, and HTTP status preservation.

## Integrated server verification

Final aggregate: **319/319 suites and 2,976/2,976 assertions passed; zero skipped/todo and zero unresolved failures**. This combines the complete two-worker invocation, fresh-process reruns of every initially failed file, and focused reruns after fixes. It is not a single green full-suite invocation.

The initial complete run finished with 193 passing and 126 failing suites. Most failures occurred before assertions because Jest's experimental VM-module registry reported `module is already linked`. Every initially failed file was rerun in a fresh process. Genuine integration failures were corrected by their owners; no import failure was silently treated as passing. The final affected payment rerun covered nine suites and 89 assertions, with three fresh-process loader reruns. The last team-entitlement suite ran all six original scenarios over actual loopback HTTP through the full production app in a guarded child Node/tsx process, retaining real PostgreSQL and the strict 403 plan-lock assertion. Its original 404 did not reproduce in the final full-app run; no product entitlement rule was weakened.

Source SHA-256 manifests capture the server tree at the initial sweep and final aggregate. JSON retains the original failures and records the chosen final result source per suite. Evidence under `/tmp/varsityhub-remediation-2026-09-05/`:

- `server-full-source-start.json`, `server-full-source-final.json`: source manifests.
- `server-full-final.json` / `.log`: original complete invocation.
- `server-isolated/manifest.json` and per-file JSON/logs: all 126 fresh-process reruns.
- `payment-tests/payment-envelope-final.json` and `payment-envelope-isolated/`: final affected payment checks.
- `roles-integration-followup.json`, `admin-parity-final.json`, `team-entitlements-full-app-final.json`: final sibling integration results.
- `server-aggregate-final.json`: 319 unique suite paths, final results and their exact source files.
- `rerun-server-failures.py`, `aggregate-server-results.py`: exact rerun and aggregation procedure.

Full command, from `server/`, using Node v20.19.6:

```sh
env -i PATH="$PATH" HOME="$HOME" \
  VARSITYHUB_ENV_PATH=/dev/null DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL=postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_20260905_full \
  JWT_SECRET=audit-local-test-secret-32-chars-minimum NODE_ENV=test \
  node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  --maxWorkers=2 --watchman=false --json \
  --outputFile=/tmp/varsityhub-remediation-2026-09-05/server-full-final.json
```

For each fresh-process rerun, keep that sanitized environment and replace the final options with `--runInBand --watchman=false --runTestsByPath <absolute-suite-path> --json --outputFile=<artifact.json>`. Rebuild the final aggregate with:

```sh
python3 /tmp/varsityhub-remediation-2026-09-05/aggregate-server-results.py \
  /tmp/varsityhub-remediation-2026-09-05/team-entitlements-full-app-final.json
```

The isolated full database already contained the new table and provenance column before execution. Only local PostgreSQL and fixture provider credentials were used. The event-creation suite separately passed nine actual HTTP/DB assertions with real routes and auth/parental-consent middleware; its test app sequences shared imports to avoid the Jest collision.

## Schema, migration and legacy records

Migration: `server/prisma/migrations/20260905000000_ad_purchase_holds/migration.sql`.

Additive changes only: new `AdSlotHold` table, FK to Ad with cascade delete, unique `(ad_id,date,purchase_reference)`, expiry/reference indexes; nullable indexed `AdReservation.purchase_reference`; Prisma Ad.slot_holds relation. There are no changes to subscription enums, provider keys, receipt cryptography or RLS. Existing rows are not deleted, reclassified or assigned guessed provenance. No backfill is needed to start using new purchase holds.

Migration was applied with psql to the isolated ads DB and Prisma client generation completed. The integrated full DB was verified to contain AdSlotHold and reservation provenance before the sweep. It was also executed in a temporary schema inside a transaction containing paid and ambiguous legacy hold fixtures. Assertions proved both old rows and states survived and provenance remained NULL; a new hold insert worked; ROLLBACK removed the proof schema. Log: `payment-tests/migration-proof.log`. This validates this additive migration, not a replay of the repository's entire historical migration chain.

Legacy reservations with NULL provenance are intentionally retained on cancellation/refund where their purchase cannot be established. Legacy hold/mixed rows are not silently deleted during cleanup or guessed paid. Such rows require ledger/provider reconciliation if present. New calls that omit the purchase reference in SLOT_FULL recovery throw instead of pretending release succeeded.

Read-only operator preflight: `server/scripts/sql/ad-inventory-preflight-20260905.sql` works before or after the migration. Postflight: `server/scripts/sql/ad-inventory-postflight-20260905.sql` requires the new table. Both use READ ONLY transactions, 10-second statement timeout, bounded detail output, and omit email/provider secrets. They were run successfully against the isolated ads DB.

Root also ran the production preflight against the verified intended DB, read-only: `/tmp/varsityhub-remediation-2026-09-05/prod-inventory-preflight.log`. Reported results: 11 unpaid ads/zero reservations; two paid ads/five reservations, all past; zero upcoming dates, zero legacy hold/pending reservation rows, zero paid ads without inventory, zero oversold dates; two completed ad purchases; zero refund/dispute event rows. Only the five past reservations lack provenance. These results do not require an immediate production inventory repair.

The scheduled backup sync copies its explicit table list and does not reconcile tables/columns itself. `server/start.sh` separately performs a bounded backup schema push when `DATABASE_BACKUP_URL` is set; that step should create the new table/column, but its failure is nonfatal. Verify both fields read-only on the backup after deployment before calling backup readiness complete. If startup reconciliation fails, inspect the backup schema and apply only the missing additive migration DDL; do not blindly replay historical migrations or manually push the full schema. The release owner verified the backup target read-only before deployment; absence of the new table/column at that point was expected. No production backup action was performed by this lane.

## Release and rollback

Deploy target: server + client OTA/web bundle. Existing installed clients remain compatible with the request/response shapes. iOS ads remain Apple IAP; Android subscription billing remains Google Play; Android ads/web remain Stripe. No native configuration/build change is required by these patches.

Critical server rollout boundary: old binaries do not count AdSlotHold. The planned release uses an explicit stop-before-start boundary: rerun read-only inventory preflight, stop the old API deployment, verify its state is REMOVED, then deploy the tested server. This introduces a bounded API outage while the new build starts. Interrupted clients and webhooks retry against the new server. New finalizers support in-flight legacy Checkout Session/PaymentIntent callbacks. Verify server health/schema, backup schema and inventory postflight before client OTA.

`overlapSeconds=0` and `drainingSeconds=0` remove the configured overlap interval and SIGTERM grace period. Railway documents the new deployment going online before the old deployment receives termination; those values alone do not guarantee an atomic stop-before-start. Explicit old-deployment removal supplies the compatibility boundary. [Railway configuration reference](https://docs.railway.com/config-as-code/reference#deployment-teardown), [deployment lifecycle reference](https://docs.railway.com/deployments/reference#singleton-deploys).

Keep the additive schema on rollback. If the new server has never accepted holds, an old-code rollback still requires preflight and a stopped new worker. Once holds exist, blindly restoring the old server would make capacity incorrect and reintroduce paid-date loss. Prefer a forward patch or retain the new inventory adapter in a rollback build. If a rollback to the original code is unavoidable, stop new checkout traffic, reconcile/settle or expire all pending purchases, confirm zero live holds, preserve the ledger/provenance snapshot, and review the old Run Again behavior before restoring traffic. Do not drop the table/column with pending holds or while refund reconciliation depends on provenance. The local transaction rollback proof is not a production rollback rehearsal.

## Required scope not certified here

No actual provider sandbox checkout, store receipt cryptographic exchange, provider refund dashboard, physical-device PaymentSheet/Apple recovery, browser rendering, live Redis two-process lock failure, deployment, OTA, backup restore or production rollback rehearsal was performed by this lane. Separate PostgreSQL connections proved serialization races; they do not substitute for Redis failure drills. Existing distributed-lock behavior is unchanged, and the route retains retryable 503 on lock failure; this lane did not inject a real Redis outage. The release owner separately handles policy/copy reconciliation; these patches retain necessary SLOT_FULL and moderation refund recovery. These code-level closures alone do not certify the full A+ runtime gate.
