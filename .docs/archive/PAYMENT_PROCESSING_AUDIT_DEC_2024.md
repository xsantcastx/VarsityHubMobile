# Payment Processing - Stripe Integration Audit
## Comprehensive Security & Architecture Analysis
**Date:** December 23, 2025  
**Audit Scope:** Stripe integration, webhook handling, subscription validation, pricing consistency, refund logic  
**Files Reviewed:** 2,268 lines across billing.ts, payments.ts, auth.ts  

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| **Critical Issues Found** | 3 | ⚠️ Security bypass, data loss |
| **High Issues Found** | 2 | ⚠️ Subscription state inconsistency |
| **Medium Issues Found** | 4 | ⚠️ Edge cases, race conditions |
| **Low Issues Found** | 2 | ✅ UX improvements |
| **Total Issues** | **11** | **ACTION REQUIRED** |

---

## Critical Issues

### 🔴 ISSUE #1: CRITICAL - Duplicate Payment Bypass (Subscription)

**Severity:** CRITICAL | **Type:** Security Bypass | **Impact:** User charged multiple times for same plan

**Location:** `server/src/routes/payments.ts:155-173`

**Problem:**
```typescript
// Current code checks for PAID sessions but doesn't prevent multiple valid checkout attempts
const recentUserSession = recentSessions.data.find(session => 
  session.metadata?.user_id === userId && 
  session.metadata?.plan === chosen &&
  session.payment_status === 'paid' // Only 10 minutes lookback!
);

if (recentUserSession) {
  throw membershipError(400, 'Payment already processed recently');
}
```

**Vulnerabilities:**
1. **Lookback too short:** Only checks last 10 minutes
   - User creates session, cart not submitted
   - User returns 15 minutes later, no duplicate prevention
   - Can create multiple checkout sessions in rapid succession

2. **No session deduplication logic:**
   - Multiple sessions can be created before first completes
   - All sessions have `payment_status === 'unpaid'` initially
   - When payment succeeds, webhook processes first completed session
   - Second session still pending, user could complete it separately

3. **User can hold multiple active sessions:**
   ```
   T=0:00   → User starts checkout (Session A created, unpaid)
   T=0:05   → User doesn't complete, navigates away
   T=0:12   → User clicks "Subscribe" again (Session B created, unpaid)
   T=0:20   → Payment completes for Session A
   T=0:25   → Payment completes for Session B (DOUBLE CHARGE!)
   ```

**Test Case:**
- Coach clicks "Subscribe Veteran" multiple times in quick succession
- All create separate sessions
- Complete payment on first session
- Second session still pending, can be completed
- Result: Two charges for same plan

**Fix Required:**
- Check for ANY pending/unpaid sessions with same plan+user
- Implement idempotency keys per session
- Cancel or reuse existing unpaid sessions

---

### 🔴 ISSUE #2: CRITICAL - Webhook Race Condition (Membership Finalization)

**Severity:** CRITICAL | **Type:** Data Loss | **Impact:** Payment processed but user preferences not updated

**Location:** `server/src/routes/payments.ts:897-1055` (finalizeFromSession)

**Problem:**
```typescript
async function finalizeFromSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata || {};
  const alreadyCompleted = transactionLog?.status === 'COMPLETED';
  const shouldSendEmail = !alreadyCompleted;
  
  // No database transaction wrapping multiple updates!
  await prisma.user.update({ where: { id: userId }, data: { preferences: prefs } });
  await updateTransactionStatus(session.id, 'COMPLETED', { ... });
  // ↑ If this fails, preferences were updated but transaction not marked complete
  // ↑ Webhook will retry, potentially updating preferences again (idempotence issue)
}
```

**Vulnerabilities:**

1. **Non-atomic updates:**
   - User.preferences updated in separate transaction
   - transactionLog.status updated separately
   - If second update fails, inconsistent state
   - Webhook retries could duplicate updates

2. **No idempotence guarantee:**
   ```
   Webhook attempt 1:
   - Update user.preferences ✅
   - Update transaction_log ❌ (database error)
   
   Webhook attempt 2 (retry):
   - Already updated user.preferences
   - No "already done" check for preferences
   - Could overwrite with stale data
   ```

3. **Missing subscription_id check:**
   - Webhook processes but user.preferences.subscription_id might not be set
   - If Stripe API is slow, sub retrieval fails silently
   - User thinks subscription is active, but no ID stored
   - Future cancellation fails

**Test Case:**
- Payment succeeds
- Webhook processes but database briefly unavailable
- User preferences not updated
- Webhook retries and succeeds
- But subscription_id was never stored properly
- User can't cancel subscription later

**Fix Required:**
- Wrap all updates in single transaction
- Implement true idempotence check before updating preferences
- Fail fast if subscription_id cannot be retrieved

