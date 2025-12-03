# VarsityHub Mobile - 4-Day Publishing Timeline

## 📅 Overview

**Goal:** Ship to App Store/Play Console with full monitoring and quality gates  
**Duration:** 4 days (flexible +1-2 if lint debt deeper than expected)  
**Status Tracking:** Update ✅/🔄/⏳ as you progress

---

## 🗓️ Day 0-1: Foundation & Monitoring Activation

### Morning: Environment Setup (2-3 hours)

#### ✅ Checkpoint 1.1: Add Sentry DSN
```bash
# Edit .env
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@o1234567.ingest.sentry.io/8765432

# Restart Expo
npx expo start --clear
```

**Verify:**
- [ ] Metro logs show: `[Sentry] initialized`
- [ ] Trigger test error: `throw new Error('Sentry Test');`
- [ ] Check Sentry dashboard for captured exception

**Rollback:** Remove DSN if crashes increase >10%

---

#### ✅ Checkpoint 1.2: Add SendGrid to Railway
```bash
# Railway Dashboard → VarsityHub API → Variables
SENDGRID_API_KEY=SG.your-api-key-here
```

**Verify:**
```bash
curl -X POST https://api-production-8ac3.up.railway.app/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-test-email@example.com","template":"welcome"}'
```

**Expected:** Email received within 2 minutes

**Rollback:** Remove key if spam complaints spike

---

### Afternoon: Quality Gates (2-3 hours)

#### ✅ Checkpoint 1.3: Run Local Quality Checks
```bash
# Clean check
npm run typecheck
# Expected: No errors (already passing ✅)

# Expo health
npm run doctor
# Expected: 2 non-critical warnings (duplicates, config sync)

# Strict linting
npm run lint:strict
# Expected: ~440 problems (156 errors, 328 warnings)
# Focus: Priority screens only
```

**Fix Priority (3 files, ~2 hours):**

1. **app/highlights.tsx** (30 mins)
   - Pattern: Same as event-detail
   - Add `void` to router.push calls
   - Rename unused vars with `_` prefix
   - Guide: `docs/LINT_CLEANUP_GUIDE.md`

2. **app/messages.tsx** (45 mins)
   - Fix async message handlers
   - Add await/catch to API calls
   - Add `void` to navigation

3. **app/feed.tsx** (30 mins)
   - Router navigation fixes
   - Unused variable cleanup

**Verify After Each:**
```bash
npm run typecheck
npx eslint app/highlights.tsx
```

**Target:** Priority screens error-free, warnings acceptable

---

#### ✅ Checkpoint 1.4: Push & Verify CI
```bash
git add .
git commit -m "Day 1: Sentry active, priority screens lint-clean"
git push origin main
```

**Watch GitHub Actions:**
- [ ] expo-doctor passes (2 warnings OK)
- [ ] lint:strict runs (errors in non-priority files OK)
- [ ] npm test passes (or skipped if no tests)
- [ ] npm audit (5 vulnerabilities OK if moderate/low)

**Success Criteria:**
- ✅ CI workflow completes (green or yellow acceptable)
- ✅ Sentry capturing exceptions
- ✅ SendGrid sending emails
- ✅ Priority screens compile cleanly

**Rollback:** If CI completely fails, revert commit and fix locally first

---

## 🗓️ Day 2: Deep Cleanup & Testing Infrastructure

### Morning: Remaining Critical Screens (3-4 hours)

#### ✅ Checkpoint 2.1: Onboarding Flow
**Files:**
- `app/onboarding/index.tsx`
- `app/onboarding/step-1-role.tsx`
- `app/onboarding/step-2-basic.tsx`
- `app/onboarding/step-3-plan.tsx`
- `app/onboarding/step-4-organization.tsx`
- `app/onboarding/step-10-confirmation.tsx`

**Pattern:**
```typescript
// Router navigation
onPress={() => void router.push('/next-step')}

// Async handlers
const handleSave = async () => {
  try {
    await API.saveProfile(data);
  } catch (_error) {
    Alert.alert('Failed');
  }
};

// Unused vars
const { id, name: _name } = user; // Only using id
```

