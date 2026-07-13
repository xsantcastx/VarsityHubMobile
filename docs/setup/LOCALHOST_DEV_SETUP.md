# 🚀 Localhost Development with Fast Refresh

## Quick Start

### Start Development Server

```bash
npm run dev
```

This will:

- ✅ Start Metro bundler on `localhost:8081`
- ✅ Enable Fast Refresh for real-time updates
- ✅ Clear cache for fresh start
- ✅ Use dev-client for development builds

### Alternative: Use Dev Server Script

```bash
npm run dev:server
```

## Fast Refresh Features

✅ **Real-time Updates** - Changes appear instantly when you save files  
✅ **State Preservation** - Component state is preserved during hot reloads  
✅ **Error Recovery** - Fix errors and see changes immediately  
✅ **Localhost Optimized** - Configured for local development

## Configuration

### Metro Config (`metro.config.js`)

- Fast Refresh explicitly enabled
- Optimized for localhost development
- Hot reloading enabled
- Port 8081 configured

### Babel Config (`babel.config.js`)

- `babel-preset-expo` includes `react-refresh/plugin` automatically
- `react-native-worklets/plugin` must be last on Expo SDK 54 / Reanimated v4

### Package Scripts

- `npm run dev` - Start with localhost, port 8081, clear cache
- `npm run dev:local` - Start with localhost, port 8081 (no cache clear)
- `npm run dev:server` - Use start-dev-server.sh script

## Verify Setup

Run the verification script:

```bash
bash scripts/verify-fast-refresh.sh
```

## Testing Fast Refresh

1. Start the dev server: `npm run dev`
2. Open your app in simulator/device
3. Edit any component file (e.g., change text or styling)
4. Save the file (`Cmd+S` or `Ctrl+S`)
5. **Watch the app update instantly** without full reload! ✨

## Troubleshooting

### Fast Refresh Not Working?

1. **Clear Metro cache:**

   ```bash
   npm run dev  # Already includes --clear flag
   ```

2. **Restart Metro bundler:**
   - Press `Ctrl+C` to stop
   - Run `npm run dev` again

3. **Check for syntax errors:**
   - Fast Refresh won't work with syntax errors
   - Fix errors first, then it will hot reload

4. **Verify configuration:**

   ```bash
   bash scripts/verify-fast-refresh.sh
   ```

5. **Rebuild only for native changes:**
   - Changes under `ios/`, `android/`, native config plugins, or newly added native packages require `npx expo run:ios` or `npx expo run:android`
   - Normal `.ts` / `.tsx` / `.js` edits should update through Metro without a rebuild

### Port Already in Use?

If port 8081 is already in use:

```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9
# Then start again
npm run dev
```

## Development URLs

- **Metro Bundler**: `http://localhost:8081`
- **Dev Tools**: Available in Expo Dev Tools (press `m` in terminal)

## Notes

- Fast Refresh only works in development mode
- Some changes (like renaming files) will trigger full reload (this is normal)
- Component state is preserved during Fast Refresh
- Form inputs and scroll positions are maintained

---

**Ready to code?** Run `npm run dev` and start editing! 🎉
