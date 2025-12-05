# Day 3 QA Testing Checklist

**Date:** December 5, 2025  
**Status:** ✅ Ready to Execute  
**Estimated Duration:** 6-8 hours

---

## ✅ Pre-QA Setup (15 minutes)

### Extensions Setup
- [ ] Reload VS Code (Cmd+Shift+P → "Developer: Reload Window")
- [ ] See "Recommended Extensions" notification
- [ ] Click "Install All" (wait 3-5 minutes)
- [ ] Restart VS Code

### Verify Tools Working
- [ ] Thunder Client (⚡ icon in Activity Bar)
- [ ] GitHub Actions (GitHub icon shows workflow)
- [ ] React Native debugging (F5 works)
- [ ] Run `npm run typecheck` (expect 0 errors)
- [ ] Run `npx expo lint 2>&1 | grep "problems"` (expect 400 warnings)

### Fresh Build
- [ ] Run `npm install` (update packages if needed)
- [ ] Run `npx expo start --ios` (build fresh iOS simulator)
- [ ] Verify app loads without errors

---

## 🎯 Core Flow Testing (2-3 hours)

### Sign-Up Flow
- [ ] Open app → See login screen
- [ ] Tap "Create Account"
- [ ] Enter email and password
- [ ] See email verification screen
- [ ] Check email (or test endpoint)
- [ ] Enter verification code
- [ ] Successfully sign up
- [ ] Sentry check: No errors (⚠️ Note any)

### User Onboarding (10 steps)
- [ ] Step 1: Account type selection (User/Veteran/Admin)
- [ ] Step 2: Profile info (name, sport)
- [ ] Step 3: Location setup (address/GPS)
- [ ] Step 4: Team affiliation (if applicable)
- [ ] Step 5: Availability preferences
- [ ] Step 6: Experience level
- [ ] Step 7: Role/position (if team)
- [ ] Step 8: Connect social (optional)
- [ ] Step 9: Photo upload (optional)
- [ ] Step 10: Review & confirm
- [ ] End: Successfully created account

### Game Discovery & RSVP
- [ ] Navigate to Discover tab
- [ ] See list of games
- [ ] Tap on a game
- [ ] See game details (time, location, players)
- [ ] Tap "RSVP"
- [ ] See confirmation
- [ ] Game updated on dashboard

### Create Game (Admin/Organizer)
- [ ] Navigate to Create Game
- [ ] Fill in game details (name, time, location, etc.)
- [ ] Set capacity
- [ ] Add description
- [ ] Submit game
- [ ] See success message
- [ ] Game appears in discovery

### Team Management
- [ ] Create a new team
- [ ] See team dashboard
- [ ] Add team members (invite)
- [ ] See members join
- [ ] Update team info
- [ ] Leave team (test role)

### Messaging System
- [ ] Find another user
- [ ] Send message
- [ ] Receive message
- [ ] See message in thread
- [ ] Send media (if supported)
- [ ] See safety features (report, block)

### Admin Dashboard
- [ ] Login as admin
- [ ] See dashboard overview
- [ ] View users list
- [ ] View games list
- [ ] See moderation queue (if applicable)
- [ ] Test user moderation (suspend, delete)
- [ ] Check audit log

---

## 📱 Technical Testing (1-2 hours)

### API Endpoints (Thunder Client)
- [ ] Health Check: `GET /health` (expect 200)
- [ ] Test Email: `POST /api/test-email` (expect success)
- [ ] Verify Token: `POST /api/verify-token` (expect valid)
- [ ] Get User: `GET /api/user/:id` (expect user data)
- [ ] List Games: `GET /api/games` (expect games)
- [ ] Create Game: `POST /api/games` (expect success)
- [ ] Admin Health: `GET /admin/health` (expect 200)

### Email/SMS Verification
- [ ] Sign up → Get email verification
- [ ] Check email received in test account
- [ ] Email has correct link/code
- [ ] Enter code → Account verified
- [ ] SMS verification (if SMS enabled)
- [ ] Check SMS received

### Error Handling
- [ ] Turn off WiFi → See error message
- [ ] Turn on WiFi → Auto-retry works
- [ ] Send invalid request → See error toast
- [ ] Network timeout → Shows message
- [ ] Check Sentry for any errors

### Performance & Stability
- [ ] Load times acceptable (< 2 seconds)
- [ ] No lag when scrolling lists
- [ ] Animations smooth
- [ ] No crashes observed
- [ ] No memory leaks (test leaving app running)

---

## 🎨 UI/UX Testing (1 hour)

### Visual Design
- [ ] All text readable (font sizes, contrast)
- [ ] Colors consistent with brand
- [ ] Spacing/padding appropriate
- [ ] No overlapping elements
- [ ] Icons clear and recognizable

### Light/Dark Mode
- [ ] Light mode readable
- [ ] Dark mode readable
- [ ] Theme toggle works
- [ ] Persists after app restart
- [ ] All screens support both

### Screen Rotation
- [ ] Rotate device → Layout adjusts
- [ ] No content cut off
- [ ] Maintain scroll position
- [ ] Keyboard doesn't break layout

