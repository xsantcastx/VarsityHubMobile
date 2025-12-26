# Stripe Live Keys Configuration Guide
**Purpose**: Update from test keys to live production keys for v1.0.1 submission  
**Status**: 🔴 BLOCKING - Must complete before QA testing  
**Time Estimate**: 5 minutes

---

## Overview

Currently, the app is using **test Stripe keys** (`sk_test_...`). Before submitting to Apple App Review, you must update to **live production keys** (`sk_live_...`).

### Why?
- Test keys generate test charges (not real money)
- App Review will reject if paying users can't actually be charged
- Live keys enable real payment processing for Veteran/Legend plans

---

## Quick Update (5 minutes)

### Step 1: Get Your Live Keys from Stripe

**Go to Stripe Dashboard**:
```
https://dashboard.stripe.com
```

**Navigate to API Keys**:
```
Developers (top right) → API Keys
```

**You should see two sets of keys**:
```
TEST KEYS (not needed anymore):
├─ Publishable: pk_test_...
└─ Secret: sk_test_...

LIVE KEYS (copy these):
├─ Publishable: pk_live_...
└─ Secret: sk_live_...
```

**Copy the LIVE Secret Key**:
```
Click "Copy" next to the LIVE Secret Key (starts with sk_live_)
```

---

### Step 2: Get Your Webhook Secret from Stripe

**Navigate to Webhooks**:
```
Developers (top right) → Webhooks
```

**Find your endpoint**:
```
Look for: https://api-production-8ac3.up.railway.app/webhooks/stripe
Click on it
```

**Copy the Signing Secret**:
```
In the "Signing secret" section, click "Reveal"
Copy: whsec_XXXXX... (your live webhook secret)
```

---

### Step 3: Update Railway Environment Variables

**Go to Railway Dashboard**:
```
https://railway.app
```

**Navigate to Production Variables**:
```
Project: VarsityHub
Branch: chore/deploy-checklist
Settings → Variables
```

**Update STRIPE_SECRET_KEY**:
```
Find: STRIPE_SECRET_KEY
Current value: sk_test_...
New value: sk_live_... (your live secret key)
Click: Save
```

**Update STRIPE_WEBHOOK_SECRET**:
```
Find: STRIPE_WEBHOOK_SECRET
Current value: whsec_... (might be test)
New value: whsec_... (your live webhook secret)
Click: Save
```

**Important**: Do NOT update the publishable keys (pk_test_ / pk_live_) yet.  
Reason: Mobile apps can use test or live publishable keys; the secret key controls actual charging.

---

### Step 4: Verify Deployment

**Check Railway Deployments**:
```
Railway.app → Deployments
Wait for green checkmark (2-5 minutes)
```

**Verify API is Healthy**:
```bash
curl https://api-production-8ac3.up.railway.app/health | jq .integrations.stripe
# Should show: true
```

---

## Testing Stripe Integration

### Before You Test:
⚠️ **Important**: Using live keys means real charges will be processed!

For testing without charging:
1. Use Stripe test card: `4242 4242 4242 4242`
2. In Stripe Dashboard: Create a test mode account for testing
3. Or: Use a very low price (e.g., $0.01) for test checkout

### Test Flow:
```
1. In app: Subscribe to Veteran ($4.99/month)
2. At checkout: Use test card 4242 4242 4242 4242
3. Any future date, any CVC (e.g., 12/25, CVC 123)
4. Should show "Payment successful"
5. Check Stripe Dashboard → Payments for the charge
6. Verify it's marked as "Test mode" (not "Live")
```

---

## Detailed Reference: What Each Key Does

| Key | Purpose | Format | Where Used |
|-----|---------|--------|-----------|
| **STRIPE_SECRET_KEY** | Server-side authentication; processes real charges | `sk_live_...` | Railway env var (CRITICAL TO UPDATE) |
| **STRIPE_WEBHOOK_SECRET** | Validates webhook signatures from Stripe | `whsec_...` | Railway env var (must match live endpoint) |
| **Publishable Key** | Client-side token generation (can be test or live) | `pk_live_...` | `app.json` or code (not urgent) |

**Focus for v1.0.1**: Update STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET only.

---

## Stripe Pricing Configuration

Verify your plan pricing is correct in Stripe:

**Check in Stripe Dashboard → Products**:

