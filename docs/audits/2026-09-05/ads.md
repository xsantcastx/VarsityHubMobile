# Ads and payment trust-boundary audit — 2026-09-05

The September 1 matrix's ads/payment closure is too broad for the current code. Seven concrete open bugs were found; six were reproduced by observing actual incorrect state/control flow, and one expected-behavior test fails (invalid dates produce 500 instead of 400). Existing baseline tests still pass many important security contracts, but one existing structural assertion is stale/failing. No product source was changed.

Audited tracked source: `ec27781e3d6cd9688064bb20bab30babd33fd00c`. `git status --short` was clean initially. Parent agent owns remote/deployed-build freshness verification. This report does not claim a production build/device/provider sign-off.

## Method and environment

Read AGENTS.md, the `varsityhub-matrix-audit` skill, the user's attached comprehensive architecture audit methodology, `docs/END_TO_END_FLOW_MATRIX_AUDIT_2026-09-01.md`, and relevant consolidated findings/backlog. Threat-model phase covered unauthenticated access, cross-owner IDOR, forged payment/approval/price fields, moderation authority, provider-event forgery/replay, stale entitlement events, inventory overbooking, checkout interruption, and malformed deep-link/payment input. The source of truth for payment/approval is the API/database plus authenticated provider events.

Local PostgreSQL was explicitly isolated at `postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_20260905_ads`, created by parent with current Prisma schema (`db push`, not a migration replay). Commands cleared inherited environment and used `VARSITYHUB_ENV_PATH=/dev/null`; no production DB/provider credentials were loaded. Email/Stripe SDKs had no usable provider credentials; no real checkout/charge/refund/provider sandbox was requested. Real JWT middleware and HTTP routes were used where described. Stripe webhook tests use a locally generated valid HMAC signature and actual local PostgreSQL; the outage scenario injects one transaction failure.

Four added `audit-*2026-09-05.test.ts` files are forensic reproduction harnesses, not fixes. Tests labeled BUG intentionally assert the observed incorrect behavior to preserve proof. The malformed-date assertion instead specifies expected 400 and remains red. These artifacts must not be interpreted as green product acceptance tests.

## Open bugs and proof

### ADS-01 — Paid advertiser bypasses full-ZIP capacity by editing targeting (P1)

Expected: changing a paid campaign's ZIP either preserves its purchased targeting or checks/reserves capacity transactionally for every existing reserved date before changing targeting. Actual: `PUT /ads/:id` accepts a new ZIP and keeps `active/paid`; reservations are unchanged and now count against the new ZIP without a capacity check.

Proof: seed two paid campaigns for tomorrow in 10002 (the current two-slot cap), then one paid campaign in 10001. The real `getFullAdSlotDates` confirms 10002 is full. Authenticated owner PUT `{target_zip_code:'10002'}` returns 200; SQL count becomes **three paid reservations in the destination ZIP**. The HTTP mocked-Prisma harness separately confirms no inventory/reservation lookup is made on this path.

Source: [ads.ts:742](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/ads.ts:742), [ads.ts:768](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/ads.ts:768), [paymentInternals.ts:598](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/paymentInternals.ts:598). Repro: [audit-ads-db-repro-2026-09-05.test.ts:82](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-ads-db-repro-2026-09-05.test.ts:82).

Exploitability × blast radius × recoverability: any paid advertiser can send this owner-authorized request; affects shared inventory and other advertisers in one ZIP/date; requires retargeting/capacity repair. Fix strategy: reuse the existing slot-cap helper inside a serializable targeting mutation or lock targeting while purchased reservations exist.

### ADS-02 — “Run Again” can erase dates already paid for (P1)

Expected: buying additional dates must preserve existing paid dates while the new payment is pending/cancelled. Actual: both Stripe checkout paths accept an `active` campaign and call `reserveAdSlots(...paymentStatus:'hold')`, which overwrites the entire ad's payment state. The feed serves only `active/paid`, so current purchased inventory disappears while checkout is pending. Expiry deletes all reservations for that ad, including the previous paid purchase.

Proof: real local DB fixture has one future paid date; invoke the real shared checkout-reservation helper inside a serializable transaction with a second date. State becomes `active/hold`, two reservations remain, serving eligibility is zero. Age the hold two hours and execute the actual registered lifecycle callback (only scheduling is mocked): state becomes `active/unpaid`, **reservations=[]**. The cron runs daily; an old hold is cleaned on its next sweep, not exactly at the one-hour point.

