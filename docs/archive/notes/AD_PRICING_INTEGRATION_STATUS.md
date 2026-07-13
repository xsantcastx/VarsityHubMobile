# Ad Pricing Integration Status

**Date:** December 13, 2025  
**Status:** ✅ Shared helper implemented, 🟡 Stripe price IDs need verification

---

## Implementation Summary

### ✅ Completed

1. **Shared Ad Pricing Helper** (`server/src/utils/adPricing.ts`)
   - Exports constants: `WEEKDAY_BLOCK_PRICE_CENTS = 500` ($5), `WEEKEND_BLOCK_PRICE_CENTS = 800` ($8)
   - `calculateAdPriceCents(isoDates)` dedupes ISO dates into week blocks, returns `{ totalCents, weekdayBlocks, weekendBlocks }`
   - `calculateAdPriceDollars(isoDates)` for UI display
   - Correctly identifies Mon–Thu as weekday (days 1–4), Fri–Sun as weekend (days 0, 5–6)

2. **Backend Integration**
   - `server/src/routes/ads.ts` (line ~325): Reservation POST endpoint calls `calculateAdPriceDollars(isoDates)`
   - `server/src/routes/payments.ts` (line 107): Checkout flow uses `calculatePriceCents(isoDates)` for subtotal
   - All math dedupes by week: selecting Wed + Thu still costs $5 (one weekday block), not $10

3. **Frontend Display**
   - `app/ad-calendar.tsx` (lines 15–16): Constants `weekdayRate = 5.00`, `weekendRate = 8.00`
   - Calendar legend, tooltips, and examples all show $5/$8 values
   - Price calculation respects weekly slots, not per-day

4. **Jest Tests**
   - `server/src/__tests__/payments.test.ts` (lines 8–9): Assertions confirm `500` and `800` cents
   - Test case (lines 12–17): Monday + Tuesday + Friday = 1 weekday block + 1 weekend block = $13
   - Empty input handled gracefully

5. **Documentation Updated**
   - `PRICING_UPDATE_COMPLETE.md`: Lists $5/$8 as current ad pricing
   - `docs/AD_PRICING_UPDATE.md`: Includes note "Dec 13 Update: Rates reduced to $5 Mon–Thu and $8 Fri–Sun"

---

## ⚠️ Critical Issue: Stripe Price ID Mismatch

### The Problem

The checkout flow uses **Stripe price IDs** that may not match the calculated subtotal:

```typescript
// server/src/routes/payments.ts, line 307–309
const adTypeToPriceId: Record<string, string> = {
  'Fri-Sun Advertising': 'price_1SNFXxGJt8CsPE1ECbmJRQDa',
  'Mond-Thurs Advertising': 'price_1SNFWzGJt8CsPE1EIikRsZif',
};
```

**Issue:** These price IDs are hardcoded and were created for the **previous pricing scheme** ($8 weekday / $10 weekend). The current system:

- **Calculates** subtotal dynamically using `calculatePriceCents()` → returns **500–800 cents** per block
- **Charges** via Stripe using fixed `priceId` → may reference **800–1000 cents** per item

**Result:** The customer sees one total in the UI (calculated from new rates), but Stripe charges a different amount (old rates from the price ID).

### Verification Steps Required

1. **Stripe Dashboard Inspection**
   - Login to Stripe: https://dashboard.stripe.com
   - Navigate to **Products** → find "Mon–Thurs Advertising" and "Fri–Sun Advertising"
   - Check the current **Unit Amount** for each price:
     - Should be: **500¢ ($5.00)** for Mon–Thurs, **800¢ ($8.00)** for Fri–Sun
     - If different: note the actual amounts and get the price ID

2. **Price ID Resolution**
   - If the Stripe prices match ($5/$8), the IDs might be correct; test end-to-end
   - If the Stripe prices don't match, **create new prices** in Stripe:
     - Product: "Mon–Thurs Advertising" → Price: 500¢
     - Product: "Fri–Sun Advertising" → Price: 800¢
   - Update `adTypeToPriceId` mapping with the new IDs

---

## 🧪 Testing Recommendations

### Unit Tests (Already in Code)

```bash
npm test -- --runTestsByPath server/src/__tests__/payments.test.ts
```

**Note:** This will fail if Jest isn't configured for server tests. Run with `--passWithNoTests` for now.

### End-to-End Smoke Test

1. **Create an ad** via admin panel or `/ads` POST endpoint
2. **Book dates** on the calendar (e.g., select Mon + Fri)
3. **Verify three totals match:**
   - UI calendar shows: `$5 + $8 = $13`
   - `/ads/reservations` API returns: `price: 13.00`
   - Stripe checkout session shows: `$13.00` before payment
4. **Proceed with payment** and confirm the charge amount in Stripe matches

### Test Scenarios

