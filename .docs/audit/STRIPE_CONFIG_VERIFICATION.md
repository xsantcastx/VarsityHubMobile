# Stripe Configuration Verification

## Current Implementation Status

### ✅ Subscription Plans (Veteran/Legend)
**Environment Variables:**
- `STRIPE_PRICE_VETERAN` - Used in `server/src/routes/payments.ts:123`
- `STRIPE_PRICE_LEGEND` - Used in `server/src/routes/payments.ts:124`
- `STRIPE_SECRET_KEY` - Used for Stripe API calls
- `STRIPE_PUBLISHABLE_KEY` - Used for frontend Stripe.js (if applicable)
- `STRIPE_WEBHOOK_SECRET` - Used for webhook signature verification

**Status:** ✅ **ACCURATE** - These are properly configured and used in the codebase.

---

### ⚠️ Advertisement Pricing (Weekday/Weekend)

**Environment Variables Shown in Image:**
- `STRIPE_PRICE_AD_WEEKDAY` = `price_1SNFWzGJt8CsPE1EIikRsZif`
- `STRIPE_PRICE_AD_WEEKEND` = `price_1SdlmiGJt8CsPE1EkPHETCvY`

**Current Code Implementation:**
- **Location:** `server/src/routes/payments.ts:95-117`
- **Method:** `calculatePriceCents()` function
- **Pricing:** Hardcoded values:
  - Weekday (Mon-Thu): 800 cents = $8.00 per week
  - Weekend (Fri-Sun): 1000 cents = $10.00 per week

**Issue:** The code **does NOT currently use** `STRIPE_PRICE_AD_WEEKDAY` or `STRIPE_PRICE_AD_WEEKEND` environment variables. Instead, it:
1. Calculates prices dynamically based on selected dates
2. Creates `price_data` on-the-fly in Stripe checkout session
3. Does not use pre-configured Stripe Price IDs

**Recommendation:**
- If you want to use the Price IDs from your Stripe dashboard, update the code to use them instead of creating price_data dynamically
- This would require modifying `server/src/routes/payments.ts` around line 354-365 to use the Price IDs

**Current Pricing Accuracy:**
- ✅ Weekday: $8/week (matches your Stripe Price ID configuration)
- ✅ Weekend: $10/week (matches your Stripe Price ID configuration)
- ⚠️ But using dynamic price_data instead of Price IDs

---

## Verification Checklist

### ✅ Verified Accurate
- [x] `STRIPE_PRICE_VETERAN` - Used correctly
- [x] `STRIPE_PRICE_LEGEND` - Used correctly  
- [x] `STRIPE_SECRET_KEY` - Used correctly
- [x] `STRIPE_PUBLISHABLE_KEY` - Present (for frontend if needed)
- [x] `STRIPE_WEBHOOK_SECRET` - Used for webhook verification

### ⚠️ Needs Attention
- [ ] `STRIPE_PRICE_AD_WEEKDAY` - **Not currently used in code** (Price ID exists but code calculates dynamically)
- [ ] `STRIPE_PRICE_AD_WEEKEND` - **Not currently used in code** (Price ID exists but code calculates dynamically)

---

## Action Items

1. **Option A: Use Price IDs (Recommended)**
   - Update `server/src/routes/payments.ts` to use `STRIPE_PRICE_AD_WEEKDAY` and `STRIPE_PRICE_AD_WEEKEND`
   - Benefits: Centralized pricing management in Stripe dashboard
   - Requires code changes

2. **Option B: Keep Current Implementation**
   - Current dynamic pricing works correctly
   - Prices match your Stripe configuration ($8/$10)
   - No code changes needed
   - Note: Price IDs in env vars are unused

---

## Summary

**Subscription Plans:** ✅ Fully accurate and properly configured

**Ad Pricing:** ⚠️ Prices are correct ($8/$10) but Price IDs from env vars are not used. The code calculates prices dynamically, which works but doesn't leverage your Stripe Price ID configuration.
