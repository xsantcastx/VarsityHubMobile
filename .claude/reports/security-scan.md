# Security Scan — VarsityHub Mobile

**Scan date:** 2026-07-11
**Repo:** `/Users/varsityhub/Code/VarsityHubMobile`
**Routine:** `.claude/scheduled-tasks/security-scan/SKILL.md`

## Summary

| Severity      | Count |
| ------------- | ----- |
| Critical      | 0     |
| High          | 0     |
| Medium        | 0     |
| Low           | 1     |
| Informational | 2     |

Overall posture is **strong**. All seven audit categories passed with no exploitable
findings. Secrets are gitignored and untracked, tokens use SecureStore, raw SQL is
parameterized and absent from route handlers, auth/admin gates are enforced
server-side, uploads are size/type-validated, and rate limiting is comprehensive.
The one Low and two Informational items below are hardening notes, not vulnerabilities.

---

## 1. Exposed secrets — PASS

- No hardcoded API keys, tokens, or passwords found in tracked `.ts/.tsx/.js` source
  (`git grep` for `AKIA…`, `sk_live_…`, `AIza…`, `xoxb-…`, `BEGIN PRIVATE KEY`,
  and `key/secret/password = "literal"` patterns all returned clean).
- `.env`, `server/.env`, and `service-account-key.json` are **not tracked** in git
  (`git ls-files --error-unmatch` fails; `git check-ignore` confirms each is ignored).
- `.gitignore` covers `.env*`, `service-account-key.json`, `*-service-account*.json`,
  `*.jks/*.p8/*.p12/*.key`, and Android keystores.
- Defense-in-depth controls in place: `.github/workflows/secret-scan.yml`,
  `snyk-security.yml`, `.gitleaks.toml`, `.husky/pre-commit` runs `gitleaks protect`,
  and `npm run verify:secrets` (`scripts/check-secret-literals.js`).

### LOW-1: Live service-account private key present in working tree

`service-account-key.json` at the repo root contains a real GCP service-account
`private_key` (`"type":"service_account"`, `BEGIN PRIVATE KEY`). It is correctly
gitignored and documented in CLAUDE.md as needed for Android Play submissions, but it
sits in plaintext on disk at the project root, where it is exposed to accidental
copy/backup/archive inclusion. **Recommendation:** store it outside the repo tree
(e.g. `~/.config`) and reference it by absolute path, or inject it at CI time.

---

## 2. XSS vectors — PASS

- No `dangerouslySetInnerHTML`, `eval(`, or `new Function(` in `app/`, `components/`,
  `utils/`, `hooks/`, or `lib/`.
- No React Native `WebView` usage anywhere in the client (no `injectedJavaScript`,
  no `source={{ html }}` HTML injection surface).

---

## 3. SQL injection — PASS

- **No raw SQL in `server/src/routes/`.** The only `$queryRaw` in a request path is a
  `SELECT 1` health probe (`index.ts:340`).
- `$queryRaw`/`$executeRaw` usages in `server/src/lib/*` (`organizationState.ts`,
  `teamState.ts`, `founderMetrics.ts`, `organizationAuthorization.ts`,
  `coachStateDriftProbe.ts`, etc.) are **tagged template literals** — Prisma
  parameterizes interpolated values automatically.

### INFO-1: `$executeRawUnsafe`/`$queryRawUnsafe` in `dbBackupSync.ts`

`server/src/lib/dbBackupSync.ts` builds INSERT/SELECT strings that interpolate
**table and column identifiers** (e.g. `dbBackupSync.ts:273,291,292`). Row values are
passed as bound `$1,$2,…` parameters (safe). The interpolated identifiers are derived
from the Postgres schema/`information_schema`, **not from user input**, and this is an
internal replica-sync job with no route exposure — so there is no injection vector
today. Noted only because `RawUnsafe` + string-built SQL is a pattern worth keeping
identifier-allowlisted if this code is ever refactored to accept external names.

---

## 4. Auth bypass — PASS

- Global `authMiddleware` (`app.ts:259`) is soft-auth: it hydrates `req.user` from a
  verified JWT but does **not** enforce; enforcement is per-route via `requireAuth`.
