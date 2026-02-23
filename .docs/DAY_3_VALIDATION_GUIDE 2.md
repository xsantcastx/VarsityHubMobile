# Day 3: Real-Data Validation & Production Blockers

**Goal:** Walk auth/game/event/payment flows on production data, log failures, fix Critical/High issues

**Timeline:** 6-8 hours of testing + fixes

**Success Metric:** Zero critical production blockers, Sentry <10 errors/hour

---

## 🎯 Checkpoint 3.1: Environment Check (15 mins)

```bash
# Verify production environment
echo "=== Environment Verification ==="
grep "EXPO_PUBLIC_API_URL\|EXPO_PUBLIC_SENTRY_DSN" .env

# Expected output:
# EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
# EXPO_PUBLIC_SENTRY_DSN=https://dba14af5...@ingest.us.sentry.io/4510445740687360

# Verify all critical files present
ls -la api/ server/ config/ constants/ hooks/ || echo "Key directories found"

# Check backend health
curl -s https://api-production-8ac3.up.railway.app/health | jq '.integrations'
```

**Success:** Environment set to production, all integrations = true

---

## 🎯 Checkpoint 3.2: Authentication Flow (30 mins)

### Test Sequence
1. **Fresh sign-out:**
   - App home → Auth screen
   - No auth token in storage

2. **Sign-in with real account:**
   - Email: Your test account
   - Password: Your credentials
   - Watch Metro for: `[http] POST /auth/login → 200`
   - Verify token stored in AsyncStorage

3. **Navigate after sign-in:**
   - Feed → Teams → Events → Game detail
   - Should NOT redirect to auth
   - Should show authenticated content

4. **Sign-out:**
   - Settings → Logout
   - Watch for: `[http] POST /auth/logout → 200`
   - Should redirect to auth screen

5. **Sign-up new account (optional):**
   - Auth screen → Create account
   - Fill onboarding
   - Complete verification
   - Should land in Feed

### Metro Watch (Key Indicators)
```
✅ [http] POST /auth/login → 200
✅ [http] Authorization: Bearer eyJhb...
✅ [auth] Token stored in AsyncStorage
✅ [http] POST /auth/logout → 200

❌ [http] POST /auth/login → 401
❌ [http] 401 → redirect to auth (loop)
❌ [auth] Token not persisting
```

### Failures to Log
```
Issue: 401 redirect loop
Severity: CRITICAL
Steps: Sign in → Feed → immediate logout
Expected: Stay in Feed with token
Actual: Redirect to auth
Sentry: [Link to error]
Fix Status: TBD
```

### Time: 30 mins

**Success Criteria:**
- ✅ Sign in works
- ✅ Token persists
- ✅ No 401 loops
- ✅ Sign out works

---

## 🎯 Checkpoint 3.3: Game Detail Flow (45 mins)

### Prerequisite
Test on **REAL game** (not sample-* games)

### Test Sequence

#### 3.3.1 Vote Flow (10 mins)
```bash
# Steps:
1. Navigate to Feed → tap real game
2. Scroll to voting section
3. Tap Team A → watch Metro
4. Expected: 
   [http] POST /games/:id/vote → 200
   Vote count updates: 5 → 6
5. Tap clear vote
6. Expected: Count reverts: 6 → 5
```

**Watch Metro for:**
```
✅ POST /games/:id/vote → 200 OK
✅ Vote count updates in UI
✅ Clear vote → POST /games/:id/vote → 200
✅ Count reverts

❌ POST /games/:id/vote → 500
❌ Count doesn't update
❌ Stuck spinner
```

#### 3.3.2 RSVP Badge (10 mins)
```bash
# Steps:
1. Tap RSVP badge on game
2. Sheet opens → select status (Going/Interested/Declined)
3. Tap confirm
4. Watch Metro: [http] PUT /games/:id/rsvp → 200
5. Badge updates to show new status
6. Close sheet
```

**Success Indicators:**
```
✅ Sheet opens on tap
✅ PUT /games/:id/rsvp → 200
✅ Status updates in UI
✅ Count updates: Going: 3 → 4
```

