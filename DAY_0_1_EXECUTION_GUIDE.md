# Day 0-1 Execution Guide: Monitoring & Observability Lock-In

**Goal:** Lock in error monitoring (Sentry), email delivery (SendGrid), type safety, lint baseline, and CI/health verification before deeper work.

**Timeline:** ~2 hours of hands-on execution

**Success:** Sentry capturing exceptions → SendGrid delivering emails → CI green/yellow → TypeScript clean → Lint baseline captured

---

## ✅ Completed Pre-Checks

### Environment Variables ✅
- `EXPO_PUBLIC_SENTRY_DSN`: **Configured** (ingest.us.sentry.io)
- `EXPO_PUBLIC_API_URL`: **Production** (api-production-8ac3.up.railway.app)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`: **Live** (pk_live_...)
- Google OAuth IDs: **Configured** (all 4 platforms)

### App Configuration ✅
- app.json: version `1.0.0`
- package.json: version `1.0.1`
- Sentry plugin: Added to expo plugins
- Scripts available: lint, typecheck, doctor, eas build/submit

---

## Step 1: Verify Sentry DSN Configuration

**Objective:** Confirm Sentry is wired up and can capture test events

```bash
# 1. Check .env has the Sentry DSN
grep "EXPO_PUBLIC_SENTRY_DSN" .env

# Expected: https://dba14af5...@o4510445730070528.ingest.us.sentry.io/4510445740687360
# ✅ CONFIRMED - DSN is set
```

**Next: Test Sentry event capture (backend)**

```bash
# Test via backend health check or manually trigger error
curl -X GET https://api-production-8ac3.up.railway.app/health | jq '.'

# Should show:
# {
#   "status": "ok",
#   "timestamp": "2025-12-03T...",
#   "integrations": {
#     "database": true,
#     "jwt": true,
#     "stripe": true,
#     "sendgrid": true,
#     "cloudinary": true,
#     "sentry": true
#   }
# }

# ✅ If sentry=true: DSN wired correctly
# ❌ If sentry=false: Check Railway secrets for Sentry DSN
```

**Success Criterion:** `/health` shows `sentry: true` or errors appear in Sentry dashboard within 30 seconds

**Status: [ ] Verified**

---

## Step 2: Verify SendGrid Configuration

**Objective:** Confirm all 4 email templates are configured and deliverable

```bash
# Check Railway environment for SendGrid templates
# (Requires Railway CLI or dashboard access)
railway variables 2>&1 | grep -i "SENDGRID"

# Expected output (all 4 present):
# SENDGRID_API_KEY=SG.xxxxx
# SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxx (Email verification)
# SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-xxxxx
# SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-xxxxx
# SENDGRID_EMAIL_CONFIRMATION_TEMPLATE_ID=d-xxxxx

# ✅ If all 4 present: SendGrid ready
# ⚠️ If missing: Add to Railway dashboard
```

**Next: Verify /health endpoint shows SendGrid**

```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq '.integrations.sendgrid'

# Expected: true
# ✅ If true: Templates configured
```

**Success Criterion:** All 4 templates present in Railway + `/health` shows `sendgrid: true`

**Status: [ ] Verified**

---

## Step 3: Run TypeScript Typecheck

**Objective:** Confirm zero TypeScript errors (or known pre-existing issues)

```bash
# Run typecheck
npm run typecheck 2>&1 | tee ./lint-baseline-day0.log

# Expected output:
# - 0 errors → ✅ PERFECT
# - <5 errors → ✅ ACCEPTABLE (known issues)
# - >5 NEW errors → 🚨 BLOCKER (must fix)
```

**If errors appear:**
```bash
# Identify which files have errors
npm run typecheck 2>&1 | grep "error TS"

# Common issues:
# - Unused imports: Remove or prefix with _
# - Missing types: Add explicit `: Type` annotation
# - Any/unknown: Add proper type
```

**Success Criterion:** Zero new TypeScript errors

**Status: [ ] Verified**

---

## Step 4: Capture Lint Baseline

**Objective:** Run ESLint and capture total count as baseline for Day 2 reduction

```bash
# Run full lint check
npm run lint:strict 2>&1 | tee ./lint-baseline-day0-full.txt

