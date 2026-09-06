# Verifiable failure safeguards — September 6, 2026

## Confirmed defect and implemented change

`lib/adVerificationQueue.ts` caught verification/cleanup failures with UI callbacks and DEV-only console output. With no callback (the confirmation-screen recovery path), durable failed receipts could remain without a recovery-specific Sentry event. Partial bundles likewise emitted only optional UI text. `utils/sentry.ts` treated a supplied fingerprint as custom context instead of configuring Sentry grouping.

Added sanitized recovery events for `verify`, `ack_cleanup`, `incomplete_bundle` and storage failures. They include stable context/stage tags and a stable two-part fingerprint. Per-item events include recovery ID, ad ID, attempt count and numeric HTTP status where available; they never include signed receipts or provider error bodies. Failure capture precedes the retry-counter storage write so another storage failure cannot hide the initial event. Cleanup failure retains the receipt for idempotent server re-verification.

This is a telemetry fix, not implementation of multi-part purchase continuation or proof of server fulfillment idempotency.

## Actual fail/pass proof

1. Wrote receipt telemetry and Sentry-adapter assertions before changing production implementations. Run: **4 failed, 10 passed**. Failure reasons: absent verify, cleanup and incomplete-bundle captures; missing `scope.setFingerprint` call. Log: `/tmp/vh-safeguards-before.log`.
2. Added the fix. Same two suites: **14 passed**. Log: `/tmp/vh-safeguards-after.log`.
3. Added a ten-query test: ten searches within 500ms of fake time, latest response first, older responses released after 3000ms of fake latency. Assert latest results and loading state after every old completion. This models throttled/out-of-order requests, not an actual 3G radio.
4. Explicitly reverted receipt/Sentry implementations to `855a07a0` and search implementation to `4849b420^`, preserving new tests. The driver saved/restored current file bytes in `finally`. **8 failed, 10 passed** for the expected behaviors: four telemetry assertions, stale search overwrite, cleared search repopulation, ten-query overwrite, malformed search payload handling. No import/setup failures. Log: `/tmp/vh-safeguards-reverted.log`.
5. Restored fixes. Expanded `npm run test:regressions:client`: **14 suites, 151 tests passed**. Log: `/tmp/vh-safeguards-final-tests.log`. Both actual client and server TypeScript checks passed with exit 0.

The suites are now included in the existing client release regression command, not an optional parallel test runner.

## Interruption matrix and remaining evidence

| Case                                        | Automated evidence                                                                               | Still required before broader closure                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Verification fails without UI callback      | Receipt preserved; attempt increments; structured event asserted; sensitive provider text absent | Deployed event delivery and account-bound automatic recovery                                                                   |
| Server accepts receipt, local removal fails | Cleanup-stage event; saved receipt retained; subsequent verification/removal succeeds            | Actual concurrent server ledger/inventory replay and StoreKit interruption tests                                               |
| Five simultaneous local recovery flushes    | One mocked HTTP call, one queue removal                                                          | Five independent concurrent server submissions; this test is client coalescing only                                            |
| Partial receipt after restart               | Stored item preserved, not submitted, incomplete-bundle event emitted                            | Durable purchase intent, native transaction reconciliation, explicit continuation of unpaid parts                              |
| Ten rapid searches                          | Latest request wins after every delayed response; invalid payload captures schema context        | Device/network observation if required for release UX                                                                          |
| Video timeout/unmount                       | Existing tests cover preview deadline, ignored late completion and overlap prevention            | Native export cancellation and memory-baseline measurement; installed trim API has no cancellation primitive                   |
| Ingestion malformed payload/502             | Existing provider-envelope and rolling-worker tests remain separate evidence                     | Failure telemetry delivery, preserved valid state and freshness/season classification; no new chaos certification claimed here |
| Full database restore                       | Prior real 59-table restore matched contents; local write/FK/uniqueness probes passed            | Migration startup currently fails P3018; schema/baseline/RLS/index reconciliation remains open                                 |
| Native map / SharedObject crashes           | Fresh Sentry and installed-source evidence, mocked map regressions                               | Physical/native lifetime reproduction and candidate comparison; no simulator used                                              |

## Deployment and telemetry status

**Local implementation/tests verified; not published in this pass. Production delivery for these new events remains unverified.** A controlled deployed recovery failure must be retrieved from Sentry with its release/OTA and diagnostic case context before that gate can pass. Existing live telemetry is not proof for code still local.

No root-cause ticket covering native crashes, full recovery promotion, missing providers or automatic multi-part recovery is closed by this change. See [remaining investigation](../audits/2026-09-05/remaining-systems-investigation-2026-09-06.md).
