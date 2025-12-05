# Day 3 QA Session Tracker

**Date:** December 5, 2025  
**Duration:** 6-8 hours  
**App Status:** VarsityHub Live on iOS Simulator  
**Backend:** All systems green (Stripe, SMTP, Sentry, DB)

---

## 📍 Session Progress

### ✅ Pre-QA Verification
- [x] App running on simulator (PID 28356)
- [x] Metro bundler active
- [x] Sentry monitoring enabled
- [x] API backend responsive
- [x] Hooks cleaned (zero TypeScript errors)
- [x] Payment infrastructure locked & ready

---

## 🎯 QA Flows (6-8 hours total)

### Flow 1: User Sign-Up
**Time:** 20 minutes  
**Status:** Not Started

**Checklist:**
- [ ] Email validation works (reject invalid emails)
- [ ] Password requirements display (8+ chars, uppercase, number, special)
- [ ] Submit button disabled until form valid
- [ ] Loading spinner during submit
- [ ] Success toast shows on signup
- [ ] User created in database
- [ ] Verification email sent
- [ ] User can proceed to onboarding
- [ ] Sentry logs signup_start breadcrumb
- [ ] No crashes, clean error handling

**Notes:**
```
Start here: Tap "Sign Up" button on login screen
Email: qa-test+001@example.com
Password: TestPassword123!
```

**Debug commands (if needed):**
- F5 → Set breakpoint in `hooks/useAuth.ts` → `handleSignUp`
- Cmd+D → Inspector → Tap form fields to see component structure
- Monitor Sentry → Look for "user_signup_start" breadcrumb

**Result:** ✅ / ❌  
**Issues Found:** (none yet)

---

### Flow 2: Game List Discovery
**Time:** 10 minutes  
**Status:** Not Started

