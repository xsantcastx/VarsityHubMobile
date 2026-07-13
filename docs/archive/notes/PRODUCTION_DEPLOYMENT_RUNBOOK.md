# 📦 Production Deployment Runbook

**Version:** 1.0  
**Last Updated:** January 2025  
**Status:** READY  
**Target Platforms:** iOS (App Store) + Android (Google Play)

---

## 🚀 Pre-Deployment Checklist (Required Before Starting)

### Code Quality & Testing ✅

- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run snyk-code` passes with 0 critical issues
- [ ] `npx expo-doctor@latest` passes 17/17 checks
- [ ] Email system test script passes 100%
- [ ] Email testing checklist completed successfully
- [ ] All manual testing passed on staging environment

### Environment & Configuration ✅

- [ ] `.env` file has all required variables set
- [ ] `server/.env` file has all required variables set
- [ ] Stripe is in LIVE mode (not test mode)
- [ ] SendGrid API key is production key (not sandbox)
- [ ] Google OAuth is configured with production credentials
- [ ] Apple Sign-In is configured with production certificates
- [ ] Database migrations have run on production (Railway PostgreSQL)
- [ ] All environment variables are secured (no secrets in git)

### Build Prerequisites ✅

- [ ] Node.js version: 18.x or 20.x (verify with `node --version`)
- [ ] Expo CLI installed: `npm install -g expo-cli`
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Git repository is clean (no uncommitted changes): `git status`
- [ ] Latest code is on main branch: `git log --oneline -1`
- [ ] All tests passing on main branch in GitHub

### Apple Setup ✅

- [ ] Apple Developer account active and in good standing
- [ ] App ID created in Apple Developer (com.varsityhub.app)
- [ ] App Store Connect app created and configured
- [ ] Bundle identifier matches: `com.varsityhub.app`
- [ ] Icons and screenshots uploaded to App Store Connect
- [ ] Privacy Policy URL set in App Store Connect
- [ ] Support URL set in App Store Connect
- [ ] Content rating completed in App Store Connect
- [ ] Distribution certificate installed locally
- [ ] Provisioning profiles created and installed
- [ ] Push notification certificate configured (if needed)

### Android Setup ✅

- [ ] Google Play Developer account active
- [ ] App created in Google Play Console
- [ ] Package name matches: `com.varsityhub.app`
- [ ] Icons and screenshots uploaded to Google Play
- [ ] Privacy Policy URL set in Google Play
- [ ] Support email set in Google Play
- [ ] Content rating completed in Google Play
- [ ] Android signing key created and backed up
- [ ] KeyStore file saved securely (.jks file)

---

## 📋 Deployment Steps

### Step 1: Final Code Verification (5 minutes)

```bash
# Verify clean git state
git status
# Output should show: "On branch main" and "nothing to commit"

# Verify latest commit
git log --oneline -1
# Output should show your latest commit hash and message

# Verify no uncommitted changes
git diff-index --quiet HEAD --
# Output should be empty (exit code 0)
```

**Expected Results:**

- ✅ Branch is `main`
- ✅ No uncommitted changes
- ✅ All files committed and pushed
- ✅ Latest commit visible in GitHub

**If Issues:**

- [ ] Commit any pending changes: `git add . && git commit -m "Pre-deployment final commit"`
- [ ] Push to GitHub: `git push origin main`
- [ ] Run checks again

---

### Step 2: Install Dependencies (3 minutes)

```bash
# Clean install of all dependencies
npm ci  # Use npm ci instead of npm install for production

# Verify no vulnerabilities
npm audit

# Expected output:
# - 0 vulnerabilities found
# - If vulnerabilities exist, run: npm audit fix
```

**Expected Results:**

- ✅ 1,281 packages installed
- ✅ 0 vulnerabilities found
- ✅ All peer dependencies satisfied

**If Issues:**

- [ ] Run: `npm install --legacy-peer-deps` (only if needed)
- [ ] Run: `npm audit fix` to auto-fix vulnerabilities
- [ ] Report any security issues before proceeding

---

### Step 3: Build Verification (5 minutes)

```bash
# Run all production code quality checks
npm run lint

# Expected output: 0 lint errors
# If issues: fix and run again

npm run typecheck

# Expected output: 0 type errors
# If issues: fix and run again

npm run snyk-code

# Expected output: 0 critical security issues
# If issues: fix and run again
```

**Expected Results:**

- ✅ Lint passes with 0 errors
- ✅ TypeScript passes with 0 errors
- ✅ Snyk code scan passes with 0 critical issues

**If Issues:**

- [ ] Fix any reported errors
- [ ] Run tests again
- [ ] DO NOT PROCEED until all pass

---

### Step 4: Prepare Build Credentials (10 minutes)

#### For iOS:

```bash
# Login to Apple Developer account via EAS
eas login

