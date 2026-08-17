# VarsityHub Mobile — Security & Architecture Validation Audit

|                |                                                           |
| -------------- | --------------------------------------------------------- |
| **Repository** | VarsityHubMobile                                          |
| **Branch**     | `fix/wwe-events-on-map`                                   |
| **Date**       | 2026-08-11                                                |
| **Standard**   | Repo Security & Architecture Audit Standard (`CLAUDE.md`) |
| **Method**     | Read-based trace + static gates + curated invariant tests |
| **Auditor**    | Claude Code (Opus 4.8)                                    |

> **Verdict — posture: STRONG.** Zero P0/P1/P2 findings. One P3 consistency
> finding (systemic, non-security). 199 invariant tests + 5 static gates green.

Hosted report (private artifact): <https://claude.ai/code/artifact/2db40dbf-faa5-48f4-af78-42ea80356ffc>

---

## Scorecard

| Severity / metric | Value   |
| ----------------- | ------- |
| P0 · Critical     | 0       |
| P1 · High         | 0       |
| P2 · Medium       | 0       |
| P3 · Low          | 1       |
| Invariant tests   | 199 ✓   |
| Static gates      | 5 / 5 ✓ |

---

## §1 · Scope & method

Followed the repo's own Security & Architecture Validation methodology: map each
system, trace the real data flow (client → API → middleware → handler → DB →
response → client state), enumerate gate points, then check for validation
drift, IDOR, replay, and silent security-posture fallbacks.

**Systems examined**

- **Auth** — registration, username/password validation parity, session refresh, the adult↔minor DM gate.
- **Payments** — promo redemption, the Stripe webhook pipeline, and the full ad-checkout flow across all three rails (§5).
- **Teams & Orgs** — invite middleware chains, follows, the sample-seed endpoint, org screen-summary reads.
- **Newer / less-covered surfaces** — `programs`, `shareLanding`, `promos`, `rsvps`, `follows`, and the uncommitted working-tree diff on this branch.

**Guiding principle.** Where the security-critical borders have already been
hardened across prior rounds, the correct result is to _confirm and not
manufacture findings_. Every "verified" row below cites a specific
`file:line` control or a passing invariant test.

**What was actually run** (distinguishing executed verification from read-based tracing):

- Executed: `test:regressions` (client 120 ✓, server 79 ✓), `unbounded-queries` (1 ✓), `verify:error-envelope`, `audit:navigation:fail` (exit 0), `verify:secrets`.
- Not run this pass: full server Jest suite, `tsc --noEmit` (client + server). Available as a deeper pre-release gate.

---

## §2 · Trust-boundary checks

| Boundary / threat            | Control (where it lives)                                                                                            | Result           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Validation drift — username  | Client `USERNAME_REGEX` `utils/formUtils.ts:125` == server `auth.ts:2860 / 3453`. Both `/^[a-z0-9_.]+$/`, len 3–20. | ✅ Exact match   |
| Validation drift — password  | Server `min(8)` + letter&digit refine `auth.ts:591`; client mirrors as UX.                                          | ✅ Parity        |
| Predictable code generation  | All token/code gen uses `crypto.random*`; handoff code `crypto.randomInt` `publicAppHandoff.ts:331`.                | ✅ Secure RNG    |
| Promo reuse / free-burn      | `/redeem` is preview-only; uses-increment happens server-side in the webhook `promos.ts:60`.                        | ✅ Guarded       |
| IDOR — self-scoped reads     | RSVPs `rsvps.ts:32` & follows `follows.ts:23` pin to `req.user.id` unless verified admin.                           | ✅ Scoped        |
| Hardcoded approval on writes | Only in `/seed-samples`, gated by `requireAdmin` `games.ts:2064`. Other hits are read filters.                      | ✅ Admin-only    |
| Minor-protection DM gate     | Block check + accepted-follow requirement + fail-closed `isMinor`/`isVerifiedAdult` `messages.ts:288–325`.          | ✅ Fail-closed   |
| Public share-landing leak    | Deleted / private / pending / cancelled all fall back to a generic landing `shareLanding.ts:246`.                   | ✅ Mirrors gates |
| Webhook replay / idempotency | Event-level dedup keyed on `event.id`, fail-closed for retry `payments.ts:262`.                                     | ✅ Idempotent    |
| Thin routes / direct fetch   | No screen calls global `fetch` (the one hit is a local function).                                                   | ✅ Clean         |