**Checklist:**
- [ ] Game list loads instantly (< 2 seconds)
- [ ] 10 games display per page
- [ ] Pull-to-refresh works (drag down)
- [ ] Infinite scroll loads next 10 games
- [ ] Each game shows: name, sport, location, time, player count
- [ ] Tap game → detail screen opens
- [ ] Memory stays stable (~130MB, doesn't grow above 180MB)
- [ ] No duplicate games appear
- [ ] Location filter works (if implemented)
- [ ] Sentry logs GET /games request

**Notes:**
```
After signup, you're on game list screen
Scroll down 10x watching memory with Cmd+D → Perf Monitor
Expected: RAM stays ~130MB
```

**Debug commands:**
- Cmd+D → Show Perf Monitor (watch FPS/RAM while scrolling)
- F5 → Breakpoint in `api/http.ts` → `get('/games')`
- Inspector → Tap game cards to see structure

**Result:** ✅ / ❌  
**Issues Found:**

---

### Flow 3: Create Game
**Time:** 15 minutes  
**Status:** Not Started

**Checklist:**
- [ ] "Create Game" button accessible from game list
- [ ] Form loads with fields: sport, time, location, max players
- [ ] Date picker shows calendar
- [ ] Time picker shows hours/minutes
- [ ] Location search works (Google Places API)
- [ ] Submit disabled until all fields filled
- [ ] Form validation rejects invalid inputs
- [ ] Loading indicator shows during submit
- [ ] Success toast + return to game list
- [ ] Game appears in list within 5 seconds
- [ ] User marked as "Organizer"
- [ ] Sentry logs game_created event

**Notes:**
```
Test data:
Sport: Basketball
Date: Tomorrow
Time: 3:00 PM
Location: Central Park (search & select)
Max Players: 10
```

**Debug commands:**
- F5 → Breakpoint in create game handler
- Check response in debugger console: `await api.post('/games', data)`
- Sentry → Check game_created breadcrumb

**Result:** ✅ / ❌  
**Issues Found:**

---

### Flow 4: Messaging System
**Time:** 10 minutes  
**Status:** Not Started

**Checklist:**
- [ ] Tap game → can message other players
- [ ] Message compose field visible
- [ ] Send button (paper plane icon) works
- [ ] Message appears instantly (optimistic UI)
- [ ] Delivery check mark appears
- [ ] Messages sorted by timestamp
- [ ] Emoji picker works (if included)
- [ ] Image/video attachment works (if included)
- [ ] Can scroll message history
- [ ] Timestamp shows correctly (relative: "2m ago")
- [ ] No message loss on refresh
- [ ] Sentry logs message_sent event

**Notes:**
```
Find a game with other players
Compose: "Hey, I'm interested in playing!"
Send → Should appear instantly
```

**Debug commands:**
- F5 → Breakpoint in message send handler
- Cmd+D → Inspector → Tap messages to see structure
- Check Sentry breadcrumbs for message_sent

**Result:** ✅ / ❌  
**Issues Found:**

---

### Flow 5: Team Management
**Time:** 10 minutes  
**Status:** Not Started

**Checklist:**
- [ ] "Teams" tab accessible from main nav
- [ ] Can create team (team name, description)
- [ ] Team created appears in list
- [ ] Can invite other users (by email)
- [ ] Invitations sent (check Sentry breadcrumb)
- [ ] Can join existing team (via invite link or search)
- [ ] Team members visible in roster
- [ ] Can message team members
- [ ] Team home screen shows recent games
- [ ] Leave team works
- [ ] Sentry logs team_created / team_joined events

**Notes:**
```
Create team: "QA Basketball" 
Search & join: Find another team if available
Send invite to another test account (if you have one)
```

**Debug commands:**
- F5 → Breakpoint in team creation handler
- Monitor Sentry for team_* breadcrumbs
- Check API in debugger: `POST /teams`

**Result:** ✅ / ❌  
**Issues Found:**

---

### Flow 6: Admin Features
**Time:** 15 minutes  
**Status:** Not Started

**Checklist:**
- [ ] Admin dashboard accessible (if user is admin)
- [ ] Can view all users list
- [ ] Can view all games list
- [ ] Can moderate users (suspend/block)
- [ ] Can remove inappropriate games
- [ ] Can view user reports/complaints
- [ ] User suspension works (user can't sign in)
- [ ] Game removal works (game disappears from list)
- [ ] Moderation actions logged in Sentry
- [ ] No crashes in admin panel
- [ ] All admin API calls respond correctly

**Notes:**
```
If not admin, ask me for admin credentials
Or: Create second test account and test as regular user
Test moderation: Suspend user → Try to sign in as them
```

**Debug commands:**
- F5 → Breakpoint in admin API calls
- Check Sentry for moderation events
- Monitor API responses in debugger

**Result:** ✅ / ❌  
**Issues Found:**

---

### Flow 7: Payment (PRIMARY - 20 minutes)
**Time:** 20 minutes + optional 45 min deep dive  
**Status:** Not Started

**Quick Start:** (2 minutes)
1. Open: `PAYMENT_QA_QUICK_START.md`
2. Read: Overview of payment flow
3. Understand: What to verify

**Main Walkthrough:** (15 minutes)
1. Open: `FLOW_7_PAYMENT_QUICKREF.md`
2. Follow: 9-step payment flow
3. Use Test Card: **4242 4242 4242 4242**
   - Expiry: 12/25
   - CVC: 123
4. Expected: Success → user joined → email sent → Sentry logged

**Verification Checklist:**
- [ ] Payment form loads
- [ ] Card input accepts 4242 card
- [ ] CVC/Expiry fields visible
- [ ] "Pay $X" button shows correct amount
- [ ] Loading spinner during transaction
- [ ] Success message appears
- [ ] User status changes to "Joined"
- [ ] Confirmation email sent (check inbox)
- [ ] Sentry shows payment_completed event
- [ ] No sensitive data in Sentry logs

**Optional Deep Dive:** (45 minutes - if time allows)
- Open: `PAYMENT_SECURITY_VERIFICATION.md`
- Run: Tests C, D, E (comprehensive security validation)
- Document: Any issues found

**Debug commands:**
- F5 → Breakpoint in payment handler (`handlePayment`)
- Stripe test: Check request payload before send
- Sentry → Look for payment_completed + customer_created events
- Email: Check test email inbox for receipt

**Result:** ✅ / ❌  
**Issues Found:**

**Payment Test Results:**
```
Card: 4242 4242 4242 4242 ✅
Amount: [Amount charged] ✅
Success Page: [Shown/Not shown] ✅
User Status: [Joined/Not joined] ✅
Email Sent: [Yes/No] ✅
Sentry Event: [Logged/Not logged] ✅
```

---

## 📊 Session Summary

### Issues Found During QA
(Track all bugs/issues here as you find them)

| # | Flow | Issue | Severity | Status |
|---|------|-------|----------|--------|
| 1 | (Flow?) | (Description) | Low/Medium/High | Open |
| 2 | | | | |
| 3 | | | | |

### Performance Baseline
```
App Startup Time: _____ seconds (target: < 3s)
Game List Load: _____ seconds (target: < 2s)
Message Send Latency: _____ ms (target: < 500ms)
Peak Memory: _____ MB (target: < 180MB)
FPS During Scroll: _____ (target: 60)
```

### Sentry Health
```
Total Issues: _____
New Issues Found: _____
Critical Errors: _____
Error Trend: (Up/Stable/Down)
```

### Overall QA Result
- [ ] ✅ **PASS** - All flows working, no blockers, ready for launch
- [ ] ⚠️ **CONDITIONAL** - Minor issues found, easily fixable, ready with fixes
- [ ] ❌ **FAIL** - Critical issues, needs attention before launch

### Sign-Off
```
QA Started:   [Time]
QA Completed: [Time]
Duration:     [Actual hours]
Tester:       QA Session
Status:       [PASS/CONDITIONAL/FAIL]
Notes:        [Any final comments]
```

---

## 🚀 When QA Complete

1. **Document Results** → Fill in all sections above
2. **Commit Session** → `git add -A && git commit -m "QA: Day 3 session complete - [PASS/CONDITIONAL/FAIL]"`
3. **Check Sentry** → Review all breadcrumbs/errors from session
4. **Fix Blockers** → If conditional/fail, prioritize fixes
5. **Final Review** → Run problematic flows again if fixes made

---

## 📚 Reference Docs While Testing

- **DEBUGGING_AND_MONITORING_QUICKSTART.md** — Debugging patterns
- **PAYMENT_QA_QUICK_START.md** — Payment overview (read at Flow 7)
- **FLOW_7_PAYMENT_QUICKREF.md** — Payment 9-step guide (follow at Flow 7)
- **PAYMENT_SECURITY_VERIFICATION.md** — Deep dive payment tests (optional)
- **DAY_3_QA_CHECKLIST.md** — This checklist (master reference)

---

## ⏰ Time Tracking

Use this to pace yourself:

```
Flow 1 (Sign-Up):      0:00 - 0:20  (20 min)
Flow 2 (Game List):    0:20 - 0:30  (10 min)
Flow 3 (Create Game):  0:30 - 0:45  (15 min)
Flow 4 (Messaging):    0:45 - 0:55  (10 min)
Flow 5 (Team Mgmt):    0:55 - 1:05  (10 min)
Break:                 1:05 - 1:15  (10 min)
Flow 6 (Admin):        1:15 - 1:30  (15 min)
Flow 7 (Payment):      1:30 - 1:50  (20 min)
Optional Deep Dive:    1:50 - 2:35  (45 min)
Wrap-up:               2:35 - 2:45  (10 min)

Total: ~2.75 hours (core) or 3.75 hours (with payment deep dive)
```

---

**Status:** Ready to start! Open DAY_3_QA_CHECKLIST.md and begin with Flow 1. 🚀

Good luck! Ping if you need debugging help or want to triage issues. I'll be here to help fix anything you find.
