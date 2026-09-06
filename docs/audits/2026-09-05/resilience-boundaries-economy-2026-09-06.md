# Resilience, data boundaries and code economy audit

Source baseline: `31f3a8ed`. This is an audit, not a repair release. No simulator,
production writes, purchases, or notifications were used. Existing connection
audit findings remain separate. No whole-codebase all-clear is claimed.

Risk model: prioritize lost payment-recovery evidence and misleading disaster
recovery assurance, then wrong/stale user-visible data and stuck authoring UI.
The searches below establish client state bugs, not an authorization bypass.
No server role, ownership, payment verification, or geofence rule was changed.

## Confirmed findings

### 1. Backup verifier can falsely reassure an operator — high recovery impact

`server/src/lib/backupFreshness.ts:49` sums row counts across tables and applies
one aggregate deficit threshold. It does not compare row identities, contents,
last successful backup time or a restored database.

Two executions of the actual exported `evaluateFreshness` function reproduced:

| Synthetic input                                   | Actual verdict                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| User 100 primary / 0 backup; Post 10,000 / 10,000 | `ok: true`, only 0.99% aggregate drift despite an empty User backup table |
| User 100 / 0; Post 100 / 200                      | `ok: true`, “Backup byte-for-byte current with the primary — 0 row drift” |

Surplus rows in one table mask deficits in another. Equal counts cannot prove
byte equality. Existing tests even assert that overstrong success wording.
The earlier live check established reachability and close counts, **not** a
restorable or byte-identical backup; no actual production loss is asserted.

Repair: separate per-table completeness, observed sync age, count drift and
restore verification. Do not offset missing rows with unrelated surplus rows;
reserve restore claims for an actual isolated restore drill.

### 2. Ad receipt retry persistence suppresses failure — high recovery risk

`hooks/useAdIAP.ts:95` catches and discards AsyncStorage write/removal errors.
`enqueuePendingAdVerification` awaits that helper as if it persisted the item.
The purchase callback finishes a consumable store transaction at line 218,
before server activation/recovery persistence later in the flow. Retry data is
initially held in memory.

A controlled probe executed the actual helper with AsyncStorage.setItem rejecting:
the helper resolved successfully despite nothing being saved. The caller can
therefore promise a retry without durable retry evidence. Combined with network
failure and app termination this creates a recovery gap. This is a code-path
risk, **not** proof that a real customer lost a purchase or of store behavior
under every failure mode. No store transaction was initiated.

Repair: report and propagate persistence failure, establish durable verified
recovery state before finishing consumable processing, and test network failure

- storage failure + restart without weakening server receipt verification.

### 3. Organization searches race and ignore clear — reproduced UI bug

`hooks/useOrganizationSearch.ts:34` clears the visible array but does not
invalidate in-flight requests. Its `search` method applies every result and
every finally block without a request identity or cancellation check.

Three audit-only desired-behavior tests in
`__tests__/organization-search-races.test.ts` were run against the real hook
using controlled API promises. **All three failed on current code**:

- Start A, start B, finish B then A: A overwrites B.
- Start A, clear results, finish A: results reappear.
- Return `{ unexpected_schema: true }`: `error` remains null and results become [].

The hook is used by `app/onboarding/step-3-league.tsx:145`. Its caller also does
not consume the hook's `error`, while showing “No organizations found for that
search” for an empty result at line 1272. Network failures and real empty results
can therefore look the same to the person onboarding.

Repair: use a query key/request identity covering the search parameters; ensure
clear invalidates the current request. Parse the response contract and display
the actual error state. Reuse the existing query client, not a second cache.

### 4. Video player load failures leave the trimmer loading — reproduced handler gap

`components/VideoTrimmer.tsx:204` handles only `readyToPlay` with positive
duration. Loading starts true; only thumbnail completion/failure clears it.
There is no player `error` handling or readiness timeout in this component.

A probe extracted the actual statusChange callback through the TypeScript AST
and invoked it with (a) error status and (b) ready status with zero duration.
Both left loading true and made zero calls to this component's failure reporter.
The filmstrip's spinner therefore has no exit path if that is the final state.
This is a JS state/handler reproduction, not a native decoder or Sentry 4A repro.

Related source-level risks needing additional tests: pending thumbnail work has
no request-generation guard; durationRef/thumbnails/applied range are not reset
when `uri` changes. The three current callers do not key VideoTrimmer by URI.
Do not label this a demonstrated memory leak; stale-result handling is the
established concern, and actual source-replacement flows need testing.

Repair: explicit loading/error/ready states, bounded readiness handling, and
per-source guards for asynchronous thumbnail/trim completion.

## Code economy

Inventory scanned 2,141 files under the selected product/script/doc roots.
Largest production modules by lines (line count is not cyclomatic complexity):

| File                                   | Lines |
| -------------------------------------- | ----: |
| server/src/routes/payments.ts          | 4,611 |
| app/game-details/GameDetailsScreen.tsx | 4,585 |
| server/src/routes/auth.ts              | 4,148 |
| app/(tabs)/team-contacts.tsx           | 3,563 |
| server/src/routes/organizations.ts     | 3,529 |
| server/src/routes/games.ts             | 3,455 |
| server/src/routes/teams.ts             | 3,270 |
| app/feed.tsx                           | 3,239 |

These are **Refactor Later**, not delete candidates. Extract domain operations
from server routes, and extract media-authoring/state sections from screens in
small behavior-preserving batches. Preserve the canonical post mapper parity,
auth/payment invariants, and existing query client. Do not equate shorter code
with safer logic.

Unused queue helpers from the connection audit are consolidation candidates,
but their runbook/monitor references must be reconciled before removal. Existing
audit documents and migrations are kept. No cleanup deletion was performed.

## Verification and limits

- Real organization hook: three deliberately red desired-behavior repros.
- Real backup verdict function: two false-success counterexamples.
- Actual trimmer callback: two unhandled readiness states.
- Actual retry persistence helper: rejected storage write swallowed.
- Source/caller tracing and file-size inventory; no native execution.
- No product code changed, so no new client/server typecheck or release pass is
  claimed for this audit. Earlier release tests do not cover these new cases.

The audit-only test lives outside the normal Jest roots. To run it, use the
repository Jest configuration with rootDir set to the repository, roots set to
`scripts/diagnostics`, and testMatch set to `**/logic-audit.repro.test.ts`.
It should turn green only after the corresponding search fixes.

Implementation follow-up: [repair and release record](../../release/FORENSIC_REPAIRS_2026-09-06.md). Audit reproduction tests were promoted into the normal test suite. Historical failing results above refer to the audited revision.