---

## §3 · Findings

One low-severity, non-security observation. Nothing at P0–P2. Ranked by
exploitability × blast radius × recoverability.

### VH-A-01 · P3 · Low · consistency

**Raw error responses bypass the error envelope in ~479 pre-existing call sites.**

Across **18 route files**, roughly **479 handlers** (single-line; more counting
multi-line) return `res.status(…).json({ error })` directly instead of the
standard envelope via `sendError()`. Concentration:

| File               | Raw hits (single-line, excl. exempt) |
| ------------------ | ------------------------------------ |
| `payments.ts`      | 86                                   |
| `organizations.ts` | 58                                   |
| `posts.ts`         | 53                                   |
| `auth.ts`          | 50                                   |
| `teams.ts`         | 41                                   |
| `users.ts`         | 33                                   |
| `ads.ts`           | 29                                   |
| `events.ts`        | 25                                   |
| `uploads.ts`       | 23                                   |
| … 9 more files     | ~81                                  |

18 sites are deliberately annotated `// error-envelope-exempt` (e.g. sanitized
payment messages).

- **Impact** — Response-shape inconsistency only. No security, correctness, or data effect. Clients reading `error` still function. Stays P3.
- **Why not caught** — The `verify:error-envelope` gate is _diff-scoped by design_: it enforces the envelope on new/changed code only, so the ~479 pre-existing sites are permitted and the gate reports "no server changes."
- **Caution** — Not a mechanical sweep. Many sites carry custom fields (`details`, `dates`, `appleStatus`, `current_status`, `fieldErrors`) that `sendError` (`{ code, details, message }`) only partly passes through, and these files auto-deploy to prod on push to `main`. A blind rewrite risks changing response contracts.
- **Recommendation** — Treat as a scoped, incremental, contract-preserving refactor (per-file PRs, starting with simple `{ error }` shapes) — or accept the forward-only enforcement and leave it. Non-blocking either way.

> **Correction note.** An earlier draft of this report characterized this as
> "a handful" of routes. On enumeration the true scope is ~479 sites; the
> finding text above reflects the corrected scope.

### Verified correct — do not re-flag

| Area                            | Verified property                                                                                                                        | Status  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Working-tree diff (this branch) | `no-store, private` + `Vary: Authorization` added to authenticated GETs on messages / notifications / posts — correct privacy hardening. | ✅ Safe |
| Seed endpoint                   | `/seed-samples` auto-approve is admin-gated & idempotent — not a `deriveGameApproval` bypass.                                            | ✅ OK   |
| `.some()` authorization smell   | All hits are extension / array checks, not per-row auth shortcuts.                                                                       | ✅ OK   |
| Response schema validators      | `api/schemas/*` report drift to Sentry without throwing on non-auth reads; auth throws closed.                                           | ✅ OK   |

---

## §4 · Objective verification

| Gate                                    | Command                   | Result                   |
| --------------------------------------- | ------------------------- | ------------------------ |
| Regression battery — client             | `test:regressions:client` | ✅ 10 suites · 120 tests |
| Regression battery — server             | `test:regressions:server` | ✅ 9 suites · 79 tests   |
| Unbounded `findMany` guard              | `unbounded-queries`       | ✅ 1 · all bounded       |
| Error-envelope (diff-scoped)            | `verify:error-envelope`   | ✅ No violations         |
| Navigation dead-ends + `router.replace` | `audit:navigation:fail`   | ✅ 0 REVIEW · exit 0     |
| Secret-literal scan                     | `verify:secrets`          | ✅ Passed                |

The battery objectively confirms: full auth-chain coverage on every critical
mutation route; the coach-create onboarding bypass stays scoped; games / ads /
invites use pending-only `updateMany` guards returning 409 on races; Apple
receipts dedupe without replaying side effects; caches invalidate on mutation
and approved-games reads are viewer-scoped.

---

## §5 · Deep trace — ad checkout, end to end

Ads use **Apple IAP on iOS** and **Stripe on Android + web**; all rails converge
on the same DB state (`Ad.payment_status`, `AdReservation`). No expected-vs-actual
divergence was found.

