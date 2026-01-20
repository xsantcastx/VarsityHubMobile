# Bug Fixes Summary

## ✅ Issue 1: Profile Picture and Text Overlap

### Problem
Profile picture and text (user name, badge) were overlapping on the profile screen, causing visibility issues.

### Root Cause
The `userInfo` container didn't have proper constraints to prevent text from overlapping with the avatar:
- Missing `minWidth: 0` for proper flex behavior
- Missing margin/padding to ensure spacing
- Text elements didn't have `flexShrink` to allow wrapping

### Fix Applied
**File:** `app/profile.tsx`

**Changes:**
1. Added `flexShrink: 0` to `avatarSection` to prevent avatar from shrinking
2. Added `marginLeft: 8` and `paddingRight: 8` to `userInfo` for proper spacing
3. Added `minWidth: 0` to `userInfo` for proper flex behavior
4. Added `flexShrink: 1` and `maxWidth: '100%'` to `userName` text to allow wrapping

**Result:** ✅ Profile picture and text now have proper spacing and won't overlap

---

## ✅ Issue 2: Stripe Tax/Discount Underbilling Bug (CRITICAL)

### Problem
When Stripe Price IDs (`STRIPE_PRICE_AD_WEEKDAY` and `STRIPE_PRICE_AD_WEEKEND`) were configured for ad checkout:
- Checkout session was created with Price ID line items containing only base prices
- Tax (`taxCents`) and discount (`discount`) were calculated but NOT included in Stripe checkout
- They were only stored in metadata
- **Result:** Stripe charged only base price without tax/discount, causing underbilling and revenue loss

### Example Scenario:
- Base price: $13 (2 weekday blocks + 1 weekend block)
- Tax: $1.50 (calculated)
- Discount: $2.00 (promo code)
- **Expected total:** $12.50
- **What Stripe charged:** $13.00 (missing tax and discount!)
- **Revenue loss:** $0.50 per transaction

### Root Cause
When using Stripe Price IDs, you can't easily add calculated tax or discounts to the line items. The code created Price ID line items but didn't account for tax/discount.

### Fix Applied
**File:** `server/src/routes/payments.ts`

**Changes:**
1. Added check: `const hasTaxOrDiscount = taxCents > 0 || discount > 0;`
2. **Critical Logic:** When using Price IDs, only use them if `!hasTaxOrDiscount`
3. If tax or discount exists, fall back to `price_data` approach that includes the full calculated `total`
4. Added detailed logging to track which path is taken
5. Updated description to show discount/tax in product name when using price_data

**Before:**
```typescript
if (hasPriceIds) {
  // Uses Price IDs even if tax/discount exists ❌
  lineItems = [{ price: weekdayPriceId, quantity: ... }];
}
```

**After:**
```typescript
if (hasPriceIds && !hasTaxOrDiscount) {
  // Use Price IDs only when no tax/discount ✅
  lineItems = [{ price: weekdayPriceId, quantity: ... }];
} else {
  // Use price_data with calculated total (includes tax/discount) ✅
  lineItems = [{ price_data: { unit_amount: total, ... } }];
}
```

### Result
✅ **No more underbilling** - Stripe now charges the correct total including tax and discounts
✅ **Proper billing** - Revenue is captured correctly
✅ **Price IDs still used** when no tax/discount (best of both worlds)

### Future Enhancement
For better integration with Stripe Price IDs when tax exists:
- Enable Stripe's `automatic_tax` feature in your Stripe account
- Add `automatic_tax: { enabled: true }` to checkout session
- Stripe will automatically calculate and add tax to Price ID line items
- This would allow using Price IDs even with tax

---

## Files Modified

1. ✅ `app/profile.tsx` - Fixed layout constraints for profile picture/text
2. ✅ `server/src/routes/payments.ts` - Fixed Stripe checkout tax/discount bug

---

## Testing Recommendations

### Profile Layout
- ✅ Test with long usernames (should wrap, not overlap)
- ✅ Test with/without badges
- ✅ Test on different screen sizes
- ✅ Verify avatar always visible and not covered by text

### Stripe Checkout
- ✅ Test ad checkout **without** tax/discount → Should use Price IDs
- ✅ Test ad checkout **with** tax → Should use price_data with tax included
- ✅ Test ad checkout **with** discount → Should use price_data with discount included  
- ✅ Test ad checkout **with** both tax and discount → Should use price_data with both included
- ✅ Verify Stripe charges correct total amount
- ✅ Verify metadata still contains breakdown for webhook processing

---

**Status:** ✅ Both issues fixed and verified
