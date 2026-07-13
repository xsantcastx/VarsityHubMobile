# Stripe Payment Fix - Regression Test Guide

**Fix Applied:** December 12, 2025  
**Issue:** Missing role binding in payment finalization  
**Status:** ✅ Code fix complete, ready for testing

---

## Summary of Change

**File:** `server/src/routes/payments.ts` (lines 956-964)  
**Change:** Added automatic `role='coach'` binding for Veteran/Legend membership purchases

### What Changed

```typescript
// CRITICAL: Set role='coach' for any membership purchase (veteran/legend)
// This is required for Step 4 (organization creation) and allows coaches to manage orgs
if (plan === 'veteran' || plan === 'legend') {
  prefs.role = 'coach';
}
```

**Before:** Only set `plan` during membership finalization  
**After:** Also set `role='coach'` atomically with plan update

---

## Why This Matters

**The Flow:**

1. User registers as 'fan' role
2. User purchases Veteran/Legend plan in Step 3
3. Payment completes via Stripe webhook
4. `finalizeFromSession()` should set `plan='veteran'/'legend'` AND `role='coach'`
5. User proceeds to Step 4 (organization creation)
6. Step 4 requires `role === 'coach'` — would have **FAILED** without this fix

---

## Regression Tests

### Critical Path (Must Pass)

#### Test 1: Veteran Plan Purchase → Step 4 Success

**Scenario:** User purchases Veteran plan and proceeds to Step 4 organization creation

**Steps:**

1. Create new user account (register as 'fan')
2. Navigate to Step 3 Plan selection
3. Select "Veteran" plan
4. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
5. Verify payment success notification
6. Proceed to Step 4 (Organization creation)
7. Attempt to create organization

**Expected Results:**

- ✅ Step 4 organization form loads (no auth error)
- ✅ User can create organization
- ✅ Organization creation succeeds
- ✅ User role in DB shows `role='coach'`
- ✅ User plan in DB shows `plan='veteran'`

**How to Verify in DB:**

```sql
SELECT id, email, preferences->>'plan' as plan, preferences->>'role' as role
FROM "User" WHERE email = '<test_user_email>' LIMIT 1;
```

Expected: `plan='veteran'`, `role='coach'`

---

#### Test 2: Legend Plan Purchase → Step 4 Success

**Scenario:** User purchases Legend (annual) plan and proceeds to org creation

**Steps:**

1. Create new user account
2. Navigate to Step 3
3. Select "Legend" plan
4. Complete Stripe checkout
5. Verify payment success
6. Proceed to Step 4
7. Create organization

**Expected Results:**

- ✅ Step 4 loads without error
- ✅ Organization creation succeeds
- ✅ DB shows `plan='legend'`, `role='coach'`

---

#### Test 3: Rookie Plan → Role Unchanged

**Scenario:** User selects Rookie plan (free) to verify role is NOT set to coach for free plan

**Steps:**

1. Create new user
2. Select "Rookie" plan in Step 3
3. No payment required - proceeds directly
4. Proceed to Step 4
5. Attempt to create organization

**Expected Results:**

- ❌ Step 4 should BLOCK with "Only coaches can create organizations" error
- ✅ DB shows `plan='rookie'`, `role='fan'` (unchanged)
- **Rationale:** Only paying coaches (veteran/legend) should get `role='coach'`

---

### Additional Regression Tests

#### Test 4: Webhook Idempotency

**Scenario:** Verify duplicate webhook events don't double-finalize

**Steps:**

1. Purchase Veteran plan (capture session ID from Stripe test dashboard)
2. Manually trigger webhook for same session twice (via `/webhook` endpoint)
3. Check transaction log and user preferences

**Expected Results:**

- ✅ First webhook: status='COMPLETED', email sent, role set
- ✅ Second webhook: status already 'COMPLETED', no email sent
- ✅ User preferences set once (no duplicates)

---

#### Test 5: Fallback Finalization

**Scenario:** Verify `/finalize-session` endpoint also sets role correctly

**Setup:** This requires backend/API testing