#### 3.3.3 Story Upload (15 mins)
```bash
# Steps:
1. Tap camera/story icon
2. Select "Gallery" or "Camera"
3. Pick existing photo or take new
4. Watch Metro:
   [story] Camera selected
   [story] Uploading attempt 1/3
   [http] POST /games/:id/stories → 200
5. Story appears in timeline
6. Tap to view → verify display
```

**Watch for upload patterns:**
```
✅ [story] Uploading attempt 1/3
✅ [http] POST /stories → 200
✅ Story appears in feed
✅ Tap to expand → loads full image

❌ [http] POST /stories → 413 (file too large)
❌ [story] Uploading attempt 3/3 → failure
❌ Spinner stuck indefinitely
```

#### 3.3.4 Share Link (10 mins)
```bash
# Steps:
1. Tap share icon
2. Watch Metro: [share] Generating link for game/123
3. Native share sheet opens
4. Verify link format:
   ✅ https://varsityhub.app/game/123 (preferred)
   OR https://varsityhub.app/game/game-slug
5. Copy link and test in browser (if not deep linking test)
```

### Time: 45 mins

**Success Criteria:**
- ✅ Vote works both ways
- ✅ RSVP updates count
- ✅ Story upload completes
- ✅ Share generates link
- ✅ All Metro shows 200 status

---

## 🎯 Checkpoint 3.4: Event Detail Flow (20 mins)

### Test Sequence

#### RSVP Flow
```bash
1. Navigate to Events calendar
2. Tap any real event
3. Tap RSVP badge
4. Toggle status
5. Watch: [http] PUT /events/:id/rsvp → 200
6. Verify capacity counter updates
```

#### Share Flow
```bash
1. Tap share icon
2. Verify link: https://varsityhub.app/event/123
3. Native share sheet opens
```

#### Maps (if location available)
```bash
1. Tap location name/icon
2. Maps app opens
3. Pin shows venue location
4. Can see directions
```

### Time: 20 mins

**Success Criteria:**
- ✅ RSVP toggle works
- ✅ Share generates correct link
- ✅ Maps integration works (if location set)

---

## 🎯 Checkpoint 3.5: Payment Flow (Critical - 30 mins)

### ⚠️ CRITICAL - This is high-risk for production

### Test Sequence

#### 3.5.1 Navigate to Subscription
```bash
1. Settings → Subscription / Billing
2. Should show current plan or upgrade options
3. No 404s or blank screens
```

#### 3.5.2 Select Plan
```bash
1. Tap "Upgrade" or "Choose Plan"
2. Select test plan (if available)
3. Tap "Continue"
4. Watch Metro: [http] POST /stripe/checkout → 200
```

#### 3.5.3 Stripe Modal Opens
```bash
1. Card input appears
2. Use Stripe test card:
   4242 4242 4242 4242
   Exp: 12/34
   CVC: 123
3. All fields valid
```

#### 3.5.4 Complete Payment
```bash
1. Tap "Confirm Payment"
2. Watch Metro: [http] POST /stripe/confirm → 200
3. Success message appears
4. Redirect to subscription page
5. Plan shows as "Active"
```

#### 3.5.5 Verify in Dashboard
```bash
1. Back to main screen
2. User profile shows active subscription
3. No "Upgrade" button (if subscription exclusive feature)
```

### Watch Metro for:
```
✅ POST /stripe/checkout → 200
✅ Stripe session created
✅ Modal opens (no blank screen)
✅ POST /stripe/confirm → 200
✅ Success redirect works
✅ Subscription status updates

❌ POST /stripe/checkout → 500 (CRITICAL)
❌ Modal doesn't open (CRITICAL)
❌ POST /stripe/confirm → 402 payment failed
❌ Success redirect broken (CRITICAL)
❌ Subscription doesn't activate (CRITICAL)
```

### Issues to Fix Immediately
- Modal doesn't open → Check Stripe key in .env
- Payment fails → Check test card, use correct Stripe key
- Subscription doesn't activate → Check backend subscription logic
- Redirect broken → Check navigation after payment

### Time: 30 mins

**Success Criteria:**
- ✅ Subscription flow completes end-to-end
- ✅ Test payment succeeds
- ✅ Subscription status updates in profile
- ✅ No blank screens or 500 errors

