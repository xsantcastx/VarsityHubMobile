# Latency Comparison (2026-08-07)

Scope: production API timing before vs after Redis region co-location.

- baseline run id (pre-move): msihasie
- post-move run id: msihdmj4
- base URL: https://api-production-8ac3.up.railway.app
- script: server/scripts/performance-baseline-test.ts

## Before vs After

| Endpoint                   | Pre-move avg | Post-move avg |           Delta |
| -------------------------- | -----------: | ------------: | --------------: |
| GET /posts (no auth)       |        564ms |         406ms | -158ms (-28.0%) |
| GET /posts (authenticated) |        804ms |         670ms | -134ms (-16.7%) |
| GET /notifications         |        400ms |         339ms |  -61ms (-15.3%) |
| GET /messages\*            |        304ms |         260ms |  -44ms (-14.5%) |

\* /messages returned 403 in both runs; timing trend still improved, but it is not a success-path payload benchmark.

## Health checks

- pre-move production health: passed
- post-move production health: passed

## Conclusion

Region alignment improved latency across all measured endpoints, with the primary target (authenticated feed) improving from 804ms to 670ms.

This closes the slowness remediation task from an evidence standpoint.