**Verify:**
```bash
npx eslint app/onboarding/*.tsx
npm run typecheck
```

**Time estimate:** 90 minutes (6 files × 15 mins each)

---

#### ✅ Checkpoint 2.2: Profile & Settings
**Files:**
- `app/profile.tsx`
- `app/edit-profile.tsx`
- `app/settings/index.tsx`
- `app/settings/manage-subscription.tsx`

**Common issues:**
- Unused media upload states
- Router navigation in modal dismissals
- Console.log statements in payment flows

**Verify:**
```bash
npx eslint app/profile.tsx app/edit-profile.tsx app/settings/*.tsx
```

**Time estimate:** 60 minutes

---

### Afternoon: Team & Admin (2-3 hours)

#### ✅ Checkpoint 2.3: Team Management
**Files:**
- `app/team-hub.tsx`
- `app/team-profile.tsx`
- `app/team-page.tsx`
- `app/manage-teams.tsx`

**Focus:**
- Team navigation router calls
- Unused team data variables
- Admin permission checks

**Time estimate:** 90 minutes

---

#### ✅ Checkpoint 2.4: Admin Screens (Optional)
**Files:** `app/admin-*.tsx`

**Decision point:** Skip if not shipping admin features yet

**If including:**
- Admin dashboard navigation
- User detail navigation
- Report handlers

**Time estimate:** 60 minutes (or skip)

---

#### ✅ Checkpoint 2.5: Full Quality Check
```bash
# Full lint check
npm run lint:strict
# Target: <100 errors (from 156)

# TypeScript
npm run typecheck
# Target: 0 errors (should still pass)

# Expo health
npm run doctor
# Target: Same 2 warnings as Day 1

# Test suite
npm test -- --runInBand --no-watchman
# Target: Passes (or skipped if no tests yet)
```

**Success Criteria:**
- ✅ Lint errors reduced by >60% (156 → <60)
- ✅ All critical screens error-free
- ✅ TypeScript clean
- ✅ Tests pass or skipped gracefully

**Push:**
```bash
git add .
git commit -m "Day 2: Deep lint cleanup, all critical screens production-ready"
git push origin main
```

**Rollback:** If breaking changes introduced, revert and fix incrementally

---

## 🗓️ Day 3: Real-World Testing & Production Blockers

### Morning: Button Diagnostics (2-3 hours)

#### ✅ Checkpoint 3.1: Environment Check
```bash
# Verify environment
node tools/diagnose-buttons.js

# Expected:
# ✅ API URL: Railway
# ✅ Sentry DSN configured
# ✅ All critical files present
```

---

#### ✅ Checkpoint 3.2: Authentication Flow
**Test:**
1. Sign out completely
2. Sign in with real credentials
3. Verify token stored
4. Navigate through app (should stay authenticated)

**Watch Metro:**
```
[http] POST /auth/login → 200
[http] Authorization: Bearer eyJhbG...
```

**Blockers to fix:**
- 401 loops
- Token not persisting
- Sign-in redirect broken

**Time:** 30 minutes

---

#### ✅ Checkpoint 3.3: Game Detail Flow
**Test on REAL game (not sample-*):**

1. **Vote:**
   - Tap Team A → watch `[http] POST /games/:id/vote`
   - Verify count updates
   - Clear vote → verify resets

2. **RSVP:**
   - Tap RSVP badge → sheet opens
   - Confirm → watch `[http] PUT /events/:id/rsvp`
   - Verify going count updates

3. **Add Story:**
   - Tap camera → watch `[story] Camera selected`
   - Select photo → watch `[story] Uploading attempt 1/3`
   - Verify upload completes → `[http] POST /games/:id/stories`

4. **Share:**
   - Tap share → watch `[share] Generating link for game/:id`
   - Verify native share sheet opens
   - Link format: `https://varsityhub.app/game/123` or slug

**Log all failures:** Screenshot + Metro output

**Time:** 45 minutes

---

#### ✅ Checkpoint 3.4: Event Detail Flow
**Test on REAL event:**

1. **RSVP:**
   - Tap badge → sheet opens
   - Toggle → watch `[http] Event RSVP toggle`
   - Verify capacity updates