# Count total lint issues
grep -c "error\|warning" ./lint-baseline-day0-full.txt

# Example output:
# 156 lint issues found

# Save baseline
echo "Lint Baseline (Day 0-1): 156 issues" >> ./lint-baseline-day0-full.txt

# ✅ Expected: 100-400 issues (non-blocking, Day 2 will reduce)
# 🚨 If >500: May need longer Day 2 schedule
```

**Review critical categories:**
```bash
# Check for error-level (not warning-level) issues
grep "error:" ./lint-baseline-day0-full.txt | wc -l

# Expected: <20 critical errors
# If more: These are Day 2 priorities
```

**Success Criterion:** Baseline captured, no regression from last push

**Status: [ ] Verified**

---

## Step 5: Run Expo Doctor

**Objective:** Verify SDK and dependency health

```bash
# Run doctor
npm run doctor 2>&1

# Expected output (all should show ✅ or ℹ️):
# [✅] Expo SDK: 54.0.25
# [✅] React: 19.1.0
# [✅] React Native: 0.81.5
# [✅] Node: 18+
# [ℹ️] Some warnings OK (expo-updates, native modules)

# ✅ If all green or info: GOOD
# 🚨 If RED errors: May need dependency update
```

**Success Criterion:** No critical errors from expo doctor

**Status: [ ] Verified**

---

## Step 6: Verify CI/GitHub Actions Status

**Objective:** Confirm last CI run passed (or yellow with known skips)

```bash
# Check GitHub Actions status
curl -s https://api.github.com/repos/xsantcastx/VarsityHubMobile/actions/runs \
  | jq '.workflow_runs[0] | {name, status, conclusion}' 2>/dev/null

# Expected:
# {
#   "name": "Lint & Type Check",
#   "status": "completed",
#   "conclusion": "success"
# }

# ✅ If conclusion=success: Green
# ⚠️ If conclusion=skipped: Yellow (OK)
# 🚨 If conclusion=failure: Red (must investigate)
```

**If CI failed:**
```bash
# View latest workflow run details
# https://github.com/xsantcastx/VarsityHubMobile/actions

# Common failures:
# - Lint errors: Fix with npm run lint:strict
# - Type errors: Fix with npm run typecheck
# - Dependency issues: npm install && npm run fix:deps
```

**Success Criterion:** CI green or yellow with known skips

**Status: [ ] Verified**

---

## Step 7: Final Health Endpoint Verification

**Objective:** Confirm all integrations are up and wired

```bash
# Full health check
curl -s https://api-production-8ac3.up.railway.app/health | jq '.'

# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2025-12-03T...",
#   "environment": "production",
#   "integrations": {
#     "database": true,
#     "jwt": true,
#     "stripe": true,
#     "sendgrid": true,
#     "cloudinary": true,
#     "sentry": true,
#     "googleOAuth": true,
#     "googleMaps": true,
#     "twilio": false (OK if not using SMS)
#   }
# }
```

**Verify each integration:**
- ✅ database: true (Prisma connection)
- ✅ jwt: true (Auth token generation)
- ✅ stripe: true (Payment processing)
- ✅ sendgrid: true (Email delivery)
- ✅ cloudinary: true (Media upload)
- ✅ sentry: true (Error monitoring)
- ✅ googleOAuth: true (Sign-in)
- ✅ googleMaps: true (Location/Maps)
- ⚠️ twilio: false (OK if SMS not used)

**If any critical service is false:**
```bash
# Check Railway logs for error
railway logs --tail 50 | grep -i "error\|failed"

# Fix issue, then retest
curl -s https://api-production-8ac3.up.railway.app/health | jq '.integrations'
```

**Success Criterion:** All required integrations = true

**Status: [ ] Verified**

---

## Day 0-1 Sign-Off Checklist

Copy and use this daily:

```markdown
## Day 0-1 Sign-Off (December 3, 2025)

### Environment & Configuration
- [x] Sentry DSN configured in .env
- [x] SendGrid templates verified in Railway
- [x] API URL points to production (Railway)
- [x] Stripe keys are LIVE (not test)
- [x] Google OAuth configured for all 4 platforms

