# Build & Automation Logs Archive

This folder contains all build logs, test results, and overnight automation outputs, organized by date.

## 2025-12-10

**Contents:**
- Build and Metro bundler logs (`*.log`, `*.txt`)
- Overnight automation runs (overnight-logs-*, overnight-health-*)
- Test results folder
- EAS build logs
- Lint results and output

**Key Files:**
- `eas-build-*.log` - EAS CLI build logs
- `metro*.log` - Metro bundler output (dev server)
- `lint-*.log` - ESLint and TypeScript checks
- `typecheck-*.log` - TypeScript type checking output
- `test-results/` - Jest and Playwright test results
- `overnight-results/` - Overnight automation full results
- `overnight-logs-*` - Time-stamped overnight automation logs

## Purpose

Logs are archived by date to keep the root directory clean and organized. Active build sessions can be monitored in real-time, and past logs are preserved for historical reference without cluttering the workspace.

## Finding a Specific Build Log

```bash
# Search for a specific log type
grep -r "ERROR" logs/2025-12-10/ | grep metro

# Check latest build output
cat logs/2025-12-10/eas-build-final.log | tail -50

# View test results
ls logs/2025-12-10/test-results/
```

---

**Note:** New dated subfolders (e.g., `logs/2025-12-11/`) will be created as new build sessions run on different dates.
