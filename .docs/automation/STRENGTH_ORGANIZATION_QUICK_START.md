# Overnight Strength & Organization - Quick Start

## 🚀 Run All Tasks

```bash
cd /Users/varsityhub/VarsityHubMobile
./scripts/overnight-strength-organization.sh
```

**Duration:** ~10-15 minutes  
**Output:** `overnight-results/strength-organization-summary-*.txt`

---

## 📋 Individual Tasks

### 1. Unused Imports Cleanup
```bash
./scripts/overnight-unused-imports.sh
```
**What it finds:**
- Unused React imports
- Unused component imports  
- Unused utility imports

**Output:** `overnight-results/unused-imports-*.json`

**Quick fix:**
```bash
# View top offenders
cat overnight-results/unused-imports-*.json | jq '.priorityFiles[] | .file'

# Auto-remove (use with caution)
npx eslint --fix --rule '@typescript-eslint/no-unused-vars: error' app/ components/
```

---

### 2. Console.log Audit
```bash
./scripts/overnight-console-cleanup.sh
```
**What it finds:**
- All console.log statements
- Console.error/warn/debug usage
- Files with 10+ console statements

**Output:** `overnight-results/console-audit-*.json`

**Quick fix:**
```bash
# View files with most console statements
cat overnight-results/console-audit-*.json | jq '.priorityFiles[] | {file, total}'

# Remove all console.log (be careful!)
find app components -name "*.tsx" -o -name "*.ts" | xargs sed -i '' '/console\.log/d'
```

---

### 3. Database Query Performance
```bash
./scripts/overnight-db-performance.sh
```
**What it finds:**
- N+1 query problems
- Missing indexes
- Queries without pagination

**Output:** `overnight-results/db-performance-*.json`

**Quick review:**
```bash
# Check for critical N+1 queries
cat overnight-results/db-performance-*.json | jq '.nPlusOne'

# Check missing indexes
cat overnight-results/db-performance-*.json | jq '.missingIndexes'
```

---

### 4. Floating Promises Analysis
```bash
./scripts/overnight-floating-promises.sh
```
**What it finds:**
- Router navigation without `void`
- Promise chains without `.catch()`
- Async calls without `await`/`void`

**Output:** `overnight-results/floating-promises-*.json`

**Quick fix (safe):**
```bash
# Router navigation - safe to auto-fix
# Find: router.push('/path')
# Replace: void router.push('/path')
```

---

## 📊 Morning Review (5 minutes)

```bash
cd /Users/varsityhub/VarsityHubMobile

# View summary
cat overnight-results/strength-organization-summary-*.txt

# Quick stats
echo "📦 Unused Imports:"
cat overnight-results/unused-imports-*.json | jq '.summary.totalUnused' 2>/dev/null || echo "N/A"

echo "📝 Console Statements:"
cat overnight-results/console-audit-*.json | jq '.summary.totalConsoleStatements' 2>/dev/null || echo "N/A"

echo "⚡ N+1 Queries:"
cat overnight-results/db-performance-*.json | jq '.summary.nPlusOne' 2>/dev/null || echo "N/A"

echo "🔧 Floating Promises:"
cat overnight-results/floating-promises-*.json | jq '.summary.total' 2>/dev/null || echo "N/A"
```

---

## 🎯 Priority Actions

Based on results, prioritize:

1. **Critical (Do First):**
   - Fix N+1 queries (performance impact)
   - Add missing database indexes
   - Fix floating promises in critical paths

2. **High Priority:**
   - Remove unused imports from top offenders (5+ unused)
   - Clean up console.log in production code paths
   - Fix floating promises in router navigation (safe auto-fix)

3. **Medium Priority:**
   - Remove remaining unused imports
   - Wrap console statements in `__DEV__` guards
   - Review and fix promise chains

---

## 🔄 Integration with Existing Automation

Add to your nightly cron:

```bash
# Add to crontab
0 2 * * * cd /Users/varsityhub/VarsityHubMobile && ./scripts/overnight-strength-organization.sh >> overnight-results/cron.log 2>&1
```

Or add to `nightly-sweeps.sh`:
```bash
# After existing tasks
echo "Running strength & organization tasks..."
bash scripts/overnight-strength-organization.sh
```

---

## 📈 Tracking Progress

Compare night-to-night:

```bash
# Compare unused imports
ls -t overnight-results/unused-imports-*.json | head -2 | xargs -I {} sh -c 'echo "== {} =="; cat {} | jq ".summary.totalUnused"'

# Compare console statements
ls -t overnight-results/console-audit-*.json | head -2 | xargs -I {} sh -c 'echo "== {} =="; cat {} | jq ".summary.totalConsoleStatements"'
```

**Goal:** See numbers decreasing each night! 📉