| Rail    | Entry endpoint                                              | Where                 |
| ------- | ----------------------------------------------------------- | --------------------- |
| web     | `POST /payments/checkout` → hosted Stripe Checkout `url`    | `ad-calendar.tsx:658` |
| iOS     | `POST /payments/apple/verify-ad-receipt` (JWS receipts)     | `ad-calendar.tsx:725` |
| Android | `POST /payments/create-payment-sheet` (Stripe PaymentSheet) | `ad-calendar.tsx:767` |

**Data flow (Android/web rail):**

| #   | Seam                               | Where                           | Data in → out                                                                                                                               |
| --- | ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Book" tap                         | `ad-calendar.tsx:647`           | selected dates → sorted `dates[]`. Client 56-day guard is UX-only.                                                                          |
| 2   | Middleware                         | `payments.ts:1954 / 3868`       | `requireAuth` + `paymentLimiter` + Zod + `enforceVerifiedForAdPaymentFlow`.                                                                 |
| 3   | Server-authoritative quote         | `buildAdQuote payments.ts:1159` | **IDOR** `ad.user_id !== userId → 403`; **56-day horizon**; no past dates; price via `calculateAdPriceCents` (client amount ignored).       |
| 4   | Approval + slot gate               | `payments.ts:2209 / 2217`       | Ad must be approved/active/archived; per-zip `MAX_AD_SLOTS=2` → 409 if full.                                                                |
| 5   | PaymentIntent → fatal hold         | `payments.ts:2325 → 2353`       | Create PI (idempotency-keyed) → `reserveAdSlots(hold)` in a Serializable tx. **Hold failure cancels the PI and 409s** — no partial booking. |
| 6   | Present sheet                      | `ad-calendar.tsx:857`           | On cancel/error → `POST /payments/cancel-intent` releases the hold.                                                                         |
| 7   | Webhook finalize                   | `payments.ts:262 → 145`         | Event dedup → `activateApprovedAdPaymentIntent`: guarded `updateMany → paid/active` + `createMany` reservations (`skipDuplicates`).         |
| 8   | Confirmation (verify, don't trust) | `ad-confirmation.tsx:87`        | Polls `Advertisement.get` ×10/3s for server `payment_status === 'paid'`; nav params are display-only.                                       |

**iOS Apple IAP path — independent re-verification** (`payments.ts:3865`):

- Rejects legacy (non-JWS) receipts in production; JWS signature verified via `verifyAppleSignedJws` (cert chain pinned to `Apple Root CA - G3`).
- Re-enforces the 56-day horizon and the `ad.user_id` ownership guard independently.
- Underpay guard: `verifiedCents < expectedPricing.totalCents → 400`.
- Replay-proof: unique constraint on `apple_transaction_id` → 409 `APPLE_TRANSACTION_ALREADY_CLAIMED`.

**Invariants held at every seam:** server-authoritative pricing (client amount
never trusted) · IDOR ownership on quote and Apple paths · 56-day horizon
enforced on both rails · fatal holds with PI cancellation (no partial bookings)
· idempotency via PI key, webhook `event.id`, and Apple tx-id uniqueness ·
confirmation verifies backend state with retries. **No fix required.**

---

## §6 · Conclusion

The three major systems and the newer surfaces are hardened, and the documented
invariants are enforced in code and test-verified. The recurring failure pattern
the standard warns about — a sibling write path bypassing a single-path pipeline
without re-implementing its checks — did not appear in any surface traced this
pass.

**Disposition**

- **Ship as-is.** No code change is required by this audit.
- **Optional P3 refactor.** The error-envelope gap is systemic (~479 sites), not a quick win — treat as a scoped, contract-preserving, per-file effort, or accept the forward-only enforcement.
- **Deeper gate available on request.** Full server Jest suite + fresh client/server `tsc --noEmit`.

**Net verdict: security & architecture posture is strong.** Zero P0/P1/P2
findings; one P3 consistency finding; 199 invariant tests and 5 static gates green.

---

### Verification disclosure

Executed this pass: `test:regressions` (client 120 ✓, server 79 ✓),
`unbounded-queries` (1 ✓), `verify:error-envelope`, `audit:navigation:fail`
(exit 0), `verify:secrets`. All other assertions are read-based traces with a
cited `file:line` control. Not executed: full server Jest suite,
`tsc --noEmit`. All `file:line` references reflect the working tree on branch
`fix/wwe-events-on-map` as of 2026-08-11.