- Protected route groups each apply `requireAuth` at the router level (verified refs in
  `teams`, `organizations`, `payments`, `posts`, `users`, `messages`, `ads`, `events`,
  `games`, `group-chats`, `uploads`, `notifications`, `follows`, `rsvps`, etc.).
- Routers with zero `requireAuth` are correctly public/read-only or otherwise gated:
  `health`, `og`, `search`, `well-known`, `publicSite`, `publicAppHandoff`,
  `shareLanding`, `sendgrid-webhook` (public); `highlights` (single GET, read-only);
  `test-emails`/`test-notifications` (admin-gated at mount, `app.ts:410-411`);
  `admin` (see below).
- **Admin routes:** gated by `requireAdmin` (`middleware/requireAdmin.ts`), which
  returns 401 when `req.user` is absent, 403 when email is unverified or not an admin.
  The four `/admin/coaches/:id/approve|reject` routes use `authMiddleware` +
  `handleCoachReview`, the documented self-gating email-link handler (`admin.ts:37`
  allowlists it). `/admin/wipe-database` is double-gated (`requireVerified` +
  `requireAdmin` + `X-Wipe-Token`) and only registered when `WIPE_TOKEN` is set.

---

## 5. Input validation gaps — PASS

- **File uploads** (`routes/uploads.ts`): multer enforces a 25 MB `fileSize` limit and a
  `fileFilter` allowlist on both MIME type and extension (`IMAGE_MIMETYPES`/
  `VIDEO_MIMETYPES` + `*_EXTENSIONS`); the proxy path additionally rejects video and
  caps at 150 MB matching the client constant.
- **Zod-validated** bodies in auth/teams/orgs/payments/posts/ads and others.
- Routers without Zod are **GET or path-param-only mutations**: `programs` follow/
  unfollow, `notifications/:id/read`, `consent/:token`, `feed`, `search`, `follows`,
  `rsvps` — each coerces params with `String(req.params.*)` and is behind `requireAuth`
  (where non-public). No unvalidated free-form body reaches a handler.

### INFO-2: Mixed validation strategy

Validation is split between Zod schemas (auth/teams/orgs) and manual `String()`/`Number()`
coercion (param-only routes). This is acceptable given the routes involved carry no
complex bodies, but a consistent per-route input schema would make coverage auditable.

---

## 6. Insecure data storage — PASS

- JWT **access and refresh tokens** are stored via `expo-secure-store`
  (`SecureStore.setItemAsync`/`getItemAsync`) on native and `sessionStorage` on web
  (`api/auth.ts:166-222`). On fresh install, stale Keychain tokens are proactively
  cleared (`api/auth.ts:40-67`).
- `AsyncStorage` is used **only** for non-sensitive flags: onboarding-complete markers
  and the fresh-install sentinel (`context/AuthProvider.tsx:509-534,801-803`,
  `api/auth.ts:51-60`). No tokens/passwords/secrets in AsyncStorage.

---

## 7. Rate limiting — PASS

- `middleware/rateLimiters.ts` defines a comprehensive Redis-backed limiter set
  (auth, passwordReset, refreshToken, verification, oauth, postCreation, message,
  upload, payment, admin, search, default, etc.).
- **Critical auth endpoints are covered:**
  - `/auth/*` mounted behind `authLimiter` (`app.ts:367`).
  - `/register` — `authLimiter` + per-email `checkAuthRateLimit` (`auth.ts:614`).
  - `/login` — `authLimiter` + per-account failed-login lockout (`auth.ts:258-300`).
  - `/password/forgot` — `passwordResetLimiter` (`auth.ts:1770-1771`).
  - `/auth/refresh` — `refreshTokenLimiter`; OAuth paths — `oauthLimiter`.
- `defaultApiLimiter` is applied to every mounted API route via `mountApiRoutes`.
- Rate limiting can only be disabled with `DISABLE_RATE_LIMITING=1` (never set in
  Railway per project constraints).

---

## Recommendations (priority order)

1. **LOW-1** — Move `service-account-key.json` out of the repo working tree and
   reference it by absolute path or inject at CI time.
2. **INFO-1** — If `dbBackupSync.ts` is ever refactored, keep table/column identifiers
   on an explicit allowlist so `RawUnsafe` string-building can never accept external names.
3. **INFO-2** — Consider a uniform per-route input schema for param-only mutation routes
   to make validation coverage mechanically auditable.
