# Deployment Runbook - VarsityHub v1.0.0 Onboarding Fix

**Runbook Version**: 1.0  
**Date**: December 10, 2025  
**Status**: Ready to Execute Upon QA Sign-Off

---

## Database Changes

**Schema Migration:**

Before or during backend deployment, apply any new database schema changes:

```bash
# Apply latest migrations (production DB)
npx prisma migrate deploy
```

**Rollback Migration:**

If a migration must be reverted (emergency):

```bash
# Find last good migration
npx prisma migrate resolve --applied <last_good_migration_name>
# Or manually revert DB to previous state (consult DBA)
```

**Seeding:**

If seed data is required:

```bash
SEED_PASSWORD=ci node prisma/seed.ts
```

**Cache Invalidation:**

If you use a cache (e.g., Redis, CDN), invalidate after migration if needed:

```bash
# Example for Redis
redis-cli FLUSHALL
# Example for CDN
# Purge cache via provider dashboard/API
```

**Feature Flags:**

If feature flags are used, toggle them as needed for rollout/rollback:

```bash
# Example (using LaunchDarkly CLI)
ld toggle <flag-key> on|off
```

---

Before executing any deployment steps, verify:

- [ ] QA has completed all 5 tests in `QA_TESTING_CHECKLIST.md`
- [ ] QA has signed off (name, date, signature on checklist)
- [ ] Release lead has reviewed QA sign-off
- [ ] No critical issues or blockers reported
- [ ] Latest commits visible in main: `b89121c`, `0a96e2e`, `01035bd`, `9574f0c`, `48ca7f4`, `99dc67b`
- [ ] Team is standing by (30-45 min availability)
- [ ] Deployment window is during business hours (9 AM - 5 PM)

---

## Phase 1: Create Release Tag (Immediate, No Downtime)

**Duration**: < 1 minute  
**Risk**: None (tag only, no deployment yet)

### Step 1.1: Create Annotated Tag

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Create tag with QA approval message
git tag -a v1.0.0-qa-approved \
  -m "Release v1.0.0: Onboarding loop fix

QA Sign-Off: [QA Tester Name], [Date]
All 5 test scenarios passed.

Commits:
- 99dc67b: CRITICAL FIX - Admin onboarding_completed must override DB values
- 48ca7f4: Fix - Mark SendGrid as optional service in health check
- 9574f0c: Docs - Comprehensive final solution
- 01035bd: Release notes - v1.0.0
- 0a96e2e: QA checklist
- b89121c: Release package index"

# Push tag to GitHub
git push origin v1.0.0-qa-approved
```

### Step 1.2: Verify Tag

```bash
# Verify tag was created and pushed
git tag -l -n10 | grep v1.0.0-qa-approved
git ls-remote --tags origin | grep v1.0.0-qa-approved
```

**Expected Output**: Tag visible in both local and remote

---

## Notification Template Smoke-Test (SendGrid)

After backend deploy, verify notification templates:

```bash
# Replace <API_KEY> and <to_email> as needed
curl --request POST \
   --url https://api.sendgrid.com/v3/mail/send \
   --header 'Authorization: Bearer <API_KEY>' \
   --header 'Content-Type: application/json' \
   --data '{
      "personalizations": [{ "to": [{ "email": "<to_email>" }] }],
      "from": { "email": "noreply@varsityhub.com" },
      "subject": "Test Notification",
      "content": [{ "type": "text/plain", "value": "This is a test notification from deployment runbook." }]
   }'
```

---

**Duration**: 2-5 minutes  
**Risk**: Low (code already deployed on main, this just confirms it)
**Status**: Backend fixes already live on main → Railway auto-deployed

### Step 2.1: Verify Current Deployment

```bash
# Check backend health
curl -s https://api-production-8ac3.up.railway.app/health | jq '.ready'

# Expected: true (or non-blocking false if SendGrid templates still provisioning)
```

### Step 2.2: Monitor Backend (If needed)

If `/health` is still `false`:

1. Log into Railway dashboard
2. Navigate to production service
3. Check deployment logs for build/startup errors
4. Wait up to 5 minutes for deployment to complete
5. Re-check `/health` until `true`

### Step 2.3: Confirm Admin Override Working

```bash
# Test endpoint directly (if you have a test token)
# This is optional—already verified in QA
curl -X GET https://api-production-8ac3.up.railway.app/me \
  -H "Authorization: Bearer <test_jwt_token>" | jq '.preferences.onboarding_completed'

# Expected: true (for admin) or false (for non-admin, depending on user)
```

---

## Phase 3: Frontend Deployment (EAS)

**Duration**: 5-15 minutes  
**Risk**: Low-Medium (new app binary, but code tested by QA)

### Step 3.1: Build Release Binary

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# For iOS
eas build --platform ios --auto-submit

# For Android (optional, if needed)
eas build --platform android --auto-submit
```

