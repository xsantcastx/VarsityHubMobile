# VarsityHub Mobile — Feature Matrix Audit (v2)

**Date**: April 17, 2026
**Scope**: Full codebase audit against Feature Matrix v5 (177 features)
**Method**: Automated code inspection of every feature row against actual server routes, middleware, Prisma schema, and frontend screens

---

## Executive Summary

Audited all 177 features from `VarsityHub_Feature_Matrix_v5_final.xlsx` against the live codebase. Found **4 critical bugs**, **10 missing features**, **6 wrong values**, and **8 stale/outdated matrix entries** that were already fixed in v1.0.2.

---

## CRITICAL BUGS (code contradicts spec)

### BUG-1: Ad creation has NO plan enforcement

- **Matrix row**: #96 — "Veteran/Legend/Admin only"
- **File**: `server/src/routes/ads.ts:136-188`
- **Finding**: Comment says "requires Veteran/Legend plan or admin" but the middleware chain is only `requireAuth, requireVerified, requireOnboarded, adCreationLimiter`. **No plan check anywhere.** Any Rookie user can create ads.
- **Severity**: HIGH — bypasses monetization gate

### BUG-2: Ad refunds are processed (user wants NO refunds)

- **Matrix row**: #176 — User note: "ALL AD HOSTING IS NO REFUNDS"
- **File**: `server/src/routes/payments.ts:1264-1318, 1480-1510, 2260-2316`
- **Finding**: Extensive refund logic processes `charge.refunded`, `charge.dispute.created` webhooks, and auto-refunds on `SLOT_FULL` overbooking. Active refund processing contradicts the no-refund policy.
- **Severity**: HIGH — financial policy mismatch

### BUG-3: DM rate limit is 3600/hr instead of 100/hr

- **Matrix row**: #177 — "Rate limit DMs 100/hr"
- **File**: `server/src/middleware/rateLimiters.ts:227-231` — messageLimiter = 60/min = 3600/hr
- **Severity**: MEDIUM — 36x higher than intended, spam risk

### BUG-4: Upload size mismatch (multer 25MB vs Cloudinary 50MB)

- **Matrix row**: #170 — "Max 50MB upload"
- **File**: `server/src/routes/uploads.ts:127,150` (multer: 25MB), `uploads.ts:193` (Cloudinary signature: 50MB)
- **Finding**: Multer gate rejects at 25MB but Cloudinary signature allows 50MB. Direct-to-Cloudinary uploads bypass multer, creating inconsistent enforcement.
- **Severity**: MEDIUM — inconsistent limit depending on upload path

---

## WRONG VALUES (code has different numbers than spec)

| #   | Feature           | Matrix Says | Code Actually Has      | File:Line             |
| --- | ----------------- | ----------- | ---------------------- | --------------------- |
| 85  | Story geofence    | 2km         | Stories=1km, Posts=3km | geofencing.ts:235,337 |
| 103 | Ad radius         | 10km        | 9km                    | ads.ts:180            |
| 124 | Warn threshold    | 1 report    | 3 reports              | moderation.ts:20      |
| 125 | Strike threshold  | 2 reports   | 5 reports              | moderation.ts:21      |
| 126 | Suspend threshold | 3 reports   | 8 reports              | moderation.ts:22      |
| 127 | Ban threshold     | 3 strikes   | 12 reports             | moderation.ts:23      |

**Decision needed**: Should the CODE be changed to match the matrix, or the MATRIX updated to reflect the code? The moderation thresholds are configurable via env vars (`MOD_WARN_THRESHOLD`, etc.) so Railway could override them without code changes.

---

## FEATURES NOT IMPLEMENTED (confirmed missing)

| #     | Feature                         | Status          | Detail                                                                                                                                                                      |
| ----- | ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32-33 | Public/private teams            | NO SCHEMA FIELD | Team model has no privacy/visibility field. All teams are org-scoped, invite-only.                                                                                          |
| 58    | Coach rejection 48hr cooldown   | NO CODE         | Org rejection cooldown exists (organizations.ts:333-360) but coach rejection sets `approval_status: 'REJECTED'` without tracking `rejected_at` timestamp or cooldown logic. |
| 59    | Coach re-application route      | NO ENDPOINT     | `POST /:id/coaches/:userId/reapply` does not exist anywhere.                                                                                                                |
| 93    | Group chat join/add-member      | NO ENDPOINT     | group-chats.ts only has create (POST /), list, send message, mark read, leave. No way to add members after creation.                                                        |
| 117   | Community directory             | NO CODE         | No route, screen, component, or schema for a community directory anywhere.                                                                                                  |
| 145   | Billing history screen          | NO UI           | manage-subscription.tsx shows plan + App Store/Play links + cancel. No billing history view. Transaction log is admin-only.                                                 |
| 148   | 2FA / MFA                       | NO CODE         | Zero references to 2fa, totp, mfa, two-factor, authenticator in entire codebase. Net-new feature.                                                                           |
| 166   | Post creation rate limit 20/day | NOT WIRED       | `postCreationLimiter` exists in rateLimiters.ts:207-211 (20/hr, not /day) but is NOT applied to POST /posts endpoint in posts.ts:718.                                       |
| 172   | Event auto-archive 3 days       | NO CODE         | No cron job or scheduled task archives events. User wants 3-day auto-archive (not 7).                                                                                       |
| 168   | Auto-expire draft ads 30 days   | PARTIAL         | overnightTasks.ts:220-240 cleans up unpaid APPROVED ads after 30 days, but does NOT clean up DRAFT ads.                                                                     |