---

## 🎯 Checkpoint 3.6: Sentry Dashboard Review (30 mins)

### Access Sentry
```
https://sentry.io → VarsityHubMobile project
```

### Review Metrics
1. **Exception Volume:**
   - Should be <10/hour after Day 2
   - Watch for: Spikes above 20/hour

2. **Top Issues:**
   - Identify most frequent errors
   - Check if related to auth/payment/upload

3. **Breadcrumb Trails:**
   - Check HTTP requests before crashes
   - Look for 401/500 patterns

4. **Performance Insights:**
   - API call durations (target <500ms p95)
   - Screen render times

### Fix Priority
```
CRITICAL (fix before ship):
- High-frequency errors (>5/min)
- Crashes on critical screens
- Payment/auth failures
- Data loss issues

HIGH (fix before TestFlight):
- Moderate-frequency errors
- Vote/RSVP failures
- Upload issues
- Share link issues

MEDIUM (can defer to v1.0.1):
- Minor navigation glitches
- Non-critical warnings
- Style/UX issues
```

### Time: 30 mins

**Success Criteria:**
- ✅ No CRITICAL errors
- ✅ Error rate <10/hour
- ✅ No payment/auth/upload failures

---

## 🎯 Checkpoint 3.7: Railway Logs Review (30 mins)

### Check Backend Health
```bash
# Option 1: Railway CLI
railway logs --tail 100 | head -50

# Option 2: Railway Dashboard
# https://railway.app → VarsityHubMobile project → Logs

# Look for:
❌ 500 errors (server crashes)
❌ Slow queries (>1s database time)
❌ Upload failures (timeouts, disk full)
❌ Email send failures (SendGrid issues)
```

### Common Issues to Watch
```
ERROR: Database query timeout (>5s)
  → Optimize query in backend
  → Add database index

ERROR: Upload failed (413 Payload Too Large)
  → Increase upload limit in middleware
  → Check Cloudinary quota

ERROR: SendGrid API failure
  → Check SendGrid API key in Railway
  → Check email template IDs
  → Verify template configuration

ERROR: Stripe API error
  → Check Stripe key (live vs test)
  → Verify webhook configuration
```

### Fix Priority
```
CRITICAL:
- 500 errors on critical endpoints
- Payment failures
- Email send failures

HIGH:
- Database query timeouts
- Upload failures
- Auth errors

MEDIUM:
- Slow API responses
- Non-critical warnings
```

### Time: 30 mins

**Success Criteria:**
- ✅ No 500 errors on critical paths
- ✅ Payment endpoint healthy
- ✅ Email delivery working
- ✅ Upload service working

---

## 🎯 Checkpoint 3.8: Production Blockers Review (30 mins)

### Gather All Issues from Day 3 Testing

**Blocker Categories:**

#### CRITICAL (Must Fix Before Ship)
```
Auth completely broken
  → Can't sign in
  → 401 loops
  → Token not persisting

Payment failing
  → Stripe modal doesn't open
  → Payment gateway timeout
  → Subscription doesn't activate
  → Charges made but no subscription

App crashes on launch
  → Crashes before showing auth screen
  → Sentry shows crash on app start

Data loss
  → Posts disappearing
  → Votes not persisting
  → Uploaded stories not appearing

Privacy violations
  → Data leaks in logs
  → Sensitive info exposed
```

#### HIGH (Fix Before TestFlight)
```
Vote/RSVP not working
  → Counts don't update
  → API returns 500

Story upload failing
  → File size issues
  → Timeout errors
  → Cloudinary errors

Share links broken
  → Links don't generate
  → Deep linking doesn't work
  → Wrong game/event opens

UI crashes
  → Specific screens crash
  → Navigation breaks
```

#### MEDIUM (Fix Before Public Release)
```
Minor navigation glitches
Styling issues
Non-critical warnings
Slow API responses (<2s)
```

#### LOW (Post-Launch)
```
Code cleanup
Performance optimizations
Analytics setup
Nice-to-have features
```

