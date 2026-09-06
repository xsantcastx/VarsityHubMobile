# Forensic systems audit — September 6, 2026

Implementation follow-up: see [repair and release record](../../release/FORENSIC_REPAIRS_2026-09-06.md). The findings below describe the pre-fix revision; they are retained as investigation evidence.

Audited working revision: 31f3a8ed. Audit only; no product fixes or deployment in this pass. No simulator, purchases, production writes, or destructive recovery operations. This is a targeted investigation, not whole-app certification.

## Confirmed findings and root-cause remedies

### Payment receipt recovery can lose a concurrently queued receipt

`hooks/useAdIAP.ts:121`: flush reads a snapshot, submits it, then replaces storage with its remaining entries. Enqueue is a separate read/modify/write operation. A shared flush promise serializes flushes but does not serialize enqueue with flush completion.

Executed the actual queue helper source, extracted and transpiled with TypeScript, in a Node VM with in-memory AsyncStorage and a deferred HTTP call. Seed A; pause A's HTTP request; enqueue B; resolve A. Observed storage `[A,B]` before completion, then `null`. B was never submitted. This proves a client queue race, not an observed production lost purchase.

Related existing finding: consumable finishTransaction precedes server activation; recovery storage errors are swallowed and recovery enqueue is launched without awaiting it. A force-kill can fall between those operations.

Remedy: durably journal receipt/purchase association before acknowledging consumption; serialize storage mutations and merge completion against current storage by receipt identity. Never hold the storage lock across network requests. Retain failures with actionable recovery status. Test process interruption, rejected storage, concurrent enqueue/flush, duplicate callbacks, and restart recovery.

### Backup refresh does not preserve the last complete backup on failure

`server/src/lib/dbBackupSync.ts:219`: backup TRUNCATE runs before the read transaction. Backup inserts and deferred-FK updates use the standalone backup client, not a backup transaction. A failed batch leaves earlier backup writes committed, while the previous backup has already been cleared. Per-table failures are reported, but reporting does not restore the prior backup.

Primary reads correctly use RepeatableRead. Foreign keys remain enforced. These safeguards prevent some inconsistencies but do not make replacement atomic.

Schema mismatch also filters missing columns out of the copy (`:232`, `:248`); this may report successful table copying despite lost fields. Sequence errors are swallowed. These are source-confirmed paths; no destructive database reproduction was run.

Remedy: validate complete schema before touching the prior backup, build a new complete generation from one snapshot, validate constraints/content/sequences, then promote atomically. Retain the prior generation on failure. Prove recovery in an isolated database with injected middle-table and deferred-FK failures. Count-based freshness alone is not a restore test; see the companion resilience audit for demonstrated false positives.

### Ingestion cannot distinguish an invalid envelope from an empty schedule

`server/src/lib/proSchedule/espnAdapter.ts:324`: missing or non-array `events` returns `[]`, as does a valid empty schedule. Executed the actual extracted parser against `{events:[]}`, `{renamed_events:[]}`, and `{events:null}`; all returned `[]` without an error. The fetch path passes HTTP-success JSON directly to this parser. Individual malformed dates can also be skipped.

Remedy: validate provider envelopes and required event fields; record received/accepted/rejected counts with reasons. Valid empty results require coverage/freshness context, not an unconditional outage alarm. Monitor expected schedule windows and last successful ingestion separately. MLS NEXT and MLS NEXT Pro coverage remain separate integration gaps; parser hardening does not create a provider.

### Search and media findings remain open

The companion resilience report and `__tests__/organization-search-races.test.ts` (promoted from the audit-only reproduction) document organization-search stale responses, repopulation after clear, and malformed payloads presented as empty success. Those desired-behavior tests were run previously and failed. Use request-generation invalidation and the existing query architecture; render the error state in the caller.

`components/VideoTrimmer.tsx` clears initial loading on ready with positive duration, without a corresponding error/zero-duration deadline. Thumbnail work lacks a source-generation guard. Introduce explicit terminal states, bounded waits, and source-scoped completion checks; native cancellation must use supported APIs. A JS timeout alone does not cancel native work. Native leaks and the reported native crashes remain unproven; this audit did not reproduce them.

## Safeguards verified by source inspection

- Subscription `hooks/useIAP.ts` awaits server verification before finishTransaction; do not generalize the ad ordering defect to subscriptions.
- Apple ad fulfillment uses unique `AppleTransactionClaim.apple_transaction_id` and a Serializable transaction encompassing claims, inventory, and completion ledger (`server/src/lib/paymentInternals.ts`). No double-fulfillment reproduction was established. Five-concurrent-request database tests remain required before claiming concurrency certification.
- Stripe webhook handling uses a distributed event lock and returns 503 on unresolved lock failure; `ProcessedStripeEvent.event_id` is unique.
- AuthProvider clears persisted/in-memory React Query cache on logout and session expiry. Missing viewer IDs in some query keys alone are insufficient proof of cross-account leakage. Account-transition race testing remains outstanding.

## Verification limits and implementation order

New executed probes: queue interleaving and three parser envelopes, using real extracted functions with controlled dependencies. No new full-suite/typecheck claim; no database concurrency or restore drill performed. Earlier focused tests do not establish native stability.

Priority: payment receipt durability and backup preservation; search correctness and provider contract validation; media lifetimes and native instrumentation. Each fix needs a failing-before/passing-after regression, then required release gates. Server contract changes deploy before dependent client OTA. Native library changes require a native build. Do not close incidents solely because JavaScript tests pass.
