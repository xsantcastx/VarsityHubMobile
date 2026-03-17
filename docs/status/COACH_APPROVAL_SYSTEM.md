# Coach Approval System

**Status:** ✅ Implemented (March 2026)

## Overview

Coaches and league owners cannot access team/event creation until approved. This prevents unvetted users from creating content.

## Flow

1. **League creation** – Creator is set to `PENDING`. Super admin must approve the league, which sets the league owner to `APPROVED`.
2. **Coach join** – When a user joins an org as a coach, they are set to `PENDING`. The league owner approves via `POST /organizations/:id/coaches/:userId/approve`.
3. **Blocking** – `requireOnboarded` middleware blocks PENDING users from team creation and event creation endpoints.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/organizations.ts` | Sets creator to PENDING on org create; approval endpoints |
| `server/src/middleware/requireVerified.ts` | `requireOnboarded` blocks PENDING users |
| `server/src/__tests__/coach-approval.test.ts` | Integration tests |
| `server/scripts/verify-coach-approval.ts` | Static verification (no DB) |

## Verification

```bash
# Static check (no database)
cd server && npm run verify:coach-approval

# Integration tests (requires DATABASE_URL)
cd server && npm test -- --testPathPattern="coach-approval"
```

## Approval Status Values

- `PENDING` – Awaiting approval; blocked from team/event creation
- `APPROVED` – Can create teams and events
