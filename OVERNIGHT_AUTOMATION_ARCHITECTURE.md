# Overnight Automation Architecture

Complete low-touch validation loop running while you sleep.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   NIGHTLY SWEEPS (11:30 PM)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │  Catch Scanner   │      │  API Smoke Tests │            │
│  │  (Python)        │      │  (Bash/curl)     │            │
│  │  ↓ 15 min        │      │  ↓ 2 min         │            │
│  │  Check: Params   │      │  Check: /health  │            │
│  │  Output: HIGH    │      │  Output: 200/404 │            │
│  │         RISK     │      │         JSON     │            │
│  └──────────────────┘      └──────────────────┘            │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │ Lint Baseline    │      │ TypeScript Check │            │
│  │ (ESLint/JSON)    │      │ (tsc --noEmit)   │            │
│  │ ↓ 3 min          │      │ ↓ 2 min          │            │
│  │ Count: Warnings  │      │ Count: Errors    │            │
│  │ Output: JSON     │      │ Output: Log      │            │
│  └──────────────────┘      └──────────────────┘            │
│                                                              │
│  ┌──────────────────────────────────────────┐             │
│  │      npm Audit Summary (npm audit)       │             │
│  │      ↓ 2 min                              │             │
│  │      Count: Critical/High/Medium/Low      │             │
│  │      Output: Log                          │             │
│  └──────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
               (All run in parallel)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│            RESULTS COLLECTED (total: 10 min)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  overnight-results/                                         │
│  ├── catch-scan-20251205_112030.log      (HIGH-RISK count) │
│  ├── api-smoke-20251205_112030.log       (pass/fail)       │
│  ├── api-smoke-20251205_112030.json      (structured)      │
│  ├── lint-baseline-20251205_112030.log   (warning count)   │
│  ├── lint-baseline-20251205_112030.json  (full results)    │
│  ├── typescript-check-20251205_112030.log (error count)    │
│  ├── npm-audit-20251205_112030.log       (vuln counts)     │
│  └── morning-review-summary.txt          (checklist)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
               (You sleep 6-7 hours)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│           MORNING REVIEW (7:30 AM - 15 min)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Check API /health (200?)                               │
│  2. Check TypeScript (0 errors?)                           │
│  3. Check lint trend (stable/down?)                        │
│  4. Check catch-block risk (< 150?)                        │
│  5. Check npm audit (no new CRITICAL?)                     │
│  6. Decision: PROCEED or FIX?                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                    ↓                    ↓
              (All Good)            (Issues Found)
                    ↓                    ↓
         ┌──────────────────┐  ┌──────────────────┐
         │ Start Day 3 QA   │  │ Quick Fixes      │
         │ (8:00 AM)        │  │ (15-30 min)      │
         │ 6-8 hours        │  │ Then QA at 8:30  │
         └──────────────────┘  └──────────────────┘
```

---

## Component Breakdown

### 1. Catch-Block Scanner
**File:** `/tmp/find-empty-catches.py`

**Purpose:** Find catch blocks that don't reference error/err/e

**What it does:**
- Scans all `.ts/.tsx/.js/.jsx` files
- Finds every `catch { ... }` block
- Checks if body references error variable
- Flags ones without references as HIGH-RISK

**Output:** `overnight-results/catch-scan-TIMESTAMP.log`

**Example:**
```
⚠️  HIGH-RISK CATCH BLOCKS (no error reference):
1. utils/dmRestrictions.ts:30
   Parameter: none
   Body: return null;

2. hooks/useGoogleAuth.ts:21
   Parameter: none
   Body: sessionUrlProvider = null;
