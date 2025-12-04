# QA Day 3 - Live Monitoring Dashboard

**Status:** ⏳ Metro bundling (cache rebuild)  
**Build Status:** ✅ Complete  
**App Installed:** ✅ iPhone 17 Pro simulator  
**Time Started:** Dec 5, 2025 @ 8:35 AM  

---

## 🔴 CRITICAL MONITORING (Watch During QA)

### 1. Sentry Error Dashboard
**URL:** https://sentry.io/organizations/varsityhub/issues/

**What to watch:**
- ❌ Should be ~0 errors during QA (expect < 5)
- ✅ Errors appear within 5-10 seconds of occurrence
- 📍 Stack trace shows file/line number
- 🔍 Search for error messages in real-time

**If you see errors:**
1. Click error to see full stack trace
2. Note the file and line number
3. Check: Is it a blocker? (app crash = yes, UI glitch = no)
4. Screenshot the error
5. Notify immediately if it's blocking

---

### 2. GitHub Actions Workflow
**URL:** https://github.com/xsantcastx/VarsityHubMobile/actions

**What to watch:**
- ✅ "Production Readiness" workflow should be PASSING
- 🔴 Any RED X = blocker (workflow failed)
- 📊 Check: Latest push should have green checkmark
- ⏱️ Workflow runs on every push (should be ~5 min)

**If workflow fails:**
1. Click on failed job
2. Check error message
3. Common issues: TypeScript error, build failure
4. Report to me immediately

---

### 3. API Health Check
**Endpoint:** https://api-production-8ac3.up.railway.app/health

**Expected response:**
```json
{
  "status": "ok",
  "uptime": 123456,
  "database": "connected",
  "services": {
    "sendgrid": "active",
    "sentry": "active"
  }
}
```

**Check every 30 minutes:**
```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq .
```

If API is down:
- ❌ Sign-up will fail
- ❌ Games won't load
- ❌ All backend operations blocked
- **Notify immediately**

---

## 📱 App Status Indicators

### Login Screen (When it appears)
- [ ] Text readable
- [ ] No error banners/dialogs
- [ ] Buttons respond to tap
- [ ] VarsityHub logo visible
- [ ] "Create Account" link visible

### After Sign-Up Success
- [ ] Navigates to onboarding (Step 1)
- [ ] Sentry: Check for new errors
- [ ] No spinners stuck (load takes < 3 seconds)

### During Onboarding
- [ ] Each step loads quickly
- [ ] Back button works
- [ ] Next button progresses
- [ ] Location permission dialog appears
- [ ] No crashes when skipping optional steps

---

## ⏱️ Phase 1 Timeline (Happening Now)

| Time | Activity | Status | Notes |
|------|----------|--------|-------|
| 8:35 | Metro bundling | ⏳ In progress | Cache rebuild, ~2-3 min wait |
| 8:38 | App connects to dev client | ⏳ Waiting | Should see login screen |
| 8:40 | **Sign-up flow** | 📍 STARTS HERE | 45 min test |
| 9:25 | Onboarding flow | 📍 Next | 40 min test |
| 10:05 | Game Discovery | 📍 Next | 40 min test |
| 10:45 | Create Game | 📍 Next | 30 min test |
| 11:15 | **Phase 1 Complete** | ✅ Goal | Break → Phase 2 |

---

## 🐛 Bug Triage Reference (Quick Decisions)

### Blocking Issues (STOP & FIX)
- 🛑 App crashes on boot
- 🛑 Sign-up flow doesn't work
- 🛑 Can't verify email (after 30 sec)
- 🛑 Can't complete onboarding
- 🛑 RSVP button doesn't work
- **Action:** Screenshot + error message + Sentry link

### Non-Blocking Issues (DOCUMENT & CONTINUE)
- 🟡 UI misalignment
- 🟡 Slow load (< 5 sec but > 2 sec)
- 🟡 Typo in text
- 🟡 Animation janky
- **Action:** Screenshot + note → GitHub issue post-QA

### Expected Issues (IGNORE)
- ⚠️ Lint warnings (we have ~400, known)
- ⚠️ Dev menu warning (Cmd+D works)
- ⚠️ Sentry "No valid DSN" warning (dev mode, expected)

---

## 🎯 Success Criteria Checklist

### By 11:15 AM (End of Phase 1), Check:
- [ ] Completed all 5 flows (sign-up → onboarding → discovery → RSVP → create)
- [ ] Zero app crashes observed
- [ ] Sentry shows 0-3 errors (dev noise acceptable)
- [ ] GitHub Actions workflow passing
- [ ] API health check passing
- [ ] All screenshots documented

**If all ✅:** Proceed to Phase 2 (teams, messaging, admin)  
**If any ❌:** Triage immediately, note blocker status

---

## 📞 Quick Communication Protocol

### You (QA Testing)
- **Every 30 min:** "Phase 1 progress - 45% complete, no issues"
- **On error:** "Found issue: [description] + screenshot + Sentry link"
- **On blocker:** "BLOCKER FOUND - app crash on sign-up. Investigating..."

### Me (Monitoring)
- **Continuous:** Watch Sentry dashboard
- **Continuous:** Watch GitHub Actions workflow
- **On your signal:** Provide immediate analysis/fix
- **If API goes down:** Proactive alert

---

## 🔧 Troubleshooting Commands (If Needed)

```bash
# Check Metro is running
lsof -i :8081 | head -2

# Verify app on simulator
xcrun simctl list apps booted | grep -i varsity

# Check TypeScript (no errors expected)
npm run typecheck

# View API health
curl -s https://api-production-8ac3.up.railway.app/health | jq .

# View Sentry DSN configured
grep SENTRY_DSN .env

# Restart Metro (if stuck)
pkill -9 node expo
sleep 3
npx expo start --clear
```

---

## 📊 Real-Time Monitoring Summary

**You are running:**
- ✅ VarsityHub Mobile app (installed on simulator)
- ✅ Metro bundler (localhost:8081)
- ✅ Production API (api-production-8ac3.up.railway.app)
- ✅ Sentry error tracking (live dashboard)
- ✅ GitHub Actions CI/CD (workflow monitoring)

**Expected during Phase 1:**
- Login screen appears → Start sign-up test
- Each flow takes 5-10 minutes
- If stuck > 30 seconds: Check Sentry for error
- If no error in Sentry: Device might be hung

**You have ~3 hours of Phase 1 testing ahead.**  
**Aim to complete by 11:15 AM for Phase 2.**

---

## 🚀 Ready to Launch

**When login screen appears:**
1. Take screenshot (for documentation)
2. Tap "Create Account"
3. Follow QA_PHASE_1_PREP_BRIEF.md sign-up section
4. Every 30 min: Update me with progress
5. Any issues: Note + screenshot + Sentry link

**You've got this. Let's get that app live! 🎯**

---

**Dashboard Updated:** Dec 5, 2025 @ 8:35 AM  
**Monitoring Status:** ACTIVE  
**Sentry Alerts:** Enabled  
**GitHub Actions:** Watching  
**Next Checkpoint:** Login screen appears (~2 min)