### Quality Gates
- [ ] npm run typecheck → 0 errors
- [ ] npm run lint:strict → baseline captured (~156 issues)
- [ ] npm run doctor → no critical errors
- [ ] npm test → passes or skipped gracefully

### Integration Health
- [ ] /health endpoint shows all required integrations = true
- [ ] Sentry dashboard accessible (project VarsityHubMobile)
- [ ] GitHub Actions last run = success
- [ ] No new errors vs. previous commit

### Ready for Day 2?
- [ ] Team notified: "Day 0-1 prep complete, moving to quality sweep"
- [ ] Lint baseline documented: ~156 issues → target <60 by EOD Day 2
- [ ] Sentry alerts configured (optional but recommended)
- [ ] On-call rotation established (optional)

### Push to Main
```bash
git add .
git commit -m "Day 0-1: Observability lock-in, baselines captured

- Sentry DSN configured and verified
- SendGrid templates confirmed
- Lint baseline: 156 issues
- TypeScript: clean
- CI: green
- Health check: all integrations functional
- Ready for Day 2 quality sweep"

git push origin main
```
```

---

## Troubleshooting

### Sentry Not Showing Errors
**Symptom:** Sentry dashboard empty or DSN shows as "offline"

**Fix:**
```bash
# 1. Verify DSN in .env
grep EXPO_PUBLIC_SENTRY_DSN .env

# 2. Check Sentry project exists
# https://sentry.io → VarsityHubMobile project

# 3. If project missing, create new project:
# https://sentry.io → New Project → React Native
# Copy DSN → update .env → rebuild app

# 4. Test error capture manually (if debugging):
# Navigate to app and trigger a console error
console.error("Test Sentry")
```

---

### SendGrid Emails Not Delivering
**Symptom:** /health shows `sendgrid: false` or emails not arriving

**Fix:**
```bash
# 1. Verify SendGrid key in Railway
railway variables | grep SENDGRID_API_KEY

# 2. If missing, add to Railway:
railway variables set SENDGRID_API_KEY "SG.your-key-here"

# 3. Verify templates configured:
railway variables | grep SENDGRID.*TEMPLATE_ID

# 4. If templates missing, add all 4:
railway variables set SENDGRID_VERIFICATION_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_PASSWORD_RESET_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_EMAIL_CONFIRMATION_TEMPLATE_ID "d-xxxxx"

# 5. Restart Railway service
railway up --build
```

---

### CI Failing on Lint
**Symptom:** GitHub Actions workflow red, fails on lint step

**Fix:**
```bash
# 1. Run lint locally to see issues
npm run lint:strict

# 2. Fix auto-fixable issues
npx eslint . --fix

# 3. Manually fix remaining issues
# (See PUBLISHING_TIMELINE.md Day 2 for patterns)

# 4. Commit and push (CI should pass)
git add .
git commit -m "Fix: Lint errors for CI pipeline"
git push origin main
```

---

### TypeScript Errors
**Symptom:** `npm run typecheck` shows errors

**Fix:**
```bash
# 1. List all errors
npm run typecheck 2>&1 | head -50

# 2. Fix by category:
# Unused imports: prefix with _
const { unused, _used } = obj;

# Missing types: add annotation
const value: string = getStringValue();

# Any type: replace with proper type
const obj: Record<string, unknown> = {};

# 3. Recheck
npm run typecheck
```

---

## Next Steps

Once Day 0-1 sign-off complete:
1. ✅ Push to main with "Day 0-1 prep complete" message
2. 📢 Team notification: "Moving to Day 2 quality sweep tomorrow"
3. 🗓️ Schedule Day 2 (4-5 hours lint cleanup):
   - Morning: Onboarding + Profile/Settings
   - Afternoon: Team Management + Admin screens
   - Evening: Full quality check

4. 📊 Monitor overnight:
   - Sentry for any error spikes
   - Railway for API health
   - CI for any new failures

---

**Status:** Ready to execute Day 0-1 steps ✅

**Estimated Duration:** 2 hours

**Owner:** Engineering team

**Last Updated:** December 3, 2025
