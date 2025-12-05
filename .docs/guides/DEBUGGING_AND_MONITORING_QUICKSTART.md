# Debugging & Monitoring Quick Start

**Last Updated:** December 5, 2025  
**Status:** ✅ Production-Ready  
**Audience:** Developers doing QA testing and post-launch monitoring

---

## 🎯 Quick Overview

VarsityHub Mobile has **3 integrated debugging/monitoring systems**:

1. **VS Code Debugger** — Step through code with breakpoints (F5)
2. **Expo Dev Menu** — Quick logs & environment checks (Cmd+D)
3. **Sentry** — Production crash monitoring & analytics

This guide helps you use all three together during QA and after launch.

---

## 1️⃣ VS Code Debugging (F5 Launch Configs)

### Setup (One-Time)

Extensions already installed:
- ✅ `msjsdiag.vscode-react-native` (auto-attaches to Metro)
- ✅ `.vscode/launch.json` has iOS/Android configs
- ✅ `.vscode/settings.json` routes ESLint/Prettier

### Using the Debugger

**Step 1:** Start Metro bundler
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npx expo start --ios
```
Wait for `expo-ready` message in terminal.

**Step 2:** Press **F5** (or click Run → Start Debugging)
Choose from:
- **React Native** → iOS simulator
- **React Native Android** → Android emulator
- **Expo App** → Alternative Expo launch

**Step 3:** Attach happens automatically
- Debugger pane opens on the left
- Console shows `[msjsdiag] Connected to metro bundler`
- Ready to set breakpoints

### Setting Breakpoints

Click line numbers in any `.ts` / `.tsx` file:
```tsx
// app/screens/auth/login.tsx
export function LoginScreen() {
  const { login } = useAuth();

  const handlePress = async () => {
    // 👈 Click line number here to set breakpoint
    await login(email, password);
  };
}
```

When code hits that line:
- Execution pauses
- Variables visible in Debug pane
- Step over/into/out using debugger toolbar

### Common Breakpoint Patterns

**Auth flow debugging:**
```tsx
// hooks/useAuth.ts
const login = useCallback(async (email: string, password: string) => {
  debugger; // Pause here
  const response = await api.post('/auth/login', { email, password });
  console.log('Login response:', response); // Also log for Sentry
  setUser(response.data);
}, []);
```

**Network request debugging:**
```tsx
// api/http.ts
export async function post(url: string, data: any) {
  console.log(`[API] POST ${url}`, data);
  const response = await fetch(url, { /* ... */ });
  // Breakpoint here to inspect response headers
  return response.json();
}
```

**State updates:**
```tsx
// Use "Watch" panel to monitor state changes
const [gameList, setGameList] = useState([]);
// Add "gameList" to Watch → updates as state changes
```

### Debugger Console Commands

While paused, type in console:
```javascript
// Inspect current user
user

// Call a function
await api.get('/health')

// Set variable
gameId = '123'

// Log without pausing
console.log('Current state:', { user, gameList })
```

---

## 2️⃣ Expo Dev Menu (Cmd+D Shortcuts)

### Access Dev Menu

On iOS simulator:
```
Press Cmd+D
```

Menu appears with options:
- `Reload` — Hot reload (keep state)
- `Inspector` — Tap elements to inspect
- `Performance Monitor` — Watch FPS/memory
- `Remote JS Debugger` — Full debugger (same as F5)
- `Expo Go` — Open in Expo Go app
- `Show Perf Monitor` — FPS & memory usage

### Using Performance Monitor

```
Cmd+D → Show Perf Monitor
```

Overlay appears showing:
```
FPS: 60      ← App refresh rate
RAM: 124 MB  ← Memory usage (watch for leaks)
```

**QA Task:** Scroll game list 10 times, RAM should stay ~120-140MB (not grow to 200+MB).

### Using Inspector

```
Cmd+D → Inspector
```
- Tap any UI element
- See component tree & props
- Useful for "why isn't this button styled?" debugging

### Remote JS Debugger (Same as F5)

```
Cmd+D → Remote JS Debugger
```
Opens Chrome DevTools — same as F5 but in browser.

---

## 3️⃣ Sentry Production Monitoring

### What Gets Captured Automatically

Every time something goes wrong:
1. **Crashes** — App errors (uncaught exceptions)
2. **Errors** — Caught exceptions via `captureException()`
3. **Breadcrumbs** — User actions leading to the error:
   - Screen navigation
   - Button taps
   - API requests
   - State changes
4. **Performance** — Transaction timing (if sampled)

### Sentry Dashboard

Go to: **https://sentry.io/**

**Top tabs:**
- **Issues** — Errors grouped by type/frequency
- **Performance** — Slow screens/API calls
- **Releases** — Errors per app version
- **Alerts** — Notifications when error spike happens

### Custom Logging

Import from `@/utils/sentry`:
```typescript
import { captureException, captureBreadcrumb } from '@/utils/sentry';