### Accessibility
- [ ] Buttons tappable size (44x44 minimum)
- [ ] Focus/selection visible
- [ ] Text contrast sufficient
- [ ] Screen reader compatible (if tested)

---

## 🐛 Edge Cases & Error Scenarios (1-2 hours)

### Network Issues
- [ ] Slow network (throttle to 3G)
- [ ] No network (airplane mode)
- [ ] Network timeout → Shows error
- [ ] Auto-retry when back online
- [ ] Pending requests queue properly

### Data Edge Cases
- [ ] Empty lists show empty state
- [ ] Long text wraps correctly
- [ ] Large images load without crash
- [ ] Special characters in names
- [ ] Very long game descriptions

### User Interactions
- [ ] Rapid taps don't duplicate submit
- [ ] Back button works everywhere
- [ ] Navigation doesn't lose state
- [ ] Logout clears user data
- [ ] Fresh login has no cached data

### Permissions
- [ ] Location permission request works
- [ ] Camera permission request works
- [ ] Photo library permission works
- [ ] Notification permission works
- [ ] Deny permission → Graceful fallback

---

## 📊 Monitoring & Alerts (Ongoing)

### Sentry Error Tracking
- [ ] Open Sentry dashboard
- [ ] Should be no new errors from QA
- [ ] Any errors appear immediately
- [ ] Stack traces readable
- [ ] Browser/device info captured

### GitHub Actions
- [ ] Check Production Readiness workflow
- [ ] Latest run should be passing
- [ ] Deployment status shows green
- [ ] No failed jobs

### Console Logs
- [ ] Open dev tools (if available)
- [ ] No TypeScript errors
- [ ] No unhandled promise rejections
- [ ] Warnings are expected (lint)

---

## 🎯 Success Criteria

### Must Pass (Launch Blocking)
- ✅ All core flows work (sign-up → game → message)
- ✅ No TypeScript errors
- ✅ No new Sentry errors
- ✅ Email verification working
- ✅ API endpoints responding
- ✅ Admin dashboard functional

### Should Pass (High Priority)
- ✅ All QA checklist complete
- ✅ Performance acceptable
- ✅ No crashes observed
- ✅ Dark mode working
- ✅ Network error handling works

### Nice to Have (Can defer)
- 🟡 Lint warnings cleaned (deferred to Phase 2)
- 🟡 Performance optimization (post-launch)
- 🟡 Advanced features (Phase 1.1)

---

## 📝 Issue Tracking

### Found a Bug?
1. **Note the issue:** Screenshot, reproduce steps
2. **Check Sentry:** Did it trigger an alert?
3. **Decide:** Launch-blocking or post-launch fix?
4. **Log it:** Create git issue or note for post-launch

### Critical Issues (Launch Blockers)
- Stop testing
- Create quick fix
- Verify fix works
- Commit and test again

### Non-Critical Issues (Post-Launch)
- Note the issue
- Continue testing
- Create GitHub issue for tracking
- Fix in v1.1 if minor

---

## ⏱️ Timeline

### Morning (2-3 hours): Setup & Core Flows
- 15 min: Extensions setup
- 15 min: Verify tools
- 15 min: Fresh build
- 90 min: Sign-up → Game → Message flows

### Midday (2-3 hours): Complete User Journeys
- Admin onboarding
- Team management
- Game creation
- Full message thread

### Afternoon (2-3 hours): Technical & Edge Cases
- API endpoint testing
- Error scenarios
- Performance checks
- Monitoring verification

---

## ✨ After QA

### If All Tests Pass ✅
- Day 3 QA complete
- Ready for Day 4 launch
- Notify stakeholders
- Prepare launch announcement

### If Issues Found ⚠️
- Critical issues: Fix immediately, re-test
- Non-critical: Log for post-launch
- Create hotfix if needed
- Update deployment timeline if necessary

---

## 📞 Quick Commands

### Build & Run
```bash
npm install                          # Update packages
npx expo start --ios               # Build iOS simulator
npm run typecheck                   # Check TypeScript
npx expo lint 2>&1 | grep problems # Check lint
```

### API Testing (Thunder Client)
1. Click ⚡ icon in Activity Bar
2. Select request
3. Click "Send"
4. Check response

### Monitor Errors (Sentry)
1. Open Sentry dashboard
2. Select VarsityHub project
3. Watch for new errors
4. Click error to see stack trace

### Watch Deployment (GitHub Actions)
1. Click GitHub icon in Activity Bar
2. Check Production Readiness workflow
3. Latest run should be passing

---

## 🏆 Success!

**If you complete this checklist successfully, you are ready for Day 4 launch!**

- Code quality: ✅
- Infrastructure: ✅
- User flows: ✅
- Error handling: ✅
- Performance: ✅

**Time to launch:** 24 hours 🚀

---

**Document Status:** Ready for Day 3 execution  
**Timestamp:** December 4, 2025  
**Estimated Duration:** 6-8 hours  
**Expected Outcome:** Ready for production launch