Source: [ad-calendar.tsx:1792](/Users/varsityhub/Code/VarsityHubMobile/app/ad-calendar.tsx:1792) advertises new dates; [payments.ts:1609](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:1609) permits active campaigns; [paymentInternals.ts:636](/Users/varsityhub/Code/VarsityHubMobile/server/src/lib/paymentInternals.ts:636) overwrites payment state; [ads.ts:492](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/ads.ts:492) requires paid to serve; [overnightTasks.ts:245](/Users/varsityhub/Code/VarsityHubMobile/server/src/cron/overnightTasks.ts:245) removes all held-ad reservations.

Exploitability × blast radius × recoverability: normal advertised UI sequence, no adversary required; one advertiser's existing purchased campaign; deleted reservations require reconstruction from purchase logs. Fix strategy: represent pending purchase inventory separately from previously paid reservation inventory; release only the failed purchase's holds. A narrowly scoped immediate mitigation could forbid additional-date checkout on active paid campaigns until preservation is implemented.

### PAY-01 — Refund for an older purchase downgrades a newer subscription (P1)

Expected: refunding an old Stripe transaction must not revoke a different current subscription entitlement. Actual: the charge-refund branch finds an old transaction by PaymentIntent, then blindly downgrades its user to Rookie using only `user_id`. It does not compare the transaction subscription/provider with the user's current subscription identity.

Proof: a user has current Legend entitlements with `subscription_id:'sub_new_current'` and current Apple entitlement metadata; an older transaction refers to `sub_old_retired`. A locally signed `charge.refunded` HTTP webhook for the old PaymentIntent returns 200, sets `plan=rookie`, `subscription_status=canceled`, and leaves current Apple metadata behind. This directly violates the repo's old-subscription event invariant. The fixture proves stale purchase handling; it is not a real store-to-store migration test.

Source: [payments.ts:575](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:575). Repro: [audit-stripe-refund-repro-2026-09-05.test.ts:104](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-stripe-refund-repro-2026-09-05.test.ts:104).

Exploitability × blast radius × recoverability: requires an authentic provider refund/dispute event for an old payment; affects the account's current paid entitlement and resource limits; manual entitlement restoration. Fix strategy: share the current-subscription identity guard across refund/dispute/deletion/update events; record refund accounting regardless, but revoke only the matching entitlement.

### PAY-02 — Refund transaction failures are acknowledged permanently (P1)

Expected: a failed refund accounting/entitlement transaction must leave the event retryable and return non-2xx. Actual: the refund branch catches and captures its error, then falls through to `markStripeEventProcessed` and HTTP 200.

Proof: valid locally signed refund webhook + real event/transaction rows, with `$transaction` failing once. Response is **200**, event row has **processed=true**, original transaction remains **COMPLETED**. Retries of that event are deduplicated despite business work never completing.

Source: [payments.ts:641](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:641), [payments.ts:1022](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:1022). Repro: [audit-stripe-refund-repro-2026-09-05.test.ts:115](/Users/varsityhub/Code/VarsityHubMobile/server/src/__tests__/audit-stripe-refund-repro-2026-09-05.test.ts:115).

Exploitability × blast radius × recoverability: transient DB fault is sufficient; refund/accounting/entitlement state for affected events; requires explicit replay/reconciliation because automatic retry is lost. Fix strategy: rethrow or return the shared failed/retryable webhook response from the inner catch and mark processed only after a committed transaction.

### ADS-03 — Web fully complimentary purchase shows failure after successful activation (P2)

Expected: `{free:true}` from `/payments/checkout` should lead to confirmation. Actual: web handler requires `data.url`, throws “Unable to start web checkout,” and remains on the payment screen. Android handles `data.free` later in its separate branch.

Proof: extracted the **actual** `handlePayment` arrow using TypeScript AST, transpiled and executed it with provider/UI boundaries mocked. A web response `{free:true}` triggers the error alert and never navigates to confirmation. This is handler execution, not a mounted browser test.

Source: [ad-calendar.tsx:654](/Users/varsityhub/Code/VarsityHubMobile/app/ad-calendar.tsx:654), [payments.ts:1247](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:1247). Fix strategy: use shared complimentary-success handling before platform-specific URL/PaymentSheet processing. Scope: any web customer with a fully complimentary promo; refresh can show the successful booking, but the misleading failure invites retries.

### ADS-04 — Apple ad purchase incorrectly depends on Stripe configuration (P2)