1. **Rookie Plan** (if applicable)
   - Price: $0 (free, should already exist)

2. **Veteran Plan**
   - Price: $4.99/month (or your configured amount)
   - Billing: Monthly
   - ID: `price_XXXXXXXXXXXXXXXXXXXXXX` (copy this)

3. **Legend Plan**
   - Price: $9.99/month (or your configured amount)
   - Billing: Monthly
   - ID: `price_XXXXXXXXXXXXXXXXXXXXXX` (copy this)

**If prices are incorrect**:
1. Edit in Stripe Dashboard → Products → [Plan] → Edit pricing
2. Or create new products with correct pricing
3. Get the new Price IDs
4. Update in Railway:
   - `STRIPE_PRICE_VETERAN=price_...`
   - `STRIPE_PRICE_LEGEND=price_...`

---

## Potential Issues & Solutions

### Issue: "Invalid API key" error when trying to charge
**Cause**: STRIPE_SECRET_KEY not updated  
**Solution**: 
1. Verify value starts with `sk_live_` (not `sk_test_`)
2. Copy entire key again from Stripe Dashboard
3. Paste into Railway (no extra spaces)
4. Wait for deployment
5. Try charge again

### Issue: Webhook signature verification fails
**Cause**: STRIPE_WEBHOOK_SECRET doesn't match endpoint  
**Solution**:
1. In Stripe Dashboard → Developers → Webhooks
2. Find your endpoint URL
3. Click to open
4. Copy the "Signing secret" from inside
5. Paste into Railway as STRIPE_WEBHOOK_SECRET
6. Deploy and test

### Issue: "Payment declined" when using test card
**Cause**: Using live secret key with test card  
**Solution**:
1. This is correct behavior - don't use real customer data with live keys
2. For testing with live keys, create a Stripe test account OR
3. Switch back to test keys temporarily, test, then switch to live

### Issue: Can't find my endpoint in Webhooks list
**Cause**: Endpoint might not be created yet  
**Solution**:
1. In Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://api-production-8ac3.up.railway.app/webhooks/stripe`
4. Events: Select "charge.succeeded", "payment_intent.succeeded", "invoice.payment_succeeded"
5. Click "Add endpoint"
6. Copy signing secret
7. Update Railway STRIPE_WEBHOOK_SECRET

---

## Checklist Before QA Testing

- [ ] Stripe Live Secret Key copied (`sk_live_...`)
- [ ] Stripe Live Webhook Secret copied (`whsec_...`)
- [ ] Railway STRIPE_SECRET_KEY updated
- [ ] Railway STRIPE_WEBHOOK_SECRET updated
- [ ] Deployment completed (green checkmark in Railway)
- [ ] Health check verified: `curl https://api-production-8ac3.up.railway.app/health | jq .integrations.stripe`
- [ ] Ready to test payment flow in QA suite

---

## After Update: What Happens

### Real Charges Will Now Be Processed
```
Coach upgrades to Veteran → Real $4.99 charge
Coach upgrades to Legend → Real $9.99 charge
```

### Test in TestFlight
```
1. Install v1.0.1 build from TestFlight
2. Create coach account
3. Try upgrading to Veteran/Legend
4. Use Stripe test card (4242 4242 4242 4242) if not doing real testing
5. Verify in Stripe Dashboard → Payments that charge appears
```

---

## Rollback Plan (If Needed)

If you need to revert to test keys:
```
1. In Railway → Variables
2. Change STRIPE_SECRET_KEY back to sk_test_...
3. Change STRIPE_WEBHOOK_SECRET back to whsec_test_...
4. Save and wait for deployment
5. Health check will still pass
```

⚠️ **Don't do this unless absolutely necessary - Apple expects live keys before submission.**

---

## Next Steps

1. ✅ Update STRIPE_SECRET_KEY in Railway
2. ✅ Update STRIPE_WEBHOOK_SECRET in Railway
3. ✅ Wait for deployment
4. ✅ Run health check to verify
5. ✅ Proceed to QA testing: `bash RUN_QA_TESTS.sh`

---

**Status**: 🔴 BLOCKING  
**Priority**: CRITICAL - Must complete before QA  
**Time Estimate**: 5 minutes  
**Last Updated**: December 26, 2025

**Questions?** Check Stripe documentation: https://stripe.com/docs/keys