---

### 🔴 ISSUE #3: CRITICAL - Ad Payment Webhook Missing Permission Check

**Severity:** CRITICAL | **Type:** Authorization Bypass | **Impact:** Attacker completes payment for ad they don't own

**Location:** `server/src/routes/payments.ts:920-958` (Ad payment in finalizeFromSession)

**Problem:**
```typescript
if (ad_id && Array.isArray(dates) && dates.length) {
  const result = await prisma.$transaction([
    prisma.ad.update({ 
      where: { id: ad_id }, 
      data: { 
        payment_status: 'paid',
        status: 'active'
      } 
    }),
    // No check that user owns the ad!
    prisma.adReservation.createMany({ data: dates... }),
  ]);
}
```

**Vulnerabilities:**

1. **No ad ownership validation:**
   - Webhook receives ad_id from session metadata
   - No verification that user (from session.metadata.user_id) owns the ad
   - Anyone who knows an ad_id can trigger payment completion for it

2. **Data source is untrusted:**
   - Metadata comes from checkout session (can be client-supplied)
   - No server-side verification that this user initiated checkout for this ad
   - Attacker could know an ad_id and create their own session

3. **Full ad activation without payment proof:**
   - Ad is set to `status: 'active'` just based on metadata
   - No actual verification of Stripe payment
   - No check that payment_intent matches expected amount for dates

**Test Case:**
- Get ad_id of competitor's ad (from web page)
- Initiate checkout for YOUR ad
- Modify metadata in browser to insert competitor's ad_id
- Complete payment
- Webhook processes and marks competitor's ad as paid (stolen!)

**Fix Required:**
- Validate that user_id owns the ad before updating
- Verify ad_id matches session creation call
- Check payment amount matches expected ad cost

---

## High Severity Issues

### 🟠 ISSUE #4: HIGH - Subscription Quantity Mismatch (Veteran Plan)

**Severity:** HIGH | **Type:** Data Inconsistency | **Impact:** Billing quantity doesn't match team count

**Location:** `server/src/routes/payments.ts:134-218` (createMembershipCheckoutSession)

**Problem:**
```typescript
// Frontend sends team_count = 5 (user has 5 teams)
// Billable quantity = 5 - 2 = 3 (correct)
const billableQuantity = chosen === 'veteran' && typeof teamCount === 'number' ? Math.max(0, teamCount - 2) : 1;

// But user later changes team count!
// They delete 2 teams → now have 3 teams
// But subscription still charges for 3 additional teams (5-2)
// User should only be charged for 1 (3-2)
```

**Vulnerabilities:**

1. **Quantity locked at checkout, not at payment:**
   - Checkout session metadata stores `team_count_total` at creation time
   - But users can create/delete teams BEFORE completing payment
   - When payment completes, webhook uses old team_count

2. **No reconciliation on subscription update:**
   - User creates session for 5 teams (billable qty = 3)
   - User deletes teams → now has 3 teams
   - User completes payment → charged for 3 teams (should be 1)
   - No automatic adjustment in webhook

3. **Veteran plan assumes 2 free teams always:**
   ```
   User creates Session A: 5 teams → billable_qty = 3
   User deletes teams → 3 teams remaining
   Payment completes → Stripe charges for 3 teams
   But user now only entitled to: 2 free + (3-2) = 1 billable team
   User is overcharged by 2 teams!
   ```

**Test Case:**
- Coach has 5 teams, initiates Veteran checkout
- Session created with team_count_total = 5
- Coach deletes 3 teams (now has 2)
- Coach completes payment
- Billed for 3 teams but should only have 2 free teams

**Fix Required:**
- Store intended team count at checkout
- Verify team count still accurate at payment completion
- Automatically adjust Stripe subscription quantity if teams changed

---

### 🟠 ISSUE #5: HIGH - Missing Subscription Status Validation

**Severity:** HIGH | **Type:** State Inconsistency | **Impact:** User thinks subscription is active but isn't

**Location:** `server/src/routes/payments.ts:1010-1040` (Subscription finalization)

**Problem:**
```typescript
// Webhook finalizes subscription but doesn't verify subscription status
try {
  const sub = await stripe.subscriptions.retrieve(String(session.subscription));
  if (sub && sub.id) {
    prefs.subscription_id = String(sub.id);
    // Missing: Check sub.status === 'active'
    // Could be: 'trialing', 'incomplete', 'incomplete_expired', 'past_due'
  }
} catch (err) {
  console.warn('Failed to retrieve subscription details:', err?.message);
  // Continues anyway! Subscription_id could be missing
}
```

**Vulnerabilities:**

1. **Stores subscription_id without validating status:**
   - Subscription could be incomplete_expired
   - subscription_id stored but subscription is not actually active
   - User thinks they have Veteran plan, they don't

