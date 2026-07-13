# QA, EAS Build & Security Scan - Local Execution Guide

**Date**: December 5, 2025  
**Status**: Ready for local execution  
**Prepared by**: Copilot (sandboxed environment)

---

## Quick Start for Local Execution

Run these three steps on your development machine in order:

### Step 1: QA Walkthrough (15-30 mins)

```bash
# In VS Code or Xcode simulator
npm run lint            # Verify no errors
npx tsc --noEmit        # Verify TypeScript

# Then manually:
# 1. Open iOS Simulator
# 2. Run: npx expo start --dev-client
# 3. Follow TESTING_CHECKLIST.md or QA_PHASE_1_READY.md
# 4. Capture any issues, screenshots, console logs
```

**Expected Output**: ✅ All tests pass or 📋 Issues documented

### Step 2: EAS Preview Build (10-30 mins)

```bash
# Build for iOS
eas build --platform ios --profile preview --wait

# Build for Android (optional)
eas build --platform android --profile preview --wait

# Share the build ID and TestFlight/Preview link
```

**Expected Output**: Build ID + downloadable preview link

### Step 3: Snyk Security Scan (5-10 mins)

```bash
# Authenticate with Snyk (first time only)
snyk auth

# Run full security scan
snyk test --all-projects

# Run code analysis
snyk code test

# Export results
snyk test --all-projects --json > snyk-results.json
snyk code test --json > snyk-code-results.json
```

**Expected Output**: JSON reports showing vulnerability count

---

## QA Walkthrough Guide

### Phase 1: Core Flows (45 mins total)

#### 1. Authentication Flow (10 mins)

**File**: `QA_PHASE_1_READY.md` (section: Auth Flow Testing)

```
✅ Email/Password Sign-Up
✅ Email/Password Sign-In
✅ Google OAuth (iOS)
✅ Apple Sign-In (iOS)
✅ Password Reset
✅ Session Persistence (kill app, relaunch)
```

**What to capture**:

- ✅ Console logs (should show: [Auth] Successful sign-in)
- ✅ No TypeScript errors in console
- ✅ Route transitions smooth (no flickering)

#### 2. Onboarding Flow (15 mins)

**File**: `ONBOARDING_BACKEND_CHECKLIST.md`

```
Step 1: Sport Selection
  ✅ Shows sport list
  ✅ Can select/deselect
  ✅ Next button enabled when selected

Step 2-8: Profile Info
  ✅ All fields accept input
  ✅ Validation shows errors (required fields)
  ✅ Date picker works for DOB

Step 9: Features (CRITICAL FOR PUSH NOTIFICATIONS)
  ✅ Notifications toggle visible
  ✅ Toggle ON → iOS permission popup appears
  ✅ User taps "Allow"
  ✅ Toggle remains ON
  ✅ Verify: GET /users/me returns push_token

Step 10: Completion
  ✅ Navigates to home screen /(tabs)
  ✅ User profile shows updated info
```

**What to capture**:

- 📸 Screenshot of Step 9 with permission prompt
- 📝 Note if permission prompt appears
- 🔍 API response showing `push_token` saved

#### 3. Push Notifications (10 mins)

**File**: `MESSAGING_AND_NOTIFICATIONS_VERIFICATION.md` (Testing section)

```
Setup: Two accounts (same device or two devices)
  Account A: Logged in with notifications enabled
  Account B: Another account (any status)

Test 1: Direct Message Notification
  ✅ Account B sends message to Account A
  ✅ Account A device shows notification
  ✅ Tap notification
  ✅ App opens → navigates to /messages
  ✅ Message visible in thread

Test 2: Like Notification (if posts enabled)
  ✅ Account A posts
  ✅ Account B likes post
  ✅ Account A gets notification
  ✅ Tap notification
  ✅ App opens → shows post detail

Test 3: Follow Notification (if follows enabled)
  ✅ Account B follows Account A
  ✅ Account A gets notification
  ✅ Tap notification
  ✅ App opens → shows Account B profile
```

**What to capture**:

- 📱 Screenshots of notifications
- 📝 Timestamps of arrival
- ⏱️ Time from send to arrival
- 🐛 Any notifications that don't arrive

#### 4. Messaging System (10 mins)

```
Setup: Two accounts in message thread

Test Sending
  ✅ Type message in compose field
  ✅ Tap send button
  ✅ Message appears instantly (optimistic UI)
  ✅ Status shows "sending" briefly
  ✅ Status updates to "sent" then "delivered"

Test Receiving
  ✅ On other account, send message
  ✅ First account receives within 3 seconds
  ✅ Auto-scrolls to newest message
  ✅ No manual refresh needed

Test Age Restrictions
  ✅ Create two accounts:
     - Account A: DOB = 2010 (minor, age 14)
     - Account B: DOB = 1990 (adult, age 35)
  ✅ Account B tries to message Account A
     → Modal warning appears: "You cannot message users under 18"
     → Message does NOT send ❌
  ✅ Account A tries to message Account B
     → Modal warning appears: "For your safety, messaging adults is restricted"
     → Message does NOT send ❌
  ✅ Account A (minor) messages Account A2 (minor)
     → No warning ✅
     → Message sends ✅
```

