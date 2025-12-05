# Nightly Automation Suite — Low-Touch Overnight Sweeps

## Overview

Five automated sweeps run every night (or on-demand) to build Day 3 QA confidence without manual intervention:

1. **Catch-Block Sanity Scan** — Find catch blocks without error references
2. **API Smoke Tests** — Health check critical endpoints
3. **Lint Baseline** — Track warning counts + regressions
4. **TypeScript Type Check** — Verify zero errors remain
5. **npm Audit Summary** — Security vulnerability tracking

All results are logged to `overnight-results/` with dated filenames for easy comparison.

---

## How to Run

### Option A: Run Now (Manual)
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
bash /tmp/nightly-sweeps.sh
```
Takes ~5-10 minutes. Results in `overnight-results/`.

### Option B: Schedule Nightly (Cron)
```bash
bash /tmp/setup-nightly-cron.sh
```
Runs every night at 11:30 PM automatically.

To view/edit your cron jobs:
```bash
crontab -l       # view all jobs
crontab -e       # edit jobs
```

### Option C: Run Individual Sweeps
Each sweep is independent and can run standalone:

```bash
# Catch-block scanner
python3 /tmp/find-empty-catches.py

# API smoke tests
bash /tmp/api-smoke-tests.sh

# Health endpoint sampler (new)
./overnight-health-check.sh

# Lint baseline (requires npm)
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npx eslint . --format=json > overnight-results/lint.json

# TypeScript check
npx tsc --noEmit

# npm audit
npm audit --json
```

### Option D: 24/7 Health Sampler
The repo now includes `overnight-health-check.sh`, a lightweight script that curls the production API overnight and logs results for Stripe/SMTP/Sentry/database signals.

```
./overnight-health-check.sh
# or customize
API_URL=https://staging.api vars \
AUTH_TOKEN=abc EXTRA_ENDPOINTS="GET /support/ping" ./overnight-health-check.sh
```

**Output:** `overnight-health-YYYYMMDD-HHMMSS/health.log` with HTTP codes and payloads (it warns if `/health` doesn’t report `stripe`, `smtp`, `sentry`, `database` as `true`).

Use it as a cron job alongside the sweeps to catch downtime immediately.

---

## Morning Review Checklist (15 minutes)

When you wake up, run this quick review:

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# 1. Catch-Block Scan
echo "📍 Catch-Block Scan:"
ls -ltr overnight-results/catch-scan-*.log | tail -1
head -30 overnight-results/catch-scan-*.log | tail -15

# 2. API Smoke Tests
echo "📍 API Smoke Tests:"
ls -ltr overnight-results/api-smoke-*.json | tail -1
cat overnight-results/api-smoke-*.json | jq .

# 3. Lint Baseline
echo "📍 Lint Baseline:"
ls -ltr overnight-results/lint-baseline-*.log | tail -1
tail -5 overnight-results/lint-baseline-*.log

# 4. TypeScript
echo "📍 TypeScript:"
ls -ltr overnight-results/typescript-check-*.log | tail -1
tail -10 overnight-results/typescript-check-*.log

# 5. npm Audit
echo "📍 npm Audit:"
ls -ltr overnight-results/npm-audit-*.log | tail -1
cat overnight-results/npm-audit-*.log
```

Or use the generated summary:
```bash
cat overnight-results/morning-review-summary.txt
```

---

## Reading the Results

### 1. Catch-Block Scan

**File:** `catch-scan-TIMESTAMP.log`

**Output:**
```
📊 CATCH-BLOCK SCAN RESULTS
Total catch blocks found:     637
  ✅ With error references:   492 (LOW risk)
  ⚠️  Without references:     145 (HIGH risk)
```

**What to look for:**
- HIGH-RISK count should **decrease** over time (as you add explicit error parameters)
- Each file listed under "HIGH-RISK CATCH BLOCKS" is a priority for refactoring

**Next step:** If HIGH-RISK > 100, consider adding error parameters to most-used catch blocks before launch.

---

### 2. API Smoke Tests

**Files:** 
- `api-smoke-TIMESTAMP.log` (detailed output)
- `api-smoke-TIMESTAMP.json` (JSON report)

**Output:**
```json
{
  "timestamp": "2025-12-05T05:30:00Z",
  "passed": 1,
  "failed": 5,
  "total": 6,
  "success_rate": "16.7%"
}
```

**What to look for:**
- `/health` endpoint should **always pass** (200 status)
- Failed endpoints may just not exist yet (expected 404s)
- If `/health` returns 500+, infrastructure issue—investigate in Sentry

**Next step:** 
```bash
# If failures, check Sentry for errors:
open https://sentry.io/organizations/varsity-hub/issues/
```

---

### 3. Lint Baseline

**Files:**
- `lint-baseline-TIMESTAMP.log` (summary)
- `lint-baseline-TIMESTAMP.json` (full results)

**Output:**
```
LINT BASELINE - TIMESTAMP
Warnings: 400
Errors:   0
```

**What to look for:**
- `Warnings` should trend **downward** each night
- `Errors` should always be **0**
- If warnings jumped up 50+, new code introduced warnings—investigate

