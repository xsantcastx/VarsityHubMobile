# VarsityHub Mobile — Security Audit

**Date:** February 22, 2025  
**Scope:** Exposed secrets, rate limiting, JWT validation

---

## Executive Summary

This audit covers three security pillars:
1. **Exposed API keys, secrets, credentials** in frontend bundle and config
2. **Rate limiting** on sign up, sign in, and email verification endpoints
3. **JWT validation** on all authenticated API endpoints

---

## 1. Secrets & Credentials Audit

### 1.1 CRITICAL — Hardcoded Secrets (Must Fix)

| Location | Issue | Recommendation |
|----------|-------|----------------|
| `app.json` | ~~Google Maps API key hardcoded~~ | ✅ **FIXED** — Now uses `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` via `app.config.js` |
| `server/scripts/stripe/create_stripe_prices.js` | ~~Stripe **secret** key hardcoded~~ | ✅ **FIXED** — Now uses `STRIPE_SECRET_KEY` env var |
| `server/.env.production.template` | ~~Contains real Stripe test key~~ | ✅ **FIXED** — Replaced with placeholder |
| `server/docs/RAILWAY_DEPLOYMENT_GUIDE.md` | ~~Contains real Stripe test key~~ | ✅ **FIXED** — Replaced with placeholder |
| `.docs/architecture/VETERAN_BILLING_*.md` | ~~Production Stripe keys~~ | ✅ **FIXED** — Replaced with placeholders; see `.docs/SECURITY_KEYS_ROTATION.md` — **rotate exposed keys** |

### 1.2 Moderate — Config in app.json

| Location | Issue | Recommendation |
|----------|-------|----------------|
| `app.json` → `extra` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ADMIN_EMAILS`, `EXPO_PUBLIC_GOOGLE_*` client IDs hardcoded | Prefer EAS Secrets / env at build time; `EXPO_PUBLIC_*` values get baked into the bundle |
| `app.json` | `NSAllowsArbitraryLoads: true` (iOS) | Allows all HTTP connections; consider restricting to specific domains or removing if possible |

### 1.3 Low — OAuth Client IDs

- Google OAuth client IDs in `app.json` extra are **intended to be public** (OAuth client IDs are not secrets). Ensure they are restricted by bundle ID / package name in Google Cloud Console.
- Stripe **publishable** keys (`pk_live_`, `pk_test_`) are designed to be public.

### 1.4 References to Rotate (If Exposed)

If any of the following were ever committed or shared:
- `sk_live_51RtgdG...` (from VETERAN_BILLING docs) — **rotate in Stripe Dashboard**
- `AIzaSyDKZL34B2z-qVvfWKfLUVsAL7I_jCXbGFA` — restrict in Google Cloud (bundle ID, API restrictions); consider regenerating if exposed broadly
- `sk_test_51S5t0k...` — rotate if this repo is public

---

## 2. Rate Limiting Audit

### 2.1 Current State

| Endpoint | Rate Limiter | Limits |
|----------|--------------|--------|
| `POST /auth/register` | `registrationLimiter` | 3/hour per IP |
| `POST /auth/login` | `authLimiter` | 5/15min per IP+email, skip successful |
| `POST /auth/google` | **None** | ❌ |
| `POST /auth/apple` | **None** | ❌ |
| `POST /auth/password/forgot` | `passwordResetLimiter` | 3/hour |
| `POST /auth/password/reset` | `passwordResetLimiter` | 3/hour |
| `POST /auth/verify/request` | Custom in-memory | 1/30s, 5/hour per user |
| `POST /auth/verify/confirm` | Brute force protection | 5 failed → 15min lockout |

### 2.2 Gaps

- **`/auth/google`** and **`/auth/apple`** have **no rate limiting**. An attacker could spam token validation attempts or create accounts.
- **Action:** Add an OAuth limiter (e.g., 10 requests/15min per IP) to both endpoints.

---

## 3. JWT Validation Audit

### 3.1 Architecture

- **authMiddleware** runs globally on every request (`app.use(authMiddleware)`).
- It parses `Authorization: Bearer <token>`, calls `verifyJwt(token)` (which uses `jwt.verify` with `JWT_SECRET`), and sets `req.user` only if the token is valid.
- **requireAuth** checks `req.user` and returns 401 if missing.
- **verifyJwt** returns `null` for invalid/expired tokens, so `req.user` stays undefined.

### 3.2 Endpoints Returning User Data

| Route | Protection | JWT Verified? |
|-------|------------|---------------|
| `GET /me` | `req.user` check in handler | ✅ |
| `PATCH /me`, `PATCH /me/preferences` | `req.user` check | ✅ |
| `POST /me/complete-onboarding` | `req.user` check | ✅ |
| `/users/*` | `requireAuth` | ✅ |
| `/posts/*` (create, upvote, comment, etc.) | `requireAuth` | ✅ |
| `/notifications/*` | `requireAuth` | ✅ |
| `/messages/*`, `/group-chats/*` | `requireAuth` | ✅ |
| `/ads` GET (mine=1 or default) | `req.user` check, returns 401/[] | ✅ |
| `/ads` POST | `requireVerified` | ✅ |
| `/highlights` GET | Public endpoint; uses `req.user` only for ranking boost | ✅ (no user data returned without token) |
| `/games`, `/events`, `/teams`, `/organizations` | Mix of public and `requireAuth` | ✅ where protected |

### 3.3 Conclusion

- All authenticated endpoints either use `requireAuth` or explicitly check `req.user`.
- JWT is verified server-side via `jwt.verify` before any user data is returned.
- **No endpoint returns user-specific data without validating the JWT first.**

---

## 4. Action Plan

### Phase 1 — Immediate (Before Real Users)

1. **Remove hardcoded Stripe secret** from `server/scripts/stripe/create_stripe_prices.js`; use `process.env.STRIPE_SECRET_KEY`.
2. **Add rate limiting** to `POST /auth/google` and `POST /auth/apple`.
3. **Rotate** any keys that appear in `.docs/architecture/VETERAN_BILLING_*.md` if they were ever real production keys.
4. **Replace** hardcoded keys in `server/.env.production.template` and `server/docs/RAILWAY_DEPLOYMENT_GUIDE.md` with placeholders.

### Phase 2 — Before Production

1. Move Google Maps API key from `app.json` to env (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) via `app.config.js` and EAS Secrets.
2. Review `NSAllowsArbitraryLoads`; restrict or remove if not required.
3. Ensure `JWT_SECRET` is ≥32 characters and not `dev-secret-change-me` in production (already validated in `jwt.ts`).

---

## Appendix: Files Modified / To Modify

- `server/scripts/stripe/create_stripe_prices.js` — use env for Stripe key
- `server/src/routes/auth.ts` — add OAuth rate limiter to `/google` and `/apple`
- `app.json` — (Phase 2) refactor to use app.config.js for Maps key