2. **Share:**
   - Generate link → verify format

3. **Maps:**
   - Tap location → Maps app opens
   - Verify coordinates used (if available)

**Time:** 20 minutes

---

#### ✅ Checkpoint 3.5: Payment Flow (Critical)
**Test Stripe integration:**

1. Navigate to subscription/billing
2. Select plan → watch `[http] POST /stripe/checkout`
3. Complete test payment (use Stripe test card)
4. Verify redirect to success screen
5. Check subscription status updates

**Blockers to fix:**
- Payment modal doesn't open
- Stripe key missing
- Success redirect broken
- Subscription not activating

**Time:** 30 minutes

---

### Afternoon: Sentry & Monitoring Review (1-2 hours)

#### ✅ Checkpoint 3.6: Review Sentry Dashboard
**Check for:**
- [ ] Exception volume (should be low, <10/hour)
- [ ] Performance insights (API call durations)
- [ ] Breadcrumb trails (HTTP requests before errors)
- [ ] Top issues by frequency

**Fix Priority:**
1. High-frequency errors (>5/min)
2. Crashes on critical screens
3. Payment/auth failures

**Time:** 30 minutes

---

#### ✅ Checkpoint 3.7: Review Railway Logs
**Check backend:**
```bash
# Railway CLI or dashboard
railway logs --tail 100

# Look for:
# - 500 errors
# - Slow queries (>1s)
# - Upload failures
# - Email send failures
```

**Fix Priority:**
1. 500 errors on critical endpoints
2. Database query optimization
3. Upload timeout issues

**Time:** 30 minutes

---

#### ✅ Checkpoint 3.8: Production Blockers Review
**Gather all issues from Day 3 testing:**

1. **Critical (must fix before ship):**
   - Auth completely broken
   - Payments failing
   - App crashes on launch
   - Data loss issues

2. **High (fix before TestFlight):**
   - Vote/RSVP not working
   - Story upload failing
   - Share links broken
   - Major UX issues

3. **Medium (fix before public release):**
   - Minor navigation glitches
   - Styling issues
   - Non-critical warnings

4. **Low (post-launch):**
   - Code cleanup
   - Performance optimizations
   - Nice-to-have features

**Decision:** Fix Critical + High, defer Medium/Low

**Time:** 30 minutes planning

---

#### ✅ Checkpoint 3.9: Fix Production Blockers
**Allocate remaining Day 3:**
- Critical issues: Fix immediately
- High issues: Fix before end of day
- Document Medium/Low for post-launch

**Push fixes:**
```bash
git add .
git commit -m "Day 3: Production blocker fixes, real-data testing complete"
git push origin main
```

**Time:** 2-4 hours (depending on issues found)

---

## 🗓️ Day 4: Final QA & Submission

### Morning: Release Preparation (2-3 hours)

#### ✅ Checkpoint 4.1: Version Bump
```bash
# Edit app.json
{
  "expo": {
    "version": "1.0.0", // or current + 0.0.1
    "ios": {
      "buildNumber": "1" // increment
    },
    "android": {
      "versionCode": 1 // increment
    }
  }
}
```

**Update package.json:**
```json
{
  "version": "1.0.0"
}
```

---

#### ✅ Checkpoint 4.2: Release Notes
**Create:** `CHANGELOG.md` or App Store/Play Store descriptions

**Template:**
```markdown
# Version 1.0.0

## New Features
- Event RSVP with capacity tracking
- Game voting and polls
- Story uploads with camera/gallery
- Share links with deep linking

## Improvements
- Sentry error monitoring
- Improved upload reliability
- Better authentication flow

## Bug Fixes
- Fixed 401 redirect loops
- Resolved story upload timeouts
- Fixed RSVP count updates

## Known Issues
- [List any Medium/Low issues deferred]
```

---