**What to expect**:

- Build queues in EAS
- Takes 5-10 minutes to compile
- Auto-submits to TestFlight (iOS) or Google Play Console (Android)
- You'll receive an email with build link

### Step 3.2: Monitor Build

```bash
# Check build status in terminal (if using `eas build` with output)
# Or visit https://eas.expo.dev/accounts/[your-username]/projects/[project-slug]
```

**Expected timeline**:

- Build starts: 0:00
- iOS build completes: ~5:00-8:00
- Build queued for submission: ~8:00-10:00
- TestFlight updated: ~10:00-15:00

### Step 3.3: Verify TestFlight/Play Console

Once EAS build completes:

1. **iOS**: Check TestFlight for new build (may require manual review, 1-2 hours)
2. **Android**: Check Google Play Console for new build
3. **Take note**: Build version number for release notes

---

## Phase 4: Production Release (App Store/Play Store)

**Duration**: Variable (review + rollout)  
**Risk**: High (public-facing, monitor closely)

### Step 4.1: Manual Review & Approval (iOS)

If TestFlight build requires Apple review:

1. Log into App Store Connect
2. Navigate to your app
3. Check build status in "Builds" section
4. Wait for Apple review (typically 24-48 hours)
5. Approve when ready, or update info/screenshots if rejected

### Step 4.2: Submit to Production

**iOS** (Manual):

1. In App Store Connect, go to "Releases"
2. Click "Create a new version"
3. Select the reviewed build
4. Fill in release notes (see below)
5. Click "Submit for Review" or "Approve"
6. Apple reviews again (usually 24 hours)
7. Automatic rollout begins once approved

**Android** (Automatic if using Play Console console):

1. Builds auto-submit via `eas build --auto-submit`
2. Monitor Google Play Console for review status
3. Once approved, configure rollout (staged or immediate)

### Step 4.3: Release Notes (for App Stores)

**iOS App Store Connect** → Copy this:

```
VarsityHub v1.0.0 - Onboarding Fix Release

What's New:
• Fixed critical bug preventing admin accounts from accessing the app
• Improved onboarding experience - users complete it once, not repeatedly
• Enhanced app performance on cold starts with instant feed loading
• Fixed backend health check to report readiness correctly

Bug Fixes:
• Admin accounts no longer incorrectly shown onboarding steps
• Users no longer forced through onboarding on every app restart
• AsyncStorage persistence for instant routing on app restart
• Health endpoint no longer blocked by optional services

Tested and verified across all user flows.
```

**Android Google Play** → Similar format (may auto-populate from EAS metadata)

---

## Phase 5: Monitoring & Rollback Prep

**Duration**: First 24 hours continuous, then 7 days close monitoring

### Step 5.1: Immediate Monitoring (First Hour)

```bash
# Every 5 minutes for first hour:
curl -s https://api-production-8ac3.up.railway.app/health | jq '.'

# Check app store download/install stats
# Monitor error logs in Sentry (if enabled)
# Check Discord/support channel for user reports
```

**Success metrics**:

- `/health` consistently returns `ready: true`
- No spike in crash rates
- No user reports of onboarding loop
- App installs/updates proceeding normally

### Step 5.2: Extended Monitoring (24 Hours)

- [ ] Dashboard metrics (app version distribution, session counts)
- [ ] Error logs (Sentry, Firebase Crashlytics)
- [ ] Support channel (Discord, email, help desk)
- [ ] Onboarding completion rates (should remain stable or improve)
- [ ] Feed load time (should not degrade)

### Step 5.3: Rollback Plan (If Critical Issues)

**If major issues found** (app crashes on launch, infinite loop still happening, etc.):

#### Immediate Actions

1. **Pause distribution** (App Store/Play Store)
   - iOS: Remove from "Scheduled Release" if not yet public
   - Android: Pause rollout to 0%

2. **Revert backend** (if issue is backend-related):

   ```bash
   cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

   # Find parent of 99dc67b (the admin fix)
   git log --oneline | grep -B1 "CRITICAL FIX"
   # Should show: 6fe7345 (the commit before 99dc67b)

   # Revert the two critical commits
   git revert 48ca7f4  # Health check
   git revert 99dc67b  # Admin merge

   # Push to trigger Railway redeploy
   git push origin main
   ```

3. **Revert app** (if issue is frontend-related):
   - Immediately build and submit previous stable version
   - Request priority review from Apple/Google
   - Halt downloads of new version

