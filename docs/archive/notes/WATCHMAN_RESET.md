# Watchman Socket Reset Guide

**Problem:** Metro bundler warning about Watchman socket permission issue.

**Solution:** Run the following commands in your **local terminal** (with user-level shell permissions):

```bash
watchman watch-del '/Users/varsityhub/Desktop/CODE/VarsityHubMobile'
watchman watch-project '/Users/varsityhub/Desktop/CODE/VarsityHubMobile'
```

**Why needed:** Watchman caches file system state. If it gets corrupted or has stale entries, Metro re-scans everything (slow). This resets the cache.

**After running:**

- The "Recrawled this watch" warning should stop appearing
- Metro bundling should be ~30% faster
- No functional change, just cleanup

**If Watchman is not installed:**

```bash
brew install watchman
```

**If you get "Permission denied" errors:**

- Make sure you're in a terminal with proper permissions (not `sudo`)
- Restart Watchman: `watchman shutdown-server && watchman trigger-init`

---

## ESLint Autofix Status

✅ ESLint configured and ready  
✅ Playwright smoke tests added  
⏳ Run Watchman reset locally to clear Metro warnings  
✅ npm scripts added: `npm run test:smoke`, `test:smoke:ui`, etc.

**Next:** Run `npm run web` to start Metro, then `npm run test:smoke` to verify smoke tests pass.