**What to capture**:

- 📝 Console logs showing message send/receive
- ⏱️ Time from send to arrival (should be <3 seconds)
- 📸 Screenshot of age restriction warning

#### 5. Game Discovery Map (5 mins)

```
Navigate to: Feed tab → "View Nearby Games on Map"

✅ Map loads (even if empty)
✅ Shows aerial USA view
✅ "No games with locations yet" message visible
✅ No crash or blank screen
✅ Back button returns to feed
```

---

## EAS Preview Build Setup

### Prerequisites

```bash
# Verify Expo CLI is installed
expo --version          # Should be 52.0.0+

# Verify you're logged in to Expo
eas whoami              # Should show account email

# Verify build profiles exist
cat eas.json            # Should show preview profile
```

### Build Commands

#### iOS Preview Build

```bash
# Clean build (recommended first time)
eas build --platform ios --profile preview --wait

# Share output
# After build completes, you'll see:
# ✅ Build ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# ✅ TestFlight link: https://testflight.apple.com/...
```

#### Android Preview Build (Optional)

```bash
# Similar to iOS
eas build --platform android --profile preview --wait

# Will create APK for direct installation
```

### Troubleshooting Build Issues

**Issue**: "Unauthorized" or "credentials not found"

```bash
# Solution: Re-authenticate
eas logout
eas login
eas build --platform ios --profile preview --wait
```

**Issue**: "Invalid certificate" or "provisioning profile"

```bash
# Solution: Update credentials
eas credentials
# Follow prompts to select iOS and update certificates
```

**Issue**: Build hangs or times out

```bash
# Solution: Run without --wait (build in background)
eas build --platform ios --profile preview --no-wait

# Then check status:
eas build --platform ios --status
```

### After Build Completes

**For iOS**:

- TestFlight link will be provided
- Share link with testers
- Testers can install via TestFlight app
- Build available for 90 days

**For Android**:

- APK file will be downloadable
- Can install via: `adb install app.apk`
- Or share APK file directly to testers

---

## Snyk Security Scan Setup

### Prerequisites

```bash
# Verify Snyk is installed
snyk --version          # Should be 1.1290.0+

# First time: authenticate with Snyk
snyk auth
# Opens browser → log in with GitHub/Google
# Paste auth token back into CLI
```

### Run Security Scans

#### Full Dependency Scan

```bash
# Scan all projects (frontend + backend)
snyk test --all-projects

# Expected output:
# ✅ 0 vulnerabilities (since we use modern deps)
# 🟡 Some low-severity issues in dev dependencies
# ⏱️ Should complete in <1 minute
```

#### Code Analysis (SAST)

```bash
# Scan source code for security flaws
snyk code test

# Expected output:
# 🟢 Should find 0-5 issues (all informational)
# Look for: SQL injection, XSS, hardcoded secrets
```

#### Export Results as JSON

```bash
# Full report
snyk test --all-projects --json > snyk-results.json

# Code analysis report
snyk code test --json > snyk-code-results.json

# Summary report
snyk test --all-projects --json-file-output=snyk-summary.json
```

#### Export to HTML (Better for sharing)

```bash
# If installed: snyk-to-html
npm install -g snyk-to-html

# Convert JSON to HTML
snyk test --all-projects --json | snyk-to-html -o snyk-report.html

# Then open: open snyk-report.html
```

### Interpreting Results

**CRITICAL Issues** ❌

- CVSS score 9.0+
- Exploitable vulnerability
- **ACTION**: Block production deployment until fixed

**HIGH Issues** ⚠️

- CVSS score 7.0-8.9
- Serious vulnerability
- **ACTION**: Fix before release, or accept risk formally

**MEDIUM Issues** 🟡

- CVSS score 4.0-6.9
- Moderate risk
- **ACTION**: Plan fix for next sprint

**LOW Issues** ℹ️

- CVSS score 0.1-3.9
- Minor issue or low severity
- **ACTION**: Track for improvement

---

## Data Collection Template

When you run these locally, please collect and share:

### QA Results

```
QA Status: ✅ PASS / 🔴 FAIL / 🟡 PARTIAL

Auth Flow:
  - Email signup: ✅
  - Email signin: ✅
  - Google OAuth: ✅
  - Apple SignIn: ✅
  - Password reset: ✅

Onboarding:
  - All steps complete: ✅
  - Step 9 (notifications): ✅ permission prompt appeared
  - Push token saved: ✅ confirmed in API response

Push Notifications:
  - Message received: ✅ arrived in 2.5 seconds
  - Tapped notification: ✅ navigated to /messages
  - Like notification: ✅ working
  - Follow notification: ✅ working

Messaging:
  - Send/receive: ✅ <3 second latency
  - Age restrictions: ✅ blocked adult→minor
  - UI smooth: ✅ no flickers

Map View:
  - Loads correctly: ✅
  - No crash: ✅

Issues Found:
  1. [Issue title] - [Steps to reproduce] - [Screenshot]
  2. [Another issue] - ...

Console Logs:
  [Paste any errors or warnings from Metro]

Screenshots:
  [Attach permission prompt, notification, age warning, etc]
```

