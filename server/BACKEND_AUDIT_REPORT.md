# VarsityHub Mobile Server — Backend Security Audit Report

**Date:** March 17, 2025  
**Scope:** `VarsityHubMobile/server/` (backend-only)

---

## Overall Grade: **B**

The server demonstrates solid security foundations: consistent auth middleware, widespread Zod validation, ownership checks on sensitive operations, and good use of `sanitizeUser`. Several gaps remain around validation coverage, rate limiting, error metadata exposure, and a few IDOR/authorization edges.

---

## 1. Route Inventory & Auth Middleware

### Summary Table

| Route Prefix | Auth | Verified | Onboarded | Admin | Notes |
|--------------|------|----------|-----------|-------|-------|
| `/auth/*` | Mixed | — | — | — | Login/register public; /me, /logout, /password/* requireAuth |
| `/me`, `/me/*` | requireAuth | — | — | — | Mounted at app level |
| `/users` | Mixed | — | — | — | GET /, /:id/ban, /:id/unban, /:id/full, /:id/export → requireAdmin |
| `/users/:id/*` | Mixed | — | — | — | Public: /:id, /:id/posts, /:id/interactions, /:id/teams; follow/block requireAuth |
| `/users/me/*` | requireAuth | — | — | — | export, follow-requests |
| `/users/lookup` | requireAuth | — | — | — | userLookupLimiter |
| `/users/search/mentions` | requireAuth | — | — | — | mentionsSearchLimiter |
| `/teams` | Mixed | — | — | — | POST /, /create → requireVerified, requireOnboarded |
| `/teams/:id` | Mixed | — | — | — | PUT, DELETE → requireVerified, requireOnboarded |
| `/organizations` | Mixed | — | — | — | POST /, /create → requireAuth; PATCH → requireAuth, requireOnboarded |
| `/posts` | Mixed | — | — | — | POST, PATCH, DELETE → requireVerified/requireOnboarded |
| `/events` | Mixed | — | — | — | POST, PUT approve/reject, PATCH → requireVerified, requireOnboarded |
| `/payments` | Mixed | — | — | — | Webhook raw; checkout/subscribe → requireVerified, paymentLimiter |
| `/admin` | requireVerified + requireAdmin | ✓ | — | ✓ | All admin routes |
| `/ads` | requireVerified, requireOnboarded | ✓ | ✓ | — | Submit-for-approval: requireAuth, requireVerified |
| `/search` | authMiddleware (optional) | — | — | — | Public search |
| `/geocoding` | requireAuth / requireAdmin | — | — | — | /location, /autocomplete → requireAuth; batch/cache → requireAdmin |
| `/reports` | requireAuth | — | — | — | reportLimiter |
| `/support` | requireAuth | — | — | — | No rate limiter |
| `/team-invites` | requireAuth | — | — | — | inviteLimiter |
| `/team-memberships` | requireAuth, requireOnboarded | — | ✓ | — | requirePlan('rookie') on POST |
| `/test-notifications` | requireAdmin | — | — | ✓ | Dev only (NODE_ENV !== 'production') |
| `/test-emails` | requireAdmin | — | — | ✓ | Dev only or ALLOW_TEST_EMAILS |

### Missing Guards

| Route | File:Line | Issue |
|-------|-----------|-------|
| `GET /users/username-available` | users.ts:403 | Public; no rate limit — username enumeration |
| `POST /organizations/check-duplicate` | organizations.ts:552 | Raw `req.body` without Zod; no rate limit |
| `GET /organizations/search/nearby` | organizations.ts:521 | Public; no rate limit — heavy geocoding abuse risk |
| `POST /support/contact`, `POST /support/feedback` | support.ts:24,66 | No reportLimiter or equivalent |
| `GET /search` | search.ts:14 | Public; no rate limit — search abuse |

---

## 2. Validation (Zod vs Raw Body)

### Routes Using Zod ✓

- Auth: register, login, google, apple, password reset/change, updateMe, preferences, complete-onboarding, verify/confirm
- Teams: create, update, invite, transfer-ownership
- Organizations: create, update, invite, join-requests, deny
- Posts: create, comments, poll, poll/vote, upvote, bookmark, patch, collage
- Events: create, rsvp, reject, update
- Ads: create, update (with safeBody strip)
- Reports: create
- Support: contact, feedback
- Payments: checkout, subscribe, finalize-session, etc. (partial — see below)
- Geocoding: location, autocomplete

### Routes Using Raw / Partial Validation

| Route | File:Line | Issue |
|-------|-----------|-------|
| `POST /auth/refresh` | auth.ts:211 | `req.body.refreshToken` — type check only, no Zod |
| `POST /auth/test-email` | auth.ts:1515 | `req.body.email` — no Zod (dev only) |
| `POST /teams/:id/transfer-ownership` | teams.ts:1438 | `req.body.new_owner_id` — String check only |
| `POST /organizations/:id/transfer-ownership` | organizations.ts:1255 | `req.body.new_owner_id` — truthy check only |
| `POST /organizations/check-duplicate` | organizations.ts:552 | `req.body` — no schema |
| `POST /organizations/:id/approve`, `/:id/reject` | organizations.ts:1394,1618 | `req.body.reason` — optional string |
| `POST /organizations/:id/coaches/:userId/approve` | organizations.ts:1504 | `req.body.team_id` — no Zod |
| `POST /organizations/:id/coaches/:userId/reject` | organizations.ts:1618 | `req.body.reason` — no Zod |
| `POST /users/:id/ban` | users.ts:49 | `req.body.reason` — no Zod |
| `POST /posts/collage` | posts.ts:1544 | `req.body.title`, `req.body.postIds` — no Zod |
| `POST /team-invites` | team-invites.ts:17 | `(req.body \|\| {}) as any` — no Zod |
| `PATCH /team-memberships/:id` | team-memberships.ts:113 | `req.body.role`, `custom_position` — no Zod |
| `POST /payments/checkout` (body parsing) | payments.ts:366,668 | Partial validation; `plan`, `team_count`, etc. from `req.body` |
| `POST /payments/update-subscription-quantity` | payments.ts:1543 | `req.body.team_count` — number check only |
| `POST /payments/apple/verify-receipt` | payments.ts:2310 | `req.body.receipt`, `productId` — presence only |
| `POST /payments/apple/verify-ad-receipt` | payments.ts:2439 | `req.body.ad_id`, `dates`, `receipts` — array checks |
| `POST /payments/google/verify-purchase` | payments.ts:2673 | `req.body` — partial checks |
| `POST /admin/users/:id/ban` | admin.ts:375 | `req.body.reason`, `severity` — no Zod |
| `POST /admin/users/:id/suspend` | admin.ts:398 | `req.body.days`, `reason` — no Zod |
| `POST /geocoding/batch/games`, `batch/events` | geocoding.ts:135,155 | `req.body.limit` — default 100, no max cap |
| `POST /test-notifications/test/geofence` | test-notifications.ts:103 | `req.body` — type checks only |
| `POST /test-notifications/test/distance` | test-notifications.ts:144 | `req.body` — type checks only |

---

## 3. Authorization & IDOR Risks

### Strong Ownership Checks ✓

- **Teams:** PUT/DELETE/:id — membership (owner/manager/coach) or org owner or admin
- **Organizations:** PATCH/:id — org admin; invite — org admin; join-requests approve/deny — org admin
- **Posts:** DELETE, PATCH — author or coach of post’s team
- **Comments:** DELETE, PATCH — comment author or post owner
- **Ads:** submit-for-approval — `ad.user_id === req.user.id`
- **Users:** follow, block, accept-follow, reject-follow — correct actor checks
- **Events:** approve, reject, PATCH, cancel — creator, team owner, or admin

### Potential IDOR / Authorization Gaps

| Route | File:Line | Risk | Severity |
|-------|-----------|------|----------|
| `GET /users/:id/full` | users.ts:69 | Admin-only; returns email — OK if requireAdmin enforced |
| `GET /users/:id/export` | users.ts:213 | Admin-only CSV export — OK |
| `GET /users/lookup` | users.ts:421 | Returns `email` when lookup by email — intentional for onboarding; rate limited |
| `GET /users/search/mentions` | users.ts:656 | Searches by `email` and returns `email_verified` — possible enumeration; rate limited |
| `GET /organizations/:id/join-requests` | organizations.ts:746 | Returns requester emails — org admin only ✓ |
| `GET /organizations/:id/members` | organizations.ts:262 | Public; includes `user.preferences` — may expose `is_parent`, etc. |
| `GET /teams/:id/members` | teams.ts:306 | requireAuth; no team membership check — any authed user can list members |
| `GET /teams/members/all` | teams.ts:349 | requireAuth + getIsAdmin — OK |
| `POST /teams/:id/transfer-ownership` | teams.ts:1130 | Verifies current owner; new owner must be team member ✓ |
| `POST /organizations/:id/transfer-ownership` | organizations.ts:924 | Verifies current owner; new owner must be org member ✓ |
| `POST /organizations/:id/coaches/:userId/approve` | organizations.ts:1140 | Verifies league owner + pending join request ✓ |

### Notable: Team Members List

`GET /teams/:id/members` (teams.ts:306) requires `requireAuth` but does not verify that the requester is a member of the team. Any authenticated user can list members of any team. **Severity: MEDIUM** (roster visibility).

---

## 4. Data Exposure & Sanitization

### sanitizeUser Usage ✓

- **auth.ts:** All user objects returned to client (login, register, google, apple, /me, update, verify, complete-onboarding) use `sanitizeUser`
- **sanitizeUser** strips: `password_hash`, `email_verification_code`, `email_verification_expires`, `password_reset_code`, `password_reset_expires`, `refresh_token`, `stripe_customer_id`

### Sensitive Field Exposure

| Location | Issue | Severity |
|----------|-------|----------|
| users.ts:436 | `GET /users/lookup` returns `{ id, email, display_name }` when lookup by email | LOW — intentional for onboarding; rate limited |
| users.ts:656 | `GET /users/search/mentions` returns `email_verified` | LOW |
| users.ts:90 | `GET /users/` (admin) returns `email`, `email_verified` | OK — admin only |
| users.ts:72 | `GET /users/:id/full` (admin) returns full user + ads | OK — admin only |
| test-notifications.ts:56 | `token_preview` exposes first 20 chars of push token | LOW — admin only, dev |

### Preferences Exposure

- `GET /users/:id` — returns `preferences` (filtered by profile_private)
- `GET /teams/:id/members` — includes `user.preferences` (jersey_number, is_parent)
- `GET /organizations/:id/members` — includes `user.preferences` (is_parent)

---

## 5. Rate Limiting

### Applied Limiters ✓

- **Auth:** authLimiter (app-level on /auth), passwordResetLimiter, refreshTokenLimiter, verificationLimiter
- **Content:** postCreationLimiter, commentLimiter, interactionLimiter, messageLimiter, groupMessageLimiter
- **Actions:** followLimiter, reportLimiter, inviteLimiter, rsvpLimiter, voteLimiter
- **Resources:** teamCreationLimiter, eventCreationLimiter, gameCreationLimiter, adCreationLimiter
- **Payments:** paymentLimiter (checkout, subscribe, finalize, etc.)
- **Uploads:** uploadLimiter
- **Lookup:** userLookupLimiter, mentionsSearchLimiter
- **Geocoding:** alternativeZipsLimiter (per route in ads)

### Gaps

| Endpoint | Issue | Severity |
|----------|-------|----------|
| `GET /users/username-available` | Public, no limiter | MEDIUM — enumeration |
| `GET /search` | Public, no limiter | MEDIUM — search abuse |
| `POST /support/contact`, `POST /support/feedback` | No limiter | MEDIUM — spam |
| `GET /organizations/search/nearby` | Public, no limiter | MEDIUM — geocoding abuse |
| `POST /organizations/check-duplicate` | No limiter | LOW |
| `POST /geocoding/location`, `GET /geocoding/autocomplete` | requireAuth but no limiter | LOW — API cost abuse |
| `GET /posts`, `GET /events` | Heavy queries, apiLimiter only | LOW — acceptable |

---

## 6. Error Handling

### Strengths ✓

- Centralized `errorHandler` middleware
- AppError, ValidationError, ConflictError, NotFoundError, etc.
- Zod errors mapped to ValidationError
- Prisma P2002, P2025, P2003 handled
- Unknown errors: generic 500, no stack in production
- Development: `message` and `stack` in 500 response

### Gaps

| File:Line | Issue | Severity |
|-----------|-------|----------|
| errorHandler.ts:84-91 | P2002 ConflictError sends `metadata: { target: prismaError.meta?.target }` to client | MEDIUM — schema/column names leaked |
| errorHandler.ts:104-111 | P2003 ValidationError sends `metadata: { field: prismaError.meta?.field_name }` to client | MEDIUM — schema info leaked |
| auth.ts:443 | Apple token error returns `detail: msg` to client | LOW — may leak verification details |
| games.ts:245 | Validation failure logs `body: req.body` | LOW — PII in logs |

**Recommendation:** Do not include Prisma `meta.target` or `meta.field_name` in client-facing error responses. Log them server-side only.

---

## 7. Input Sanitization

### SQL Injection ✓

- Prisma used throughout — parameterized queries
- No raw SQL with user input (except `$queryRaw` with template literals in admin)

### XSS ✓

- `stripHtml` used for post title/content (posts.ts)
- `validateContent` (contentFilter) for profanity/bullying
- Avatar URL restricted to allowed domains (auth updateMeSchema)
- Organization approve/reject HTML: `safeName` escapes `&<>"` (organizations.ts:1020, 1089)

### Regex DoS

- No complex user-controlled regex observed
- Zip code: `^\d{5}$` — safe
- Username: `^[a-z0-9_.]+$` — safe

### Unbounded Arrays

| Location | Issue | Severity |
|----------|-------|----------|
| posts.ts:1544 | `postIds` in collage — `postIds.length` checked, but no max | LOW |
| events.ts:653 | `take: 10000` for RSVP users on event update | LOW — bounded |
| organizations createTeamSchema | `authorized_users` array — no max length in Zod | LOW |
| completeOnboardingSchema | `authorized`, `authorized_users` — `z.array(z.any())` | LOW |

---

## 8. Consistency

### Naming

- Mixed: `error` vs `message` in JSON responses
- Some routes return `{ error: '...' }`, others `{ error: '...', message: '...' }`

### Status Codes

- Generally correct: 200, 201, 400, 401, 403, 404, 409, 429, 500
- Some 500s where 400 might be more appropriate (e.g., validation in payments)

### Error Format

- Most use `{ error: string }` or AppError `toJSON()`
- Inconsistent `issues` vs `details` for validation errors

---

## GAPS Summary (by Severity)

### CRITICAL

- None identified.

### HIGH

| # | File:Line | Description |
|---|-----------|-------------|
| 1 | — | No single critical flaw; aggregate of MEDIUM items |

### MEDIUM

| # | File:Line | Description |
|---|-----------|-------------|
| 1 | errorHandler.ts:84-91, 104-111 | Prisma meta (target, field_name) leaked to client |
| 2 | users.ts:403 | `GET /users/username-available` — public, no rate limit |
| 3 | search.ts:14 | `GET /search` — public, no rate limit |
| 4 | support.ts:24,66 | Support contact/feedback — no rate limit |
| 5 | organizations.ts:521 | `GET /organizations/search/nearby` — no rate limit |
| 6 | teams.ts:306 | `GET /teams/:id/members` — any authed user can list any team |

### LOW

| # | File:Line | Description |
|---|-----------|-------------|
| 1 | organizations.ts:552 | `POST /organizations/check-duplicate` — raw body, no Zod |
| 2 | team-invites.ts:17 | `POST /team-invites` — no Zod |
| 3 | team-memberships.ts:32,113 | `POST`, `PATCH` — no Zod |
| 4 | posts.ts:1544 | `POST /posts/collage` — no Zod |
| 5 | geocoding.ts:18,61 | `/location`, `/autocomplete` — no rate limit |
| 6 | auth.ts:443 | Apple token error exposes `detail` |

---

## Recommendations

1. **Error handler:** Remove `metadata.target` and `metadata.field_name` from client responses for Prisma errors; log them server-side only.
2. **Rate limiting:** Add limiters to:
   - `GET /users/username-available` (e.g., 30/min per IP)
   - `GET /search` (e.g., 60/min per user or IP)
   - `POST /support/contact`, `POST /support/feedback` (reuse reportLimiter or similar)
   - `GET /organizations/search/nearby` (e.g., 30/min per IP)
   - `POST /geocoding/location`, `GET /geocoding/autocomplete` (per-user)
3. **Validation:** Add Zod schemas for:
   - `POST /team-invites`, `PATCH /team-memberships/:id`
   - `POST /organizations/check-duplicate`
   - `POST /posts/collage`
   - Transfer-ownership bodies (`new_owner_id`)
   - Admin ban/suspend bodies
4. **Authorization:** Restrict `GET /teams/:id/members` to team members, org admins, or platform admins.
5. **Array limits:** Add `.max()` to `authorized_users`, `postIds`, and similar arrays in Zod schemas.
6. **Consistency:** Standardize error response shape (`error`, `message`, `issues`/`details`) across routes.

---

## STRONG Areas

- **Auth:** JWT verification, banned/suspended checks, password change invalidation, COPPA handling
- **Validation:** Most routes use Zod; content filter and stripHtml for UGC
- **Authorization:** Ownership checks on teams, orgs, posts, events, ads
- **Data exposure:** sanitizeUser used consistently; sensitive fields stripped
- **Rate limiting:** Auth, payments, uploads, reports, invites, and many content actions covered
- **Infrastructure:** Helmet, CORS, trust proxy, Stripe webhook signature verification