### Decision Matrix
```
Issue Severity | Fix Now? | When? | Deferrable?
CRITICAL      | YES      | NOW   | NO
HIGH          | YES      | Today | NO
MEDIUM        | If time  | Today | YES (v1.0.1)
LOW           | NO       | Later | YES (v1.1)
```

### Time: 30 mins

---

## 🎯 Checkpoint 3.9: Fix Production Blockers (2-4 hours)

### Time Allocation
```
CRITICAL issues: 1-2 hours (fix each immediately)
HIGH issues:     1-2 hours (batch similar fixes)
Document MEDIUM: 30 mins (note for post-launch)
Test fixes:      30 mins (verify each fix)
```

### Fix Template
```
1. Identify root cause (check Sentry + Metro logs)
2. Make minimal fix
3. Test locally
4. Commit with message: "Fix: [Issue name] - [root cause]"
5. Push to main
6. Retest on production branch
7. Document fix in blockers log
```

### Example Fixes

#### Fix: 401 Redirect Loop
```typescript
// Root cause: Token not included in auth headers
// Location: api/hooks/useAuthToken.ts

// Before
const headers = {
  'Content-Type': 'application/json'
};

// After
const token = await AsyncStorage.getItem('auth_token');
const headers = {
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
};
```

#### Fix: Stripe Modal Doesn't Open
```typescript
// Root cause: Missing Stripe publishable key in .env
// Location: .env

// Verify:
grep "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" .env
# Should show: pk_live_... (NOT pk_test_)

// If test key, update to live key:
# Go to Stripe dashboard → API Keys → Copy pk_live_
# Update .env
# Rebuild app
```

#### Fix: Story Upload Timeout
```typescript
// Root cause: Cloudinary timeout, file too large
// Location: api/upload.ts

// Increase timeout
const uploadPromise = cloudinary.upload(file, {
  timeout: 30000,  // Increase from 10000
  maxFileSize: 10 * 1024 * 1024  // 10MB limit
});
```

### Time: 2-4 hours

**Success Criteria:**
- ✅ All CRITICAL issues fixed
- ✅ All HIGH issues fixed
- ✅ MEDIUM issues documented for later
- ✅ Each fix tested locally + on production

---

## 📋 Day 3 Sign-Off

```markdown
## Day 3 Sign-Off (December 5, 2025)

### ✅ Testing Complete
- [x] Auth flow: Sign in/out/up works
- [x] Game detail: Vote, RSVP, upload, share works
- [x] Event detail: RSVP, share works
- [x] Payment: Stripe flow completes end-to-end
- [x] Sentry dashboard: Errors <10/hour
- [x] Railway logs: No 500 errors on critical paths

### ✅ Issues Fixed
- [x] CRITICAL blockers: 0 remaining
- [x] HIGH blockers: 0 remaining
- [x] MEDIUM issues: Documented for v1.0.1
- [x] LOW issues: Documented for v1.1

### ✅ Production Ready
- [x] All critical flows work end-to-end
- [x] No payment failures
- [x] No auth loops
- [x] No data loss
- [x] Sentry healthy

### Commit & Push
\`\`\`bash
git add .
git commit -m "Day 3: Production validation complete, all blockers fixed

✅ Auth flow: Working end-to-end
✅ Game voting: Tested and working
✅ RSVP: Counts updating correctly
✅ Story upload: Completing successfully
✅ Payment: Stripe flow passing
✅ Share links: Generating correctly
✅ No CRITICAL/HIGH production blockers
✅ Sentry: <10 errors/hour
✅ Ready for Day 4 release mechanics"

git push origin main
\`\`\`

### Ready for Day 4? ✅ YES
```

---

## 🚨 Emergency Recovery Plan

**If critical bug found too late:**

1. **Document issue** with Sentry link + repro steps
2. **Assess impact:**
   - Affects >10% of users? → FIX NOW
   - Affects payment? → FIX NOW
   - Affects auth? → FIX NOW
   - Minor? → DEFER to v1.0.1 hotfix
3. **Execute quick fix:**
   - Make minimal code change
   - Test locally
   - Commit + push
   - Wait for CI to pass
4. **Decide:**
   - If fixed: Continue to Day 4
   - If complex: Delay timeline by 1 day

---

**Day 3 complete = you're 80% to launch! 🚀**
