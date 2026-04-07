# 💰 VarsityHub Stripe Pricing Configuration

## Current Live Configuration (Updated in Stripe)

This document reflects the **actual Stripe product IDs and pricing** currently configured in the Stripe dashboard.

---

## 🧩 Account Tiers (Coach Subscriptions)

### Rookie Account
- **Price:** FREE
- **Stripe Product ID:** N/A (No Stripe product needed)
- **Limit:** First 2 teams free
- **Description:** Encourage onboarding and early engagement without paywalls
- **Backend Code:** N/A (no billing for Rookie)

**Features:**
- First 2 teams free
- Basic scheduling and roster management
- Event creation
- Photo/video sharing
- Community support

**Upgrade Path:**
After 2 teams, users must upgrade to Veteran or Legend to add more teams.

---

### Veteran Account
- **Price:** $0.99/month **per team** (beyond first 2 free)
- **Stripe Product ID:** `prod_TCjgM4tFKjUigv`
- **Stripe Price ID:** `price_1SCd6HRuB2a0vFjp1QlboTEv` (from server/.env)
- **Billing:** Monthly recurring per team
- **Backend Code:** 99 cents = $0.99/month

**Pricing Model:**
- First 2 teams: FREE (Rookie)
- Team 3+: $0.99/month each
- Example: 5 teams = 2 free + 3 paid = $2.97/month total

**Features:**
- All Rookie features
- Pay per team added
- Up to 12 authorized users
- 🏆 Blue shield badge on profile
- Event scheduling tools
- Parent communication

**Limitations:**
Each team beyond 2 incurs a $0.99/month charge.

---

### Legend Account
- **Price:** $20.00/year (flat rate, unlimited)
- **Stripe Product ID:** `prod_TGw0PNT97OCrl8`
- **Stripe Price ID:** `price_1SCd6IRuB2a0vFjpQOSdctN4` (from server/.env)
- **Billing:** Annual recurring
- **Backend Code:** 2000 cents = $20.00/year

**Pricing Model:**
- Unlimited teams for one annual fee
- Best value for organizations with 3+ teams

**Value Calculation:**
- 3 teams on Veteran: $0.99 × 1 team × 12 months = $11.88/year
- 3 teams on Legend: $20/year (premium features included)
- 10 teams on Veteran: $0.99 × 8 teams × 12 months = $95.04/year
- 10 teams on Legend: $20/year (saves $75.04!)

**Features:**
- All Veteran features
- Unlimited teams included (no per-team charge)
- Unlimited authorized users
- 🥇 Gold trophy badge on profile
- Advanced analytics dashboard
- Custom branding options
- Team import/export tools

**Best For:**
- Established programs
- Multi-team organizations
- Schools with many sports
- Clubs with multiple age groups

---

## 📢 Advertisement Slots

### Weekday Ads (Monday–Thursday)
- **Price:** $5 per week
- **Stripe Product ID:** `prod_TJtJaRjlcRrFQM`
- **Backend Code:** 500 cents = $5/week
- **Purpose:** Weekday ad slot pricing (Mon–Thu)

### Weekend Ads (Friday–Sunday)
- **Price:** $8 per week
- **Stripe Product ID:** `prod_TJtKOftqpmv4Zp`
- **Backend Code:** 800 cents = $8/week
- **Purpose:** Weekend ad slot pricing (Fri–Sun)

**Ad Billing Model:**
- Ads are priced per **weekly slot**, not per day
- **Mon–Thu slot:** $5/week (covers Monday through Thursday)
- **Fri–Sun slot:** $8/week (covers Friday through Sunday)
- Users select individual dates, but pricing applies to the weekly slot category
- Example: Selecting Wednesday = $5 for the Mon–Thu slot that week

**Updated:** Backend uses 500 cents ($5) and 800 cents ($8) — see `server/src/utils/adPricing.ts`.

---

## 📋 Complete Pricing Reference Table