```

**Morning check:**
```bash
grep "HIGH risk\|Total" overnight-results/catch-scan-*.log
```

---

### 2. API Smoke Tests
**File:** `/tmp/api-smoke-tests.sh`

**Purpose:** Quick health check of critical endpoints

**What it does:**
- Tests `/health` endpoint (must pass)
- Tests sample auth/API endpoints
- Captures HTTP status codes
- Logs responses for debugging

**Output:** 
- `overnight-results/api-smoke-TIMESTAMP.log` (text)
- `overnight-results/api-smoke-TIMESTAMP.json` (structured)

**Example:**
```json
{
  "timestamp": "2025-12-05T05:30:00Z",
  "passed": 1,
  "failed": 5,
  "total": 6,
  "success_rate": "16.7%"
}
```

**Morning check:**
```bash
cat overnight-results/api-smoke-*.json | jq '.passed'
```

**Critical:** `/health` endpoint **must** return 200

---

### 3. Lint Baseline
**File:** `npx eslint . --format=json` (in nightly-sweeps.sh)

**Purpose:** Track linting warnings over time

**What it does:**
- Runs ESLint on full codebase
- Counts warnings vs errors
- Saves raw JSON for comparison
- Flags trend (up/down/stable)

**Output:**
- `overnight-results/lint-baseline-TIMESTAMP.log` (summary)
- `overnight-results/lint-baseline-TIMESTAMP.json` (raw data)

**Example:**
```
LINT BASELINE - 20251205_112030
Warnings: 400
Errors:   0
```

**Morning check:**
```bash
# Compare last two nights
diff <(grep "Warnings" overnight-results/lint-baseline-*.log | head -1) \
     <(grep "Warnings" overnight-results/lint-baseline-*.log | tail -1)
```

**Expected:** Should be stable or trending downward

---

### 4. TypeScript Type Check
**File:** `npx tsc --noEmit` (in nightly-sweeps.sh)

**Purpose:** Verify zero TypeScript errors

**What it does:**
- Runs full TypeScript type checking
- No code generation (--noEmit)
- Logs any errors found
- Should be completely silent if 0 errors

**Output:** `overnight-results/typescript-check-TIMESTAMP.log`

**Example (no errors):**
```
# (completely empty file)
```

**Example (with errors):**
```
src/components/MyComponent.ts:42:10 - error TS2339: Property 'foo' does not exist on type 'Bar'.
```

**Morning check:**
```bash
cat overnight-results/typescript-check-*.log | wc -l
# Should return 0 (no output = no errors)
```

**Critical:** Must have 0 errors before QA

---

### 5. npm Audit Summary
**File:** `npm audit --json` (in nightly-sweeps.sh)

**Purpose:** Track security vulnerabilities

**What it does:**
- Scans all npm dependencies
- Counts vulnerabilities by severity
- Identifies new vulns vs existing
- Prioritizes Critical/High

**Output:** `overnight-results/npm-audit-TIMESTAMP.log`

**Example:**
```
NPM AUDIT SUMMARY
Total: 3
  🔴 Critical: 0
  🟠 High: 1
  🟡 Medium: 2
  🔵 Low: 0
```

**Morning check:**
```bash
grep -E "Critical|High" overnight-results/npm-audit-*.log
```

**Critical:** New Critical/High vulns block QA

---

## Master Orchestrator

**File:** `/tmp/nightly-sweeps.sh`

**What it does:**
1. Creates `overnight-results/` directory
2. Launches all 5 sweeps in parallel (not sequential)
3. Waits for all to complete
4. Generates `morning-review-summary.txt`
5. Logs everything with timestamps

**Key feature:** All sweeps run **simultaneously**
- If run individually: 10-15 min total
- If run sequentially: 25-30 min total
- Parallel execution saves 15 minutes overnight

---

## Scheduling

### Option 1: Manual (On-Demand)
```bash
bash /tmp/nightly-sweeps.sh
```
Takes ~10 minutes. Results saved immediately.

### Option 2: Cron (Automatic Nightly)
```bash
bash /tmp/setup-nightly-cron.sh
```
Runs every night at 11:30 PM (23:30).

**To verify:**
```bash
crontab -l | grep nightly-sweeps
```

**To disable:**
```bash
crontab -e
# Delete the nightly-sweeps.sh line
```

### Option 3: GitHub Actions (Enterprise)
Add to `.github/workflows/nightly.yml`:
```yaml
name: Nightly Automation
on:
  schedule:
    - cron: '30 23 * * *'
jobs:
  sweeps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: bash /tmp/nightly-sweeps.sh
      - uses: actions/upload-artifact@v3
        with:
          name: overnight-results
          path: overnight-results/
