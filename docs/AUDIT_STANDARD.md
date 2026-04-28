# VarsityHub Audit Standard

> Reference for scheduled audits and for any review that triggers the word
> "audit." Not a PR checklist — see `PR_CHECKLIST.md` for per-PR mechanics.

## Purpose

Define how we audit this codebase for security, data-integrity, and
architectural risk in a way that is:

1. **Threat-model first, style second.** Audits must lead with trust
   boundaries and invariants. Style rules follow.
2. **Mechanically verifiable where possible.** Every finding should name a
   command, grep, or test that produces a pass/fail. Opinion is a fallback,
   not a default.
3. **Proof-bearing.** Findings without a reproducible path are conjecture and
   do not enter the fix queue.

The audits that found real bugs in this codebase followed these heuristics:
paired code must stay in lockstep (middleware drift); "keep on missing data"
filters are almost always wrong (map past-events); catch-all error handlers
hide real bugs (ad banner); inline type switches drift from shared helpers
(notification routing); server-side state transitions without a WHERE guard
race (event approval). Codify the pattern; don't rediscover it next time.

---

## Phase 1 — Map the system

Before looking for bugs, describe the system. Every audit begins by producing:

- **Flow diagram.** Client → API → database → async jobs → third parties.
  Every hop. If you can't draw it, you can't audit it.
- **Production-log sample for the reported failure.** Pull at least one real
  failing request from production logs before auditing route-level code. If
  production logs are unavailable, say so explicitly; do not substitute
  static code reading for runtime evidence.
- **Source-of-truth table.** For each critical state (auth, plan, approval,
  membership, payment, ownership), name the one layer that owns it. See the
  living table below; update it when it changes.
- **Trust boundaries.** User input, deep links, webhooks, background jobs,
  admin actions, third-party callbacks. Each boundary is a validation gate.
- **Invariants.** Statements that must always be true regardless of inputs.
  Example: "a user's subscription tier is the tier they last paid for, as
  confirmed by Stripe or Apple." These are what the audit tests.

## Phase 2 — Threat model

For every critical flow, walk every category below. If a category does not
apply, say so explicitly. Silence is not an answer.

- **Auth bypass** — can this action execute without a session?
- **Privilege escalation** — can a user perform an action above their role,
  plan, or ownership level?
- **IDOR** — can a user reference another user's resource by ID?
- **Payment spoofing** — can a user cause a paid-state transition without a
  verified payment provider event?
- **Webhook replay** — is the handler idempotent? Signature-verified?
  Deduplicated by provider event id?
- **Middleware / parser ordering** — does any gate read `req.body` or
  `req.query` before that data is populated for the route type? JSON routes
  get app-level parsing; multipart routes often do not until `multer` runs.
- **Stale cache** — does a mutation invalidate every cache that reads the
  mutated entity?
- **Deep-link abuse** — can a crafted link put the app in a bad state?
- **Concurrent-write race** — can two callers cause contradictory state?

Each category gets a one-line answer. If the answer is "mitigated by X," name
X and cite the file.

## Phase 3 — Drift checks

Compare authoritative layers against each other. Drift is where bugs live.

- **Frontend validation vs backend Zod vs database constraint.** Do they
  agree? Frontend strictly weaker than backend is correct; stricter is drift.
- **Sibling middlewares or handlers** that must stay in lockstep (e.g.,
  `requireVerified` and `requireOnboarded`). One updated without the other is
  the bug.
- **Endpoint-family parity.** If multiple endpoints perform the same
  conceptual state transition, verify the fix or invariant on every sibling
  before declaring the issue closed.
- **Shared utility vs inline duplicates.** Any inline duplicate of a shared
  helper is a drift candidate. Grep for the helper's call sites and confirm
  every caller uses it.
- **Client TypeScript types vs server response shape.** Missing fields on the
  client silently degrade; extra fields on the client mask missing server
  fields.
- **Documented policy vs enforced code.** If the README says "X is enforced"
  and no test or runtime check enforces X, that's drift.

## Phase 4 — Classification

Every finding is classified on three axes, not a single severity label.

| Axis           | Scale                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Exploitability | unauthenticated / any authenticated user / specific role                  |
| Blast radius   | one user / subset / all users / system-wide data integrity                |
| Recoverability | auto-heals / manual fix per user / manual fix system-wide / unrecoverable |

A CRITICAL finding is typically high on all three. A finding that affects all
users but auto-heals is different from one that affects one user but is
unrecoverable — conflating them under one severity hides the real risk.

## Phase 5 — Proof

Every finding must carry:

- Branch confirmation for the code being read. Run
  `git rev-parse --abbrev-ref HEAD` before reporting a finding and confirm it
  matches the branch production deploys from.