**How to find new warnings:**
```bash
# Compare two nights
diff <(jq '.warnings | length' overnight-results/lint-baseline-20251204_*.json) \
     <(jq '.warnings | length' overnight-results/lint-baseline-20251205_*.json)
```

---

### 4. TypeScript Type Check

**File:** `typescript-check-TIMESTAMP.log`

**Output (clean):**
```
# No output = zero errors
```

**Output (errors):**
```
error TS2339: Property 'foo' does not exist on type 'Bar'
  at src/components/MyComponent.ts:42:10
```

**What to look for:**
- Should be **completely empty** (no output)
- Any `error TS` lines are blocking issues—fix before QA

**Next step:** If errors exist:
```bash
# Run build to confirm errors
npm run build 2>&1 | grep error
```

---

### 5. npm Audit Summary

**File:** `npm-audit-TIMESTAMP.log`

**Output:**
```
NPM AUDIT SUMMARY
Total: 3
  🔴 Critical: 0
  🟠 High: 1
  🟡 Medium: 2
  🔵 Low: 0
```

**What to look for:**
- **Critical/High** = block QA until patched
- **Medium** = acceptable (fix after launch if needed)
- **Low** = ignore

**Next step:** If Critical/High found:
```bash
npm audit fix --audit-level=high
git add package*.json
git commit -m "fix: patch high-severity npm vulnerabilities"
```

---

## Comparison Workflow

To spot regressions night-to-night:

```bash
# Compare lint warning counts
ls -tr overnight-results/lint-baseline-*.log | tail -2 | xargs -I {} sh -c 'echo "== {} =="; grep "Warnings:" {}'

# Compare catch-block risk scores
ls -tr overnight-results/catch-scan-*.log | tail -2 | xargs -I {} sh -c 'echo "== {} =="; grep "HIGH risk" {}'

# Compare API test pass rate
ls -tr overnight-results/api-smoke-*.json | tail -2 | xargs -I {} sh -c 'echo "== {} =="; cat {} | jq ".success_rate"'
```

---

## Troubleshooting

### Sweeps didn't run overnight

**Check if cron is set up:**
```bash
crontab -l | grep nightly-sweeps
```

**If not, run manually:**
```bash
bash /tmp/nightly-sweeps.sh
```

**If cron failed, check logs:**
```bash
cat overnight-results/cron.log
```

---

### Missing log files

Some sweeps may fail silently. Check which ones ran:
```bash
ls -la overnight-results/ | grep -E "catch-scan|api-smoke|lint-baseline|typescript|npm-audit"
```

If any are missing, run that sweep manually:
```bash
python3 /tmp/find-empty-catches.py > overnight-results/catch-scan-manual.log
```

---

### API smoke tests all failing

If all smoke tests fail (not just missing endpoints), check API infrastructure:

```bash
# Is API server up?
curl -I https://api-production-8ac3.up.railway.app/health

# Check Sentry for errors
open https://sentry.io/organizations/varsity-hub/

# Check Railway logs
open https://railway.app/project/...
```

---

## Next Steps for Day 3 QA

✅ **If morning review shows:**
- ✅ Catch-block HIGH-RISK trending down
- ✅ API `/health` passing
- ✅ Lint warnings stable or improving
- ✅ TypeScript errors = 0
- ✅ npm audit no Critical/High vulns

**Then:** Proceed to `DAY_3_QA_QUICKSTART.md` for full QA execution.

---

## Files Reference

| File | Purpose | Run Command |
|------|---------|-------------|
| `/tmp/find-empty-catches.py` | Catch-block scanner | `python3 /tmp/find-empty-catches.py` |
| `/tmp/api-smoke-tests.sh` | API health checks | `bash /tmp/api-smoke-tests.sh` |
| `/tmp/nightly-sweeps.sh` | Master automation suite | `bash /tmp/nightly-sweeps.sh` |
| `/tmp/setup-nightly-cron.sh` | Cron scheduler | `bash /tmp/setup-nightly-cron.sh` |
| `overnight-results/` | All results & logs | `ls -la overnight-results/` |

---

## Scheduling Options

### Option 1: Manual (On-Demand)
Run whenever you want to check status:
```bash
bash /tmp/nightly-sweeps.sh
```

### Option 2: Cron (Automatic Nightly)
Set once, runs every night at 11:30 PM:
```bash
bash /tmp/setup-nightly-cron.sh
```

### Option 3: GitHub Actions (Advanced)
For continuous integration, add to `.github/workflows/nightly-sweeps.yml`:
```yaml
name: Nightly Automation
on:
  schedule:
    - cron: '30 23 * * *'  # 11:30 PM every day
jobs:
  sweeps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: bash /tmp/nightly-sweeps.sh
      - uses: actions/upload-artifact@v3
        with:
          name: nightly-results
          path: overnight-results/
```

---

## Expected Timeline

- **Tonight:** Nightly sweeps run (11:30 PM or manual)
- **Morning (7:30 AM):** Review results (15 min)
- **Morning (8:00 AM):** Start Day 3 QA if ready
- **End of Day 3:** Full QA complete, ready for launch

---

This automation gives you **6-8 hours of free validation** every night.
