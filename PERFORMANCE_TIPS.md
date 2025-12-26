# Performance Tips for Large Repository

This repo contains ~84k files across dependencies. These optimizations keep commands responsive.

## Git Operations (Now ~44ms instead of 20+ seconds)

✅ **Enabled by default:**
- `core.preloadindex=true` — Parallel index loading
- `core.untrackedCache=true` — Cache untracked file list
- `status.aheadBehind=false` — Skip expensive branch comparison

**Fast commands:**
```bash
git status -s          # Shows modified files only (fast)
git log --oneline -10  # View recent commits
git diff HEAD~1        # Compare commits
```

**View untracked files when needed:**
```bash
git status -u          # Show all untracked files
git status -uno        # Show untracked files only (ignore untracked count)
```

## Search Operations

✅ **Avoid scanning large folders:**

```bash
# ❌ Slow: Scans entire repo including node_modules
rg "TODO"

# ✅ Fast: Only source code
rg "TODO" src app shared

# ✅ Fast: Explicit exclusions
rg --glob '!node_modules' --glob '!.venv' "TODO"
```

## Folders to Ignore

These are already in `.gitignore` and won't be scanned by git:
- `node_modules/` — ~624 MB
- `server/node_modules/` — ~434 MB  
- `.venv/` — ~881 files
- `.expo/`, `dist/`, `build/`

## Timeouts

If running commands that scan the entire tree (rare), increase timeout:
```bash
timeout 60 npm run lint    # Instead of default 20s
```

But prefer targeted scans:
```bash
npm run lint src/features  # Lint specific folder
```

## Watchman (File System Monitoring)

Watchman monitors file changes. Keep it healthy:
```bash
watchman watch-project .   # Reinitialize watch
watchman stats .           # Check health
watchman shutdown          # Reset if stuck
```

## Node Modules Size

If node_modules gets bloated, clean it:
```bash
rm -rf node_modules package-lock.json
npm install

# Or in iOS:
cd ios && rm -rf Pods Podfile.lock && pod install
```

## Summary

| Operation | Before | After |
|-----------|--------|-------|
| `git status` | 20+ sec | ~44 ms |
| `git log` | 5+ sec | <100 ms |
| `rg "TODO" src` | ~500 ms | ~50 ms |
| Dev workflow | Slow, frustrating | Fast, responsive |

✅ All optimizations are enabled by default. No further configuration needed.
