# VarsityHub Mobile — Frontend–Backend Integration Audit

**Date:** March 17, 2025  
**Scope:** How the Expo/React Native app and Node/Express server work together

---

## Overall Grade: **A-**

The integration is well-architected: centralized HTTP client, consistent auth flow, aligned error handling, and clear API contracts. A few path/route mismatches and edge cases remain.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Expo/React Native App (VarsityHubMobile/)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ AuthProvider │  │ api/*.ts    │  │ context/PostCacheContext │  │
│  │ (auth state) │  │ (API layer)│  │ (caching)                │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                                        │
│         └────────────────┼────────────────────────────────────┐  │
│                          ▼                                     │  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ api/http.ts — Central HTTP client                            ││
│  │ • Bearer token injection • 401 → refresh → retry               ││
│  │ • Timeouts • 502/network retries • 429 no-retry              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + JSON
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Node/Express Server (server/)                                   │
│  • /auth, /me, /users, /teams, /posts, /payments, etc.           │
│  • JWT verify • requireAuth • requireVerified • requireAdmin    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Flow

### Token Lifecycle

| Step | Frontend | Backend |
|------|----------|---------|
| Login/Register | `auth.login()` → saves `access_token`, `refresh_token` | Returns `{ access_token, refresh_token, user, needs_verification? }` |
| API calls | `http.ts` adds `Authorization: Bearer <token>` | `authMiddleware` verifies JWT, sets `req.user` |
| 401 response | Triggers `auth.refreshToken()` | — |
| Refresh | `POST /auth/refresh` with `{ refreshToken }` | Validates refresh token, returns new pair |
| Logout | `auth.logout()` → clears tokens, calls `POST /auth/logout` | Invalidates refresh token (best-effort) |

### Alignment ✓

- **Refresh body:** Frontend sends `refreshToken`; backend expects `refreshToken` ✓
- **Token storage:** SecureStore (native) / localStorage (web) ✓
- **needs_verification:** Frontend checks `res?.needs_verification` after login; backend sets it when `!user.email_verified` ✓
- **Logout:** Frontend calls `/auth/logout` before clearing; backend invalidates ✓

### Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| Refresh bypasses http client | LOW | `auth.refreshToken()` uses raw `fetch`; no retry/timeout. Acceptable for single attempt. |
| Web localStorage for refresh | LOW | XSS could steal refresh token on web. Mitigated by React Native Web surface. |

---

## 3. API Path Mapping

### /me and /auth/me

| Frontend Call | Path | Backend Mount | Status |
|---------------|------|---------------|--------|
| `auth.me()` | `GET /me` | `app.get('/me', ...)` | ✓ |
| `User.updateMe()` | `PUT /auth/me` | `authRouter.put('/me', ...)` under `/auth` | ✓ |
| `User.patchMe()` | `PATCH /me` | `app.patch('/me', ...)` | ✓ |
| `User.updatePreferences()` | `PATCH /me/preferences` | `app.patch('/me/preferences', ...)` | ✓ |
| `User.completeOnboarding()` | `POST /me/complete-onboarding` | `app.post('/me/complete-onboarding', ...)` | ✓ |
| Subscription | `GET /me/subscription` | `app.get('/me/subscription', ...)` | ✓ |

**Note:** `/me` is mounted at app root; `/auth/me` is under auth router. Both resolve correctly.

---

## 4. Error Response Contract

### Backend Error Format

```json
{ "error": "Message", "message": "Optional", "ban_reason": "...", "banned_until": "..." }
```

### Frontend Handling

| Status | Frontend Behavior |
|--------|-------------------|
| 401 | Refresh token → retry; if refresh fails, clear auth, throw |
| 403 | No refresh; throw with `err.data` (ban_reason, banned_until) |
| 404 | Throw; some paths suppressed in dev |
| 429 | User message; no retry; `err.data` preserved |
| 502 | Retry with backoff (Railway infra) |
| 408 | Timeout; retry once |

### Alignment ✓

- **Error extraction:** `data.error || data.message` ✓
- **403 ban handling:** `sign-in.tsx` reads `ban_reason`, `banned_until` ✓
- **429:** Frontend does not retry ✓

### Gap

| Issue | Severity | Notes |
|-------|----------|-------|
| retryAfter not used | LOW | Backend sends `retryAfter` in 429; frontend shows generic message. Could improve UX with countdown. |

---

## 5. Auth State Sync

### Fields Used by Frontend

| Field | Source | Frontend Use |
|-------|--------|--------------|
| `user.id` | GET /me | Identity, API calls |
| `user.email_verified` | GET /me | Redirect to /verify if false |
| `user.preferences.onboarding_completed` | GET /me | Redirect to onboarding if false |
| `user.preferences.role` | GET /me | Coach vs fan flows |
| `user.approval_status` | GET /me | Pending coach blocking |
| `user.role` / `user.is_admin` | GET /me | Admin panel visibility |

### Backend Enforcement

- `requireVerified` → checks `email_verified`
- `requireOnboarded` → checks `preferences.onboarding_completed`
- `requireAdmin` → checks admin role/email

**Alignment ✓** — Frontend routing mirrors backend guards; no bypass.

---

## 6. Entity API Layer

### API Modules → Backend Routes

| api/*.ts | Primary Backend | Notes |
|----------|-----------------|-------|
| auth.ts | /auth/*, /me | Token, login, register, verify |
| user.ts | /users/*, /me/* | User CRUD, follow, lookup |
| teams.ts | /teams/* | Teams, members, invites |
| posts.ts | /posts/* | Posts, comments, upvotes |
| events.ts | /events/* | Events, RSVPs |
| games.ts | /games/* | Games, media |
| messages.ts | /messages/* | DMs |
| organizations.ts | /organizations/* | Orgs, members, invites |
| payments.ts | /payments/* | Stripe, subscriptions |
| upload.ts | /uploads/* | Cloudinary signatures, uploads |

### Path Consistency ✓

- `User.ban(id)` → `POST /users/:id/ban` ✓
- `Team.members(id)` → `GET /teams/:id/members` ✓
- `Organization.members(id)` → `GET /organizations/:id/members` ✓

---

## 7. Deep Link → Screen Mapping

### Team Deep Links (Fixed)

| Deep Link Type | ROUTE_MAP Target | Actual Screen | Status |
|----------------|------------------|---------------|--------|
| `team` | `/(tabs)/team-page` | team-page.tsx | ✅ FIXED — loads `Team.get(id)` correctly |

### Other Mappings ✓

- `post` → post-detail ✓
- `game` → game-detail ✓
- `event` → event-detail ✓
- `profile` / `user` → user-profile (profile with user id) ✓

---

## 8. Cache-Control Alignment

### Frontend no-store Paths

```ts
/^\/(me|auth\/me|rsvps|follows|support|search|users|teams|team-memberships|team-invites|events\/)/
```

### Backend noStore

Applied to `/me`, `/me/preferences`, `/me/complete-onboarding`, `/me/subscription`, `/messages`, `/notifications`, `/admin`, etc.

**Alignment ✓** — Personalized data gets no-store on both sides.

---

## 9. CORS & Origins

### Backend

- Production: `varsityhub.app`, `app.varsityhub.app`, `lime.varsityhub.app`, etc.
- Dev: `localhost:3000`, `localhost:8081`, `localhost:19006`
- `ALLOWED_ORIGINS` env for overrides

### Frontend

- Uses `EXPO_PUBLIC_API_URL` or default production URL
- React Native apps use native fetch (no browser CORS for app)
- Web build would need origin in backend allowlist ✓

---

## 10. Rate Limiting Awareness

### Frontend

- 429: Shows "Too many attempts. Please wait a moment and try again."
- Does not retry 429 ✓
- Auth limiter (login): 20/15min per IP — frontend surfaces generic message ✓

### Backend

- Sends `retryAfter` in 429 body
- Frontend does not display countdown (low priority)

---

## 11. Recommendations Summary

### Completed (March 2025)

1. ✅ **Fix team deep link target:** `team` in ROUTE_MAP now points to `/(tabs)/team-page`.
2. ✅ **retryAfter UX:** 429 errors show "try again in X seconds" when backend sends retryAfter (1–300s).
3. ✅ **Refresh timeout:** `auth.refreshToken()` uses AbortController with 15s timeout.

### Remaining

4. **Document:** Add a shared API contract doc (OpenAPI/Swagger) — backend has `/api-docs`; ensure frontend paths match.
5. **team-profile vs team-page:** Naming clarified — team deep links now use team-page; team-profile remains user profile alias.

---

## 12. Checklist

- [x] Auth flow (login, refresh, logout) aligned
- [x] Error format (error, message, status) consumed correctly
- [x] 401 → refresh → retry implemented
- [x] 403 ban handling (ban_reason, banned_until)
- [x] 429 no-retry
- [x] needs_verification / onboarding_completed sync
- [x] Fix team deep link → team-page
- [x] retryAfter UX for 429
- [x] Refresh timeout

---

*Integration audit complete. Backend and frontend work together cohesively; the team deep link fix is the main actionable gap.*