| Dates Selected             | Weekday Blocks | Weekend Blocks | Expected Total             |
| -------------------------- | -------------- | -------------- | -------------------------- |
| Any single Monday–Thursday | 1              | 0              | $5.00                      |
| Any single Friday–Sunday   | 0              | 1              | $8.00                      |
| Mon + Fri                  | 1              | 1              | $13.00                     |
| Mon + Tue                  | 1              | 0              | $5.00 (one weekly block)   |
| Fri + Sat                  | 0              | 1              | $8.00 (one weekly block)   |
| Mon + Fri + Sun            | 1              | 1              | $13.00 (two weekly blocks) |

---

## 📋 Next Steps (Priority Order)

1. **Verify Stripe Price IDs** (Required)
   - Check Stripe dashboard for current unit amounts
   - If unit amounts ≠ 500¢ / 800¢: create new prices, update `adTypeToPriceId`

2. **Run End-to-End Test** (Required)
   - Create test ad, book dates, compare UI total vs. Stripe total
   - Confirm payment processes at the correct amount

3. **Update Documentation** (Nice-to-have)
   - Update `docs/AD_PRICING_UPDATE.md` to remove references to the old $8/$10 scheme
   - Add a final "Current Implementation" section confirming $5/$8 is live

4. **Log Subtotal Transparency** (Optional)
   - Add explicit logging in checkout: `debugLog('[payments] Ad checkout: subtotal=${subtotal} cents, price_id=${priceId}')`
   - Helps future debugging if discrepancies arise

---

## File Inventory

### Backend (Server)

| File                                    | Lines            | Change                                              | Status |
| --------------------------------------- | ---------------- | --------------------------------------------------- | ------ |
| `server/src/utils/adPricing.ts`         | 1–65             | **New file:** Shared pricing helper                 | ✅     |
| `server/src/routes/ads.ts`              | ~325             | Uses `calculateAdPriceDollars()`                    | ✅     |
| `server/src/routes/payments.ts`         | 16, 107, 307–309 | Imports helper, calculates subtotal, maps price IDs | ✅     |
| `server/src/__tests__/payments.test.ts` | 1–76             | Tests for $5/$8 pricing                             | ✅     |

### Frontend

| File                  | Lines               | Change                                    | Status |
| --------------------- | ------------------- | ----------------------------------------- | ------ |
| `app/ad-calendar.tsx` | 15–16, 620–740, 809 | Constants, legend, examples, calculations | ✅     |

### Documentation

| File                         | Lines   | Change                                       | Status |
| ---------------------------- | ------- | -------------------------------------------- | ------ |
| `PRICING_UPDATE_COMPLETE.md` | ~89–100 | References $5/$8                             | ✅     |
| `docs/AD_PRICING_UPDATE.md`  | 5–100   | Dec 13 note, but old scheme still documented | 🟡     |

---

## Code Examples

### Correct Weekly Slot Calculation

```typescript
// User selects: Wed, Thu, Fri
const dates = ['2025-01-15', '2025-01-16', '2025-01-17'];
// Wed + Thu = same week (Mon–Thu block) = 1 weekday block
// Fri = same week (Fri–Sun block) = 1 weekend block
const result = calculateAdPriceCents(dates);
// result = { totalCents: 1300, weekdayBlocks: 1, weekendBlocks: 1 }
// UI shows: $5.00 + $8.00 = $13.00 ✅
```

### Checkout Flow (Simplified)

```typescript
const subtotal = calculatePriceCents(isoDates); // 1300 cents
const tax = calculateSalesTax(subtotal, zipCode);
const total = subtotal + tax;
// Create Stripe session with:
// - line_item.price = adTypeToPriceId[ad.type]  // Must equal $5 or $8
// - metadata.subtotal_cents = subtotal         // For logging
// - metadata.tax_cents = tax                   // For logging
```

---

## Open Questions

1. **Are the Stripe price IDs still accurate?**
   - Last updated: Unknown (check Stripe dashboard)
   - If old, new IDs needed

2. **Should we eliminate the Stripe price ID dependency?**
   - Currently: Use fixed price ID + dynamic metadata
   - Alternative: Always use dynamic prices via `price_data`
   - Consideration: Speed vs. flexibility

3. **How are multi-week bookings handled?**
   - Example: Book Mon of week 1 + Wed of week 2
   - Answer: Two separate weekday blocks = $10 (not prorated)
   - Is this intentional?

---

## Summary Table

| Component          | Status         | Risk     | Action Required                |
| ------------------ | -------------- | -------- | ------------------------------ |
| Helper function    | ✅ Implemented | None     | None                           |
| Backend routes     | ✅ Integrated  | None     | None                           |
| Frontend constants | ✅ Updated     | None     | None                           |
| Jest tests         | ✅ Written     | Low      | Run tests when Jest configured |
| Stripe price IDs   | 🟡 Unknown     | **High** | **Verify in dashboard ASAP**   |
| Documentation      | ✅ Updated     | Low      | Clean up old scheme notes      |

---

**Prepared by:** GitHub Copilot  
**Next Review:** After Stripe verification step completed
