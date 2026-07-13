# QA Phase 1 Prep Brief - Day 3 Launch

**Status:** Build in progress  
**ETA:** 3-4 minutes (xcodebuild + simulator launch)  
**Ready to test:** 8:30 AM (estimated)

---

## 🎯 Phase 1 QA Overview

You're about to run a **6-8 hour comprehensive QA test** on a production-ready codebase. This document is your quick reference for the first 2-3 hours (Setup + Core Flows).

**Current Code Status:**

- ✅ 0 TypeScript errors (verified moments ago)
- ✅ All catch blocks fixed (39 files)
- ✅ Video upload iOS fix (simplified approach)
- ✅ Sentry dev errors gated (won't show in dev)
- ✅ Critical floating promises fixed
- ✅ Infrastructure live (API, DB, email, Sentry)

---

## 📋 Phase 1 Roadmap (2-3 Hours)

### Segment 1: Pre-Flight Checks (15-20 min)

**While the build finishes, prepare:**

1. **Open in VS Code:**
   - [ ] Extensions Activity Bar check
   - [ ] Thunder Client ⚡ visible
   - [ ] GitHub icon ready

2. **Terminal tabs ready:**
   - [ ] Tab 1: iOS simulator running
   - [ ] Tab 2: Sentry dashboard (browser)
   - [ ] Tab 3: GitHub Actions (browser)
   - [ ] Tab 4: Test account email open

3. **Test Accounts Ready:**
   - Email: `testuser@varsityhub.test`
   - Password: `Test123!@#` (or check `.env.local`)
   - Admin account: `admin@varsityhub.test`

---

### Segment 2: Core Flow #1 - Sign-Up (40-50 min)

**Goal:** Verify user can go from login → email verification → account creation

**Steps:**

1. App boots → Login screen visible
2. Tap "Create Account"
3. Enter: email (NEW, like `qa-test-1@varsityhub.test`)
4. Enter: password
5. See "Check your email" screen
6. Find verification email (check inbox or Thunder Client `/test-email` endpoint)
7. Enter verification code
8. Complete account creation
9. **Expected:** Account created, logged in, onboarding starts

**Success Metrics:**

- ✅ No crashes
- ✅ Email received within 5 seconds
- ✅ Code works first time
- ✅ Sentry: 0 errors
- ✅ Load time < 2 seconds per screen

**If Email Slow:**

- Use Thunder Client `POST /api/test-email` to manually trigger
- Or check SendGrid logs (check .env for SendGrid API key if needed)

---

### Segment 3: Core Flow #2 - Onboarding (30-40 min)

**Goal:** Complete 10-step onboarding flow without errors

**Steps:**

1. Post-sign-up → See Step 1 (Account Type)
2. Select: "Player" or "Team Lead" (test both if time)
3. Step 2: Fill profile (name, sport, avatar if available)
4. Step 3: Location (allow GPS or enter manual address)
5. Step 4-10: Complete remaining steps
6. **Expected:** Finish onboarding → Dashboard with empty game list

**Success Metrics:**

- ✅ All 10 steps load without lag
- ✅ GPS/location permission granted
- ✅ Back button works between steps
- ✅ Skip optional steps (like photo upload) work
- ✅ No crashes

**If GPS Hangs:**

- Simulator might ask for permission → Tap "Allow"
- If still stuck: Can skip, use manual address instead

---

### Segment 4: Core Flow #3 - Game Discovery & RSVP (30-40 min)

**Goal:** User can find games and RSVP

**Steps:**

1. From dashboard → Tap "Discover" tab
2. See list of games (should have seeded test games)
3. Tap on any game → See details
4. Tap "RSVP" → Confirm participation
5. Check game now shows on dashboard
6. **Expected:** RSVP recorded, game appears in "Upcoming Games"

**Success Metrics:**

- ✅ Games load quickly
- ✅ Game detail screen shows all info
- ✅ RSVP button works
- ✅ Game updates in real-time
- ✅ No crashes

**If No Games Appear:**

- This is expected if test data wasn't seeded
- Can create a test game first (see Segment 5) or skip to testing with admin
- Note: Post-launch, marketing will seed real games

---

### Segment 5: Core Flow #4 - Create Game (as Admin/Lead) (20-30 min)

**Goal:** Game creation works end-to-end

**Steps:**

1. Switch to admin account (if you're not already)
2. Tap "Create" or "Create Game"
3. Fill: Title, Date/Time, Location, Description, Capacity
4. Submit
5. **Expected:** Game created, appears in discovery, others can RSVP

**Success Metrics:**

- ✅ Form validates input
- ✅ Date picker works
- ✅ Location picker works (Google Maps integration)
- ✅ Game saved to database
- ✅ Game visible in Discover instantly

**If Location Picker Hangs:**

- Google Maps might take time to load first time
- Wait 5 seconds, or manually type address
- Can be optimized post-launch if slow

---

## 🔍 Critical Monitoring (Ongoing)

### Sentry Dashboard

Open: https://sentry.io (or your Sentry workspace)

**Watch for:**

- ❌ Any NEW errors during testing
- ✅ Errors from your session appear immediately (5-10 second delay)
- Note stack traces of any issues

**Expected:**

- Dev mode won't show Sentry banners (we gated them)
- Real errors will still be logged to Sentry backend
- If you see an error in Sentry but not on screen, that's correct behavior

### Console Logs (Dev Menu)

- Cmd+D in simulator → Opens dev menu
- Tap "Show Dev Menu" (if not visible)
- Look for TypeScript errors (expect 0)
- Look for unhandled promise rejections (expect 0)
- Warnings are OK (lint-related, non-blocking)

### GitHub Actions

Open: https://github.com/xsantcastx/VarsityHubMobile/actions

**Watch for:**

- Production Readiness workflow should be PASSING
- Any failed jobs = blocker
- Check: Latest push should have green checkmark

---

## 🐛 Bug Triage Quick Guide

### If You Find an Issue:

**Step 1: Classify**

- **Blocking:** App crashes, can't progress, data loss
- **High:** Feature broken but workaround exists
- **Medium:** UI glitch, minor functionality issue
- **Low:** Cosmetic, lint warning, performance

**Step 2: Reproduce**

- Write down exact steps
- Screenshot/video if helpful
- Note error message (if any)

**Step 3: Check Sentry**

- Go to Sentry dashboard
- Search error name
- If it's there: Already logged (good!)
- If not there: Might be silent fail, investigate

**Step 4: Decide Action**

- **Blocking Issues:**
  - Stop testing
  - Create quick git branch: `git checkout -b fix/issue-name`
  - Fix code
  - `npm run typecheck` (verify no new errors)
  - Rebuild: `npx expo run:ios`
  - Re-test issue
  - Commit and continue
- **Non-Blocking Issues:**
  - Note it: create GitHub issue with screenshot
  - Continue testing
  - Fix post-launch in v1.1

---

## ⏱️ Time Budget (Phase 1: 2-3 Hours)

| Activity          | Time                | Status         |
| ----------------- | ------------------- | -------------- |
| Build finishes    | 3-4 min             | ⏳ In progress |
| Pre-flight checks | 15 min              | Ready          |
| Sign-up flow      | 45 min              | Ready          |
| Onboarding        | 40 min              | Ready          |
| Game Discovery    | 40 min              | Ready          |
| Create Game       | 30 min              | Ready          |
| **Phase 1 Total** | **180 min (3 hrs)** | ✅ Planned     |

**Then:**

- 5-min break
- Transition to Phase 2: Advanced flows (teams, messaging, admin)

---

## 🚀 What Success Looks Like (Phase 1)

After completing Phase 1, you should have:

- ✅ App boots cleanly every time
- ✅ Sign-up/email verification works (within 5 seconds)
- ✅ Onboarding flows smoothly (all 10 steps)
- ✅ Games appear in discovery
- ✅ RSVP works
- ✅ Game creation works
- ✅ Zero crashes observed
- ✅ Sentry shows 0 new errors
- ✅ No TypeScript errors in console

**If all above ✅:** You're on track for launch. Proceed to Phase 2.

---

## 🆘 Troubleshooting Quick Reference

### App won't boot

```bash
# Option 1: Clear build
rm -rf ios/build .expo
npx expo run:ios

# Option 2: Clear everything
rm -rf node_modules .expo ios/build
npm install
npx expo run:ios
```

### Simulator frozen

- Cmd+Q to close
- `xcrun simctl erase all` to reset all simulators
- `npx expo run:ios` to rebuild

### Email not arriving

- Check spam folder
- Wait 10 seconds (SendGrid can be slow)
- Use Thunder Client to test endpoint directly

### Build fails on Sentry

- Check: Has Sentry been configured?
- Check: Is Sentry DSN in `.env`?
- If empty, rebuild with: `npx expo prebuild --clean`

### Can't find test accounts

- Check `.env` file for credentials
- Or create new account during sign-up flow (that IS a test)

---

## 📞 When to Call Me

**Stop & Call If:**

- 🛑 App crashes on startup
- 🛑 Sign-up flow doesn't work
- 🛑 Email verification fails (after 30 sec wait)
- 🛑 Can't RSVP to games
- 🛑 GitHub Actions failing
- 🛑 Sentry showing > 10 errors

**Can Handle Yourself:**

- ✅ UI cosmetic issues
- ✅ Performance slow (< 5 sec load)
- ✅ Lint warnings
- ✅ One-off network hiccup
- ✅ Feature works but could be better

---

## 📍 Current Status

**Build Status:** ⏳ In progress  
**Estimated Ready:** 3-4 minutes  
**Next Step:** When build completes, verify login screen loads  
**Then:** Start Phase 1 (sign-up flow)

**You're ready. Build is running. Let's go! 🚀**

---

**Document:** QA Phase 1 Prep Brief  
**Time:** Dec 5, 2025 @ 8:27 AM  
**Duration:** 2-3 hours (Phase 1)  
**Success Criteria:** All core flows working, 0 crashes, 0 new Sentry errors
