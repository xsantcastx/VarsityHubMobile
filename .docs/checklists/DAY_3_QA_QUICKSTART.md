# Day 3 QA Quick Start - Real Data Testing

**Timeline:** 6-8 hours | **Focus:** End-to-end flows with real data | **Goal:** Production readiness validation

---

## ⚡ PREP (15 minutes)

### 1. Reload VS Code & Install Extensions
```bash
Cmd+Shift+P → "Developer: Reload Window"
# Wait for reload, then click "Install All" when prompted
# Extensions: Thunder Client, GitHub Actions, Docker, React Native Tools, Expo Tools
```

### 2. Import Thunder Client Collection
- Click ⚡ icon in left sidebar (Thunder Client)
- Look for pre-built collection at `.vscode/thunder-client.json`
- Import health, email, and admin endpoint tests
- Keep Thunder Client tab open during testing

### 3. Sign Into GitHub Actions
- Click GitHub icon in sidebar
- Sign in so you can watch CI/CD pipeline
- Keep Actions tab open to catch any workflow issues

### 4. Verify Test Setup
```bash
# Check test accounts are ready
cat config/test-accounts.json 2>/dev/null || echo "Generate test accounts first"

# Verify simulator/device
xcrun simctl list | grep "iPhone" | head -3

# Or for Android
adb devices | grep emulator
```

---

## 📋 REFERENCE DOCS (Open These Tabs Now)

| Document | Purpose | Location |
|----------|---------|----------|
| **DAY_3_QA_CHECKLIST.md** | Main 6-8 hour testing script | Root directory |
| **LAUNCH_DASHBOARD.md** | Pass/fail tracking + blockers | Root directory |
| **Thunder Client Collection** | Pre-built API smoke tests | `.vscode/thunder-client.json` |
| **Sentry Dashboard** | Real-time error monitoring | https://sentry.io/vhub |

---

## 🔧 ENVIRONMENT SANITY (2 minutes)

Run these once before diving into app flows:

```bash
# TypeScript check
npm run typecheck 2>&1 | tail -3

# ESLint check
npm run lint:strict 2>&1 | tail -10

# Production readiness
./verify-production-ready.sh 2>&1 | tail -15
```

### Verify Backend is Live
From **any machine with network access** (not this restricted environment):
```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-04T...",
  "integrations": {
    "sentry": "connected",
    "sendgrid": "configured",
    "database": "connected"
  }
}
```

---

## 🚀 EXECUTION FLOW (6-8 hours)

Follow **DAY_3_QA_CHECKLIST.md** in this order:

### Phase 1: Auth & Onboarding (30 min)
- [ ] Sign out completely
- [ ] Sign in with existing test account
- [ ] Create fresh user account (capture screenshots)
- [ ] Verify email/SMS verification flow
- [ ] Check onboarding completion
- [ ] Monitor Sentry for errors

### Phase 2: Core Fan Flows (2 hours)
- [ ] Browse game feed (sort, filter, search)
- [ ] Join a game (RSVP, calendar integration)
- [ ] Vote on posts (upvote/downvote, count updates)
- [ ] Add story to game (photo/video upload)
- [ ] Share game link (deep link verification)
- [ ] Check Thunder Client logs for API responses
- [ ] Monitor Sentry errors in real-time

### Phase 3: Coach/Org Flows (2 hours)
- [ ] Create new team
- [ ] Create event/game for team
- [ ] Manage roster (add/remove members)
- [ ] Send team invites (check email delivery)
- [ ] Test subscription flow (Stripe test card: 4242 4242 4242 4242)
- [ ] Verify payments in Stripe dashboard
- [ ] Check admin approvals queue

### Phase 4: Messaging & Notifications (1 hour)
- [ ] Send 1-on-1 message (real user)
- [ ] Create group message
- [ ] Mark messages as read
- [ ] Check notification badges update
- [ ] Verify push notifications (if on device)
- [ ] Test typing indicators
- [ ] Monitor message delivery in Sentry

### Phase 5: Admin Dashboard (1 hour)
- [ ] View pending approvals
- [ ] Review user reports
- [ ] Test content moderation
- [ ] Check analytics dashboard
- [ ] Verify email logs
- [ ] Test admin role permissions

### Phase 6: Edge Cases & Error Handling (30 min)
- [ ] Offline mode (toggle airplane mode, reconnect)
- [ ] Background/foreground transitions
- [ ] Network timeout scenarios
- [ ] Invalid input handling
- [ ] Permission denials (camera, contacts, location)
- [ ] Large data set pagination

