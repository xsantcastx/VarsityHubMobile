# Login + Onboarding Security Matrix

Last updated: 2026-03-22

## Purpose

Define the exact, production-safe login/onboarding behavior for VarsityHub so users cannot bypass sign-in or onboarding requirements.

---

## Source of Truth Rules

1. **Server is source of truth for onboarding completion**
   - `user.preferences.onboarding_completed` in DB controls access.
   - Client-side flags are convenience only and must never grant access alone.

2. **Only one endpoint can complete onboarding**
   - `POST /me/complete-onboarding` is the only legal path to set `onboarding_completed=true`.
   - Direct preference/profile updates must not set it to `true`.

3. **All protected access requires a valid JWT**
   - Missing/invalid JWT => treated as unauthenticated.
   - Expired access token can refresh once via refresh token flow.

4. **Fresh app installs require fresh sign-in**
   - Native secure storage can persist across reinstall.
   - Client must invalidate legacy persisted token when install sentinel is missing.

---

## Frontend Routing Matrix (AuthProvider)

| State | Target Route |
|---|---|
| Unauthenticated | `/sign-in` |
| Authenticated but unverified | `/verify` |
| Verified + onboarding incomplete | `/onboarding/step-1-role` (or next required onboarding step) |
| Coach pending approval (not proceeding as fan) | `/onboarding/pending-approval` |
| Coach approved + payment required | `/settings/manage-subscription` |
| Verified + onboarding complete | `/(tabs)` |

### Guard Requirements

- Route guards must re-evaluate when auth state **or current route segment** changes.
- Protected deep links must be deferred until auth state is resolved.
- Index fallback redirects must not include test bypasses.

---

## Onboarding Flow (Exact)

### Step 1 — Role
- User chooses `fan` or `coach`.
- Persist role draft in onboarding state.

### Step 2 — Basic
- Collect username, DOB, affiliation, ZIP.
- Validate username availability.
- COPPA enforced (`<13` blocked server-side).
- Fan path can complete onboarding directly via `POST /me/complete-onboarding`.

### Step 3 — League (Coach)
- Join existing organization or create organization.
- If join request submitted => pending approval.
- If organization created => league pending approval.
- Do not auto-skip to tabs.

### Completion
- Only after server accepts `POST /me/complete-onboarding`:
  - `onboarding_completed=true`
  - role context persisted
  - org/team context persisted where applicable

---

## Backend Enforcement Matrix

| Endpoint | Enforcement |
|---|---|
| `GET /me` | Returns current auth/profile state; no forced onboarding completion overrides |
| `PATCH /me/preferences` | Must reject `onboarding_completed=true` writes |
| `PATCH /me` / `PUT /auth/me` | Must reject `preferences.onboarding_completed=true` writes |
| `POST /me/complete-onboarding` | Requires auth + verified; authoritative onboarding completion |
| `POST /auth/upgrade-to-coach` | Requires verified; sets coach path to pending/incomplete until approval/payment |

---

## Security Invariants

- No unauthenticated access to protected screens/APIs.
- No client-side write path can force onboarding completion.
- No E2E/test bypass logic in production routing paths.
- Stale secure-store tokens from previous installs are invalidated on first launch.

---

## QA Checklist (Must Pass)

1. Fresh install opens to `/sign-in` (no silent old session reuse).
2. New user cannot reach tabs before completing required onboarding.
3. Unverified user cannot access tabs/protected actions.
4. Direct `PATCH /me/preferences { onboarding_completed: true }` returns 403.
5. Coach pending approval stays on pending screen until approved.
6. Approved coach with required payment is routed to subscription completion.
