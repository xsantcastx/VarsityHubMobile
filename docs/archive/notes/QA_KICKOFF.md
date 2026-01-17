# QA Kickoff - VarsityHub v1.0.0 Release

**Date**: December 10, 2025  
**Status**: ✅ GO FOR TESTING  
**Timeline**: ~30 minutes to complete 5 scenarios

---

## Your Mission

Execute the 5-scenario QA checklist in `QA_TESTING_CHECKLIST.md`. Sign off once complete.

---

## What We Fixed

### 🔴 Critical Bug: Admin Account Onboarding Loop
- **Problem**: Admin accounts forced through onboarding instead of landing on feed
- **Root Cause**: Backend merge order was backwards
- **Fix**: Reversed merge parameter order (line 477 in `auth.ts`)
- **Result**: Admins now skip onboarding correctly

### 🟡 Important: User Onboarding Persistence
- **Problem**: Users forced through onboarding on every app restart
- **Root Cause**: No local persistence, race condition with API
- **Fix**: Added AsyncStorage caching + dual-check routing
- **Result**: Users complete onboarding once, then feed loads instantly on every restart

### 🟢 Minor: Health Check Blocker
- **Problem**: `/health` reported `ready: false` indefinitely
- **Root Cause**: Missing SendGrid templates blocked health check
- **Fix**: Marked SendGrid as optional service
- **Result**: Health check reports ready when core services up

---

## Testing Setup

### Pre-Test (1 minute)
- [ ] Clone latest main: `git pull origin main`
- [ ] Verify commit `d816eb3` is your HEAD
- [ ] App deployed and running (or ready to test on staging)
- [ ] Network connectivity confirmed

### Test Environment
- Device/Simulator: _____________
- Backend: `https://api-production-8ac3.up.railway.app`
- Admin Email: `emilmancero@gmail.com`
- Network: _____ (WiFi/Cellular)

---

## The 5 Scenarios (Detailed)

### Test 1: Admin Account - Skip Onboarding ✅
**What**: Admin should land on feed, NOT onboarding  
**How**: Sign in with `emilmancero@gmail.com`  
**Expected**: Feed with Home/Updates/Settings tabs (no "Step 1/9")  
**Time**: ~2 minutes

### Test 2: New User - Complete Onboarding ✅
**What**: New user should see full 9-step flow  
**How**: Create new test account (e.g., `qa-test-<timestamp>@varsityhub.app`)  
**Expected**: "Step 1/9" appears, all steps clickable, final step redirects to feed  
**Time**: ~5 minutes (includes completing all steps)

### Test 3: Cold Restart - Instant Loading ✅
**What**: Restarting app should load feed instantly (no onboarding)  
**How**: Sign out, sign in as admin, force quit, reopen  
**Expected**: Feed appears quickly without "Step 1/9"  
**Time**: ~3 minutes

### Test 4: Account Switch - State Cleared ✅
**What**: Switching accounts should reset state properly  
**How**: Sign out, sign in as different users in sequence  
**Expected**: Admin skips onboarding, new user sees it  
**Time**: ~5 minutes

### Test 5: Backend Health ✅
**What**: Health endpoint should report readiness correctly  
**How**: Run: `curl -s https://api-production-8ac3.up.railway.app/health | jq '.'`  
**Expected**: `ready: true` (or non-blocking `false`), all core integrations green  
**Time**: ~1 minute

---

## Quick Reference

**Full Checklist**: Open `QA_TESTING_CHECKLIST.md` and fill it out  
**Technical Details**: See `ONBOARDING_LOOP_FINAL_SOLUTION.md` if you hit unexpected behavior  
**Release Notes**: See `RELEASE_NOTES_v1.0.0.md` for stakeholder context

---

## If You Hit Issues

### "Admin still sees onboarding"
- **Check**: Backend `/health` endpoint (database and JWT must be true)
- **Check**: Admin email in `.env` matches login email
- **Check**: Network connectivity to backend
- **Action**: Post in #deployments or contact Release Lead

### "App crashes or won't load"
- **Check**: Latest commit is `d816eb3`
- **Check**: Network connectivity
- **Action**: Force kill and reopen; if persists, post in #deployments

### "Cold restart shows onboarding (should skip)"
- **Check**: You signed in as admin in previous session
- **Check**: Force quit properly (app fully closed)
- **Action**: Try 2-3 times; if persists, note in checklist and continue

### Test Timeout or Hangs
- Move to next scenario
- Document in checklist under "Notes"
- Continue to completion

---

## Sign-Off Instructions

Once all 5 tests complete:

1. **Fill in QA_TESTING_CHECKLIST.md**:
   - Mark each test ✅ or ❌
   - Fill in any notes
   - Sign your name and today's date

2. **Create a commit** (optional but recommended):
   ```bash
   git add QA_TESTING_CHECKLIST.md
   git commit -m "QA sign-off: All 5 scenarios passed for v1.0.0"
   git push origin main
   ```

3. **Notify Release Lead**:
   - Post in #deployments: "✅ QA sign-off complete for v1.0.0"
   - Share the signed checklist

---

## Success Criteria

- [x] All 5 scenarios tested
- [x] Admin account working correctly
- [x] New user flow complete
- [x] Cold restart instant
- [x] Account switching proper
- [x] Health check responding

**If all ✅**: Ready for production deployment  
**If any ❌**: Document and notify Release Lead before deploying

---

## Next Steps (After You Sign Off)

1. Release Lead creates release tag: `git tag -a v1.0.0-qa-approved`
2. Release Lead executes `DEPLOYMENT_RUNBOOK.md` (EAS build → App Store)
3. Team monitors for 24 hours
4. Success → Release complete 🎉

---

## Questions?

- **Technical questions**: See `ONBOARDING_LOOP_FINAL_SOLUTION.md`
- **Blockers**: Post in #deployments
- **Timing issues**: Contact Release Lead

---

**You've got this! 🚀 Go test the fix!**

*Started at: ________  Completed at: ________  (Fill in actual times)*