1. Complete Veteran purchase (capture session ID)
2. Simulate webhook failure (don't let webhook process)
3. Call `/finalize-session` endpoint directly
4. Pass authenticated user's JWT + session ID

**Expected Results:**

- ✅ Endpoint validates session belongs to authenticated user
- ✅ Role set to 'coach'
- ✅ Plan set to 'veteran'
- ✅ Success response

---

#### Test 6: Concurrent Checkout + Webhook

**Scenario:** Verify atomic update prevents race condition

**Steps:**

1. User initiates checkout (session created, transaction log = PENDING)
2. While pending, manually call `/finalize-session` endpoint
3. Let webhook fire simultaneously
4. Check final state

**Expected Results:**

- ✅ One finalizer wins (either endpoint or webhook)
- ✅ Role set to 'coach' exactly once
- ✅ No partial/corrupt state
- ✅ Transaction log status = 'COMPLETED'

---

## Manual Testing Checklist

### Pre-Test Setup

- [ ] Backend running locally (`npm run dev` in `server/` directory)
- [ ] Database seeded with test users
- [ ] Stripe test keys configured in `.env`
- [ ] Frontend running (app or web)
- [ ] Browser dev tools open (to check local storage, network)

### Critical Path Tests (Must Pass for Deploy)

- [ ] Test 1: Veteran plan → Step 4 succeeds
- [ ] Test 2: Legend plan → Step 4 succeeds
- [ ] Test 3: Rookie plan → Step 4 blocked (role unchanged)

### Advanced Tests (Nice to Have)

- [ ] Test 4: Webhook idempotency
- [ ] Test 5: Fallback finalization endpoint
- [ ] Test 6: Concurrent operations

### Database Verification

- [ ] Query user after Veteran purchase: `role='coach'`, `plan='veteran'`
- [ ] Query user after Legend purchase: `role='coach'`, `plan='legend'`
- [ ] Query user after Rookie selection: `role='fan'`, `plan='rookie'`

---

## Deployment Readiness Checklist

- [x] **Code Change:** Role binding added to finalizeFromSession
- [x] **Linting:** No errors (warnings only in unrelated files)
- [x] **Compilation:** Server builds without payment-related errors
- [x] **Backward Compatibility:** Only affects membership plan purchases (no breaking changes)
- [ ] **Manual Testing:** All critical path tests passing
- [ ] **QA Sign-Off:** Product/QA confirms tests pass
- [ ] **Monitoring:** Payment logs show role='coach' being set
- [ ] **Deployment:** Code merged to main and deployed to production

---

## Monitoring & Alerts (Post-Deploy)

### Dashboard Metrics

1. **Plan Distribution:** Verify veterans/legends show in dashboard
2. **Role Distribution:** Verify coaches > 0 after payment
3. **Step 4 Success Rate:** Monitor org creation success (should not drop)
4. **Payment Error Rate:** No increase in finalization errors

### Logs to Watch

```
[payments] membership finalize { userId, plan, subscription_id }
```

Should show `role='coach'` being set in transaction log.

### Alert Conditions

- 🔴 **CRITICAL:** If `plan='veteran'` but `role='fan'` → data inconsistency
- 🟡 **WARNING:** If org creation fails for newly-paid users → role binding issue
- 🟡 **WARNING:** If Step 4 returns 403 after successful payment → role not propagated

---

## Rollback Plan

If issues occur post-deploy:

1. **Immediate:** Remove role binding from finalizeFromSession (comment out lines 963-965)
2. **Messaging:** Notify affected users that Step 4 org creation requires manual role update
3. **Permanent Fix:** Investigate why role binding wasn't working, retry with additional validation
4. **Prevention:** Add test to CI/CD to catch this before deploy

---

## Questions & Troubleshooting

**Q: Why is role='coach' set for ALL membership plans (veteran/legend) but not rookie?**  
A: Rookie is free and is a test plan. Only paid memberships grant coach privileges. If you want to support rookie coaches, update the condition to `if (plan === 'veteran' || plan === 'legend' || plan === 'rookie')`.

**Q: What if a user has multiple purchases (e.g., switches from veteran to legend)?**  
A: Each purchase finalization overwrites prefs atomically. User will end up with the latest plan and role='coach' (no issue).

**Q: Can a user downgrade from coach to fan?**  
A: Currently, once `role='coach'` is set, it persists. To downgrade, either:

- Add explicit downgrade endpoint
- Check subscription status and reset role if subscription cancelled (already handled in `/subscription/cancel`)

**Q: Will this break existing production data?**  
A: No. Only new/future purchases will trigger finalization with the new role binding. Existing users are unaffected. If you want to backfill role='coach' for existing veterans/legends, use a data migration script.

---

**Last Updated:** December 12, 2025  
**Author:** GitHub Copilot  
**Status:** Ready for QA Testing
