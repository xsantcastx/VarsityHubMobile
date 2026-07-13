# Security Audit Fixes — 2026-03-17

**Scope:** Audit findings from VarsityHub Security Audit + Comprehensive Architecture Audit

---

## Fixes Applied

### HIGH Priority

| #   | Issue                                   | Fix                                                                     | File                                                |
| --- | --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ----- | ---------- |
| 1   | **DELETE /me no password confirmation** | Require `password` in body; verify with bcrypt; reject if invalid       | `users.ts`, `api/user.ts`, `app/settings/index.tsx` |
| 2   | **preferences.plan self-modifiable**    | Strip `plan` from PATCH; remove from schema; client cannot set          | `auth.ts`                                           |
| 3   | **Team limits ignores payment_pending** | Use `plan = payment_pending ? 'rookie' : (prefs.plan                    |                                                     | ...)` | `teams.ts` |
| 4   | **Ad slot count inconsistency**         | Add `pending_approval` to checkout slot check (align with PaymentSheet) | `payments.ts`                                       |

### MEDIUM Priority

| #   | Issue                                             | Fix                                                                       | File                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| 5   | **POST /ads missing requireOnboarded**            | Add `requireOnboarded` middleware                                         | `ads.ts`                                    |
| 6   | **No Zod on support/promos/tournaments**          | Add Zod schemas for all inputs                                            | `support.ts`, `promos.ts`, `tournaments.ts` |
| 7   | **POST /posts/:id/poll missing requireOnboarded** | Add `requireOnboarded`                                                    | `posts.ts`                                  |
| 8   | **Email exposed in pending coaches**              | Remove `email` from user select in pending-coaches response               | `organizations.ts`                          |
| 9   | **No rate limit on /ads/alternative-zips**        | Add `alternativeZipsLimiter` (30/min per IP)                              | `ads.ts`, `rateLimiters.ts`                 |
| 10  | **Notification tap handlers don't check auth**    | Move `NotificationTapHandler` inside AuthProvider; guard protected routes | `NotificationTapHandler.tsx`, `_layout.tsx` |

### LOW Priority

| #   | Issue                                   | Fix                                                                   | File       |
| --- | --------------------------------------- | --------------------------------------------------------------------- | ---------- |
| 11  | **No admin audit logging**              | Log `[ADMIN_AUDIT] user_banned` with admin_id, banned_user_id, reason | `admin.ts` |
| 12  | **Follow endpoint no duplicate check**  | Catch P2002 (unique violation) on create; return 200 idempotent       | `users.ts` |
| 13  | **Admin date params not Zod-validated** | Validate startDate/endDate; return 400 on invalid                     | `admin.ts` |

### CRITICAL (from Architecture Audit)

| #   | Issue                     | Fix                                                                   | File     |
| --- | ------------------------- | --------------------------------------------------------------------- | -------- |
| 14  | **IDOR: Ad reservations** | When `ad_id` provided, verify `ad.user_id === req.user.id` (or admin) | `ads.ts` |

---

## Frontend Changes

- **Delete account:** Modal now requires "Type DELETE" + password; `User.deleteAccount(password)` sends password in body
- **Notification taps:** `NotificationTapHandler` component inside AuthProvider; redirects to home if unauthenticated when tapping protected routes

---

## Follow-up Fixes (2026-03-17)

- **banner_fit_mode** — Standardized on `cover|contain|fill`; Prisma + BannerAd support both
- **Org role `administrator`** — Removed from checks; schema uses `owner|manager|member`
- **Teams GET /:id/members** — Added `requireAuth`
- **ZIP validation** — Backend min(3).max(20); frontend aligned (5-digit US or 3–20 char)

---

## Verification

- Run `npm run typecheck` in project root
- Run `npm run server:test` in server
- Manual: Delete account flow, notification tap when logged out, ad reservations with another user's ad_id
