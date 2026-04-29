# Security Backlog

**Created:** 2026-03-16
**Context:** Full security audit completed. All CRITICAL and HIGH-severity exploitable issues are fixed. Items below are deferred to post-launch.

---

## P1 — First Post-Launch Sprint

### #9 Refresh tokens stored in localStorage on web

- **Risk:** HIGH
- **Why deferred:** Mobile uses SecureStore (secure). Web is not the primary platform.
- **Issue:** Any XSS vulnerability on web would expose refresh tokens (7-day validity).
- **Fix:** Move refresh tokens to HTTPOnly cookies with `SameSite=Strict`. Requires backend changes to set/read cookies instead of JSON response bodies.

### #12 No token blacklist on logout

- **Risk:** MEDIUM
- **Why deferred:** Access tokens expire in 15 minutes. Refresh tokens are cleared client-side on logout.
- **Issue:** Stolen tokens remain valid until expiry. If a device is compromised, attacker has up to 7 days of access.
- **Fix:** Add Redis-backed blacklist. On logout, add refresh token to blacklist with 7-day TTL. Check blacklist on every `/auth/refresh` call.

---

## P2 — Next Quarter

### #8 Admin access via hardcoded email list

- **Risk:** HIGH (impact) / LOW (exploitability)
- **Why deferred:** Works for single-admin setup. Only one admin (support@varsityhub.app).
- **Issue:** No granular roles (all-or-nothing admin). Adding admins requires env var change + redeploy. No audit trail for admin actions.
- **Fix:** Add `role` column to User model (`user`, `moderator`, `admin`, `superadmin`). Migrate `ADMIN_EMAILS` check to DB lookup. Add `AdminAction` audit logging.

### #10 Refresh token not rotated on all auth endpoints

- **Risk:** HIGH
- **Why deferred:** Rotation happens on `/auth/refresh` which is the primary token renewal path. Login/register/OAuth issue new tokens (not reuse old ones).
- **Issue:** If a refresh token is intercepted, it can be reused for 7 days without triggering rotation.
- **Fix:** Implement sliding-window rotation: every successful `/auth/refresh` invalidates the old token and issues a new one. Store previous token briefly to handle race conditions.

### #11 Org join requests use preference-based role check

- **Risk:** HIGH
- **Why deferred:** Preferences can't be directly modified via API (no raw PATCH /preferences endpoint for role). Server re-checks permissions on every action.
- **Issue:** If a user could somehow modify `preferences.role` to `coach`, they could submit join requests as a coach.
- **Fix:** Refactor all role checks to use database-stored memberships exclusively. Never use `preferences.role` for authorization — only for UI display.

---

## P3 — Backlog

### #13 No login anomaly detection

- **Risk:** MEDIUM
- **Why deferred:** Standard for early-stage apps. Device info is already tracked on login (fire-and-forget).
- **Fix:** Alert users on login from new device/location. Require email confirmation for suspicious logins (new country, multiple failed attempts from different IPs).

### #14 Org creation auto-approved to creator before super-admin review

- **Risk:** MEDIUM
- **Why deferred:** By design — creator needs to use the org immediately. Super-admin approval gate exists (`admin_approved` field).
- **Fix:** Document the flow. Consider blocking public visibility until `admin_approved = true`.

### #15 Missing empty/error states on some screens

- **Risk:** MEDIUM (UX, not security)
- **Why deferred:** Core flows have proper states. Edge cases on less-used screens.
- **Fix:** Audit all screens for loading/empty/error state coverage. Add `SkeletonCard` to remaining list screens.

### #16 Accessibility — 5.5% label coverage

- **Risk:** MEDIUM (compliance)
- **Why deferred:** Not a security issue. Important for inclusivity and App Store compliance.
- **Fix:** Start with high-impact elements: main CTAs, form inputs, navigation buttons. Target 50%+ coverage in first pass.

### #17 Fire-and-forget API calls without user feedback

- **Risk:** LOW
- **Why deferred:** Non-critical operations (notification channel setup, Sentry init, deep link handling).
- **Fix:** Add error toasts for user-facing operations. Use `ErrorToast` component (exists but unused).

### #18 No Apple IAP server-side webhook for subscription renewals

- **Risk:** MEDIUM
- **Why deferred:** Client-side restore flow (`useIAP.ts`) re-validates receipts on every app launch.
- **Fix:** Implement Apple Server Notifications v2. Handle `DID_RENEW`, `DID_FAIL_TO_RENEW`, `EXPIRED`, `REFUND` events server-side.
