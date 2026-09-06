# Current ad booking re-audit — September 5, 2026

**Ordinary booking permissions pass, but the current payment code has two reproduced refund defects.** Source is `fccdc186` (same server product source as deployed `e7f38857`). Test transport uses real JWT middleware, Express, PostgreSQL and correctly signed local webhook payloads. Stripe SDK network calls are stubs; no provider charge, refund, or email occurred.

## Enumerated scenario matrix

The baseline ad/date/checkout/refund suites were included in the fresh full-server sweep. The new persona suite contains **19 cases: 17 passed, 2 failed**.

| Case                                                                                            | Fan                         | Coach                     | Organization owner        | Evidence                                                                                                  |
| ----------------------------------------------------------------------------------------------- | --------------------------- | ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Draft creation ignores forged owner/payment/approval fields; edit/submit; founder-only approval | Pass                        | Pass                      | Pass                      | Persisted draft/pending/approved states; all three denied self-review                                     |
| Foreign ad read/edit/delete/submit/reservations/quote/checkout/PaymentSheet                     | Pass                        | Pass                      | Pass                      | 403, unchanged ad and no payment-intent/session creation                                                  |
| Payment before platform approval                                                                | Pass                        | Pass                      | Pass                      | Both Stripe endpoints deny                                                                                |
| Approved ad web Checkout → signed completion → paid inventory                                   | Pass                        | Pass                      | Pass                      | Server quote ignores forged price; purchase hold replaced by paid reservation                             |
| Approved ad PaymentSheet → signed completion → paid inventory                                   | Pass                        | Pass                      | Pass                      | Same assertions against actual database                                                                   |
| Cancel another account's pending PaymentIntent                                                  | Own fan cancellation passes | Denied                    | Denied                    | Foreign denial; owner's hold removed and transaction failed                                               |
| Unverified payment                                                                              | Denied                      | —                         | —                         | No checkout/intent creation; the test starts with a seeded ad, not an unverified draft-creation assertion |
| PaymentSheet refund identity                                                                    | **Fail**                    | Shared path; not repeated | Shared path; not repeated | AD-C01                                                                                                    |
| Two overlapping paid bookings; refund first                                                     | **Fail**                    | Shared path; not repeated | Shared path; not repeated | AD-C02                                                                                                    |

Required device/provider acceptance remains **0/9**: a real iOS Apple ad purchase, Android Stripe ad purchase, and web Stripe purchase for each of the three personas. Receipt recovery, user cancellation, provider refunds and delivery must be included in those journeys. The passing local suite cannot substitute for those nine cases. Google Play is the subscription rail, not the Android ad rail.

## AD-C01 — PaymentSheet refunds cannot find the completed purchase

**Open Bug; high priority.** Run `/payments/create-payment-sheet`, deliver `payment_intent.succeeded`, then deliver `charge.refunded` for that PaymentIntent. Settlement marks the transaction COMPLETED and the ad active/paid, but the transaction's `stripe_payment_intent_id` is **null**. The refund returns **500** because its lookup uses only that column.

`activateApprovedAdPaymentIntent` (`server/src/routes/payments.ts:159`) passes `purchaseReference` but omits `stripePaymentIntentId` when calling `reserveAdSlots`. The transaction logger originally stores the PI in `stripe_session_id`. `server/src/lib/adInventory.ts:156` only fills the dedicated PI field when explicitly supplied; the refund lookup is `server/src/routes/payments.ts:497`.

Reproduction: `a PaymentSheet purchase can be found and fully refunded by its PaymentIntent` in `server/src/__tests__/current-ads-persona-reaudit-2026-09-05.test.ts`. Expected `{paymentIntentReference:pi.id,refundStatus:200}`; actual `{paymentIntentReference:null,refundStatus:500}`. The webhook remains retryable, but retries cannot repair a reference that is never written.

Exploitability: ordinary successful PaymentSheet purchase followed by a refund/dispute; blast radius: affected purchases, active ad inventory and reconciliation; recovery: fix settlement and reconcile existing missing references from known purchase identity. Fix: write the dedicated reference atomically with completion, cover both pending-initiation and webhook-only recovery paths, and prepare a bounded read-only scan before any historical data repair.

## AD-C02 — Refunding an earlier overlapping booking erases later paid delivery

**Open Bug; high priority.** The same ad/date can be purchased twice using distinct checkout idempotency keys. Both purchases complete. `AdReservation` is unique by ad/date and `createMany(skipDuplicates:true)` retains only the first purchase's provenance. Refunding that first purchase removes the only reservation and sets the ad to draft/refunded even though the second transaction remains paid.

Reproduction: `refunding an earlier purchase preserves an overlapping later paid purchase` in the new suite. Both actual signed Checkout completion callbacks are asserted successful. After refunding the first, expected `{paidDates:1,status:'active',payment:'paid'}`; actual `{paidDates:0,status:'draft',payment:'refunded'}`.

Source: `server/src/lib/adInventory.ts:133` skips the duplicate paid row; `server/src/routes/payments.ts:609` deletes by the earlier purchase reference. The prior disjoint-date Run Again regression does not cover this overlap.

Exploitability: repeat purchase of an already-paid date, then refund of the older transaction; blast radius: that ad's paid delivery and accounting; recovery: reconcile actual purchases and restore remaining paid entitlement. Fix: reject/exclude already-owned dates before a second charge, or represent overlapping purchase entitlement explicitly. Test both overlapping and disjoint bookings across Checkout, PaymentSheet and Apple before release; do not remove the existing hold/provenance migration.

## Historical notes and execution limits

Prior September 5 regression cases for hold separation, disjoint Run Again, retarget/capacity, 56-day/date validation, signed webhook retry, old-subscription protection and platform handler branching pass in the fresh baseline sweep. Their broad “refund/settlement is safe” wording is **incomplete**, not a reason to erase the earlier proofs. AD-C01/C02 exercise missing sibling/lifecycle cases.

The original new harness was unfinished: it omitted Express JSON parsing and reused one fake Stripe customer ID for multiple users. Those test-only defects were corrected before the final run; initial failures are retained in `/tmp/varsityhub-current-reaudit-20260905/ads-personas*.{json,log}`. An initial overlap probe hit AD-C01 first; the final overlap case uses Checkout with explicit, distinct idempotency keys to isolate AD-C02.

Run the suite with loopback database `varsityhub_audit_vh_reaudit_ads_20260905_1`, both env-file paths `/dev/null`, `NODE_ENV=test`, `EMAIL_PROVIDER=test`, and a local JWT secret of at least 32 characters:

```sh
npm --prefix server test -- --runInBand --runTestsByPath src/__tests__/current-ads-persona-reaudit-2026-09-05.test.ts
```

It intentionally exits nonzero while both findings reproduce. Final confirmation: `/tmp/varsityhub-current-reaudit-20260905/ads-current-confirmed.{log,json}`. A post-format run additionally timed out one organizer draft/approval test and retained an open handle; that first result is preserved in `ads-current-formatted.*`. The fresh-process confirmation used `--forceExit` for harness shutdown and returned the same **17 passed / 2 defect failures**, without increasing the 10-second test timeout. This is a test-harness limitation, not a new passing production timing guarantee. No product, production billing state, or deployment was modified.