---

## 📊 LOGGING & TRACKING

### For Every Failure Found:
1. **Screenshot** – Capture the exact state
2. **Sentry Link** – Find error in https://sentry.io/vhub, copy link
3. **Reproduction Steps** – Document what you did
4. **Update LAUNCH_DASHBOARD.md** – Add issue with priority
5. **Update DAY_3_QA_CHECKLIST.md** – Mark ❌ for that flow

### Issue Template:
```markdown
## Issue #X: [Brief Title]

**Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

**Flow:** [Which phase/flow this affects]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected:** [What should happen]

**Actual:** [What actually happened]

**Sentry Link:** https://sentry.io/vhub/issues/...

**Screenshot:** [Attached]

**Notes:** [Additional context]
```

---

## 🎯 SUCCESS CRITERIA

### Must Pass (Blocking):
- ✅ Auth flows (sign up, sign in, logout)
- ✅ Core game discovery + RSVP
- ✅ Messaging (send/receive)
- ✅ Admin dashboard loads
- ✅ No critical Sentry errors
- ✅ TypeScript builds cleanly

### Should Pass (High Priority):
- ✅ Payment flows (Stripe integration)
- ✅ Email verification
- ✅ Story uploads
- ✅ Team management
- ✅ Push notifications
- ✅ Admin moderation

### Nice to Have (Lower Priority):
- ✅ Edge case handling
- ✅ Offline resilience
- ✅ Performance metrics
- ✅ Accessibility compliance

---

## 🔍 QUICK REFERENCE COMMANDS

```bash
# Watch Sentry in real-time
open https://sentry.io/vhub

# Check latest commits
git log --oneline -10

# See overnight results
cat overnight-results.txt | tail -50

# Monitor logs
tail -f overnight.log

# Fresh build if needed
npm install && npx expo start --ios

# Kill stuck processes
pkill -f "expo\|node" || true

# Check git status
git status --short
```

---

## 📱 TEST ACCOUNTS

### Pre-Created Test Users:
```
Email:    test.user@varsityhub.com
Password: TestPassword123!
Role:     Fan

Email:    coach.test@varsityhub.com
Password: CoachPass123!
Role:     Coach

Email:    admin.test@varsityhub.com
Password: AdminPass123!
Role:     Admin
```

### Stripe Test Card:
```
Card:     4242 4242 4242 4242
Exp:      12/25
CVC:      123
Name:     Test User
```

---

## ⏰ TIMING BREAKDOWN

| Phase | Time | Status |
|-------|------|--------|
| Prep + Environment Check | 15 min | ⏳ START HERE |
| Phase 1: Auth | 30 min | ⏳ NEXT |
| Phase 2: Core Flows | 2 hours | ⏳ MAIN |
| Phase 3: Coach/Payments | 2 hours | ⏳ MAIN |
| Phase 4: Messaging | 1 hour | ⏳ MAIN |
| Phase 5: Admin | 1 hour | ⏳ MAIN |
| Phase 6: Edge Cases | 30 min | ⏳ FINAL |
| **Total** | **~7.5 hours** | |

---

## 🚨 IF YOU FIND BLOCKERS

### Critical Issues (Stop & Triage):
- App crashes on launch
- Auth completely broken
- Database connection failed
- Payment processing failing
- Sentry not capturing errors

### High Priority (Document & Continue):
- User flow incomplete
- Data not persisting
- Email not sending
- Performance degradation

### Lower Priority (Log & Continue):
- UI text issues
- Minor layout bugs
- Missing non-critical features

---

## ✅ CHECKLIST TO START

- [ ] VS Code reloaded + extensions installed
- [ ] Thunder Client imported
- [ ] GitHub Actions signed in
- [ ] Test accounts verified
- [ ] Simulator/device ready
- [ ] Sentry dashboard open
- [ ] DAY_3_QA_CHECKLIST.md open
- [ ] LAUNCH_DASHBOARD.md ready to update
- [ ] Backend health check passed (curl)
- [ ] npm run typecheck passing
- [ ] Ready to begin Phase 1: Auth

---

## 🎯 YOU'RE READY!

Everything is in place. When you start, follow DAY_3_QA_CHECKLIST.md phase by phase, log issues in LAUNCH_DASHBOARD.md, and keep Sentry open.

**I'm here to help with any blockers you hit. Just let me know!** 🚀

---

Generated: December 4, 2025 | Status: Ready for Production QA
