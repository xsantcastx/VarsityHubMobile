# Quick Reference: Local Execution Checklist

## Before You Start
- [ ] Have VarsityHub workspace open in VS Code
- [ ] macOS with Xcode installed (iOS) or Android Studio (Android)
- [ ] Simulator/emulator running or physical device connected
- [ ] Snyk account created (snyk.io)
- [ ] Expo account authenticated (`eas whoami` should show email)

---

## Phase 1: QA Walkthrough (45 mins)

### Setup (5 mins)
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npm run lint           # 0 errors expected
npx tsc --noEmit       # 0 errors expected
```

### Start Dev Client (5 mins)
```bash
npx expo start --dev-client
# Opens Metro at http://localhost:8081
# Press 'i' for iOS or 'a' for Android
```

### Run Tests (45 mins)
Follow sections in order:
1. **Authentication Flow** (10 mins) - Sign up, sign in, OAuth, session
2. **Onboarding Flow** (15 mins) - All steps, especially Step 9 (notifications)
3. **Push Notifications** (10 mins) - Send/receive, deep linking, different types
4. **Messaging System** (10 mins) - Send/receive, age restrictions

**Capture**:
- ✅/❌ for each test
- 📸 Screenshots of issues
- 📝 Console logs of errors
- ⏱️ Timing for notifications

---

## Phase 2: EAS Preview Build (20-30 mins)

### iOS Build
```bash
eas build --platform ios --profile preview --wait
# Outputs: Build ID + TestFlight link
```

### Android Build (Optional)
```bash
eas build --platform android --profile preview --wait
# Outputs: Build ID + APK link
```

**Capture**:
- Build IDs
- Success/failure status
- Build duration
- TestFlight/APK links

---

## Phase 3: Snyk Security Scan (10 mins)

### Authenticate (First time only)
```bash
snyk auth
# Opens browser, copy token back
```

### Run Scans
```bash
snyk test --all-projects
snyk code test

snyk test --all-projects --json > snyk-results.json
snyk code test --json > snyk-code-results.json
```

**Capture**:
- Vulnerability counts
- Critical/High/Medium/Low breakdown
- JSON files

---

## Results Template

Copy this and fill in as you go:

```
═══════════════════════════════════════════════════════════
QA WALKTHROUGH RESULTS
═══════════════════════════════════════════════════════════

Auth Flow: ✅ PASS / ❌ FAIL
  - Email sign-up: ✅ / ❌
  - Email sign-in: ✅ / ❌
  - Google OAuth: ✅ / ❌
  - Apple Sign-In: ✅ / ❌
  - Password reset: ✅ / ❌
  - Session persistence: ✅ / ❌
  Issues: [none] / [list any found]

Onboarding Flow: ✅ PASS / ❌ FAIL
  - Steps 1-8: ✅ / ❌
  - Step 9 (Notifications): ✅ / ❌
    Permission prompt appeared: ✅ / ❌
    Token saved to backend: ✅ / ❌ (checked API response)
  Issues: [none] / [list any found]

Push Notifications: ✅ PASS / ❌ FAIL
  - Direct message notification: ✅ / ❌ (arrived in ___ seconds)
  - Deep link to /messages: ✅ / ❌
  - Like notification: ✅ / ❌
  - Follow notification: ✅ / ❌
  Issues: [none] / [list any found]

Messaging System: ✅ PASS / ❌ FAIL
  - Send message: ✅ / ❌
  - Receive message: ✅ / ❌ (arrived in ___ seconds)
  - Age restriction (adult→minor): ✅ / ❌ (blocked correctly)
  - Age restriction (minor→adult): ✅ / ❌ (blocked correctly)
  - Age restriction (minor↔minor): ✅ / ❌ (allowed correctly)
  Issues: [none] / [list any found]

Map View: ✅ PASS / ❌ FAIL
  - Loads: ✅ / ❌
  - No crashes: ✅ / ❌
  - Shows empty state: ✅ / ❌
  Issues: [none] / [list any found]

OVERALL QA STATUS: ✅ READY FOR RELEASE / 🟡 MINOR ISSUES / ❌ BLOCKING ISSUES

═══════════════════════════════════════════════════════════
EAS BUILD RESULTS
═══════════════════════════════════════════════════════════

iOS Build:
  Status: ✅ Success / ❌ Failed
  Build ID: ________________
  Duration: __________ minutes
  TestFlight Link: _______________________________
  Issues: [none] / [list any found]

Android Build:
  Status: ✅ Success / ❌ Failed / ⏭️ Skipped
  Build ID: ________________
  Duration: __________ minutes
  APK Link: _______________________________
  Issues: [none] / [list any found]

═══════════════════════════════════════════════════════════
SNYK SECURITY SCAN RESULTS
═══════════════════════════════════════════════════════════

Dependency Vulnerabilities:
  Total: ___
  Critical: ___ (issues: _____)
  High: ___ (issues: _____)
  Medium: ___ (issues: _____)
  Low: ___ (issues: _____)

Code Analysis (SAST):
  Total Issues: ___
  By Type: [list]

Critical Findings: [NONE] / [list]
Action Required: [NONE] / [list]

Security Sign-Off: ✅ APPROVED / ❌ REQUIRES FIXES

═══════════════════════════════════════════════════════════
```

---

## Where to Share Results

1. **Copy results template** (above)
2. **Attach JSON files**:
   - snyk-results.json
   - snyk-code-results.json
3. **Attach screenshots**:
   - Permission prompt
   - Notification alert
   - Age restriction warning
   - Any errors found
4. **Share via**:
   - Slack
   - Email
   - GitHub issue
   - Direct message

---

## What Happens After You Share

I will immediately:
1. ✅ Parse all findings
2. ✅ Create GitHub issues for bugs (with priority)
3. ✅ Provide code fixes or guidance
4. ✅ Update documentation
5. ✅ Generate final go/no-go recommendation
6. ✅ Create release notes

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Setup & QA | 45 mins | 🟢 Ready |
| EAS Build | 20-30 mins | 🟢 Ready |
| Snyk Scan | 10 mins | 🟢 Ready |
| Analysis (me) | 15 mins | ⏳ Waiting |
| **TOTAL** | **~90-100 mins** | |

---

## Support

**Stuck on any step?** Refer to:
- `TESTING_CHECKLIST.md` - Full QA guide
- `QA_PHASE_1_READY.md` - Detailed test cases
- `MESSAGING_AND_NOTIFICATIONS_VERIFICATION.md` - Deep dive on specific features
- `EAS_BUILD_GUIDE.md` - Build troubleshooting
- `SECURITY.md` - Security best practices

**Need help during execution?**
1. Check the relevant guide above
2. Review Metro console logs
3. Share error message + console output

---

**Ready to begin? Start with QA Phase 1! 🚀**