4. **Notify Stakeholders**
   - Release lead notifies team, product, support
   - Post in Discord with status
   - Set up incident call if needed

#### Post-Rollback

1. Root cause analysis
2. Fix implementation
3. Re-test with QA
4. Re-run release workflow

---

## Phase 6: Post-Launch Success Criteria (7 Days)

### Metrics to Validate

| Metric                            | Target         | Actual |
| --------------------------------- | -------------- | ------ |
| App crash rate                    | No increase    | \_\_\_ |
| Onboarding completion %           | Same or higher | \_\_\_ |
| "Onboarding loop" support tickets | 0              | \_\_\_ |
| Feed load time                    | < 2 seconds    | \_\_\_ |
| Admin account bypass working      | 100%           | \_\_\_ |
| Cold restart instant routing      | > 95%          | \_\_\_ |

### Post-Launch Sign-Off

Once all metrics pass:

- [ ] Release lead confirms success
- [ ] Update `DEPLOYMENT_STATUS.md` with completion time
- [ ] Archive this runbook with actual execution log
- [ ] Post retrospective (if any issues encountered)

---

## Abort / Rollback Checklist

- [ ] Stop app distribution (pause on App Store/Play Store)
- [ ] Revert backend commits to main
- [ ] Push revert to trigger Railway redeploy
- [ ] Run `npx prisma migrate resolve --rolled-back <migration_name>` if DB rollback needed
- [ ] Invalidate cache if needed
- [ ] Build previous stable version
- [ ] Submit emergency app update
- [ ] Post incident timeline in Discord
- [ ] Schedule post-mortem meeting
- [ ] Root cause analysis and new fix
- [ ] Re-test before next release attempt

---

- [ ] Stop app distribution (pause on App Store/Play Store)
- [ ] Revert backend commits to main
- [ ] Push revert to trigger Railway redeploy
- [ ] Verify backend health endpoint recovering
- [ ] Build previous stable version
- [ ] Submit emergency app update
- [ ] Post incident timeline in Discord
- [ ] Schedule post-mortem meeting
- [ ] Root cause analysis and new fix
- [ ] Re-test before next release attempt

---

## Communication Template

**To send when deploying:**

```
🚀 VarsityHub v1.0.0 Deployment - Onboarding Fix Release

Timeline:
- 9:00 AM: Tag creation & backend verification
- 9:05 AM: Frontend binary build starts (EAS)
- 9:15 AM: TestFlight submission
- 9:30 AM+: Monitor health and support channels

What's fixed:
✅ Admin accounts now skip onboarding (land on feed)
✅ Users complete onboarding once, not repeatedly
✅ Cold starts load instantly (AsyncStorage caching)
✅ Health check no longer blocked by optional services

QA Status: ✅ All 5 scenarios passed
Security: ✅ Snyk scan clean
Code: ✅ Deployed to production

Team: Standing by for first 24 hours. Please report any issues in #deployments.
```

---

## Contacts During Deployment

| Role             | Name               | Phone              | Slack               |
| ---------------- | ------------------ | ------------------ | ------------------- |
| Release Lead     | \***\*\_\_\_\*\*** | \***\*\_\_\_\*\*** | @\***\*\_\_\_\*\*** |
| Engineering Lead | \***\*\_\_\_\*\*** | \***\*\_\_\_\*\*** | @\***\*\_\_\_\*\*** |
| QA Lead          | \***\*\_\_\_\*\*** | \***\*\_\_\_\*\*** | @\***\*\_\_\_\*\*** |
| Product Lead     | \***\*\_\_\_\*\*** | \***\*\_\_\_\*\*** | @\***\*\_\_\_\*\*** |
| On-Call (24h)    | \***\*\_\_\_\*\*** | \***\*\_\_\_\*\*** | @\***\*\_\_\_\*\*** |

---

## Quick Reference

**Key Files**:

- Release package: `RELEASE_PACKAGE_INDEX.md`
- QA checklist: `QA_TESTING_CHECKLIST.md`
- Release notes: `RELEASE_NOTES_v1.0.0.md`
- Technical details: `ONBOARDING_LOOP_FINAL_SOLUTION.md`

**Key Commits**:

- Admin fix: `99dc67b`
- Health check: `48ca7f4`
- Documentation: `9574f0c`, `01035bd`, `0a96e2e`, `b89121c`

**Key Endpoints**:

- Backend health: `https://api-production-8ac3.up.railway.app/health`
- Backend `/me`: `https://api-production-8ac3.up.railway.app/me`
- EAS dashboard: `https://eas.expo.dev`
- App Store Connect: `https://appstoreconnect.apple.com`
- Google Play Console: `https://play.google.com/console`

---

**Version 1.0 — Ready for Deployment** ✅