| Tier / Product | Description | Price | Stripe Product ID | Stripe Price ID | Backend (cents) |
|----------------|-------------|-------|-------------------|-----------------|-----------------|
| **Rookie** | First two teams free | FREE | N/A | N/A | N/A |
| **Veteran** | Per-team monthly subscription | $0.99/month per team | `prod_TCjgM4tFKjUigv` | `price_1SCd6HRuB2a0vFjp1QlboTEv` | 99 |
| **Legend** | Annual unlimited subscription | $20.00/year | `prod_TGw0PNT97OCrl8` | `price_1SCd6IRuB2a0vFjpQOSdctN4` | 2000 |
| **Ad (Mon–Thu)** | Weekday ad slot | $5/week | `prod_TJtJaRjlcRrFQM` | Configured via `STRIPE_PRICE_AD_WEEKDAY` | 500 |
| **Ad (Fri–Sun)** | Weekend ad slot | $8/week | `prod_TJtKOftqpmv4Zp` | Configured via `STRIPE_PRICE_AD_WEEKEND` | 800 |

---

## 🔧 Environment Configuration

### Server .env File
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...

# Membership Price IDs (Configured)
STRIPE_PRICE_VETERAN=price_1SCd6HRuB2a0vFjp1QlboTEv
STRIPE_PRICE_LEGEND=price_1SCd6IRuB2a0vFjpQOSdctN4