```

---

## Data Flow

```
11:30 PM
  │
  ├─→ catch-scan.py       → catch-scan-20251205.log
  ├─→ api-smoke.sh        → api-smoke-20251205.{log,json}
  ├─→ eslint --json       → lint-baseline-20251205.{log,json}
  ├─→ tsc --noEmit        → typescript-check-20251205.log
  └─→ npm audit --json    → npm-audit-20251205.log
       │
       ├─→ parse output
       ├─→ generate summary
       └─→ create morning-review-summary.txt
            │
            ↓
      overnight-results/
      (all logs + JSONs)
            │
         6-7 hours later
            │
            ↓
        7:30 AM
      MORNING REVIEW
      (15 minutes)
            │
            ├─→ All green?  → Start QA (8 AM)
            └─→ Issues?     → Fix first (30 min)
```

---

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| Catch scanner | `/tmp/find-empty-catches.py` | Python script |
| API smoke tests | `/tmp/api-smoke-tests.sh` | Bash script |
| Nightly sweeps | `/tmp/nightly-sweeps.sh` | Master orchestrator |
| Cron setup | `/tmp/setup-nightly-cron.sh` | Schedule installer |
| Results | `overnight-results/` | All outputs + logs |
| Documentation | `NIGHTLY_AUTOMATION_GUIDE.md` | Full reference |
| Morning check | `MORNING_REVIEW_CHECKLIST.md` | 15-min checklist |

---

## Execution Flow (Details)

```bash
# 1. Master script starts
bash /tmp/nightly-sweeps.sh

# 2. Creates results directory
mkdir -p overnight-results/

# 3. Launches 5 sweeps in background
python3 /tmp/find-empty-catches.py > overnight-results/catch-scan-*.log &
bash /tmp/api-smoke-tests.sh > overnight-results/api-smoke-*.log 2>&1 &
npx eslint . --format=json > overnight-results/lint-baseline-*.json &
npx tsc --noEmit > overnight-results/typescript-check-*.log 2>&1 &
npm audit --json | python3 << PROCESS > overnight-results/npm-audit-*.log &

# 4. Waits for all PIDs to complete
wait $pid1 $pid2 $pid3 $pid4 $pid5

# 5. Generates summary
cat > overnight-results/morning-review-summary.txt << ...

# 6. Done! Results ready for morning
```

All 5 sweeps run **simultaneously** in background processes.
Total time: ~10 minutes (parallel) vs ~30 min (sequential).

---

## Troubleshooting

### Sweeps didn't run
1. Check if cron is enabled: `crontab -l`
2. Run manually: `bash /tmp/nightly-sweeps.sh`
3. Check for errors: `cat overnight-results/nightly-sweeps.log`

### Some sweeps failed
Check individual logs:
```bash
ls -la overnight-results/ | grep -E "catch|smoke|lint|type|audit"
# Missing files = that sweep failed
```

### No results directory
Create it:
```bash
mkdir -p /Users/varsityhub/Desktop/CODE/VarsityHubMobile/overnight-results
```

### npm audit hangs
Add timeout:
```bash
timeout 30 npm audit --json > npm-audit.log
```

---

## Success Metrics

✅ **Optimal overnight run:**
- Catch-scan HIGH-RISK: < 150 (trending down)
- API /health: 200 (passing)
- Lint warnings: stable or down
- TypeScript errors: 0
- npm audit: no new CRITICAL/HIGH

✅ **Ready for QA if:**
- API infrastructure responding
- Zero TypeScript errors
- No new security vulnerabilities
- Lint trend positive

❌ **Blockers (fix before QA):**
- TypeScript errors present
- API /health returning 5xx
- New Critical/High vulnerabilities

---

## Next Steps

1. **Tonight:** Nightly sweeps run (manual or cron)
2. **Morning:** 15-minute review
3. **8:00 AM:** Start Day 3 QA (if all green)
4. **5:00 PM:** QA complete
5. **Tomorrow:** Production launch

This gives you **6-8 hours of free validation** overnight.

Every morning, you wake up to complete infrastructure validation reports.