# Select your Apple Developer account
# It will prompt for:
# - Apple ID email
# - Apple ID password or app-specific password
# - 2FA code if prompted

# Verify credentials stored
eas credentials show --platform ios

# Expected output:
# - Distribution Certificate: active
# - Provisioning Profiles: active
# - Push Notifications (optional): configured
```

**Expected Results:**

- ✅ Successfully authenticated with Apple Developer
- ✅ Distribution credentials visible
- ✅ Provisioning profiles listed

**If Issues:**

- [ ] Verify Apple ID has access to Developer Team
- [ ] Check Developer Team membership in Apple Developer website
- [ ] Re-run: `eas credentials show --platform ios`

#### For Android:

```bash
# Verify keystore file exists
ls -la android/app/release.jks
# Or wherever your keystore is stored

# Expected output:
# -rw-r--r--  1 user  group  12345 Jan 24 release.jks

# If file doesn't exist, you must create a keystore:
# keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release
```

**Expected Results:**

- ✅ Keystore file exists and is readable
- ✅ Keystore password known and secure
- ✅ Key alias and password documented

**If Issues:**

- [ ] Create new keystore if missing
- [ ] Backup keystore to secure location
- [ ] Document password in secure vault (NOT in git)

---

### Step 5: Build iOS IPA (15-20 minutes)

```bash
# Start iOS build via EAS
eas build --platform ios --auto-submit

# Or build without auto-submit (manual review):
eas build --platform ios

# This will:
# - Compile your React Native code
# - Link Expo libraries
# - Sign with distribution certificate
# - Create IPA file
# - Upload to App Store Connect (if auto-submit enabled)

# Monitor build progress
eas build:list --platform ios

# When complete, download IPA:
# - IPA will be in EAS cloud storage
# - Or automatically submitted to App Store Connect
```

**Expected Results:**

- ✅ Build completes successfully
- ✅ Build artifact generated and uploaded
- ✅ App appears in App Store Connect

**Build Troubleshooting:**

```bash
# If build fails:

# Check build logs:
eas build:view

# Common issues:
# 1. "Provisioning profile error"
#    → Run: eas credentials show --platform ios
#    → Regenerate credentials if needed

# 2. "Certificate not found"
#    → Make sure distribution certificate is active
#    → Check Apple Developer website

# 3. "Build timeout"
#    → Wait 5-10 minutes and try again
#    → Check EAS status page
```

---

### Step 6: Build Android APK/AAB (15-20 minutes)

```bash
# Start Android build via EAS
eas build --platform android --auto-submit

# Or build without auto-submit:
eas build --platform android

# This will:
# - Compile your React Native code
# - Link Expo libraries
# - Create Android App Bundle (AAB)
# - Sign with release keystore
# - Upload to Google Play Console (if auto-submit enabled)

# Monitor build progress
eas build:list --platform android

# When complete:
# - AAB will be in EAS cloud storage
# - Or automatically submitted to Google Play
```

**Expected Results:**

- ✅ Build completes successfully
- ✅ AAB artifact generated and uploaded
- ✅ App appears in Google Play Console

**Build Troubleshooting:**

```bash
# If build fails:

# Check build logs:
eas build:view

# Common issues:
# 1. "Keystore file not found"
#    → Make sure android/app/release.jks exists
#    → Run: ls -la android/app/release.jks

# 2. "Keystore password incorrect"
#    → Verify password in eas.json matches actual keystore
#    → Test locally if needed

# 3. "Build timeout"
#    → Wait 5-10 minutes and try again
#    → Check EAS status page
```

---

### Step 7: Review Builds in Console

#### App Store Connect (iOS):

```bash
# Open in browser: https://appstoreconnect.apple.com

# Steps:
# 1. Navigate to: My Apps > [Your App] > Builds
# 2. Find your build with version matching app.json
# 3. Review metadata:
#    - Version number (e.g., 1.0.0)
#    - Build number (e.g., 1)
#    - Supported devices
#    - SDK version
# 4. Click "Build Ready to Submit"
# 5. Proceed to submission (next step)
```

#### Google Play Console (Android):

```bash
# Open in browser: https://play.google.com/console

