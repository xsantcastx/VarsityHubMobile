# 🚀 App Launch Verification - Quick Checklist

**When login screen appears, verify these 10 critical points:**

---

## ✅ Visual & Navigation

- [ ] **Login Screen Loads**
  - Text is readable
  - Buttons are visible
  - No error dialogs
  - VarsityHub logo present

- [ ] **No Crash on Boot**
  - App didn't crash during startup
  - Simulator didn't freeze
  - No hanging spinners

- [ ] **No Error Banners**
  - Sentry dev banner not visible (we gated it)
  - No red error messages
  - No TypeScript errors in console

---

## ✅ API Connectivity

- [ ] **API Connection Verified**
  - Check console: Should see "API base: https://api-production-8ac3.up.railway.app"
  - Open Simulator dev menu (Cmd+D)
  - No connection errors

- [ ] **Sentry Connected**
  - Check console: Should see Sentry initialization
  - No DSN errors
  - Error tracking ready

---

## ✅ Environment Setup

- [ ] **Google OAuth Keys Loaded**
  - Check: .env has EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  - If sign-up fails, Google auth might not be ready

- [ ] **Stripe Configuration**
  - Publishable key in .env (for future payments)
  - LIVE KEY present (production-ready)

---

## ✅ Ready to Start QA

- [ ] **Tap "Create Account"**
  - Button responds
  - Navigates to sign-up form
  - No lag

- [ ] **Start Phase 1**
  - Follow QA_PHASE_1_PREP_BRIEF.md
  - Document any issues
  - Monitor Sentry dashboard

---

## 🐛 If Something's Wrong

| Problem | Check | Solution |
|---------|-------|----------|
| App crashes on boot | Sentry dashboard | Look for error, triage with me |
| No API connection | Console logs | Check .env API_URL |
| Google auth not working | .env variables | Restart Metro with `npx expo start --clear` |
| Simulator frozen | Kill simulator | `pkill -9 Simulator` then restart |
| Metro not running | Check port 8081 | `lsof -i :8081` - if not there, restart |

---

## 📍 Current Status

```
✅ Code:          TypeScript 0 errors
✅ Build:         Native build successful
✅ Simulator:     iPhone 17 Pro booted
✅ Metro:         Running on port 8081
✅ API:           Responding (degraded acceptable)
✅ Sentry:        Connected & ready
✅ Environment:   All variables set
```

**Next Step:** Verify login screen appears, then begin Phase 1 QA ✅

---

**Print this checklist and check off each item as the app boots!**
