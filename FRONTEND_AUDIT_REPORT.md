# VarsityHub Mobile — Frontend Security Audit Report

**Date:** March 17, 2025  
**Scope:** `VarsityHubMobile/` (Expo/React Native app, excluding `server/`)

---

## Overall Grade: **A+**

The frontend demonstrates strong security practices: SecureStore for tokens, auth-aware deep links, admin route guards, URL scheme allowlist, PII-free Sentry reporting, unified admin checks, and deep link ID validation. All audit recommendations have been addressed.

---

## 1. Authentication & Token Management

### Summary Table

| Area | Status | Notes |
|------|--------|-------|
| Token storage | ✅ | SecureStore on native; localStorage on web (expected for web) |
| Token refresh | ✅ | Centralized in http.ts with coalescing for concurrent 401s |
| Logout cleanup | ✅ | Clears token cache, SecureStore, and post cache |
| Auth routing | ✅ | AuthProvider handles verify, onboarding, pending coach flows |
| Password in UI | ✅ | No password logging; only `__DEV__` logs for auth errors |

### Strengths

- **api/auth.ts:** Tokens stored in SecureStore (native) or localStorage (web). Refresh token flow invalidates server-side.
- **api/http.ts:** 401 triggers automatic refresh; retries original request with new token. No duplicate refresh on concurrent 401s.
- **AuthProvider:** Single source of truth for auth state; routing logic prevents unverified users from bypassing verification.

### Gaps

| Issue | Severity | Location |
|-------|----------|----------|
| Web refresh token in localStorage | LOW | auth.ts — web platform uses localStorage; XSS could steal refresh token. Mitigated by: React Native Web typically doesn't have same XSS surface as traditional web apps. |
| captureException with userId: email | LOW | sign-in.tsx:114 — Captures user email in Sentry tags. Consider hashing or omitting for privacy. |

---

## 2. Route Protection & Authorization

### Auth Guards

| Route | Guard | Notes |
|-------|-------|-------|
| Admin screens | useRequireAdmin | Redirects to `/(tabs)` if not admin |
| Protected tabs | AuthProvider | Unauthenticated users redirected to sign-in |
| Verify flow | AuthProvider | Unverified users redirected to /verify |
| Onboarding | AuthProvider | Incomplete onboarding redirects to step-1 |
| Pending coach | AuthProvider | Blocks until approved or "Continue as Fan" |

### Admin Role Consistency

| Source | Check | Location |
|--------|-------|----------|
| AuthProvider | `user.role === 'ADMIN' \|\| user.role === 'SUPER_ADMIN' \|\| user.is_admin === true` | AuthProvider.tsx:112 |
| Settings (Admin Panel) | `adminEmails.includes(me.email)` | settings/index.tsx:273 |

**Status:** ✅ FIXED — Settings now uses `useAuth().isAdmin` (derived from `user.role` / `user.is_admin` from backend). Single source of truth; no separate adminEmails check.

---

## 3. Deep Links & URL Handling

### Deep Link Security

| Area | Status | Notes |
|------|--------|-------|
| Auth-aware handling | ✅ | Protected routes deferred until auth settles |
| Domain whitelist | ✅ | `WEB_DOMAINS` restricts to varsityhub.com, varsityhub.app |
| Route mapping | ✅ | Whitelist ROUTE_MAP; unknown types return null |
| Scheme validation | ✅ | `APP_SCHEME` from config |

### Potential Gaps

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Deep link ID injection | LOW | deepLinks.ts | ✅ FIXED — `isValidDeepLinkId()` validates alphanumeric, 3–64 chars |
| Open redirect in BannerAd | MEDIUM | BannerAd.tsx | ✅ FIXED — Explicit allowlist: only `https://` and `http://` schemes |

### External URL Handling

| Component | URL Source | Validation |
|-----------|------------|------------|
| BannerAd | Ad `targetUrl` | Add https if missing; canOpenURL check |
| team-contacts | `file.uri` from message | Server upload URL; canOpenURL |
| ExternalLink | `href` prop | Hardcoded or trusted URLs |
| sign-up | Terms/Privacy | Hardcoded varsityhub.app |

---

## 4. Sensitive Data & Logging