// Log custom error
try {
  await complexOperation();
} catch (error) {
  captureException(error, { 
    context: 'gameCreation',
    extra: { gameId: '123' }
  });
}

// Log user action
captureBreadcrumb('User clicked create game', 'user-action', {
  gameType: 'pickup',
  sport: 'basketball'
});
```

### API Requests Auto-Logged

In `api/http.ts`, every request adds breadcrumb:
```typescript
// This happens automatically
// Breadcrumb visible in Sentry under "Integration":
//   POST /games
//   ✓ 200 OK (45ms)
```

### Filtering in Development

**Sentry is disabled in dev mode** (app/\_layout.tsx):
```typescript
initSentry(); // Checks __DEV__ flag
// If development: no errors sent to Sentry
// If production: all errors sent
```

**Why?** Prevents dev errors from polluting production dashboard.

---

## 📋 QA Testing Checklist with Debugging

### Flow 1: Sign-Up (20 min)

```bash
F5 → React Native iOS
Cmd+D → Inspector (optional: tap form elements to verify structure)
```

**What to watch:**
- ✅ Email validation error shows
- ✅ Password requirements display
- ✅ "Submit" button disabled until valid
- ✅ Sentry logs "user_signup_start" breadcrumb

**If bug found:**
1. Press F5 → debugger attaches
2. Set breakpoint in `hooks/useAuth.ts` → handleSignUp
3. Inspect `email` and `password` values
4. Step through validation logic

### Flow 2: Game List (10 min)

```bash
Cmd+D → Show Perf Monitor (watch for memory leaks)
```

**What to watch:**
- ✅ Infinite scroll loads 10 at a time
- ✅ Each scroll doesn't spike RAM
- ✅ Sentry shows GET /games requests completing

**If memory leak suspected:**
1. Scroll 20 times
2. RAM should stay ~130MB
3. If RAM grows to 200MB+:
   - Take heap snapshot (Chrome DevTools: Memory tab)
   - Look for detached DOM nodes or unreleased promises

### Flow 3: Create Game (15 min)

```bash
F5 → Set breakpoint in createGame handler
Test with invalid inputs first (empty fields, past dates)
```

**What to watch:**
- ✅ Form validation works
- ✅ Submit disabled if invalid
- ✅ Loading spinner shows during request
- ✅ Success toast appears
- ✅ Sentry shows "game_created" event

### Flow 4: Messaging (10 min)

```bash
Cmd+D → Inspector
Tap message bubbles to verify styles
```

**What to watch:**
- ✅ Messages send instantly (optimistic UI)
- ✅ Delivery confirmation appears
- ✅ Timestamps show correctly
- ✅ Images/videos load

**Network debugging:**
```
F5 → debugger.openUrl('chrome://inspect')
Open Network tab → filter by 'messages'
Watch for WebSocket or HTTP POST requests
```

---

## 🐛 Troubleshooting Workflow

### Scenario 1: "Button doesn't respond"

```
Step 1: Cmd+D → Inspector → Tap button
  Result: See if component renders at all
  
Step 2: F5 → Set breakpoint in button's onPress handler
  Result: Does code even get called?
  
Step 3: Check Sentry breadcrumbs
  Result: Did user action get logged?
  
Fix: Usually one of:
  - Button disabled by conditional (check state)
  - onPress prop not wired correctly
  - Parent TouchableOpacity capturing tap
```

### Scenario 2: "Blank screen on load"

```
Step 1: Cmd+D → Remote JS Debugger
  Result: Check console for JS errors
  
Step 2: F5 → Set breakpoint in _layout.tsx → RootLayout component
  Result: Does root component render?
  
Step 3: Check Sentry → Issues tab
  Result: Any crashes on app boot?
  
Fix: Usually one of:
  - Missing provider (AuthProvider, ThemeProvider)
  - Hook running before context exists
  - Uncaught error in _layout.tsx
```

### Scenario 3: "API call fails silently"

```
Step 1: F5 → Set breakpoint in api/http.ts → post/get function
  Result: See request payload & headers
  
Step 2: Check Sentry → Performance tab
  Result: How long did request take? Did it timeout?
  
Step 3: Check Sentry → Issues tab → Look for fetch errors
  Result: "Network request failed"? Check backend health
  
Step 4: Terminal → check Expo logs
  Command: Cmd+Shift+J (opens Expo CLI logs)
  
