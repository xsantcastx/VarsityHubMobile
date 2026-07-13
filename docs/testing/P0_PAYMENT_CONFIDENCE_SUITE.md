# P0 Payment Confidence Suite

Goal: validate payment correctness under real-world failure modes before broad launch.

---

## Coverage matrix (required)

| Scenario                          | Automated | Manual | Pass criteria                                            |
| --------------------------------- | --------- | ------ | -------------------------------------------------------- |
| Happy path checkout               | ✅        | ✅     | payment succeeds, DB status completed, confirmation sent |
| Retry path                        | ✅        | ✅     | duplicate submits do not double-charge/double-finalize   |
| Duplicate webhook replay          | ✅        | ✅     | replay is deduplicated, no duplicate side effects        |
| Timeout / delayed webhook         | ✅        | ✅     | finalize remains consistent after delayed processing     |
| Refund path (slot full / failure) | ✅        | ✅     | refund status and user notice are correct                |
| Apple Pay on device               | ❌        | ✅     | one successful purchase on physical iOS device           |
| Google Play on device             | ❌        | ✅     | one successful purchase on physical Android device       |

---

## Automated checks to run each release candidate

```bash
# Server payment foundation tests
npm --prefix server test -- --runTestsByPath \
  src/__tests__/distributedLock.test.ts \
  src/__tests__/transaction-logger-update.test.ts \
  src/__tests__/payments-finalization.test.ts
```

---

## Manual smoke checks (every candidate build)

## iOS Apple Pay (physical device)

1. Install candidate build.
2. Complete one Apple Pay purchase.
3. Confirm:
   - user plan/ad state updated correctly,
   - transaction record exists with expected status,
   - no duplicate finalization.

## Android Google Play (physical device)

1. Install candidate build.
2. Complete one Google Play purchase.
3. Confirm same checks as iOS.

---

## Evidence capture template

- Build number:
- Device model / OS:
- Payment provider: Apple / Google / Stripe Checkout
- Order/session/transaction IDs:
- Result: PASS/FAIL
- Notes:
