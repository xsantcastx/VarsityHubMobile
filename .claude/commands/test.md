Run the specified test script from server/scripts/. If no test is specified, run db-integrity-check.ts as a quick health check.

After the test completes, summarize:
- Total pass/fail count
- Any failures with root cause explanation
- Recommended fix for each failure

Available test scripts:
- ghost-user — Ghost/anonymous user access boundaries
- fan-journey — Fan signup through full usage flow
- coach-journey — Coach approval and permissions flow
- ad-hosting — Ad creation, booking, and payment flow
- email-delivery — SendGrid template delivery verification
- db-integrity — Database constraint and relationship checks
- auth-security — Authentication and authorization checks
- rate-limit — Rate limiting enforcement
- notification — Push notification delivery
- geofencing — Location-based content filtering
- concurrent — Race condition and concurrency tests
- performance-baseline — Response time benchmarks
- security-smoke — Quick security surface scan

Run with: `npx tsx server/scripts/{name}-test.ts`

$ARGUMENTS
