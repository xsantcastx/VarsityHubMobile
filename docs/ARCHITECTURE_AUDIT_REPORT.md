# VarsityHubMobile — Comprehensive System Architecture Audit

**Date:** March 17, 2025  
**Scope:** Security gaps, validation mismatches, architectural inconsistencies  
**Methodology:** System mapping, gap identification, severity assessment

---

## Overall Grade: **B-** (Good foundation, notable gaps)

The codebase has solid auth middleware, rate limiting, and structured validation in many areas. Critical issues center on one IDOR, validation schema drift, and inconsistent authorization patterns across interconnected features.

---

## 1. STRONG AREAS (No Action Required)

| Area | Details |
|------|---------|
| **Auth middleware** | `requireAuth`, `requireVerified`, `requireOnboarded`, `requireAdmin` consistently applied; JWT + refresh tokens; `authMiddleware` populates `req.user` |
| **Rate limiting** | `authLimiter`, `apiLimiter`, `paymentLimiter`, `adCreationLimiter`, `inviteLimiter`, etc. on sensitive endpoints |
| **Ad ownership checks** | GET/PUT/DELETE `/ads/:id` verify `ad.user_id === req.user.id` or admin; submit-for-approval checks ownership |
| **Payment authorization** | Ad checkout verifies `ad.user_id === req.user?.id`; finalize-session validates `metadata.user_id === req.user.id` |
| **Team/org permissions** | Teams: owner/manager/coach checks for update, delete, invite; Orgs: membership + league owner checks |
| **ID generation** | Prisma `@default(cuid())` — non-predictable IDs |
| **Stripe webhook** | Raw body preserved for signature verification; event deduplication via `ProcessedStripeEvent` |
| **CORS** | Explicit origins; no wildcard in production |
| **Content filtering** | `validateContent` on posts, team names, events |
| **Admin gating** | `getIsAdmin` / `isEmailAdmin` for admin-only views (ads `all=1`, users list, etc.) |

---

## 2. NEEDS FIXING (Ranked by Priority)

### CRITICAL

| # | Issue | Location | Severity | Recommendation |
|---|------|----------|----------|----------------|
| 1 | **IDOR: Ad reservations** — `GET /ads/reservations?ad_id=X` returns reservations for any ad without verifying the ad belongs to the authenticated user. Any user can enumerate another user's ad reservation dates. | `server/src/routes/ads.ts:460-489` | CRITICAL | When `ad_id` is provided, verify `ad.user_id === req.user.id` (or admin) before returning. Add `where: { ad: { user_id: req.user.id } }` when filtering by ad_id. |

### HIGH

| # | Issue | Location | Severity | Recommendation |
|---|------|----------|----------|----------------|
| 2 | **banner_fit_mode schema mismatch** — Backend Zod accepts `cover \| contain \| fill`; Prisma comment and frontend use `letterbox \| fill \| stretch`. Frontend `BannerAd.tsx` displays `letterbox` but backend would reject it if sent. | `server/src/routes/ads.ts:20,32` vs `components/BannerAd.tsx:20` vs `server/prisma/schema.prisma:486` | HIGH | Align schemas: either (a) add `letterbox` and `stretch` to backend Zod and map to display, or (b) standardize on `cover/contain/fill` everywhere and update frontend normalization. |
| 3 | **Organization role `administrator`** — `events.ts` checks `role: { in: ['owner', 'manager', 'administrator'] }` but Prisma `OrganizationMembership` schema only defines `owner \| manager \| member`. `administrator` never matches. | `server/src/routes/events.ts:36` vs `server/prisma/schema.prisma:746` | HIGH | Add `administrator` to org role if intended, or remove from `isOrgAdmin` and rely on `owner`/`manager`. |
| 4 | **Ad GET /reservations without ad ownership** — Same root cause as #1; when `ad_id` is passed, results are not scoped to the requester's ads. | `server/src/routes/ads.ts:460-489` | HIGH | Same fix as #1. |

### MEDIUM

| # | Issue | Location | Severity | Recommendation |
|---|------|----------|----------|----------------|
| 5 | **ZIP code validation inconsistency** — User preferences `zip_code` (auth/me) accepts `min(2).max(20)`; ads/organizations require `^\d{5}$`. Frontend `zip-code.tsx` uses `generic = /^[A-Za-z0-9\s-]{3,10}$/` allowing non-US formats. | `app/settings/zip-code.tsx:14-17` vs `server/src/routes/ads.ts:22` vs `server/src/routes/auth.ts:1106` | MEDIUM | Decide: (a) user zip is US-only → align frontend to `^\d{5}$`, or (b) support international → keep generic for profile, but ads remain US-only and validate at ad creation. |
| 6 | **Teams GET /:id/members unauthenticated** — Anyone can list team members (emails, display names). May be intentional for public teams but exposes PII. | `server/src/routes/teams.ts:306-347` | MEDIUM | Consider `requireAuth` or restrict returned fields (e.g., no email) for non-members. |
| 7 | **Ad radius ignored** — Backend always uses `radius: 9` (fixed 9km); Zod schema has `radius: z.number().optional()` but value is never used. | `server/src/routes/ads.ts:23,82` | MEDIUM | Remove `radius` from ad create schema or document that it's fixed; avoid confusion. |
| 8 | **Ad schema vs Prisma comment** — Prisma comment says `letterbox \| fill \| stretch`; Zod says `cover \| contain \| fill`. Stored values may not match Zod. | `server/src/routes/ads.ts:20` vs `server/prisma/schema.prisma:486` | MEDIUM | Resolve as part of #2. |