---

## STALE FINDINGS (already fixed in v1.0.2, matrix not updated)

| #   | Feature                          | Matrix Says       | Current Reality                                                                                   |
| --- | -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| 20  | Undo post returns 410            | "DOES NOT WORK"   | FIXED — Undo works within 5-minute window (posts.ts:1782-1822). 410 only after window expires.    |
| 43  | Season dates not in updateSchema | "Partial"         | FIXED — season_start and season_end added to updateSchema (teams.ts:650-651)                      |
| 44  | Bulk schedule no atomic rollback | "Partial"         | FIXED — POST /games/bulk endpoint with atomic transaction, max 30 games (games.ts:774-854)        |
| 57  | Org rejection 48hr cooldown      | Was N             | FIXED — REJECTION_COOLDOWN_MS = 48hr, rejected_at field added (organizations.ts:333-360, 478-505) |
| 76  | Fan pending cap wrong            | "Cap is 3 not 2"  | CODE SAYS 3 — events.ts:774-792 has `pendingCount >= 3`. Matrix description says 2, code says 3.  |
| 88  | Highlights 100km hard cap        | "Removed"         | CONFIRMED — 100km used as scoring radius, not hard cap (highlights.ts:32)                         |
| 90  | Message limits                   | Was wrong         | FIXED — DMs: 50/request (messages.ts:67), Group: 100/request (group-chats.ts:121)                 |
| 96  | Ad plan restriction              | Was wrong → fixed | STALE — Comment says fixed but NO enforcement code exists (see BUG-1)                             |

---

## PARTIAL / NEEDS ATTENTION

### #10: Public/private profile

- **Matrix**: Y for all roles
- **Finding**: No `is_private`, `privacy_public`, or `profile_visibility` field in User schema (schema.prisma). The settings screen has a "Change privacy" option but no corresponding schema field found.
- **Action**: Verify if privacy is stored in user `preferences` JSON field.

### #28: Caps detection removed for fans

- **Matrix**: Y — "Caps detection removed for fans"
- **Finding**: No caps lock detection or spam filter code found in posts.ts or any middleware.
- **Action**: If caps detection was never implemented, remove from matrix.

### #60: Org approval → coach onboarding routing

- **Matrix**: Partial — "brittle"
- **Finding**: NotificationTapHandler.tsx:108-110 routes correctly. AuthProvider.tsx:696-841 has comprehensive routing logic. Works but complex.
- **Action**: Monitor for edge cases; no code change needed.

### #81: Past-date events

- **Matrix**: N — "Zod blocks past dates"
- **Finding**: CONFIRMED — events.ts Zod schema requires `eventDate >= now`. Matrix says fans should be able to create past-date events for record-keeping, but code blocks it for everyone.
- **Decision**: Is this intentional? If past-date record-keeping is wanted, the Zod validation needs a role-based bypass.

### #85: Geofencing distances

- **Matrix**: "2km"
- **Finding**: Stories = 1km (geofencing.ts:235), Posts = 3km (geofencing.ts:337). Neither matches the matrix.
- **Decision**: Which distances are correct? Update matrix or code.

### #105: Ad approved but not paid

- **Matrix**: N — "payment screen reachability unclear"
- **Finding**: approvalService.ts:383 correctly sets status. Push notification says "Tap to complete payment" (L397). Flow exists but needs device testing.
- **Action**: Device walkthrough to verify payment screen is reachable from notification tap.

### #110: Push notifications

- **Matrix**: Partial — "delivery not guaranteed"
- **Finding**: Token registered at sign-in and in AuthProvider. Delivery depends on valid Expo push token. This is inherent to push notification systems, not a bug.
- **Action**: No code change needed. Matrix should say Y with a note about token validity.

### #118: Sport filter

- **Matrix**: Partial — "no sport filter control in UI"
- **Finding**: No dedicated sport filter dropdown. Users can text-search for sport names.
- **Action**: Consider adding a sport filter picker to search/discover UI.

### #141: Veteran price display

- **Matrix**: "$0.99/mo per team"
- **Finding**: payments.ts:235 confirms `unit_amount: 99` (99 cents = $0.99). Accurate in code.
- **Action**: Matrix text says "$1.00" in some places — correct to $0.99.

### #153: Pending approval screens