# Ad Price IDs (Configured)
STRIPE_PRICE_AD_WEEKDAY=price_... # $5/week Mon–Thu
STRIPE_PRICE_AD_WEEKEND=price_... # $8/week Fri–Sun
```

### Fallback Pricing (if Price IDs not configured)
File: `server/src/routes/payments.ts`

```typescript
// Membership fallback (lines 103-116)
price_data: {
  currency: 'usd',
  unit_amount: chosen === 'veteran' ? 99 : 2000, // $0.99 or $20.00
  recurring: { 
    interval: chosen === 'veteran' ? 'month' : 'year' 
  },
  product_data: {
    name: 'Membership - ' + chosen,
    description: chosen === 'veteran' 
      ? 'Veteran plan - $0.99/month per team' 
      : 'Legend plan - $20.00/year unlimited (fallback price)',
  },
}
```

---

## 💡 Pricing Strategy Breakdown

### Why Rookie is Free
1. **Lower barrier to entry** - Users can try before they buy
2. **Natural upgrade funnel** - Users hit 2-team limit and see value
3. **Viral growth** - More teams = more users = more network effects
4. **Data collection** - Learn user behavior before monetization

### Why Veteran is Per-Team
1. **Scalable revenue** - Revenue grows with customer success
2. **Fair pricing** - Small programs pay less, large programs pay more
3. **Flexibility** - Users can add/remove teams as needed
4. **Predictable cash flow** - Monthly recurring revenue (MRR)

### Why Legend is Annual Flat Rate
1. **Better LTV** - Lock in customers for full year
2. **Value perception** - Unlimited teams = premium offering
3. **Price anchor** - Makes Veteran seem more affordable
4. **Commitment** - Annual billing reduces churn

### Ad Pricing Tiers
1. **Weekend premium** - Higher traffic = higher price
2. **Weekday discount** - Incentivize off-peak ad purchases
3. **Slot-based** - Simple, predictable pricing for advertisers

---

## 📊 Revenue Scenarios

### Small Organization (3 teams)
- **Rookie:** FREE (2 teams) → $0/year
- **Veteran:** $0.99 × 1 team × 12 months = $11.88/year
- **Legend:** $20/year
- **Best Choice:** Veteran is cheaper; Legend adds premium features

### Medium Organization (5 teams)
- **Rookie:** Not allowed (2 team limit)
- **Veteran:** $0.99 × 3 teams × 12 months = $35.64/year
- **Legend:** $20/year
- **Best Choice:** Legend (saves $15.64!)

### Large Organization (10 teams)
- **Rookie:** Not allowed (2 team limit)
- **Veteran:** $0.99 × 8 teams × 12 months = $95.04/year
- **Legend:** $20/year
- **Best Choice:** Legend (saves $75.04!)

**Insight:** Legend becomes dramatically more valuable with more teams, naturally driving enterprise customers to premium tier.

---

## 🔍 Code Implementation Status

### ✅ Updated (Matches Stripe)
- [x] `app/onboarding/step-3-plan.tsx` - Plan selection UI
- [x] `app/onboarding/step-10-confirmation.tsx` - Account summary
- [x] `app/create-team.tsx` - Team creation limits and alerts
- [x] `components/CoachTierBadge.tsx` - Plan display badges
- [x] `server/src/routes/payments.ts` - Backend pricing (lines 103-116, 157-177)

### ⚠️ Needs Review
- [x] **Ad pricing backend** - ✅ **UPDATED** to match Stripe ($5 weekday, $8 weekend per week)
  - File: `server/src/utils/adPricing.ts` - canonical pricing constants
  - File: `server/src/routes/payments.ts` - checkout session creation
  - File: `app/ad-calendar.tsx` - client-side display
  - **Confirmed:** Pricing is per WEEK/SLOT (Mon–Thu = $5/week, Fri–Sun = $8/week)

### 📝 Documentation Updated
- [x] `STRIPE_PRICING_CONFIG.md` - This file
- [x] `ONBOARDING_FIXES_SUMMARY.md` - Updated with new pricing
- [x] `USER_ROLES_AND_TYPES.md` - Updated plan descriptions

---

## 🧪 Testing Checklist

### Veteran Plan ($0.99/month per team)
- [ ] Rookie user with 2 teams sees upgrade prompt at 3rd team
- [ ] Veteran signup uses Stripe Price ID: `price_1SCd6HRuB2a0vFjp1QlboTEv`
- [ ] Stripe checkout shows $0.99/month recurring
- [ ] After payment, user can add teams at $0.99/month each
- [ ] Each team shows $0.99/month charge in Stripe dashboard
- [ ] User can downgrade if they remove teams

### Legend Plan ($20.00/year)
- [ ] Legend signup uses Stripe Price ID: `price_1SCd6IRuB2a0vFjpQOSdctN4`
- [ ] Stripe checkout shows $20.00/year recurring
- [ ] After payment, user can add unlimited teams at no extra charge
- [ ] Stripe dashboard shows single $20.00/year subscription (not per-team)
- [ ] User sees Gold badge and premium features

### Ad Slots
- [ ] Weekday ad checkout shows $5/week
- [ ] Weekend ad checkout shows $8/week
- [ ] Stripe uses correct Product IDs
- [ ] Backend correctly calculates total for multi-date ad campaigns
- [ ] UI displays "$5 per week (Mon–Thu)" and "$8 per week (Fri–Sun)"

---

## 🚀 Deployment Checklist

1. **Verify Stripe Dashboard:**
   - [ ] Products exist with correct IDs
   - [ ] Prices are active (not archived)
   - [ ] Price IDs match .env file
   - [ ] Webhooks configured for subscription events

2. **Update Environment:**
   - [ ] Server `.env` has all Price IDs
   - [ ] Production `.env` uses live Stripe keys
   - [ ] Test mode uses test keys

3. **Test Payment Flows:**
   - [ ] Test mode: Complete Veteran signup
   - [ ] Test mode: Complete Legend signup
   - [ ] Test mode: Add team on Veteran plan
   - [ ] Test mode: Purchase ad slot
   - [ ] Verify all Stripe events fire correctly

4. **Monitor Production:**
   - [ ] Track successful payments
   - [ ] Monitor failed payments
   - [ ] Check subscription renewal rates
   - [ ] Verify webhook processing

---

## 📞 Support Information

**If prices in app don't match Stripe:**
1. Check server `.env` has correct `STRIPE_PRICE_*` variables
2. Verify Stripe Price IDs are active in dashboard
3. Check fallback pricing in `payments.ts` (lines 103-116)
4. Restart server after `.env` changes

**If subscription creation fails:**
1. Verify Stripe secret key is correct
2. Check Price ID exists and is active
3. Ensure webhook endpoint is configured
4. Review Stripe logs for errors

**For ad pricing questions:**
1. Canonical prices: $5/week (Mon–Thu), $8/week (Fri–Sun) — see `server/src/utils/adPricing.ts`
2. Pricing is per weekly slot, not per day
3. Test with multi-day ad campaigns

---

**Last Updated:** February 27, 2026
**Status:** ✅ All pricing updated to match code and Stripe (Memberships + Ads)
**Configuration Source:** Stripe Dashboard (live) + `server/src/utils/adPricing.ts`