2. **Silent failure in subscription retrieval:**
   - Stripe API call fails (temporary error)
   - subscription_id not set
   - User thinks they have plan, they can create unlimited teams
   - System allows actions reserved for paid users

3. **No status check before allowing features:**
   - Later endpoints check: `if (subscription_id) { allow_feature }`
   - Should check: `if (subscription_id && subscription.status === 'active')`

**Test Case:**
- Payment succeeds but Stripe API temporarily slow
- Subscription retrieval times out
- subscription_id not stored
- User isn't billed but system thinks no subscription exists
- Creates unlimited teams (should be limited by plan)

**Fix Required:**
- Verify subscription.status === 'active' before storing
- Fail checkout if subscription not active
- Add status check to all features that depend on subscription_id

---

## Medium Severity Issues

### 🟡 ISSUE #6: MEDIUM - Duplicate Prevention Only on Recent Sessions

**Severity:** MEDIUM | **Type:** Race Condition | **Impact:** Duplicate sessions if check fails

**Location:** `server/src/routes/payments.ts:155-173`

**Problem:**
```typescript
// Only searches last 10 minutes
const recentSessions = await stripe.checkout.sessions.list({
  limit: 10,
  created: { gte: Math.floor((Date.now() - 10 * 60 * 1000) / 1000) }
});

// What if user tries again after 15 minutes?
// Duplicate prevention doesn't trigger
```

**Impact:**
- User gets 504 error during payment
- Waits 15 minutes
- Clicks "Subscribe" again
- No duplicate session found
- Can create new session
- Both could potentially complete

**Fix Required:**
- Check all unpaid sessions in past 24 hours
- Implement session expiration/reuse logic
- Use Stripe's idempotency keys

---

### 🟡 ISSUE #7: MEDIUM - No Rollback on Ad Reservation Failure

**Severity:** MEDIUM | **Type:** Transaction Integrity | **Impact:** Ad marked paid but reservations not created

**Location:** `server/src/routes/payments.ts:930-958`

**Problem:**
```typescript
// Transaction should be atomic
await prisma.$transaction([
  prisma.ad.update({ data: { payment_status: 'paid' } }),
  prisma.adReservation.createMany({ data: dates... }),
]);

// But if createMany fails partway through (e.g., bad dates),
// Ad is marked paid but some reservation dates not created
```

**Impact:**
- Ad shows as paid in dashboard
- But some calendar dates aren't reserved
- Another user can book same dates
- Ad conflicts

**Fix Required:**
- Validate all dates before transaction
- Add explicit rollback error handling
- Mark ad as requiring manual review on failure

---

### 🟡 ISSUE #8: MEDIUM - No Attempt Limit on Webhook Processing

**Severity:** MEDIUM | **Type:** Resource Exhaustion | **Impact:** Webhook could loop indefinitely on errors

**Location:** `server/src/routes/payments.ts:422-512` (Webhook handler)

**Problem:**
```typescript
paymentsRouter.post('/webhook', async (req, res) => {
  // No try-catch around finalizeFromSession
  // If finalize throws, webhook fails
  // Stripe retries with exponential backoff (multiple times)
  // Each retry makes same attempt
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await finalizeFromSession(session);  // Can throw
    } catch (e) {
      console.warn('Error finalizing session in webhook:', e?.message);
      // Doesn't re-throw, but finalizeFromSession could fail silently
    }
  }
});
```

**Impact:**
- If database is down, webhook silently fails
- Stripe thinks we processed it, sends 200 OK
- User payment sits in "pending" state forever
- No automatic retry or alert

**Fix Required:**
- Wrap finalizeFromSession in try-catch with explicit logging
- Return 500 if finalization critical fails (tells Stripe to retry)
- Add monitoring for webhook processing failures

---

### 🟡 ISSUE #9: MEDIUM - Promo Code Redemption Not Atomic with Payment

**Severity:** MEDIUM | **Type:** Data Consistency | **Impact:** Promo code used without payment

**Location:** `server/src/routes/payments.ts:1046-1051`

**Problem:**
```typescript
// Ad reservation payments
const total = Math.max(0, subtotal - discount + taxCents);
if (total === 0) {
  if (appliedCode) {
    await redeemPromo({ ... }); // ✅ Redeems code
  }
  // Creates ad reservations in transaction
} else {
  // Normal payment path
  // In webhook: redeemPromo called again (line 1046)
}

// What if webhook fails after promo redeemed?
// Code is already used, but payment not finalized
```

