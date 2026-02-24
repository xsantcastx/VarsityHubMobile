# ⚡ Quick Reference: Runtime Testing in 5 Minutes

## TL;DR (Too Long; Didn't Read)

**Status**: Code is good ✅ | Need to test it ⏳

**What to do**:
```bash
# Terminal 1
npm run server:dev

# Terminal 2
npm run dev:expo

# Then test: Email → Security → Google Auth
```

**What happens**: You prove the app actually works

**Time**: 40-65 minutes

**Result**: 100% confident it's production-ready

---

## 3 Tests in One Paragraph Each

### Test 1: Email Verification
Sign up → Get verification email → Click link → Get routed to right page. Check it works for coach, athlete, and fan roles.

### Test 2: Dev Security  
Dev build shows debug info. Production build doesn't. Skip button only available in dev.

### Test 3: Google Auth
Try signing in with Google on iOS, Android, and Web. All should work using correct platform client ID.

---

## Command Cheat Sheet

```bash
# Setup
npm install                    # Install dependencies
npm run server:dev            # Start backend (Terminal 1)
npm run dev:expo              # Start Expo (Terminal 2)

# From Expo CLI
i                             # Open in iOS simulator
a                             # Open in Android emulator
w                             # Open in web browser

# Useful commands
npm run typecheck             # Check TypeScript
npm run lint                  # Check code style
npm run test                  # Run automated tests
```

---

## Test Checklist

### Before You Start
- [ ] Node.js v18+ installed
- [ ] npm dependencies installed
- [ ] .env file has 3 Google client IDs
- [ ] Backend port 4000 available
- [ ] Metro port 8081 available

### Test 1: Email (10 min)
- [ ] Sign up with test account
- [ ] Check email inbox
- [ ] Click verification link
- [ ] Verify routed to correct page

### Test 2: Security (10 min)
- [ ] Dev code visible in dev build
- [ ] Dev code hidden in production build
- [ ] Skip button works in dev
- [ ] Skip button missing in production

### Test 3: Google Auth (15 min)
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

### After Tests
- [ ] Document results
- [ ] Report pass/fail
- [ ] Proceed to staging or fix issues

---

## What Success Looks Like

```
✅ Email verification: Works end-to-end
✅ Dev code security: Hidden in production
✅ Google auth: Works on all platforms

= PRODUCTION READY 🚀
```

---

## If Something Fails

1. Check logs (Terminal 1 for backend, Terminal 2 for Expo)
2. Review troubleshooting in RUNTIME_TEST_GUIDE.md
3. Common fixes:
   - Backend not running? Start: `npm run server:dev`
   - Expo not building? Clear cache: `npm run dev:expo -- --clear`
   - Google OAuth fails? Check .env has client IDs

---

## Documents You Have

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **RUNTIME_TEST_GUIDE.md** | Step-by-step testing | 15 min |
| **READY_FOR_RUNTIME_TESTING.md** | Overview & decision tree | 10 min |
| **PHASE_TRANSITION_SUMMARY.md** | What's done vs what's next | 10 min |
| **ALL_FIXES_VERIFIED.md** | Code analysis results | 15 min |
| **VERIFICATION_CHECKLIST.md** | Detailed technical checklist | 20 min |

---

## The Key Insight

We verified the code is correct (95% confidence).  
You verify it actually works (100% confidence).  
Then it's production-ready.

---

## Start Here 👇

1. Open **RUNTIME_TEST_GUIDE.md**
2. Follow step-by-step
3. Report results
4. Deploy!

---

**Status**: Ready to test | **Time**: 1 hour | **Effort**: Follow instructions | **Outcome**: Production confidence ✅
