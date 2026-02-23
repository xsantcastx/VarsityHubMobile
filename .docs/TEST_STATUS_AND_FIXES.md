# Test Status and Fixes

**Date:** February 22, 2025

## Current Status

### Geofencing (`server/src/__tests__/geofencing.test.ts`)

**Fixed:** Missing `geofence-telemetry` module.

- Created `server/src/lib/geofence-telemetry.ts` — exports `logRejection` used by `geofencing.ts`.
- Geocoding logic tests (calculateDistance, isWithinGeofence) pass.
- **Still failing:** `verifyEventPostingPermission` and `verifyStoryCreationPermission` — Jest ESM mock for Prisma: `prisma.event.findUnique` does not expose `mockResolvedValue`. Likely a Jest + ESM + Prisma mock compatibility issue. Possible fixes:
  - Use `jest.unstable_mockModule` (ESM-specific).
  - Use a `__mocks__` directory.
  - Refactor geofencing to accept a prisma instance (DI) for easier testing.

### Organizations (`server/tests/organizations.test.ts`)

**Error:** `Must use import to load ES Module: .prisma/client/default.js`

- Prisma client is treated as ESM; Jest + Node ESM handling conflict.
- `postinstall` runs `fix-prisma-cjs.cjs` to set `"type": "commonjs"` in `.prisma/client/package.json`; may need to re-run `npm install` in `server/` after changes.
- **Skipped in CI** via `SKIP_SERVER_DB_TESTS` / `skipDbTests`.

### Auth Sign-In Integration (`server/tests/auth-signin.integration.test.ts`)

**Error:** `Cannot find module '../middleware/auth.js' from 'src/__tests__/testApp.ts'`

- `testApp.ts` imports `authMiddleware` from `../middleware/auth.js`.
- Added `moduleNameMapper` in jest.config.js for `../middleware/auth.js` → `auth.ts`; resolution may still be wrong.
- **Skipped in CI** via `SKIP_SERVER_INTEGRATION_TESTS` / `RUN_SERVER_INTEGRATION_TESTS`.

### Auth Sign-In Mock (`server/tests/auth-signin.mock.test.ts`)

**Status:** All 16 tests pass. No Prisma/database used; uses `MockDatabase`.

---

## Fixes Applied

1. **geofence-telemetry.ts** — Implemented missing module imported by `geofencing.ts`.
2. **jest.config.js** — `moduleNameMapper` entries for:
   - `./geofence-telemetry.js` → `geofence-telemetry.ts`
   - `../middleware/auth.js` → `auth.ts`

---

## Recommended Next Steps

1. Run `npm run postinstall` in `server/` to ensure Prisma CJS fix is applied.
2. For geofencing: refactor to inject Prisma or use `jest.unstable_mockModule`.
3. For organizations: ensure Prisma fix is applied; consider running with `SKIP_SERVER_DB_TESTS=0` only when DB is available.
4. For auth-signin integration: adjust import paths or moduleNameMapper so `testApp` resolves `auth` correctly.
