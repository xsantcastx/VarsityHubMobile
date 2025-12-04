# 🛠️ QA Quick Commands Reference

**Keep this open during QA for fast access to critical commands.**

---

## 📱 Simulator & App Commands

```bash
# Open simulator
open -a Simulator

# Kill simulator (if frozen)
pkill -9 Simulator

# List running simulators
xcrun simctl list devices

# Clear simulator data
xcrun simctl erase booted

# Launch app on simulator
xcrun simctl launch booted com.xsantcastx.varsityhub
```

---

## 🔧 Build & Metro Commands

```bash
# Start fresh Metro bundler
npx expo start --clear

# Rebuild iOS app (if needed)
npx expo run:ios

# Clean build (nuclear option)
rm -rf ios/build .expo node_modules
npm install
npx expo run:ios

# Check TypeScript
npm run typecheck

# Check lint
npx expo lint 2>&1 | grep problems
```

---

## 🌐 API & Network Commands

```bash
# Check API health
curl -s https://api-production-8ac3.up.railway.app/health | jq .

# Check Metro running
lsof -i :8081 | head -2

# Monitor API calls (from simulator logs)
# In simulator: Cmd+D → Show Dev Menu → Toggle Network Inspector

# Test email endpoint (use in Thunder Client or curl)
# POST: https://api-production-8ac3.up.railway.app/api/test-email
# Body: { "email": "test@example.com" }
```

---

## 📊 Monitoring Commands

```bash
# Watch Sentry errors real-time
# URL: https://sentry.io/organizations/varsityhub/issues/

# Check GitHub Actions workflow
# URL: https://github.com/xsantcastx/VarsityHubMobile/actions

# View build logs
tail -100 /tmp/build.log

# View Metro logs
tail -100 /tmp/metro.log
```

---

## 🐛 Debugging Commands

```bash
# Check simulator console (run from terminal)
# In Simulator: Cmd+D → Show Dev Menu → Remote JS Debugger
# Or: xcrun simctl spawn booted log stream --predicate 'process == "VarsityHub"'

# Clear Metro cache completely
watchman watch-del '/Users/varsityhub/Desktop/CODE/VarsityHubMobile'
watchman watch-project '/Users/varsityhub/Desktop/CODE/VarsityHubMobile'

# Kill all node processes
pkill -9 node expo

# Check what's using ports
lsof -i -P -n | grep LISTEN | grep -E "8081|8082|19000|19001"
```

---

## 📝 Documentation Commands

```bash
# View current QA checklist
cat DAY_3_QA_CHECKLIST.md | less

# View Phase 1 guide
cat QA_PHASE_1_PREP_BRIEF.md | less

# View execution log
cat QA_EXECUTION_LOG.md | less

# View launch verification
cat LAUNCH_VERIFICATION_CHECKLIST.md | less

# View all QA docs
ls -la *QA*.md *AUDIT*.md *SUMMARY*.md
```

---

## 🔍 Git Commands

```bash
# View latest commits
git log --oneline -10

# Check current branch
git branch

# Check status
git status

# View specific commit
git show 9d12333

# Create issue branch (if needed)
git checkout -b fix/issue-name

# Stage and commit
git add .
git commit -m "Fix: Description"
```

---

## 🚨 Emergency Commands (If Things Break)

```bash
# Reset everything and start fresh
pkill -9 node expo Simulator 2>/dev/null
sleep 3
rm -rf ios/build .expo node_modules package-lock.json
npm cache clean --force
npm install
npx expo run:ios

# If Simulator won't start
xcrun simctl create "iPhone 17 Pro" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-18-1

# If Metro cache corrupted
rm -rf ~/.expo
rm -rf node_modules/.cache
npx expo start --clear

# Restart everything (slowest but most reliable)
pkill -9 node expo
sleep 5
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npm install
npx expo run:ios
```

---

## 📱 Simulator Dev Menu (Cmd+D)

Once app is running in simulator:

```
1. Press Cmd+D on Mac (while simulator has focus)
2. Choose "Show Developer Menu"
3. Options available:
   - Reload JavaScript
   - Remote JS Debugger
   - Show Network Inspector
   - Show Performance Monitor
   - Show React Native logs
   - Toggle Element Inspector
   - Toggle PerfMonitor
```

---

## 🎯 Thunder Client API Testing

```
1. Open VS Code
2. Click ⚡ icon (Thunder Client) in Activity Bar
3. Pre-made requests available:
   - Health Check (GET /health)
   - Create User (POST /api/users)
   - Get Games (GET /api/games)
   - Test Email (POST /api/test-email)
4. Click "Send" to execute
5. View response in right panel
```

---

## 📞 When to Use These Commands

| Situation | Commands |
|-----------|----------|
| App won't boot | `npx expo run:ios` (rebuild) |
| Simulator frozen | `pkill -9 Simulator` + `open -a Simulator` |
| Metro hanging | `npx expo start --clear` |
| Strange cache issues | `watchman watch-del ...` + `watchman watch-project ...` |
| Network problems | `curl https://api-production...` check health |
| Everything broken | Run emergency reset (bottom section) |
| Need logs | `tail -100 /tmp/build.log` or `tail -100 /tmp/metro.log` |
| Need to debug | `Cmd+D` in simulator → "Remote JS Debugger" |

---

## ✨ Pro Tips

1. **Keep terminal tabs organized:**
   - Tab 1: QA checklist execution
   - Tab 2: Monitoring (tail logs)
   - Tab 3: Build commands (ready to run)

2. **For fast rebuilds:**
   - Use `npx expo start --clear` (faster than full rebuild)
   - Only use `npx expo run:ios` if needed (slower, ~3-4 min)

3. **Monitor Sentry while testing:**
   - Keep https://sentry.io open in browser
   - Errors appear within 5-10 seconds
   - Gives early warning of issues

4. **Check GitHub Actions:**
   - Keep workflow URL open
   - Should see green checkmarks on latest commits
   - Any red X = build failed (blocker)

5. **Use Thunder Client for API testing:**
   - Faster than manual curl commands
   - Can see request/response clearly
   - Pre-configured requests ready

---

## 🎯 Reference During QA

**Bookmark these URLs:**
- Sentry: https://sentry.io/organizations/varsityhub/issues/
- GitHub Actions: https://github.com/xsantcastx/VarsityHubMobile/actions
- API Health: https://api-production-8ac3.up.railway.app/health

**Have these docs open:**
1. QA_PHASE_1_PREP_BRIEF.md (main guide)
2. QA_EXECUTION_LOG.md (track progress)
3. QA_LIVE_MONITORING_DASHBOARD.md (monitoring reference)
4. This file (quick commands)

---

**Last Updated:** December 5, 2025 @ 8:40 AM  
**Status:** Ready for QA  
**Next:** Copy & paste commands as needed during testing