Fix: Usually one of:
  - Backend server down (curl https://api-production...  /health)
  - Wrong API URL in .env
  - Missing auth token
  - CORS blocked by backend
```

### Scenario 4: "Weird rendering bug"

```
Step 1: Cmd+D → Inspector → Tap affected element
  Result: See computed styles & props
  
Step 2: F5 → debugger → inspect component state
  Result: Is state what you expected?
  
Step 3: Check device orientation
  Command: Rotate simulator (Cmd+←/→)
  Result: Does bug disappear in landscape?
  
Fix: Usually one of:
  - Hardcoded dimensions (use Dimensions API)
  - Missing responsive layout (use flex)
  - Font too large for screen
  - SafeAreaView not accounting for notch
```

---

## 🔍 Using Sentry Dashboard

### View Crashes from QA

1. Go to **https://sentry.io/organizations/varsityhub/**
2. Click **Issues** tab
3. Filter by **Recent** or **Unresolved**
4. Click any issue to see:
   - **Stack trace** — exact error location
   - **Breadcrumbs** — what user did before crash
   - **Device info** — iOS/Android version
   - **Release** — which app version

### Find Errors from Specific QA Session

Filter by tags:
```
environment: production
app_version: 1.0.0
user_id: qa_tester_123
```

### Resolve/Ignore Errors

After fixing a bug:
1. Click Issue
2. Click **Resolve** button (top right)
3. Error no longer shows in dashboard
4. If same error reoccurs → reappears automatically

### Set Up Alerts

1. Sentry Settings → Alerts
2. Create new alert:
   - **Condition:** Issues/Error rate high
   - **Action:** Email me OR Slack notification
3. Example: "Alert if 5+ errors in 1 hour"

---

## 🚀 Post-Launch Monitoring

### Daily Check (2 minutes)

```
Morning: Open Sentry → Issues tab
Review: Any new crashes overnight?
Action: If yes, identify & fix immediately
```

### Weekly Review (15 minutes)

```
Monday: Pull Sentry stats
  - How many unique errors this week?
  - Most common error?
  - Error trend (going up/down)?
  - Performance P95 latency?

Action: 
  - If trend is up → investigate root cause
  - If specific error common → prioritize fix
  - If performance slow → check API slowness
```

### Monthly Deep Dive (1 hour)

```
1st of month: Sentry Performance tab
  - Which screens are slowest?
  - Which API endpoints are slowest?
  - Any new performance issues?

2nd: Sentry Releases tab
  - Did last release reduce error rate?
  - Which version has most errors?

3rd: Email stakeholders
  - Report: "0 crashes, 2 errors fixed, 95th percentile: 500ms"
  - Confidence level: "Production stable ✅"
```

---

## 📚 Reference Docs

| Doc | Purpose | Location |
|-----|---------|----------|
| **EXTENSIONS_ACTIVATION_READY.md** | Extension setup & F5 debugging | Lines 39-144 |
| **QA_QUICK_COMMANDS.md** | Cmd+D menu & quick shortcuts | Lines 88-231 |
| **MONITORING_SETUP.md** | Sentry configuration & usage | All sections |
| **BUTTON_DEBUG_QUICK_REF.md** | Button-specific debugging | All sections |
| **11-TROUBLESHOOTING.md** | Deep troubleshooting guide | Lines 727-760 |

---

## ⚡ TL;DR (Copy-Paste Workflow)

### Start Debugging Right Now

```bash
# Terminal 1: Start Metro
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npx expo start --ios

# Terminal 2 (VS Code):
# Press F5 → React Native iOS → Debugger attaches

# On simulator:
# Cmd+D → Remote JS Debugger (if you want Chrome DevTools instead)

# Set breakpoint: Click line number
# Run code: App will pause at breakpoint
# Inspect: Look at Variables panel on left
```

### Monitor Production (After Launch)

```
Daily: https://sentry.io/ → Issues tab
Check: Any new crashes?
Action: If yes → check stack trace → fix & deploy

Weekly: Check error trend
Monthly: Report to stakeholders
```

---

## ✅ Pre-QA Checklist

Before starting Day 3 QA:
- [ ] Expo running: `npx expo start --ios`
- [ ] Debugger works: Press F5 → attached
- [ ] Cmd+D menu works: Performance monitor shows
- [ ] Sentry DSN set: `.env` has `EXPO_PUBLIC_SENTRY_DSN`
- [ ] Backend health: `curl https://api-production.../health`
- [ ] Extensions installed: Check VS Code extension panel

All ✅? **Ready for QA!**

---

## 🆘 Still Stuck?

1. Check relevant doc above (EXTENSIONS_ACTIVATION_READY, MONITORING_SETUP, etc.)
2. Try "Reload Window" (Cmd+Shift+P → Reload Window)
3. Kill all processes: `pkill -9 node expo`
4. Fresh start: `npm install && npx expo start --ios`
5. Check Sentry Issues for unhandled exceptions
6. Last resort: Check GitHub Issues or Slack engineering channel

---

**Version:** v1.0  
**Status:** Production-Ready  
**Last Tested:** December 5, 2025