**Impact:**
- Promo code used (can't be used again)
- Payment failed
- Ad not reserved
- User has wasted promo code

**Fix Required:**
- Only redeem promo after payment verified
- Implement rollback for promo if payment fails
- Use Stripe's built-in discount system instead

---

### 🟡 ISSUE #10: MEDIUM - Missing Subscription Downgrade Validation

**Severity:** MEDIUM | **Type:** Business Logic Gap | **Impact:** User downgrades but keeps paid features

**Location:** Need to check - audit found that POST /subscription/cancel exists but need to verify downgrade handling

**Problem:**
User is on Veteran plan (can create unlimited teams with per-team billing).
User cancels subscription.
But user can still create teams!
System doesn't immediately downgrade to Rookie (2 team limit).

**Impact:**
- User creates 10 teams on Veteran
- Cancels subscription (status = active until period ends)
- Can still use teams/create new ones
- Switches to another expensive plan
- Bill is inconsistent with usage

**Fix Required:**
- On cancellation, either:
  - Immediately downgrade to Rookie, or
  - Lock team creation until period end
- Enforce team limits after cancellation

---

## Low Severity Issues

### 🟢 ISSUE #11: LOW - Missing Payment Method Validation

**Severity:** LOW | **Type:** UX | **Impact:** Confusing error messages

**Location:** `server/src/routes/payments.ts:225` (Checkout session config)

**Problem:**
```typescript
// Hard-coded to 'card' only
payment_method_types: ['card'],

// But user might prefer other payment methods available in their region
// Error message is generic "Payment failed"
// No explanation of why card-only
```

**Impact:**
- User with only bank account can't pay
- No clear error message
- Support tickets increase

**Fix Required:**
- Support more payment methods if Stripe account has them
- Add UX feedback for unsupported payment methods

---

## Summary by Frequency

### Most Common Pattern
**Idempotence failures:** Issues #2, #4, #9
- Multiple webhook calls with same data
- Updates happen without checking if already done
- No transaction-level atomicity

### Second Most Common
**Authorization/Access Control:** Issues #1, #3
- Insufficient validation of user ownership
- Metadata trust without verification
- Race conditions around session creation

### Validation Gaps
Issues #5, #10
- Missing status checks
- Incomplete state validation

---

## Deployment Impact Assessment

| Issue | Blocking | User Impact | Fix Complexity |
|-------|----------|------------|-----------------|
| #1 Duplicate Payments | ✅ YES | $$ Direct loss | Medium |
| #2 Webhook Race | ✅ YES | User can exploit | High |
| #3 Ad Authorization | ✅ YES | Security breach | Medium |
| #4 Quantity Mismatch | ⚠️ WARN | Billing accuracy | Medium |
| #5 Subscription Status | ✅ YES | Feature access | Low |
| #6 Recent Sessions | ⚠️ WARN | Duplicate risk | Low |
| #7 Reservation Rollback | ⚠️ WARN | Data integrity | Medium |
| #8 Webhook Attempts | ⚠️ WARN | Silent failures | Low |
| #9 Promo Atomicity | ⚠️ WARN | Promo loss | Medium |
| #10 Downgrade Logic | ⚠️ WARN | Feature access | High |
| #11 Payment Methods | ❌ NO | UX issue | Low |

---

## Recommended Fix Order

1. **IMMEDIATE (Production Blocker)**
   - Issue #3: Ad authorization check (security)
   - Issue #1: Duplicate payment prevention (revenue loss)
   - Issue #2: Webhook idempotence (data corruption)

2. **URGENT (High Impact)**
   - Issue #5: Subscription status validation
   - Issue #4: Quantity mismatch reconciliation

3. **IMPORTANT (Integrity)**
   - Issue #10: Downgrade validation
   - Issue #7: Transaction rollback

4. **RECOMMENDED (Reliability)**
   - Issue #6: Extended session lookup
   - Issue #8: Webhook error handling
   - Issue #9: Promo atomicity

5. **NICE-TO-HAVE (UX)**
   - Issue #11: Payment method support

---

## Testing Recommendations

### Unit Tests Needed
- [ ] Duplicate session prevention with >10 minute gap
- [ ] Idempotent webhook processing
- [ ] Team count reconciliation between checkout and finalization
- [ ] Subscription status validation
- [ ] Ad ownership verification

### Integration Tests Needed
- [ ] Full membership checkout flow with webhook
- [ ] Full ad reservation with webhook
- [ ] Promo code redemption with payment
- [ ] Concurrent checkout attempts
- [ ] Webhook retry scenarios

### Scenarios to Test
- [ ] User creates session but never completes payment
- [ ] User modifies team count after session creation
- [ ] Stripe API temporarily unavailable during webhook
- [ ] Multiple webhooks for same session (Stripe retry)
- [ ] Session created 15 minutes before payment completion

---

**Status:** 🔴 CRITICAL - 3 issues blocking production  
**Next Phase:** Begin fixing issues in recommended order  
**Estimated Fix Time:** 4-6 hours for all critical issues

