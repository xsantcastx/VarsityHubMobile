# Stripe Audit & Fix - Next Steps Summary

**Status:** ✅ Code Fix Complete | 🔄 Ready for QA Testing  
**Commit:** `33e9bbd` - "Fix: Set role='coach' for membership plan purchases in Stripe finalization"

---

## What Was Fixed

**Issue:** Role binding gap in payment finalization  
**Impact:** Users purchasing Veteran/Legend plans couldn't complete Step 4 (organization creation)  
**Root Cause:** `finalizeFromSession()` set `plan` but not `role` to 'coach'  
**Solution:** Added 4-line fix to set `role='coach'` for membership purchases

**Code Change:**

```typescript
// File: server/src/routes/payments.ts, lines 963-965
if (plan === 'veteran' || plan === 'legend') {
  prefs.role = 'coach';
}
```

---

## Immediate Next Steps (This Session)

### ✅ Completed

- [x] Identified critical role binding gap in Stripe finalization
- [x] Implemented fix in `finalizeFromSession()`
- [x] Created comprehensive audit report (`STRIPE_AUDIT_REPORT.md`)
- [x] Created regression test guide (`STRIPE_FIX_REGRESSION_GUIDE.md`)
- [x] Verified code compiles without errors
- [x] Committed changes to main branch

### 🔄 Pending (Required Before Deploy)

1. **Manual Regression Testing** (Critical Path)
   - [ ] Test Veteran plan purchase → Step 4 org creation succeeds
   - [ ] Test Legend plan purchase → Step 4 org creation succeeds
   - [ ] Test Rookie plan selection → Step 4 org creation blocked
   - [ ] Verify DB shows `role='coach'` after paid plan purchases

2. **Backend Testing** (If Backend Available)
   - [ ] Test webhook idempotency (duplicate events handled safely)
   - [ ] Test fallback finalization endpoint (`/finalize-session`)
   - [ ] Monitor payment logs for role binding in transaction logs

3. **QA Sign-Off**
   - [ ] Product/QA confirms all tests pass
   - [ ] No regressions detected in related flows
   - [ ] Payment processing still works correctly

---

## Testing Instructions

### Quick Start (5-10 minutes)

```bash
# 1. Start backend
cd server && npm run dev

# 2. Start app (web or simulator)
npm run web  # or expo run:ios / expo run:android

# 3. Manual test flow:
# - Register new user
# - Complete Step 1-2 onboarding
# - Select Veteran plan in Step 3
# - Complete Stripe checkout (test card: 4242 4242 4242 4242)
# - Proceed to Step 4
# - Verify organization creation form loads and works
```

### Full Test Suite (See STRIPE_FIX_REGRESSION_GUIDE.md)

- Test 1: Veteran plan → Step 4 success
- Test 2: Legend plan → Step 4 success
- Test 3: Rookie plan → Step 4 blocked
- Test 4-6: Advanced scenarios (idempotency, concurrent ops)

---

## Deployment Checklist

**Before Deploying to Production:**

- [ ] All manual regression tests pass
- [ ] QA sign-off obtained
- [ ] No new errors in payment logs
- [ ] Monitoring dashboards reviewed
- [ ] Rollback plan acknowledged (see guide for details)
- [ ] Team notified of deployment time

**Deployment Steps:**

1. Merge main branch to production deployment branch
2. Run migrations (if any) — this fix requires none
3. Deploy backend code
4. Monitor payment logs for 30 minutes
5. Verify role='coach' being set in transaction logs

**Post-Deployment Validation:**

- [ ] New users can complete onboarding flow
- [ ] Payment processing continues normally
- [ ] Step 4 org creation works for paid plans
- [ ] No anomalies in payment/user metrics

---

## Related Documentation

1. **STRIPE_AUDIT_REPORT.md** (Comprehensive)
   - Full security audit of Stripe integration
   - Identifies strengths and the one critical gap
   - Recommendations for future improvements

2. **STRIPE_FIX_REGRESSION_GUIDE.md** (Test Procedures)
   - Step-by-step testing instructions
   - DB verification queries
   - Rollback procedures if issues occur

3. **This File** (Quick Reference)
   - Overview and next steps

---

## Key Metrics to Monitor

After deployment, watch these:

```
1. Payment Success Rate
   - Should remain ~same as before fix
   - If drops > 5%, investigate

2. Step 4 Org Creation Success Rate
   - Should INCREASE (was previously blocked for paid users)
   - Target: 80%+ success rate for paid users

3. Role Distribution
   - New metric: % of users with role='coach'
   - After fix: Should see increase in coaches from paid plan purchases

4. Stripe Webhook Processing
   - Errors should remain < 1%
   - Idempotency should work (no duplicate finalization)

5. User Complaints
   - Watch for "can't create organization after paying" reports
   - If any, roll back immediately
```

---

## Support & Troubleshooting

**Issue:** After purchase, user still can't create organization  
**Action:**

1. Check DB: `SELECT preferences->>'role', preferences->>'plan' FROM "User"`
2. If role='fan': Payment finalization didn't run properly
3. Try manually calling `/finalize-session` endpoint (requires auth)

**Issue:** Payment processing failing after deploy  
**Action:**

1. Check logs for errors in finalizeFromSession
2. Verify Stripe webhook secret is correct
3. Check transaction log for failed entries
4. Roll back if critical issue (see guide)

**Issue:** Duplicate users being marked as 'coach'  
**Action:**

1. Role='coach' is safe to have multiple times (not a constraint)
2. Verify payment wasn't double-charged (check transaction log)
3. If double finalization, check webhook idempotency

---

## Timeline

**Phase 1 (Current - Dec 12):**

- ✅ Code fix implemented
- ✅ Documentation created
- ✅ Changes committed

**Phase 2 (QA Testing - Dec 12-13):**

- Manual regression testing
- QA sign-off
- ETA: 1-2 hours

**Phase 3 (Deployment - Dec 13+):**

- Merge to production branch
- Deploy to staging (verify)
- Deploy to production
- Monitor 30+ minutes
- ETA: 30 mins after approval

---

## Success Criteria

✅ **Fix is successful if:**

1. Users with Veteran/Legend plans have `role='coach'`
2. Step 4 organization creation works for paid users
3. Rookie plan users remain with `role='fan'`
4. Payment processing continues normally
5. No duplicate finalization issues
6. User experience improves (can now complete onboarding)

❌ **Roll back if:**

1. Step 4 fails for paid users post-fix
2. Payment processing breaks
3. Unexpected role='coach' values appear in data
4. Webhook errors spike > 10%

---

## Questions?

Refer to:

- **STRIPE_AUDIT_REPORT.md** - Full technical details
- **STRIPE_FIX_REGRESSION_GUIDE.md** - Testing procedures
- Git commit `33e9bbd` - Exact code change

---

**Last Updated:** December 12, 2025  
**Author:** GitHub Copilot  
**Status:** Code Ready, Awaiting QA Testing