Expected: Apple IAP checkout should depend on Apple configuration/availability. Actual: the native handler requires a valid Stripe publishable key before it reaches the iOS Apple purchase branch. Missing build-time key plus missing/unavailable server key stops Apple checkout.

Proof: executed actual handler with `Platform.OS='ios'`, empty build/server Stripe keys, and an available Apple purchase stub. It fetches Stripe config and displays “Payments Not Ready”; Apple purchase is never called. This is a conditional configuration fault, not evidence that production Stripe configuration is currently absent and not evidence of an iOS Stripe charge/link.

Source: [ad-calendar.tsx:689](/Users/varsityhub/Code/VarsityHubMobile/app/ad-calendar.tsx:689), [ad-calendar.tsx:719](/Users/varsityhub/Code/VarsityHubMobile/app/ad-calendar.tsx:719). Fix strategy: move Stripe key handling exclusively into the Android Stripe branch. Scope: iOS ad checkout while Stripe configuration is missing; client update required.

### ADS-05 — Malformed ad dates cause an internal server error (P3)

Expected: `POST /payments/ad-quote` with `dates:['not-a-date']` returns 400 validation error. Actual: real authenticated HTTP returns 500. Zod accepts any string and pricing calls `toISOString` on Invalid Date. The same shared quote builder serves checkout paths, but only the quote endpoint was exercised with this input.

Source: [payments.ts:1048](/Users/varsityhub/Code/VarsityHubMobile/server/src/routes/payments.ts:1048), [adPricing.ts:30](/Users/varsityhub/Code/VarsityHubMobile/server/src/utils/adPricing.ts:30). Fix strategy: share strict real-calendar YYYY-MM-DD validation across quote, Stripe checkout, and Apple date input before pricing. Scope: malformed authenticated request; no charge/state mutation observed.

## Scenario matrix / reconciliation

| Scenario                                                                                           | Current classification and evidence                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated edit; another fan reading/editing/deleting someone else's ad; foreign reservations | Closed for exercised HTTP contracts: 401/403, no write; mocked Prisma, real Express owner/ID checks.                                                                                                                                                                                                                                                      |
| Owner tries to set `payment_status=paid`, `status=active`, or foreign `user_id`                    | Closed for update route: protected fields stripped, persisted state remains unchanged in live-router test.                                                                                                                                                                                                                                                |
| Paid business-name edit                                                                            | Closed for exercised route: moves to pending review while preserving paid status.                                                                                                                                                                                                                                                                         |
| Rookie fan ad pricing; client-forged zero amount                                                   | Closed: real JWT/HTTP/DB yields nonzero server-derived quote. Ads are deliberately available without paid-plan or onboarding gates; old paid-coach-only matrix claims are stale policy claims.                                                                                                                                                            |
| Today/future booking; 56-day horizon                                                               | Closed for tested quote boundaries: day56=200, yesterday/day57=400; duplicate dates priced once. Invalid-date parsing remains ADS-05.                                                                                                                                                                                                                     |
| Foreign ad quote                                                                                   | Closed: 403 with real HTTP/database.                                                                                                                                                                                                                                                                                                                      |
| Ad approval email and dashboard authority                                                          | 24 existing HTTP/DB tests pass: non-admin dashboard review denied, unverified dashboard admin denied, verified admin accepted, signed token GET confirmation versus POST mutation, replay token burned, moderation override reason, rate limit. Email token is deliberately a scoped bearer capability; it does not give global founder admin access.     |
| Local ad serving and capacity                                                                      | 4 existing real HTTP/DB tests pass: 9 km radius, no location returns no ads, feed-bundle geofence parity, exact ZIP capacity. ZIP retarget bypass remains ADS-01.                                                                                                                                                                                         |
| Impressions/clicks                                                                                 | 2 existing HTTP/DB tests pass: active paid tracked; inactive/unpaid rejected.                                                                                                                                                                                                                                                                             |
| Membership/ad finalization, pending Apple replay, receipt ownership claims                         | 11 existing actual-DB tests pass; provider payment verification is not exercised. Apple same-user retry idempotent; cross-purchase receipt replay rejected; SLOT_FULL rollback releases receipt claim.                                                                                                                                                    |
| Invalid Stripe webhook signatures                                                                  | 3 actual HTTP tests pass: missing/tampered signature=400; missing secret=500. Valid-signature outage and stale-refund paths remain PAY-01/PAY-02.                                                                                                                                                                                                         |
| Google unsafe fallback                                                                             | 7 pure helper tests pass, production flag forced off. Google expiry/provider runtime covered only by parent/broader suite where reported.                                                                                                                                                                                                                 |
| “No refunds” versus actual code                                                                    | Policy Decision: SLOT_FULL automatic refunds still exist; paid-ad moderation rejection also uses `issueAdRefund`. UI “All Sales Final — No Refunds” is broader than code. Do not remove financial recovery merely to match the wording. `docs/CONSOLIDATED_VERIFIED_FINDINGS.md` treats only SLOT_FULL as open; reconcile moderation refund language too. |
| September 1 “closed by automated gates”                                                            | Too broad: the existing lifecycle matrix implements its own local truth table instead of invoking production transitions. It passes alongside the real paid-date-loss reproduction.                                                                                                                                                                       |