#### ✅ Checkpoint 4.3: Build Production Bundles
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Monitor builds in EAS dashboard
```

**Verify:**
- [ ] Build completes successfully
- [ ] No errors in build logs
- [ ] Bundle size reasonable (<50MB)

**Time:** 30-60 minutes (mostly waiting)

---

### Afternoon: TestFlight/Internal Testing (2-3 hours)

#### ✅ Checkpoint 4.4: Deploy to TestFlight
```bash
# After iOS build completes
eas submit --platform ios --profile production
```

**Or manual upload:**
1. Download .ipa from EAS
2. Upload via Xcode/Transporter
3. Submit to TestFlight

**Verify:**
- [ ] Build appears in TestFlight
- [ ] No compliance issues
- [ ] Internal testers can install

---

#### ✅ Checkpoint 4.5: Internal QA Pass
**Test on real device (not simulator):**

1. **Fresh install:**
   - Onboarding flow complete
   - Sign up new account
   - Verify email/SMS if enabled

2. **Core flows:**
   - Browse Feed → tap game → vote
   - Events calendar → tap event → RSVP
   - Add story with photo
   - Share game/event link

3. **Edge cases:**
   - Airplane mode → graceful offline
   - Background/foreground → state persists
   - Push notifications (if enabled)

4. **Performance:**
   - Cold launch time (<3s)
   - Navigation smooth (60fps)
   - No memory leaks

**Log any issues:** Sentry should capture crashes automatically

**Time:** 90 minutes

---

#### ✅ Checkpoint 4.6: Monitoring Dashboard Check
**Final verification:**

1. **Sentry:**
   - [ ] Exception rate normal (<5/hour)
   - [ ] No critical errors
   - [ ] Breadcrumbs capturing properly

2. **Railway:**
   - [ ] API response times good (<500ms p95)
   - [ ] No 500 errors
   - [ ] Database healthy

3. **SendGrid:**
   - [ ] Emails delivering
   - [ ] No bounces/spam
   - [ ] Open rates reasonable

**Time:** 20 minutes

---

### Evening: App Store Submission (1-2 hours)

#### ✅ Checkpoint 4.7: App Store Connect Metadata
**Fill out:**
- [ ] App name, subtitle, description
- [ ] Screenshots (required sizes)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Keywords
- [ ] Age rating
- [ ] App Store category

**Time:** 45 minutes

---

#### ✅ Checkpoint 4.8: Submit for Review
**Steps:**
1. Select build from TestFlight
2. Add "What's New" text (release notes)
3. Submit for review
4. Answer App Review questions

**Expected:**
- Review time: 1-3 days typically
- May request additional info

**Time:** 15 minutes

---

#### ✅ Checkpoint 4.9: Play Store Submission (Parallel)
**Similar process:**
1. Upload .aab from EAS
2. Add store listing metadata
3. Complete privacy/security questionnaire
4. Submit for review

**Expected:**
- Review time: 1-7 days typically

**Time:** 45 minutes

---

## 🚨 Contingency Plans

### If Day 1 Slips
**Cause:** More lint errors than expected

**Action:**
- Focus on Event/Game detail only
- Defer Messages/Feed to Day 2
- Extend timeline by +1 day

---

### If Day 2 Slips
**Cause:** Onboarding/Profile complex

**Action:**
- Ship with warnings on non-critical screens
- Document known issues
- Fix post-launch incrementally

---

### If Day 3 Reveals Critical Bugs
**Cause:** Real-data testing uncovers blockers

**Action:**
- STOP ship timeline
- Fix critical issues first
- Re-run full Day 3 testing
- Extend timeline by +1-2 days

**Critical bugs that block ship:**
- Auth completely broken (can't sign in)
- App crashes on launch
- Data loss (posts/votes disappearing)
- Payment failures (money charged, no subscription)
- Privacy violations (data leaks)

---

### If App Review Rejects
**Common reasons:**
- Missing privacy policy
- Crashes during review
- Misleading metadata
- Violates guidelines

**Action:**
- Address feedback immediately
- Re-submit within 24 hours
- May add 2-3 days to timeline

---

## 📊 Success Metrics

### Day 1 Exit Criteria
- ✅ Sentry capturing exceptions
- ✅ SendGrid sending emails
- ✅ Priority screens lint-clean
- ✅ CI workflow passing (green/yellow)
- ✅ TypeScript compiling

### Day 2 Exit Criteria
- ✅ All critical screens error-free
- ✅ Lint errors <60 (from 156)
- ✅ Tests passing
- ✅ CI consistently green

### Day 3 Exit Criteria
- ✅ Button diagnostics pass on real data
- ✅ No critical production blockers
- ✅ Sentry dashboard clean (<10 errors/hour)
- ✅ All high-priority issues fixed

### Day 4 Exit Criteria
- ✅ Production builds complete
- ✅ TestFlight QA passed
- ✅ Submitted to App/Play Store
- ✅ Monitoring dashboards green

---

## 🎯 Daily Standup Template

**Copy this for daily check-ins:**

```markdown
## Day X Progress

