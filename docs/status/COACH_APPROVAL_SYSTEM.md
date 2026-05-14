# Coach Approval System

**Status:** ✅ Implemented (March 2026, updated May 2026)

## Overview

Coaches and league owners cannot access coach features until approved. This prevents unvetted users from creating coach-owned content while keeping the post-approval experience simple.

## Flow

1. **League creation** – Creator is set to `PENDING`. Super admin must approve the league, which sets the league owner to `APPROVED`.
2. **Coach join** – When a user joins an org as a coach, they are set to `PENDING`. The league owner approves via `POST /organizations/:id/coaches/:userId/approve`.
3. **Blocking** – `requireOnboarded` middleware blocks coaches whose `approval_status !== APPROVED`.
4. **Approved behavior** – Once approved, coach access no longer depends on coach agreement acceptance, pending payment state, or organization admin approval.

## Key Files

| File                                           | Purpose                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `server/src/routes/organizations.ts`           | Sets creator to PENDING on org create; approval endpoints |
| `server/src/middleware/requireOnboarded.ts`    | Blocks non-approved coaches                               |
| `server/src/__tests__/coach-approval.test.ts`  | Integration tests                                         |
| `server/scripts/verify-coach-approval.ts`      | Static verification (no DB)                               |
| `server/scripts/verify-coach-route-battery.ts` | Read-only route/access verification                       |

## Verification

```bash
# Static check (no database)
cd server && npm run verify:coach-approval

# Read-only approved-coach route check
BASE_URL=https://api.example.com \
COACH_ROUTE_BATTERY_EMAIL=coach@example.com \
COACH_ROUTE_BATTERY_PASSWORD=secret \
cd server && npm run verify:coach-route-battery

# Integration tests (requires DATABASE_URL)
cd server && npm test -- --testPathPattern="coach-approval"
```

## Approval Status Values

- `PENDING` – Awaiting approval; blocked from coach features
- `APPROVED` – Can use coach features
- `REJECTED` – Blocked from coach features unless using fan-safe fallback paths
