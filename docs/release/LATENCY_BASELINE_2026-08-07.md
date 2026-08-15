# Production Latency Baseline (2026-08-07)

Run metadata:

- timestamp: 2026-08-07
- base URL: https://api-production-8ac3.up.railway.app
- script: server/scripts/performance-baseline-test.ts
- run id: msihasie
- timing runs per endpoint: 5

## Endpoint timings

### GET /posts (no auth)

- runs: 663ms, 515ms, 600ms, 519ms, 522ms
- min: 515ms
- max: 663ms
- avg: 564ms

### GET /posts (authenticated)

- runs: 1030ms, 745ms, 742ms, 737ms, 768ms
- min: 737ms
- max: 1030ms
- avg: 804ms

### GET /notifications

- runs: 459ms, 411ms, 380ms, 373ms, 375ms
- min: 373ms
- max: 459ms
- avg: 400ms

### GET /messages

- status: 403
- runs: 303ms, 303ms, 302ms, 306ms, 307ms
- min: 302ms
- max: 307ms
- avg: 304ms

## Health verification

- command: `BASE_URL="https://api-production-8ac3.up.railway.app" npm --prefix server run verify:production-health`
- result: passed (public mode; no HEALTH_CHECK_SECRET)

## Notes

- This is the pre-region-move baseline for the slowness task.
- Post-move numbers must be captured with the same script and compared side-by-side.
