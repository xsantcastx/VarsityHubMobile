# Security Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## Medium

### Geocoding proxy endpoints have no dedicated abuse/cost limiter

- Affected files:
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:328)
  - [server/src/routes/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/geocoding.ts:19)
  - [server/src/routes/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/geocoding.ts:64)
  - [server/src/middleware/rateLimiters.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/middleware/rateLimiters.ts:503)
- Failure path:
  - Any authenticated user can repeatedly call `/geocoding/location` and `/geocoding/autocomplete`.
  - These handlers proxy directly to Google Maps APIs.
  - They only inherit the broad `defaultApiLimiter`, not a stricter route-specific limiter tuned for an external paid dependency.
- Expected behavior:
  - External geocoding/autocomplete endpoints should have explicit low-volume throttles keyed by user or IP.
- Actual behavior:
  - The routes are only protected by `requireAuth` plus the global default limiter.
  - There is no geocoding-specific limiter in `rateLimiters.ts`.
- Fix recommendation:
  - Add a dedicated `geocodingLimiter` in `server/src/middleware/rateLimiters.ts`.
  - Apply it to both `/geocoding/location` and `/geocoding/autocomplete`.
  - Consider separate lower ceilings for autocomplete and full geocode lookups.
- Verification:
  - Grep for `geocodingLimiter` usage in `server/src/routes/geocoding.ts`.
  - Add an HTTP test that the route returns `429` after the configured threshold.