- **Matrix**: Partial — "two states not one"
- **Finding**: pending-approval.tsx (join-request) and league-pending-approval.tsx (org-approval) are separate screens. AuthProvider distinguishes them.
- **Action**: This is working as designed. Update matrix to say Y.

### #158: Favorites screen

- **Matrix**: Partial — "only bookmarked posts"
- **Finding**: app/favorites.tsx EXISTS and shows saved/bookmarked posts. Does not include teams/people/orgs.
- **Action**: Matrix is accurate. Feature works but is limited to posts only.

### #167: Text-only highlights

- **Matrix**: User says "TEXT ONLY POST SHOULD BE ALLOWED IN HIGHLIGHTS"
- **Finding**: highlights.ts enforces `media_url: { not: null }` on ALL queries (lines 59, 75, 100, 115, 141).
- **Action**: Remove the `media_url` filter from highlights queries to allow text-only posts.

---

## USER DECISIONS ON SUGGESTED RULES

| #   | Rule                            | User Decision         | Current Code                                       | Action Needed                                               |
| --- | ------------------------------- | --------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| 166 | Post rate limit 20/day          | Y                     | Limiter exists (20/hr) but NOT applied to endpoint | Wire `postCreationLimiter` to POST /posts; change to 20/day |
| 167 | Require media for highlights    | N (allow text-only)   | Highlights require media_url                       | Remove `media_url: { not: null }` filter                    |
| 168 | Auto-expire draft ads 30d       | Y                     | Only cleans approved unpaid ads                    | Add draft cleanup to overnightTasks.ts                      |
| 169 | Group chats within teams only   | Already correct       | teamId required (group-chats.ts:223-226)           | No change needed                                            |
| 170 | Max upload 50MB                 | Y                     | Multer: 25MB, Cloudinary: 50MB                     | Align multer to 50MB                                        |
| 171 | Coach email domain verify       | N (user doesn't want) | Not implemented                                    | No change needed                                            |
| 172 | Event auto-archive 3 days       | Y (3 days, not 7)     | Not implemented                                    | Add cron to archive events 3 days after date                |
| 173 | Require profile photo for posts | N                     | Not implemented                                    | No change needed                                            |
| 174 | Weekly email digest             | N                     | Not implemented                                    | No change needed                                            |
| 175 | Team-level comment moderation   | N                     | Not implemented                                    | No change needed                                            |
| 176 | Ad refund policy (no refunds)   | Y (no refunds)        | Refunds actively processed                         | Remove/disable refund webhooks                              |
| 177 | DM rate limit 100/hr            | Y                     | Currently 3600/hr (60/min)                         | Change messageLimiter to 100/hr                             |

---

## GLOBAL CODE QUALITY CHECKS

### Unbounded findMany queries

- **Status**: CLEAN — All `findMany` calls have `take` limits.

### req.user without requireAuth

- **Status**: CLEAN — All routes accessing `req.user` are guarded by `requireAuth`.

### Dark mode color violations

- **Status**: CLEAN — No hardcoded `#000`, `#333`, `#374151`, `#111`, or `black` text colors found in app/\*.tsx.

---

## PRIORITY FIX LIST

### P0 — Fix Now (breaks monetization/policy)

1. **BUG-1**: Add plan enforcement to ad creation (ads.ts:136-142)
2. **BUG-2**: Align refund handling with no-refund policy (payments.ts)

### P1 — Fix This Sprint (wrong behavior)

3. **BUG-3**: Change DM rate limit from 60/min to ~2/min (100/hr)
4. **BUG-4**: Align upload limits (multer 25MB → 50MB)
5. Wire `postCreationLimiter` to POST /posts endpoint (#166)
6. Remove `media_url` filter from highlights queries (#167)
7. Add event auto-archive cron (3 days after event date) (#172)

### P2 — Fix Next Sprint (missing features)

8. Coach rejection 48hr cooldown (#58)
9. Coach re-application route (#59)
10. Group chat add-member endpoint (#93)
11. Add draft ad 30-day cleanup (#168)
12. Decide on moderation thresholds (#124-127) — code vs matrix values

### P3 — Backlog (net-new features)

13. 2FA for email users (#148)
14. Billing history screen (#145)
15. Community directory (#117)
16. Public/private teams (#32-33)
17. Past-date event creation for record-keeping (#81)
18. Sport filter picker in search (#118)

### Matrix Updates Only (no code change)

- Update #20 to Y (undo post fixed)
- Update #43 to Y (season dates fixed)
- Update #44 to Y (bulk games fixed)
- Update #57 to Y (org cooldown fixed)
- Update #76 description: cap is 3, not 2
- Update #85 distances: stories=1km, posts=3km
- Update #88 to Y (100km scoring, no hard cap)
- Update #103: radius is 9km not 10km
- Update #110 to Y (push works, token validity is normal)
- Update #141: price is $0.99 not $1.00
- Update #153 to Y (two screens is by design)
- Remove #28 (caps detection never existed)
- Remove #117 from feature list (community directory never built)