# Steps:
# 1. Navigate to: [Your App] > Release > Production
# 2. Click "Create new release"
# 3. Select your build (AAB with correct version)
# 4. Review metadata:
#    - Version name (e.g., 1.0.0)
#    - Version code (auto-incremented)
#    - Supported devices
#    - SDK version
# 5. Add release notes
# 6. Save and continue to review (next steps)
```

---

### Step 8: Submit iOS to App Store

#### Option A: Via App Store Connect Web

```
1. Go to: https://appstoreconnect.apple.com
2. Select: My Apps > [Your App] > Builds
3. Click your build
4. Click: "Add for Review" button
5. Complete all required sections:
   - Version Release (automatic or manual)
   - Export Compliance (US export regulations)
   - Advertising Identifier (IDFA) declaration
   - Content Rights
   - Age Rating if not completed
6. Review final summary
7. Click: "Submit for Review"
8. Receive email confirmation
```

#### Option B: Via Xcode (if needed)

```bash
# Only use if EAS submit didn't work

# Requires Xcode Command Line Tools:
xcode-select --install

# Then use EAS to submit:
eas submit --platform ios
```

**Expected Results:**

- ✅ Received "Build received by App Store" email
- ✅ Build status changes to "Waiting for Review"
- ✅ Apple will review within 24-48 hours

**App Store Review Timeline:**

- 24-48 hours: Standard review (most apps)
- 48-72 hours: May be required for complex apps
- Expedited review available if urgent (paid option)

---

### Step 9: Submit Android to Google Play

#### Via Google Play Console Web

```
1. Go to: https://play.google.com/console
2. Select your app
3. Navigate to: Release > Production
4. Click: "Create new release"
5. Select your AAB build
6. Add release notes (visible to users):
   - What's new in this version?
   - Bug fixes and improvements
7. Set staged rollout % (recommended: 25% first, then 100%)
8. Review country targeting and pricing
9. Click: "Save and continue"
10. Review everything carefully
11. Click: "Review release"
12. Make final confirmation
13. Click: "Rollout to production"
```

**Expected Results:**

- ✅ Release created and pending review
- ✅ Initial rollout to staged users (if selected 25%)
- ✅ Full rollout after 24-48 hours

**Google Play Review Timeline:**

- Usually approved within 2-3 hours
- Can take up to 24 hours
- Google Play automatically reviews for malware/policy violations

---

### Step 10: Monitor Rollout (30 minutes to 24 hours)

#### For iOS:

```bash
# Check review status
# Option 1: App Store Connect website
# - My Apps > [Your App] > Build Activity
# - Status will change from "Waiting for Review" → "In Review" → "Ready for Sale"

# Option 2: Command line (optional)
eas build:view --platform ios
```

**iOS Review Status Flow:**

```
Waiting for Review (1-3 hours)
    ↓
In Review (up to 24 hours)
    ↓
Ready for Sale ✅ (app goes live immediately)
    ↓
OR Rejected (review issues, will email details)
```

#### For Android:

```bash
# Check rollout status
# Google Play Console > [Your App] > Release > Production
# Status will change: "Pending review" → "In review" → "Rolling out"

# Check rollout percentage:
# - Initial: 25% (testing with portion of users)
# - After 24-48 hours: Increase to 100% for full release
```

**Android Rollout Status Flow:**

```
Under review (2-3 hours usually)
    ↓
Approved ✅
    ↓
Rolling out in phases (if staged rollout enabled)
    ↓
Complete rollout to 100% (after 24-48 hours)
```

---

### Step 11: Post-Launch Verification (15 minutes)

```bash
# Once apps go live, verify:

# iOS App Store
# 1. Go to: https://apps.apple.com
# 2. Search for "VarsityHub"
# 3. Verify it appears with correct version number
# 4. Verify screenshots and description display correctly
# 5. Download to test device and verify functionality

# Google Play Store
# 1. Go to: https://play.google.com/store/apps
# 2. Search for "VarsityHub"
# 3. Verify it appears with correct version number
# 4. Verify screenshots and description display correctly
# 5. Download to test device and verify functionality

# In-App Verification
# 1. Create test account if not already made
# 2. Login and verify authentication works
# 3. Test all major features:
#    - Browse events
#    - Submit event
#    - RSVP to event
#    - Team management
#    - Payments (use test Stripe card)
# 4. Send yourself test emails
#    - Verify email subjects display
#    - Verify images load
#    - Verify variables populate
# 5. Check analytics/monitoring
#    - Firebase/Sentry for errors
#    - User session tracking
```

**Verification Checklist:**

- [ ] App appears in both app stores
- [ ] Version number matches (1.0.0)
- [ ] Screenshots and description correct
- [ ] App downloads and installs
- [ ] Authentication works
- [ ] Core features functional
- [ ] Emails send correctly
- [ ] No critical errors in logs
- [ ] Performance is acceptable

---

### Step 12: Document Release

```bash
# Create release notes document

