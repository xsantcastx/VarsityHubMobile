# Sentry alerting checklist

Use these alert rules for the production API service:

1. 5xx spike
   - Trigger when the server error rate exceeds 5% over 5 minutes.
   - Use the `transaction` or `http` issue when the app returns 5xx responses.

2. Prisma slow-query spike
   - Trigger when the `[prisma] slow query` log message appears more than 10 times in 5 minutes.
   - If the log format is not yet normalized, create an issue rule on the `prisma` or `slow_query` tag.

3. Authentication failures
   - Trigger when auth failures exceed 10 events in 5 minutes.
   - Filter by the `/auth/*` routes or the `401` response path.

4. Payment errors
   - Trigger when payment failures exceed 3 events in 5 minutes.
   - Filter on the `/payments` routes or the `payment` tag.

5. Health-check regressions
   - Trigger when the `/health` endpoint stops returning `200` or when the service reports `ready: false`.

If you have a valid Sentry API token and organization/project slugs, the next step is to create these rules directly in the Sentry dashboard or via the Sentry API. The repo's `npm run verify:ops` script covers the prerequisite DSN and health-check wiring.
