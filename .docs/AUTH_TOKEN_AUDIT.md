# Auth Token Lifecycle Audit

**Date:** February 22, 2025

---

## 1. Token Issuance (Backend)

| Location | Flow | Token |
|----------|------|-------|
| `server/src/routes/auth.ts` | POST /auth/register | `signJwt({ id, is_admin })` |
| `server/src/routes/auth.ts` | POST /auth/login | `signJwt({ id, is_admin })` |
| `server/src/routes/auth.ts` | POST /auth/google | `signJwt({ id, is_admin })` |
| `server/src/routes/auth.ts` | POST /auth/apple | `signJwt({ id, is_admin })` |
| `server/src/lib/jwt.ts` | `signJwt()` | HS256, expiry **1 hour** |

**Findings:**
- Single access token only; **no refresh token** implemented
- Expiry: 1 hour (DEFAULT_ACCESS_TOKEN_EXPIRY = '1h')
- README claims "1h access + 30d refresh" but refresh flow does not exist

---

## 2. Token Storage (Client)

| Location | Storage | Key |
|----------|---------|-----|
| `api/auth.ts` | **expo-secure-store** (native) | `auth_token_key` |
| `api/auth.ts` | localStorage (web only) | `auth_token_key` |
| `api/http.ts` | In-memory `tokenCache` | N/A |

**Findings:**
- ✅ Tokens stored in SecureStore on native (not AsyncStorage)
- ✅ Web uses localStorage (acceptable for web)
- `api/settings.ts` uses SecureStore for app settings (prefix `vh_settings_`) — not auth tokens

---

## 3. Token Attachment to Requests

| Location | Behavior |
|----------|----------|
| `api/http.ts` `request()` | `const token = getAuthToken(); if (token) headers['Authorization'] = \`Bearer ${token}\`;` |
| `api/upload.ts` | Uses `getAuthToken()` for upload XHR |
| `api/auth.ts` `loadToken()` | Loads from SecureStore → `setAuthToken()` (populates cache) |

**Flow:**
- `checkAuth()` calls `auth.getToken()` (loadToken) then `User.me()`
- `loadToken()` hydrates `tokenCache` from SecureStore if cache empty
- All `httpGet`/`httpPost` use `getAuthToken()` → reads from cache only

---

## 4. Token Refresh

**Current state:** None. No refresh token, no refresh endpoint.

**Consequence:** After 1 hour, the access token expires. Next authenticated request returns 401. User is logged out.

---

## 5. 401 / Expired Token Handling

| Location | Behavior |
|----------|----------|
| `api/http.ts` (res.ok === false) | On 401/403: `clearAuthToken()` (clears **in-memory** cache only) |
| `api/auth.ts` `me()` | On 401: calls `auth.logout()` → clears memory + SecureStore |
| `api/auth.ts` `logout()` | `clearAuthToken()` + SecureStore.deleteItemAsync |

**Critical bug:**
- When **any** API call (not just `User.me`) returns 401, `http.ts` only clears `tokenCache`
- SecureStore still holds the expired token
- Next `loadToken()` repopulates cache from SecureStore → expired token reused → 401 again
- **Fix:** On 401/403, also clear SecureStore (call full token clear, not just memory)

---

## 6. Mid-Session Token Expiry — Trace

1. User is using app, token expires (1h passed)
2. User triggers action (e.g. load feed, post, RSVP)
3. `request()` sends `Authorization: Bearer <expired>`
4. Server returns 401
5. `http.ts`: `clearAuthToken()` → tokenCache = null; **SecureStore NOT cleared**
6. Error propagates to caller (e.g. feed fails)
7. AuthProvider may call `checkAuth()` again (e.g. on OfflineBanner retry)
8. `checkAuth()` calls `auth.getToken()` → loadToken reads from SecureStore → expired token back in cache
9. `User.me()` runs with expired token → 401 again
10. `auth.me()` catch: `auth.logout()` → now SecureStore cleared
11. `checkAuth` sets user = null → routing redirects to sign-in

**Result:** User sees error and is eventually redirected to sign-in. No crash, but **not seamless** — they are logged out. Without refresh tokens, seamless refresh is impossible.

---

## 7. Logout — What Gets Cleared

| Item | Cleared? | Location |
|------|----------|----------|
| In-memory token | ✅ | `auth.logout()` → `clearAuthToken()` |
| SecureStore token | ✅ | `auth.logout()` → `SecureStore.deleteItemAsync(TOKEN_KEY)` |
| user (AuthProvider) | ✅ | `signOut()` → `setUser(null)` |
| pendingVerificationEmail | ✅ | `signOut()` |
| hasCompletedOnboarding | ✅ | `signOut()` |
| ONBOARDING_COMPLETE_KEY (AsyncStorage) | ✅ | `signOut()` → `AsyncStorage.removeItem` |
| lastPushRegistrationRef | ✅ | `signOut()` |
| vh_settings_* (SecureStore) | ❌ | Not cleared |
| OnboardingContext (AsyncStorage) | ❌ | onboarding_state, progress, reducer_state not cleared |
| team-contacts (AsyncStorage) | ❌ | Messages cache not cleared |

**Fix:** Clear settings and onboarding storage on logout so no previous session data persists.

---

## 8. Implemented Changes ✓

1. **401/403:** `http.ts` now calls `on401Handler` which tries `auth.tryRefreshToken()`. If refresh succeeds, the request is retried; otherwise `clearPersistedToken()` runs (SecureStore + memory).
2. **Refresh tokens:** Backend issues `refresh_token` (30d) with `access_token` (1h). `POST /auth/refresh` exchanges refresh_token for new tokens. Client stores both in SecureStore, attempts refresh on 401 before failing.
3. **Logout:** `signOut()` now clears: token, refresh token, settings (vh_settings_*), onboarding storage, team-contacts cache (team_messages_*, team-*-files).

---

## 9. Token Lifecycle (Current)

1. **Issued:** login, register, Google, Apple → `access_token` (1h) + `refresh_token` (30d)
2. **Stored:** SecureStore (native), localStorage (web) — `auth_token_key`, `auth_refresh_token_key`
3. **Used:** All API requests send `Authorization: Bearer <access_token>`
4. **Expired (1h):** Next request gets 401 → client calls `POST /auth/refresh` with refresh_token → new tokens → retry request (seamless)
5. **Refresh expired (30d):** 401 → refresh fails → `clearPersistedToken()` → user redirected to sign-in
6. **Logout:** All tokens, settings, onboarding, team cache cleared.