# File: PRODUCTION_RELEASE_NOTES.md

Timestamp: [Date/Time]
Version: 1.0.0 (Build 1)
Platforms: iOS (App Store) + Android (Google Play)

✅ DEPLOYMENT SUMMARY:
- iOS: Submitted [time/date], Approved [time/date], Live at [time/date]
- Android: Submitted [time/date], Approved [time/date], Live at [time/date]

📋 FEATURES INCLUDED:
- [List major features]
- [List major fixes]
- [List security updates]

🐛 KNOWN ISSUES:
- [Any known limitations]

📊 BUILD STATS:
- Bundle size iOS: [size] MB
- Bundle size Android: [size] MB
- Dependencies: 1,281 packages
- Security: 0 vulnerabilities

🔗 LINKS:
- iOS App Store: https://apps.apple.com/app/varsityhub/id[ID]
- Android Play Store: https://play.google.com/store/apps/details?id=com.varsityhub.app
- GitHub Commit: [commit hash]
```

---

## ⚠️ Rollback Procedures

### If Critical Issues After Launch:

#### Remove from App Store (Immediate)

```bash
# iOS: Go to App Store Connect
# 1. My Apps > [App] > Pricing and Availability
# 2. Click "Manage" next to Status
# 3. Select "Remove from Sale"
# 4. Confirm removal
# Removed within 24 hours

# Android: Go to Google Play Console
# 1. [App] > Release > Production
# 2. Click "Remove from store"
# 3. Confirm
# Removed immediately
```

#### Prepare Hotfix

```bash
# 1. Identify the issue
# 2. Create fix in code
# 3. Test thoroughly locally and on staging
# 4. Commit with message: "Hotfix: [issue description]"
# 5. Push to main branch
# 6. Run all quality checks
# 7. Create new build with incremented version
#    - iOS: 1.0.1 (build 2)
#    - Android: 1.0.1 (build 2)
# 8. Resubmit to both stores with explanation
```

#### Communicate Status

```bash
# 1. Email all users who downloaded
#    "We're addressing an issue and will have a fix within X hours"
# 2. Update app store pages with status
# 3. Post on social media/support channels
# 4. Do NOT publicly blame users or make excuses
```

---

## 🎯 Post-Launch Checklist

### Day 1 After Launch:

- [ ] Monitor crash reports in Firebase/Sentry
- [ ] Check user reviews in app stores
- [ ] Monitor server logs for errors
- [ ] Track analytics for unusual patterns
- [ ] Respond to user feedback
- [ ] Verify email system working (check sample user emails)

### Week 1:

- [ ] Review aggregate crash/error reports
- [ ] Analyze user engagement metrics
- [ ] Monitor payment processing
- [ ] Check email delivery rates
- [ ] Review authentication success rates
- [ ] Plan any quick fixes/patches

### Month 1:

- [ ] Analyze feature usage patterns
- [ ] Review user feedback and ratings
- [ ] Plan next version/features
- [ ] Update documentation
- [ ] Optimize based on analytics

---

## 📞 Support Contacts

**If builds fail or won't submit:**

- EAS Support: https://expo.dev/support
- Apple Developer Support: https://developer.apple.com/support
- Google Play Support: https://support.google.com/googleplay

**If app is rejected:**

- Email provided by Apple or Google with reason
- Address specific issues mentioned
- Resubmit with explanation

**Internal Support:**

- Backend issues: Check server logs
- Email issues: Check SendGrid dashboard
- Payment issues: Check Stripe dashboard
- Authentication: Check OAuth provider dashboards

---

## ✅ Final Sign-Off

**Deployment started:** **\*\***\_\_\_**\*\*** (Date/Time)  
**iOS submitted:** **\*\***\_\_\_**\*\*** (Date/Time)  
**iOS approved:** **\*\***\_\_\_**\*\*** (Date/Time)  
**Android submitted:** **\*\***\_\_\_**\*\*** (Date/Time)  
**Android approved:** **\*\***\_\_\_**\*\*** (Date/Time)  
**Live to users:** **\*\***\_\_\_**\*\*** (Date/Time)

**Deployed by:** \***\*\*\*\*\*\*\***\_\_\_\***\*\*\*\*\*\*\***  
**Verified by:** \***\*\*\*\*\*\*\***\_\_\_\***\*\*\*\*\*\*\***  
**Notes:** \***\*\*\*\*\*\*\***\_\_\_\***\*\*\*\*\*\*\***