### ✅ Completed
- [ ] Checkpoint X.1: Description
- [ ] Checkpoint X.2: Description

### 🔄 In Progress
- [ ] Checkpoint X.3: Current blocker

### ⏳ Blocked
- Issue: Description
- Impact: Critical/High/Medium/Low
- Owner: You/Backend/External

### 📊 Metrics
- Lint errors: XXX → YYY (target: <60)
- Sentry errors: XXX/hour (target: <10)
- CI status: Green/Yellow/Red

### 🎯 Tomorrow's Plan
- Start: Checkpoint X.X
- Goal: Ship by EOD / Fix blocker
```

---

## 📞 Emergency Contacts

**If stuck:**
- Expo documentation: https://docs.expo.dev
- Sentry support: https://sentry.io/support
- Railway support: https://railway.app/help
- Apple Developer: https://developer.apple.com/support
- Google Play: https://support.google.com/googleplay/android-developer

**Me:** Available for:
- Debugging production blockers
- Code review before ship
- Post-launch monitoring setup

---

## ✅ Pre-Flight Checklist (Run Day 4 Morning)

```bash
# Environment
[ ] EXPO_PUBLIC_SENTRY_DSN in .env
[ ] SENDGRID_API_KEY in Railway
[ ] EXPO_PUBLIC_API_URL = Railway production
[ ] Stripe keys = production (not test)

# Code
[ ] npm run typecheck → passes
[ ] npm run lint:strict → <60 errors
[ ] npm run doctor → 2 warnings OK
[ ] git status → clean (all committed)

# Testing
[ ] Button diagnostics passed on real data
[ ] No critical Sentry errors (last 24h)
[ ] Payment flow works (test transaction)
[ ] Auth flow works (sign in/out/up)

# Build
[ ] app.json version bumped
[ ] Release notes written
[ ] Screenshots prepared
[ ] Privacy policy published

# Monitoring
[ ] Sentry dashboard clean
[ ] Railway logs normal
[ ] SendGrid delivering emails
```

**If all checked:** ✅ **CLEAR TO SHIP**

---

## 🎓 Lessons Learned (Fill Post-Launch)

**What went well:**
- 

**What slipped:**
- 

**What to improve next time:**
- 

**Unexpected issues:**
- 

---

## 🚀 Launch Day Communication

**Internal team:**
```
🚀 VarsityHub Mobile v1.0.0 submitted!
- iOS: In App Store review
- Android: In Play Store review
- Expected live: 2-3 days
- Monitoring: Active (Sentry + Railway)
- Known issues: [Link to tracker]
```

**External (if applicable):**
```
📱 Exciting news! VarsityHub Mobile is coming soon!
We've submitted to App Store & Play Store.
Track progress: [Link]
```

---

## 📈 Post-Launch (Day 5+)

**Immediate (first 24h):**
- Monitor Sentry for crash spikes
- Watch Railway for 500 errors
- Check SendGrid deliverability
- Respond to App Review feedback

**First week:**
- Gather user feedback
- Fix critical bugs (hotfix if needed)
- Monitor crash-free rate (target: >99%)
- Plan v1.0.1 patch release

**First month:**
- Address Medium/Low issues from backlog
- Performance optimizations
- Analytics review
- Plan v1.1.0 features

---

**You're 85% ready. Follow this timeline and you'll ship in 4 days (or 5-6 if lint debt deeper). Let me know when you start Day 1 and I'll help verify each checkpoint!** 🚀
