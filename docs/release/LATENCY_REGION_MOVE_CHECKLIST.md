# Latency Region Move Checklist

Purpose: verify measurable latency improvement after API/DB region co-location.

## 1) Capture pre-move baseline

Run from repo root against current production:

```bash
BASE_URL="https://api-production-8ac3.up.railway.app" \
npm --prefix server run verify:production-health

BASE_URL="https://api-production-8ac3.up.railway.app" \
npx tsx server/scripts/performance-baseline-test.ts
```

Record from output:

- GET /posts avg, min, max
- GET /notifications avg, min, max
- GET /messages avg, min, max

Save the console output artifact in your release notes.

## 2) Execute region move

Infra/operator action in Railway:

- co-locate API and Postgres in the same region
- confirm deploy is healthy

## 3) Capture post-move baseline

Run the exact same commands again:

```bash
BASE_URL="https://api-production-8ac3.up.railway.app" \
npm --prefix server run verify:production-health

BASE_URL="https://api-production-8ac3.up.railway.app" \
npx tsx server/scripts/performance-baseline-test.ts
```

## 4) Pass criteria

Mark latency fix complete only if all conditions hold:

- production health check passes before and after
- /posts average latency improves by a meaningful margin
- /notifications and /messages do not regress
- no new auth/session errors in Sentry during observation window

## 5) Evidence block for changelog

Include this in release notes:

- baseline timestamp before move
- baseline timestamp after move
- side-by-side endpoint timing table
- conclusion: improved / no change / regressed
