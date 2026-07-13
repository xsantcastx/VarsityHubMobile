# How to Reload Simulator

## Quick Reload (Fastest)

**In the iOS Simulator:**

- Press **`Cmd + R`** to reload the app
- Or: **Device → Shake** → Select "Reload"

This will refresh the app with your latest changes if Metro is running.

---

## Start Dev Server (If Not Running)

If Metro bundler isn't running, start it:

```bash
npm run dev
```

Or:

```bash
npx expo start --dev-client --scheme varsityhubmobile --host localhost --port 8081 --clear
```

This will:

- Start Metro bundler on port 8081
- Enable Fast Refresh
- Clear cache for fresh start
- Connect to your simulator automatically

---

## Full Rebuild (If Reload Doesn't Work)

If simple reload doesn't pick up changes:

```bash
npm run ios
```

Or:

```bash
npx expo run:ios
```

This will rebuild and reinstall the app in the simulator.

---

## Troubleshooting

### Metro Not Connecting

1. Check if Metro is running: Look for "Metro waiting on..." in terminal
2. Check port 8081: `lsof -i :8081`
3. Restart Metro: Stop (Ctrl+C) and run `npm run dev` again

### Changes Not Appearing

1. Press `Cmd + R` in simulator
2. Check Metro terminal for errors
3. Clear cache: `npm run dev` (includes --clear flag)
4. Full rebuild: `npm run ios`

### Simulator Not Opening

1. Open manually: Xcode → Open Developer Tool → Simulator
2. Or run: `open -a Simulator`

---

## Scripts Available

- `./scripts/reload-simulator.sh` - Shows reload options
- `./scripts/start-dev-server.sh` - Starts Metro bundler
- `npm run dev` - Quick start dev server

---

**Tip:** Keep Metro running in a terminal window while developing. Press `Cmd + R` in simulator whenever you make changes to see them instantly!
