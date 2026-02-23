# Ad Pricing Fix - Weekday/Weekend Stripe Integration

## Issues Fixed

### ❌ Previous Problems

1. **Incorrect Pricing Function in `payments.ts`**:
   - Used old `calculatePriceCents()` function
   - Charged per DATE instead of per WEEK BLOCK (charging twice for Mon + Tue)
   - Used outdated prices: $8 weekday, $10 weekend (should be $5/$8)

2. **Incorrect Pricing in `ads.ts`**:
   - Used hardcoded $8/$10 prices (should be $5/$8)
   - Correctly grouped by week blocks but with wrong prices

3. **Price IDs Not Used**:
   - Stripe Price IDs exist but weren't being used
   - Made centralized pricing management impossible

### ✅ Fixes Applied

1. **Updated `payments.ts`**:
   - ✅ Now imports and uses `calculateAdPriceCents()` from `utils/adPricing.ts`
   - ✅ Uses correct prices: $5 weekday, $8 weekend
   - ✅ Properly groups dates into week blocks (no double-charging)
   - ✅ Added support for Stripe Price IDs (uses them if configured, falls back to dynamic pricing)

2. **Updated `ads.ts`**:
   - ✅ Now imports and uses `calculateAdPriceDollars()` from `utils/adPricing.ts`
   - ✅ Consistent pricing calculation with payments route
   - ✅ Removed duplicate pricing logic

3. **Added Price ID Support**:
   - ✅ Code now checks for `STRIPE_PRICE_AD_WEEKDAY` and `STRIPE_PRICE_AD_WEEKEND`
   - ✅ If Price IDs are configured, uses them in Stripe checkout
   - ✅ Falls back to dynamic `price_data` if Price IDs not available
   - ✅ Added env var validation in `server/src/lib/env.ts`

## Current Pricing

**Active Rates:**
- **Monday–Thursday Slot:** $5.00 per week
- **Friday–Sunday Slot:** $8.00 per week

**How It Works:**
1. Dates are grouped by week (Monday to Sunday)
2. Each week can have both weekday block (Mon-Thu) and weekend block (Fri-Sun)
3. Booking any date within a week block reserves the entire block
4. Total = (weekday blocks × $5) + (weekend blocks × $8)

**Examples:**
- Select Wednesday = $5 (reserves Mon-Thu block for that week)
- Select Friday = $8 (reserves Fri-Sun block for that week)
- Select Wednesday + Friday = $13 ($5 + $8)
- Select Wednesday + Thursday = $5 (same weekday block, no double-charge)
- Select Friday + Saturday = $8 (same weekend block, no double-charge)

## Stripe Price ID Configuration

**To Use Price IDs (Recommended):**

Set in your environment (Railway/`.env`):
```bash
STRIPE_PRICE_AD_WEEKDAY=price_1SNFWzGJt8CsPE1EIikRsZif
STRIPE_PRICE_AD_WEEKEND=price_1SdlmiGJt8CsPE1EKPHETCVY
```

**Benefits:**
- Centralized pricing management in Stripe dashboard
- No code changes needed to update prices
- Better Stripe analytics and reporting

**Fallback:**
- If Price IDs not configured, code uses dynamic `price_data`
- Still calculates correct prices ($5/$8)
- Works without Price IDs (backward compatible)

## Files Modified

1. ✅ `server/src/routes/payments.ts`
   - Removed old `calculatePriceCents()` function
   - Added import for `calculateAdPriceCents`
   - Updated checkout session to use Price IDs when available
   - Added weekday/weekend block metadata

2. ✅ `server/src/routes/ads.ts`
   - Removed duplicate pricing calculation
   - Added import for `calculateAdPriceDollars`
   - Uses shared pricing helper

3. ✅ `server/src/lib/env.ts`
   - Added `STRIPE_PRICE_AD_WEEKDAY` to env schema
   - Added `STRIPE_PRICE_AD_WEEKEND` to env schema

## Testing Checklist

### Manual Testing

1. **Weekday Booking:**
   - Select a Wednesday
   - Should show $5.00 total
   - Stripe checkout should charge $5.00

2. **Weekend Booking:**
   - Select a Friday
   - Should show $8.00 total
   - Stripe checkout should charge $8.00

3. **Mixed Booking:**
   - Select Wednesday + Friday
   - Should show $13.00 total
   - Stripe checkout should charge $13.00

4. **Same Week Block:**
   - Select Wednesday + Thursday (same week)
   - Should show $5.00 (not $10)
   - Stripe checkout should charge $5.00

5. **Different Weeks:**
   - Select Monday of week 1 + Monday of week 2
   - Should show $10.00 (two separate weekday blocks)
   - Stripe checkout should charge $10.00

### Price ID Testing

1. **With Price IDs Configured:**
   - Set `STRIPE_PRICE_AD_WEEKDAY` and `STRIPE_PRICE_AD_WEEKEND`
   - Checkout should use Price IDs in line_items
   - Verify in Stripe dashboard that correct Price IDs are used

2. **Without Price IDs:**
   - Remove Price ID env vars
   - Checkout should still work with dynamic `price_data`
   - Prices should remain correct ($5/$8)

## Verification

Run the verification script:
```bash
./scripts/verify-stripe-config.sh
```

Check that:
- ✅ Pricing calculation uses shared helper
- ✅ Prices are correct ($5/$8)
- ✅ Week block grouping works correctly
- ✅ Price IDs are used when configured

## Summary

✅ **All ad pricing issues fixed:**
- Correct prices ($5 weekday, $8 weekend)
- Proper week block grouping
- Stripe Price ID support added
- Consistent pricing across all routes
- Backward compatible (works with or without Price IDs)

The ad hosting Stripe integration is now working correctly! 🎉