- File path(s) and line number(s)
- Reproduction: exact steps or `curl` invocation
- Expected vs actual behavior
- One-sentence fix strategy

Findings without proof are conjecture and do not enter the fix queue. This
rule exists because agent-based audits in particular over-report; reading the
actual file before accepting a finding is not optional.

## Phase 6 — Fix + verification

Every fix must ship with:

- **Regression test that fails against the pre-fix code.** If the test would
  pass before the fix too, it isn't a regression test.
- `npx tsc --noEmit` green on both server and client
- `npm run verify:guardrails` green
- `npm run test:regressions` green
- If the fix touches auth, payment, approval, or schema: before/after
  reproduction documented in the PR description
- If the fix touches schema: migration plan + rollback plan

---

## Source-of-truth table

These are the current authoritative layers. Code that contradicts this table
is wrong. Update this table when the architecture changes — it is meant to be
the single reference for "where does X live?"

| Domain                  | Source of truth                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| Authentication          | JWT validated in `server/src/middleware/auth.ts`                              |
| Email verification      | `User.email_verified`, enforced by `server/src/middleware/requireVerified.ts` |
| Onboarding status       | Canonical top-level `onboarding_completed`, mirrored into                     |
|                         | `preferences.onboarding_completed` for compatibility; enforced by             |
|                         | `requireOnboarded.ts`                                                         |
| Onboarding bypass       | Shared route list in both middlewares — must stay in lockstep                 |
| User role               | Canonical top-level `role`, with `preferences.role` accepted only as          |
|                         | compatibility fallback in shared helpers                                      |
| Subscription plan       | `subscription_*` columns, written only by Stripe/Apple webhook handlers       |
| Organization membership | `OrganizationMembership.status === 'active'` (not just row existence)         |
| Team membership         | `TeamMembership.status === 'active'` (not just row existence)                 |
| Approval status         | `approval_status` column, mutated only via `updateMany` + WHERE guard         |
|                         | inside `server/src/lib/approvalService.ts`                                    |
| Payment event processed | Persisted event-id dedup store, checked before side effects                   |
| Booking horizon         | `server/src/utils/bookingHorizon.ts` — single function, called by client      |
|                         | and server                                                                    |
| Notification routing    | `utils/notificationPresentation.ts` — shared by feed drawer + full screen     |
| User display label      | `utils/userDisplay.ts` `formatUserLabel`                                      |
| Upload error surface    | `utils/uploadErrorAlert.ts` `showUploadErrorAlert`                            |
| Post-event upload grace | `server/src/lib/geofencing.ts` — 2 days before / live / 48h after-if-live     |

## Known assumptions (deliberately accepted, not bugs)

These have been audited and explicitly accepted as product decisions. Do not
re-audit without new information.

- **App is US-only.** USD is hardcoded in payments.ts `formatUsd` and in
  Stripe `currency: 'usd'` calls. Ad-calendar UI uses `$` literals. Apple IAP
  uses `displayPrice` verbatim (correct). See `AUDIT_I18N_*.md` for the six
  locations to revisit if internationalization is ever in scope.
- **No client/server version negotiation.** Deploy discipline is "server
  first, OTA second." App Store binaries older than current `version` do not
  receive OTAs. Accepted at current scale. Adding a `/capabilities` endpoint
  - `X-App-Version` header is ~30 minutes of work if this becomes real pain.
- **Post soft-delete leaves orphaned comments/votes/bookmarks as storage
  debt.** Read paths already filter `deleted_at` at the join step, so
  orphans never reach the UI. Treated as nightly-cron work, not a user-facing
  bug.
- **User delete uses CASCADE plus manual `deleteMany` inside a
  `$transaction`.** Redundant but rollback-safe because the whole transaction
  rolls back on any failure. Not a bug.

## Audit cadence

- **Per-PR:** PR_CHECKLIST.md mechanical gates run every PR.
- **Per-release:** Source-of-truth table reviewed; any changed entry gets a
  paired regression test.
- **Quarterly:** Full threat-model walk of each critical flow. Findings
  captured with proof per Phase 5. Dismissals captured in "Known assumptions."
- **Triggered:** Any production incident triggers a focused audit of the flow
  that broke, following Phases 1–6.

## Related docs

- `PR_CHECKLIST.md` — mechanical checklist run on every PR.
- `AUDIT_SCORECARD.md` — reusable pass/fail sheet for each audit run.
- `AUDIT_I18N_*.md`, `AUDIT_VERSION_DRIFT_*.md` — accepted-assumption
  registers. Add a new one when you accept a new assumption.