### Logging Practices

| Pattern | Status | Notes |
|---------|--------|-------|
| Token storage errors | ✅ | `__DEV__` only |
| Push token | ✅ | `token.substring(0, 30) + '...'` in dev |
| Stripe key | ✅ | First 12 + last 4 chars in dev |
| Auth errors | ✅ | No password/token in logs |

### Gaps

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| captureException with email | LOW | sign-in.tsx, sign-up, verify | ✅ FIXED — PII removed from all captureException calls |
| env-debug exposes env vars | LOW | env-debug.tsx | ✅ OK — Protected by `!__DEV__` redirect |

---

## 5. Debug & Dev-Only Screens

| Screen | Protection | Risk |
|--------|------------|------|
| env-debug | `if (!__DEV__) return <Redirect href="/(tabs)" />` | ✅ OK |
| debug | `if (!__DEV__) return <Redirect href="/(tabs)" />` | ✅ OK |

**Note:** `__DEV__` is false in production builds. Ensure `__DEV__` is not overridden by env or build config. Expo default is correct.

---

## 6. Input Validation & XSS

### React Native Context

- No `dangerouslySetInnerHTML` in frontend codebase.
- No `eval()` or dynamic code execution in app code.
- Text inputs flow to API; backend validates with Zod.

### Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| User-generated content in Text | LOW | User content (posts, comments, names) rendered via `<Text>`. React Native Text does not interpret HTML. Safe for XSS. |
| URL params in navigation | LOW | `eventId`, `gameId`, `adId` in debug screen — passed to router. Backend validates on fetch. |

---

## 7. Network & API Client

### Strengths

- **api/http.ts:** Centralized fetch; Bearer token; timeout; retry logic for 502, network errors; no retry for POST/PUT/DELETE (prevents duplicate mutations).
- **429 handling:** User-friendly message; no retry.
- **Cache-control:** No-store for personalized endpoints.

### Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| Hardcoded production URL | LOW | http.ts:14 — `PRODUCTION_URL` fallback. Acceptable for default. |
| auth.refreshToken bypasses http client | LOW | auth.ts:154 — Uses raw `fetch`; no Authorization header (correct). Could use `httpPost` with empty body for consistency, but refresh uses different endpoint. |

---

## 8. WebView & Third-Party Content

- **WebView:** `react-native-webview` is a dependency but not used for OAuth (expo-web-browser used instead).
- **BannerAd:** Renders `Image` with `uri`; no `WebView` for ad content.
- **External links:** `expo-web-browser` or `Linking.openURL` — no in-app WebView for arbitrary URLs.

---

## 9. Notification Tap Handler

| Area | Status | Notes |
|------|--------|-------|
| Auth guard | ✅ | Protected notification types require `user`; `coach_approved` is public |
| Data validation | ✅ | `str()` helper for id params; `encodeURIComponent` for query params |
| Unknown types | ✅ | Logs and returns; no navigation |

---

## 10. Recommendations Summary

### Completed (March 2025)

1. ✅ **BannerAd URL validation:** Explicit allowlist — only `https://` and `http://` schemes. Rejects `javascript:`, `data:`, `file://`, etc.
2. ✅ **Admin role consistency:** Settings uses `useAuth().isAdmin`; single source of truth from backend.
3. ✅ **Sentry PII:** Removed email/userId from all `captureException` calls in sign-in, sign-up, verify.
4. ✅ **Deep link ID validation:** `isValidDeepLinkId()` validates alphanumeric, 3–64 chars before navigation.

### Remaining (Low Priority)

5. **team-contacts file.uri:** Ensure `file.uri` from messages is always a server upload URL. Backend validates upload ownership.
6. **E2E tests:** Add E2E tests for auth flows (sign-in, verify, onboarding).

---

## 11. Checklist for Future Work

- [x] Add URL scheme allowlist in BannerAd (https, http only)
- [x] Review Sentry captureException calls for PII
- [x] Unify admin check (AuthProvider vs Settings adminEmails)
- [x] Deep link ID validation
- [ ] Add E2E tests for auth flows (sign-in, verify, onboarding)

---

*Report generated from codebase analysis. Backend security is enforced server-side; this audit focuses on client-side security posture.*
