# Fast Refresh Guide - Simulator Development

## Quick Start

### 1. Start Dev Server with Fast Refresh
```bash
npm run dev
# or
npx expo start --dev-client --clear
```

### 2. Open iOS Simulator
Once Expo starts:
- Press `i` to open iOS Simulator
- Or press `a` for Android emulator

### 3. Test Fast Refresh
1. Make a change to any component (e.g., change text color or label)
2. Save the file (`Cmd+S`)
3. **Fast Refresh should update instantly** without full reload

## Fast Refresh Features

✅ **Enabled by Default** - Expo enables Fast Refresh automatically  
✅ **Hot Reload** - Component state preserved on most changes  
✅ **Error Recovery** - Fix syntax errors and see changes immediately  
✅ **Component State** - Your component state stays intact during edits  

## Keyboard Shortcuts in Expo Dev Tools

- `r` - Reload app (full reload)
- `m` - Toggle menu
- `d` - Open developer menu
- `j` - Open debugger
- `i` - Open iOS simulator
- `a` - Open Android emulator
- `w` - Open web browser

## Configuration Status

✅ **metro.config.js** - Fast Refresh enabled  
✅ **babel.config.js** - react-refresh plugin included via babel-preset-expo  
✅ **Development Mode** - Fast Refresh only works in dev mode  

## Troubleshooting

### Fast Refresh Not Working?
1. **Restart Metro bundler:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear Metro cache:**
   ```bash
   npx expo start --dev-client --clear
   ```

3. **Reset simulator:**
   - In simulator: Device → Erase All Content and Settings
   - Or: Press `r` in Expo dev tools for full reload

4. **Check for syntax errors:**
   - Fast Refresh won't work with syntax errors
   - Fix the error first, then it will hot reload

### When Fast Refresh Falls Back to Full Reload

Fast Refresh automatically falls back to full reload when:
- You change a file that's not a React component
- You rename a file
- You change exports (non-React exports)
- You have a syntax error

This is **normal behavior** - just let it reload!

## Verify Fast Refresh is Working

1. Open any screen in your app (e.g., sign-up screen)
2. Edit a component (change text, color, or add a console.log)
3. Save the file
4. **Watch the simulator** - it should update instantly without the app restarting
5. Component state should be preserved (form inputs, scroll position, etc.)

## Example Test

Try this quick test:
1. Open `app/sign-up.tsx`
2. Find the title/heading text
3. Change it to "Fast Refresh Test!"
4. Save (`Cmd+S`)
5. **Simulator should update instantly** ✨

If you see the text change immediately without the app restarting, Fast Refresh is working!