## Commands and counts actually run

Every server invocation used this prefix:

```sh
env -i PATH="$PATH" HOME="$HOME" VARSITYHUB_ENV_PATH=/dev/null \
  DATABASE_URL=postgresql://varsityhub@127.0.0.1:5432/varsityhub_audit_20260905_ads \
  JWT_SECRET=audit-local-test-secret-32-chars-minimum NODE_ENV=test \
  npm --prefix server test -- --runInBand <paths>
```

1. Final new audit harness group: `audit-ads-db-repro-2026-09-05.test.ts`, `audit-ad-client-handler-2026-09-05.test.ts`, `audit-stripe-refund-repro-2026-09-05.test.ts`, `audit-ads-boundaries-2026-09-05.test.ts` — **4 suites: 3 passed, 1 failed; 22 tests: 21 passed, 1 failed**. Failure is actual malformed-date 500 vs expected400. Passing BUG tests deliberately confirm six bad behaviors. Machine-readable results: [ads-repro-results.json](/tmp/varsityhub-audit-2026-09-05/ads-repro-results.json); [log](/tmp/varsityhub-audit-2026-09-05/ads-repro-results.log).

2. Existing plus initial two audit harness group: `payments-finalization.test.ts`, `ad-approval-security.test.ts`, `ad-geofencing.integration.test.ts`, `ad-engagement-metrics.test.ts`, `stripe-webhook-signature.test.ts`, initial `audit-ads-db-repro-2026-09-05.test.ts`, `audit-ad-client-handler-2026-09-05.test.ts` — **7 suites / 48 tests passed**. Existing baseline contribution is **5 suites / 44 tests**, with 4 initial new repro tests making 48. Later new harnesses supersede their initial versions; do not sum duplicate runs.

3. Existing structural/pure helper group: `payment-ad-slots.test.ts`, `payments-invariants.test.ts`, `ads-route-gating.test.ts`, `ad-lifecycle-matrix.test.ts`, `google-play-unverified-fallback.test.ts`, `ad-state-invariants.test.ts`, `ad-refund-reconcile.contract.test.ts`, `ad-approval-race.test.ts` — **8 suites: 7 passed, 1 failed; 105 tests: 104 passed, 1 failed**. Failure is `ad-state-invariants.test.ts:164`: expects >=3 exact `payment_status:'paid', status:'active'` literals, sees2. This is a stale structural count, distinct from the seven product bugs. [Results](/tmp/varsityhub-audit-2026-09-05/ads-existing-contract-results.json), [log](/tmp/varsityhub-audit-2026-09-05/ads-existing-contract-results.log).

Unique latest tests represented here: **17 suites / 171 tests; 169 passed assertions, 2 failed assertions**, with the crucial qualification that six open defects are intentionally passing observation tests. Initial unfinished mock-harness run had a missing Sentry mock export; fixed only in the harness and rerun successfully. Do not mistake its original nine import failures for product bugs.

`npx prettier --write` ran on the four new audit files only. Parent owns client/server typechecks, global source gates, navigation, full suites, deployed version comparison, and final combined totals. No migrations, commits, pushes, OTA, or production writes were performed by this subtask.

## Remaining runtime scope

Not exercised: actual Stripe/Apple/Google sandbox purchase/refund dashboards; receipt cryptographic verification against live stores; device PaymentSheet cancellation and reconnect; real email provider delivery; production Redis cross-replica lock behavior; real browser rendering and native Apple checkout. Current schema was created directly for local tests, so migration roll-forward/rollback is not certified. The user should not be told “every ad/payment scenario works end to end” while these runtime checks and reproduced bugs remain.
