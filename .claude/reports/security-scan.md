---
# VarsityHub Mobile — Security Scan Report

**Date:** 2026-04-01
**Scan type:** Automated scheduled audit
**Scope:** Full codebase — client (React Native/Expo) + server (Express/Prisma)

---

## Summary

| Severity | Count |
|----------|---------|
| HIGH     | 1     |
| MEDIUM   | 3     |
| LOW      | 2     |
| PASS     | 10+   |

---

## Findings
### HIGH

#### 1. Google Maps API Key Hardcoded in Version-Controlled Config Files
**Files:** `app.json:172`, `eas.json:93`
**Key:** `AIzaSyDhct-4heIbBF1w9l_64SC8VafmyQWWQlg`

The Google Maps API key is hardcoded in both `app.json` and `eas.json`, both committed to git. Anyone with repo access (or who forks it) obtains this key. If the key has no API restrictions or quota limits in Google Cloud Console, an attacker could make geocoding/Maps API requests and run up costs.

**Recommendation:** Restrict the key in Google Cloud Console to the required APIs and app bundle IDs/SHA fingerprints. Rotate the key and move it to EAS Secrets (`eas secret:create`) rather than hardcoding in `app.json`. The `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` env var pattern already exists; use it via EAS.

---

### MEDIUM

#### 2. Stripe Live Publishable Key Hardcoded in Version-Controlled Config
**Files:** `app.json:171`, `eas.json:93`
**Key prefix:** `pk_live_51Rtgd...`

The Stripe publishable key is hardcoded in committed files. Publishable keys cannot initiate charges or access account data — they are intentionally public-facing for client-side tokenization. However, hardcoding a live key in version control means it appears in git history and any forks. A compromised publishable key can be used for card testing (carding) against the Stripe account, potentially triggering fraud flags.

**Recommendation:** Move to EAS Secrets and remove the literal value from app.json/eas.json. Restrict the key to the app bundle ID in the Stripe dashboard.

---

#### 3. `$executeRawUnsafe` Usage in Admin Route
**File:** `server/src/routes/admin.ts:746-772`

The `/admin/wipe-production` endpoint uses 30+ `prisma.$executeRawUnsafe(...)` calls. All statements are static string literals with no user input interpolated, so there is no current SQL injection risk. However, `$executeRawUnsafe` bypasses Prisma parameterization. If a future maintainer adds user-controlled values without using tagged template literals, injection would result.

**Recommendation:** Replace with `prisma.$executeRaw` tagged template literals which enforce parameterization by design.

---

#### 4. `/auth/upgrade-to-coach` Missing Explicit `requireAuth` Middleware
**File:** `server/src/routes/auth.ts:865`

`requireVerified` internally checks `if (!req.user) return res.status(401)`, so this endpoint IS functionally protected. However, the absent explicit `requireAuth` guard is inconsistent — all other mutating auth routes chain `requireAuth` before `requireVerified`. This is easy to misread in code review and fragile if `requireVerified` is ever refactored.

**Recommendation:** Add `requireAuth as any` before `requireVerified as any` for consistency and defense-in-depth.

---

### LOW

#### 5. Known Test Password for Demo Account in Committed Script
**File:** `server/scripts/create-demo-account.ts:15`

A known password for `demo@varsityhub.app` is committed to the repo. If this account exists in production and the password was never rotated after running the script, it is a known-credential account.

**Recommendation:** Verify the demo account password has been rotated. Load passwords from environment variables in dev scripts to avoid committing any credentials.

---

#### 6. `redis.eval()` Flagged — Not a JavaScript eval() Risk
**Files:** `server/src/lib/distributedLock.ts:82,90`, `server/src/lib/redisRateLimit.ts:138`

All `eval(` matches are `redis.eval()` (Redis Lua script evaluation) using static Lua scripts and fully parameterized arguments. No JavaScript `eval()` with user-controlled input exists anywhere.

**No action required** — documented for completeness.

---

## Audit Passes (No Issues Found)

| Area | Result | Notes |
|------|--------|-------|
| Token storage | PASS | JWT + refresh tokens use expo-secure-store (iOS Keychain / Android Keystore). AsyncStorage only used for non-sensitive state (onboarding flags, recent searches). |
| XSS vectors | PASS | No dangerouslySetInnerHTML, no user-controlled eval(), no WebViews found. |
| SQL injection | PASS | The one $queryRaw with a variable (gameStories.ts:174) uses Prisma tagged template literal (parameterized), plus an alphanumeric regex guard. |
| Auth bypass | PASS | authMiddleware applied globally (app.ts:177). All sensitive routes chain requireAuth / requireVerified / requireAdmin. requireAdmin re-checks DB for admin email + verification. |
| Test routes in production | PASS | /test-notifications and /test-emails only mounted when NODE_ENV != production (app.ts:287-288). |
| Admin route protection | PASS | adminRouter applies adminLimiter globally. Destructive routes additionally require requireVerified + requireAdminMiddleware. Wipe endpoint requires x-confirm-wipe header. |
| Login rate limiting | PASS | Two layers: parent app limiter (300 req/15min per IP) + per-email Redis counter (5 attempts/15min). |
| Register rate limiting | PASS | Same dual layer as login. |
| Password reset rate limiting | PASS | /password/forgot uses per-email Redis counter. /password/reset has failure-based lockout (5 failures = 15min lock). |
| OAuth rate limiting | PASS | /auth/google and /auth/apple use oauthLimiter (10 req/15min per IP). |
| File upload validation | PASS | MIME type + extension cross-check whitelist, 100MB limit for media, 5MB for avatars. Rate limiting applied. |
| .gitignore coverage | PASS | .env, *.p8, *.p12, *.key, *.pem, *.keystore, service-account-key.json, credentials.json all ignored. |
| Input validation | PASS | All auth endpoints validated with Zod schemas before any processing. |

---

## Recommendations by Priority

1. Rotate and restrict the Google Maps API key — already in git history; restrict in Google Cloud Console immediately.
2. Rotate and restrict the Stripe publishable key — lower urgency, but clean up git exposure.
3. Move both keys to EAS Secrets to prevent future commits.
4. Refactor $executeRawUnsafe to $executeRaw tagged templates in admin.ts (safety by construction).
5. Add explicit requireAuth to /upgrade-to-coach for consistency.
6. Verify demo account password has been rotated post-script.
---