### EAS Build Results

```
iOS Build:
  - Build ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  - Status: ✅ Success
  - TestFlight link: [URL]
  - Build duration: X minutes

Android Build (if attempted):
  - Build ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  - Status: ✅ Success
  - APK link: [URL]
  - Build duration: X minutes

Build Issues:
  [Any errors during build process]

Logs:
  [Paste relevant error logs if build failed]
```

### Snyk Results

```
Dependency Vulnerabilities:
  - Total found: X
  - Critical: X
  - High: X
  - Medium: X
  - Low: X

Code Analysis Issues:
  - Total found: X
  - By type: [XSS, SQLi, etc]

Issues Details:
  1. [Package]: [Issue] - Severity [Level]
  2. ...

JSON Reports:
  [Attach snyk-results.json and snyk-code-results.json]
```

---

## Integration: Receiving Results

**Once you share results, I will immediately**:

1. ✅ **Parse QA findings**
   - File GitHub issues for any bugs found
   - Prioritize by severity
   - Assign fix ownership
   - Provide code fixes if needed

2. ✅ **Review build artifacts**
   - Check build logs for warnings
   - Verify code integrity
   - Confirm all files present
   - Generate release notes

3. ✅ **Analyze security report**
   - Flag any critical issues
   - Provide remediation steps
   - Update security documentation
   - Create compliance report

4. ✅ **Generate summary report**
   - Green/yellow/red status
   - Go/no-go recommendation
   - Next steps and timeline
   - Risk assessment

---

## Timeline Estimate

| Step                | Duration     | When                |
| ------------------- | ------------ | ------------------- |
| QA Walkthrough      | 45 mins      | Now                 |
| EAS Build (iOS)     | 10-30 mins   | Parallel with QA    |
| EAS Build (Android) | 10-30 mins   | After iOS           |
| Snyk Scan           | 5-10 mins    | After builds        |
| **Total**           | **~90 mins** | **Start to finish** |

---

## Commands Reference (Copy-Paste Ready)

```bash
# ═══════════════════════════════════════════════════════════
# QA VERIFICATION
# ═══════════════════════════════════════════════════════════

# Check code quality
npm run lint
npx tsc --noEmit

# Start dev client
npx expo start --dev-client

# Open simulator (macOS)
open -a Simulator

# ═══════════════════════════════════════════════════════════
# EAS BUILD
# ═══════════════════════════════════════════════════════════

# Verify Expo setup
eas whoami
cat eas.json

# Build iOS
eas build --platform ios --profile preview --wait

# Build Android
eas build --platform android --profile preview --wait

# Check status without waiting
eas build --platform ios --status

# ═══════════════════════════════════════════════════════════
# SNYK SECURITY SCAN
# ═══════════════════════════════════════════════════════════

# Authenticate (first time)
snyk auth

# Run full dependency scan
snyk test --all-projects

# Run code analysis
snyk code test

# Export JSON results
snyk test --all-projects --json > snyk-results.json

# Convert to HTML report
snyk test --all-projects --json | snyk-to-html -o snyk-report.html

# ═══════════════════════════════════════════════════════════
```

---

## Success Criteria

### ✅ QA Phase Complete When:

- All auth flows tested and working
- Onboarding completed with push token saved
- Push notifications received and deep-linked correctly
- Messaging system send/receive working (<3 sec latency)
- Age restrictions enforced on both sides
- Map view displays without crashing
- **Console shows 0 TypeScript errors**

### ✅ Build Phase Complete When:

- iOS preview build succeeds
- Build available in TestFlight
- Android build succeeds (if attempted)
- APK available for download
- No warnings about missing certificates
- Bundle size reasonable (<200MB for iOS)

### ✅ Security Phase Complete When:

- Snyk dependency scan completes
- Snyk code scan completes
- All CRITICAL issues identified (should be 0)
- HIGH issues reviewed and accepted/fixed
- Reports exported as JSON and HTML
- Security sign-off obtained

---

## Troubleshooting Quick Links

**QA Issues**: See `TESTING_CHECKLIST.md` → Troubleshooting section  
**Build Issues**: See `EAS_BUILD_GUIDE.md` → Common Problems  
**Security Issues**: See `SECURITY.md` → Vulnerability Response

---

## Next Steps After Results

1. **Share all outputs** (QA notes, build links, security reports)
2. **I'll analyze** and create GitHub issues for any findings
3. **Provide fixes** or guidance for issues found
4. **Generate release** notes and go/no-go recommendation
5. **Schedule review** meeting with stakeholders

---

**Ready to execute locally?**

👉 Start with **Step 1: QA Walkthrough** (takes 45 mins)  
👉 Then **Step 2: EAS Preview Build** (takes 20-30 mins)  
👉 Finish with **Step 3: Snyk Scan** (takes 5-10 mins)

**Total time: ~90 minutes** for complete QA → Build → Security pipeline

Good luck! 🚀