### LOW

| # | Issue | Location | Severity | Recommendation |
|---|------|----------|----------|----------------|
| 9 | **OrgId regex frontend** — `organization.tsx` uses `/^[a-zA-Z0-9_-]{1,128}$/`; CUIDs are 25 chars. Overly permissive length. | `app/(tabs)/organization.tsx:90` | LOW | Tighten to CUID-like pattern if needed, or keep permissive for future ID formats. |
| 10 | **Dev-only routes in production** — `dev-set-logo`, `test-notifications`, `test-emails` are gated by `NODE_ENV !== 'production'` but worth verifying in deployment. | `server/src/routes/teams.ts:501-512`, `server/src/app.ts:264-268` | LOW | Confirm `NODE_ENV` is set correctly in production. |

---

## 3. Architectural Inconsistencies

| Feature | Pattern | Inconsistency |
|---------|----------|---------------|
| **Auth** | Custom JWT + refresh; `requireAuth` / `requireVerified` / `requireOnboarded` | Consistent. Some routes use `requireAuth` only where `requireVerified` might be safer (e.g., payments use `requireVerified`; Apple IAP uses `requireAuth` by design). |
| **Payments** | Stripe + IAP; `requireVerified` on checkout; `requireAuth` on IAP (Apple/Google don't require verified email) | Intentional split; documented. |
| **Teams** | `requireVerified` + `requireOnboarded` + `requirePlan('rookie')` on create; role checks for update/delete | Coach role derived from preferences + DB memberships; `administrator` in org check doesn't exist in schema. |
| **Organizations** | `requireAuth` on most; `requireOnboarded` on sensitive; `requireAdmin` for admin views | Duplicate create paths: `POST /` and `POST /create` with different schemas. |
| **Ads** | `requireVerified` + `requireOnboarded` on create; owner/admin checks on CRUD | IDOR on reservations (#1). `banner_fit_mode` schema drift. |

---

## 4. Validation Summary

| Domain | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Email | `formUtils.validateEmail` | Zod `.email()` | Aligned |
| Password | `formUtils.validatePassword` (letter + number) | `passwordStrength` in auth | Aligned |
| Username | `formUtils.validateUsername` `/^[a-z0-9_.]+$/` | auth `z.string().regex(/^[a-z0-9_.]+$/)` | Aligned |
| ZIP (ads/orgs) | `^\d{5}$` in submit-ad | Zod `^\d{5}$` | Aligned |
| ZIP (user prefs) | `zip-code.tsx` generic regex | preferences `z.record(z.any())` — no validation | Mismatch (see #5) |
| banner_fit_mode | `rotate \| fill \| stretch` → normalized | Zod `cover \| contain \| fill` | Mismatch (see #2) |

---

## 5. Bottom Line Recommendation

1. **Immediate (CRITICAL):** Fix the ad reservations IDOR in `ads.ts` by enforcing ad ownership when `ad_id` is provided.
2. **Short-term (HIGH):** Resolve `banner_fit_mode` and org `administrator` role inconsistencies.
3. **Medium-term (MEDIUM):** Align ZIP validation across user preferences and ads; consider auth for team members list.
4. **Ongoing:** Add shared Zod schemas (e.g., in a `shared/` or `server/schemas/` package) for ad, org, and user models to prevent frontend/backend drift.

---

## 6. File:Line Quick Reference

| File | Line(s) | Issue |
|------|---------|-------|
| `server/src/routes/ads.ts` | 460-489 | IDOR: reservations not scoped to user's ads |
| `server/src/routes/ads.ts` | 20, 32 | banner_fit_mode Zod vs Prisma/frontend |
| `server/src/routes/ads.ts` | 82 | radius ignored, always 9 |
| `server/src/routes/events.ts` | 36 | `administrator` role not in schema |
| `server/prisma/schema.prisma` | 486 | banner_fit_mode comment: letterbox\|fill\|stretch |
| `app/settings/zip-code.tsx` | 14-17 | Generic zip allows non-US |
| `app/(tabs)/organization.tsx` | 90 | OrgId regex 1-128 chars |
| `server/src/routes/teams.ts` | 306-347 | GET /:id/members unauthenticated |
| `server/src/routes/teams.ts` | 501-512 | dev-set-logo (dev only) |
