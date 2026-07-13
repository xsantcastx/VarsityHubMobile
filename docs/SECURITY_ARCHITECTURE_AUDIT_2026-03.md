# VarsityHub Security & Architecture Audit

**Audit Date:** March 15, 2026  
**Audit Type:** Security & Architecture Validation Audit  
**Methodology:** System Mapping → Gap Identification → Severity Classification → Remediation

---

## Executive Summary

This audit maps major systems (Auth, Payments, Teams/Orgs, Ads, Uploads), identifies validation mismatches, authorization gaps, and architectural inconsistencies.

### Severity Classification

| Severity     | Count | Definition                                                    |
| ------------ | ----- | ------------------------------------------------------------- |
| **CRITICAL** | 2     | User can bypass intended restrictions; data integrity at risk |
| **HIGH**     | 4     | Data integrity; authorization gaps; architectural flaws       |
| **MEDIUM**   | 6     | Inconsistency; design flaw; UX/security edge                  |
| **LOW**      | 5+    | Edge cases; UX polish; documentation                          |

---

## 1. System Mapping

### 1.1 Auth System

| Component  | Location                                       | Notes                                                            |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Routes     | `server/src/routes/auth.ts`                    | 17 routes; register, login, OAuth, verify, reset                 |
| Middleware | requireAuth, requireVerified, requireOnboarded | Hierarchy: auth → verified → onboarded                           |
| Schemas    | Zod in auth.ts                                 | updateMeSchema: username `min(3).max(20).regex(/^[a-z0-9_.]+$/)` |
| Frontend   | AuthProvider, sign-in, sign-up, verify         | `api/auth.ts`; User.me(), User.updatePreferences()               |

**Permission Hierarchy:** Unauthenticated → Authenticated → Verified → Onboarded → Plan-based → Admin

### 1.2 Payments/Plans

| Component      | Location                        | Notes                                                     |
| -------------- | ------------------------------- | --------------------------------------------------------- |
| Routes         | `server/src/routes/payments.ts` | Stripe checkout, webhook, IAP verify                      |
| IAP            | `hooks/useIAP.ts`               | MIDTIER, TOPTIER; Apple/Google receipt validation         |
| Plan Limits    | `server/src/lib/planLimits.ts`  | Rookie 2 teams; Veteran unlimited; Legend extracurricular |
| Stripe Webhook | checkout.session.completed      | finalizeFromSession; idempotency via processedStripeEvent |

**Plan Persistence:** Stripe webhook → `finalizeFromSession`; IAP → `/payments/apple/verify-receipt`, `/payments/google/verify-purchase`. Plan persisted only after payment callback.

### 1.3 Teams/Organizations

| Component       | Location                                        | Notes                                                    |
| --------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Team Create     | POST /teams, POST /teams/create                 | requireVerified, requireOnboarded, requirePlan('rookie') |
| Org Create      | POST /organizations, POST /organizations/create | requireAuth only — **no requireOnboarded**               |
| Org Update      | PATCH /organizations/:id                        | requireAuth, requireOnboarded                            |
| Extracurricular | club_type === 'extracurricular'                 | requires Legend plan; backend enforces 403               |

### 1.4 Ads

| Component     | Location                                             | Notes                                                            |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Create        | POST /ads                                            | requireVerified                                                  |
| Update/Delete | PUT /ads/:id, DELETE /ads/:id                        | Owner check: `ad.user_id === req.user.id`                        |
| Reservations  | POST /ads/reservations                               | **Requires ad.payment_status === 'paid'** — see CRITICAL finding |
| Payment Flow  | create-payment-sheet → webhook → finalizeFromSession | Reservations created in webhook                                  |

### 1.5 Uploads

| Component  | Location                  | Notes                                            |
| ---------- | ------------------------- | ------------------------------------------------ |
| Cloudinary | uploads.ts, cloudinary.ts | POST /uploads; GET /uploads/cloudinary-signature |
| Avatar     | upload.ts                 | Local disk; may fail on ephemeral Railway        |

---

## 2. Gap Identification

### CRITICAL

#### C1. POST /ads/reservations — Free Ad Slots Without Payment

**Location:** `server/src/routes/ads.ts` lines 503–535

**Issue:** The endpoint accepts `{ ad_id, dates }` and creates `AdReservation` records for any paid ad. The normal flow creates reservations via Stripe webhook (`finalizeFromSession`). The frontend never calls `Advertisement.reserve()` — all ad reservations go through payment. **An attacker could POST arbitrary dates to a paid ad and receive free ad slots.**

**Evidence:** `Advertisement.reserve()` exists in `api/entities.ts` but is never called in the codebase. The ad-calendar uses `create-payment-sheet` → payment → webhook.

**Fix:** Endpoint returns **403 Forbidden** (not 410 Gone). Rationale: 410 signals "gone permanently" and clients may cache it; 403 allows future repurposing. test-email-queue.sh previously used this endpoint. Code: `ads.ts` line 581.

**Severity:** CRITICAL — FIXED

---

#### C2. Org Create Without requireOnboarded — RESOLVED (By Design)

**Location:** `server/src/routes/organizations.ts` lines 312, 414

**Issue:** `POST /organizations` and `POST /organizations/create` use `requireAuth` only.

**Resolution:** Intentional. Org creation is part of the onboarding flow (step-3-league). The user creates an org _during_ onboarding, before `onboarding_completed` is set. Adding `requireOnboarded` would block the flow. Escalation is mitigated:

- Org sits in `admin_approved: false` until super admin approves
- `POST /organizations/:id/invite` requires `requireOnboarded` — user cannot invite until onboarded
- Team create requires `requireOnboarded` — user cannot create teams until onboarded

**Severity:** N/A (by design).

---

### HIGH

#### H1. PUT /me vs PATCH /me — Duplicate Logic

**Location:** `server/src/routes/auth.ts` lines 971–1033, 1037–1100

**Issue:** Both handlers share identical logic; maintenance burden and risk of drift.

**Fix:** Consolidate into a single handler; use `router.put('/me', handler)` and `router.patch('/me', handler)` pointing to the same function. — FIXED

**Severity:** HIGH — FIXED

---

#### H2. finalize-session — Client-Triggered Race

**Location:** `server/src/routes/payments.ts` lines 1842–1894

**Issue:** `POST /finalize-session` is a fallback when webhooks are unavailable. Client can call it with a session_id. The handler validates `session.metadata.user_id === req.user.id` and `payment_status === 'paid'`. Idempotency exists in `finalizeFromSession` via `processedStripeEvent`. However, a client could call it before the webhook, causing double-processing risk if both run concurrently. The `transactionLog?.status === 'COMPLETED'` check mitigates this.

**Status:** FIXED. Added per-session lock (`finalizeSessionLocks`) to prevent concurrent finalization by client and webhook.

**Severity:** HIGH — FIXED

---

#### H3. org zip_code Validation Mismatch

**Location:** `server/src/routes/organizations.ts` vs `server/src/routes/ads.ts`

**Issue:** Org schemas use `zip_code: z.string().max(10)` — no format validation. Ads use `target_zip_code: z.string().regex(/^\d{5}$/)` — strict 5-digit US zip. Inconsistent validation across systems.

**Fix:** Align org zip_code to `regex(/^\d{5}$/)` if US-only, or document why org allows broader format. — FIXED

**Severity:** HIGH — FIXED

---

#### H4. Team Invite — requireAuth vs requireVerified

**Location:** `server/src/routes/teams.ts` line 1147

**Issue:** `POST /teams/:id/invite` used `requireAuth` and `requireOnboarded` only. Other team mutations use `requireVerified`.

**Fix:** Added `requireVerified` to team invite. FIXED.

**Severity:** HIGH — FIXED

---

### MEDIUM

#### M1. requireVerified Bypass for Team Creation

**Location:** `server/src/middleware/requireVerified.ts` (referenced in teams router)

**Issue:** Documentation mentions a bypass for onboarding team creation. Verify the exact bypass logic and whether it can be abused.

**Severity:** MEDIUM

---

#### M2. request-join-organization — No Double-Submit Guard

**Location:** `app/request-join-organization.tsx` line 300

**Issue:** `disabled={!canSubmit}` — no `saving` or `submitting` guard. User could double-submit.

**Backend idempotency:** `POST /organizations/join-requests` has server-side deduplication:

- Checks `existingRequest` with `organization_id_user_id`; returns 400 "You already have a pending request" if pending
- Uses `upsert` on `organization_id_user_id` — duplicate requests update message, don't create new rows

**Fix:** Frontend guard reduces unnecessary network calls; backend already prevents duplicate pending requests.

**Severity:** MEDIUM (backend covered; frontend guard optional)

---

#### M3. Avatar Upload — Local Disk on Ephemeral FS

**Location:** `server/src/routes/upload.ts` (avatar)

**Issue:** Avatar upload uses local disk; Railway uses ephemeral filesystem. Files may be lost on restart.

**Fix:** Route avatar uploads through Cloudinary or another persistent storage.

**Severity:** MEDIUM

---

#### M4. Two Upload Systems

**Location:** `upload.ts` (avatar, local) vs `uploads.ts` (Cloudinary)

**Issue:** Inconsistent; avatar may not persist.

**Severity:** MEDIUM

---

#### M5. Frontend Validation — Password Min Length

**Location:** Sign-up forms

**Issue:** Backend: `z.string().min(8)`. Frontend may not enforce 8 chars before submit. User gets 400 after submit.

**Fix:** Add validation message on sign-up password field. — FIXED (hint + validatePassword on submit)

**Severity:** MEDIUM

---

#### M6. Frontend Validation — Username Regex

**Location:** Edit profile, username inputs

**Issue:** Backend: `regex(/^[a-z0-9_.]+$/)`. Frontend may not enforce; user gets 400 after submit.

**Fix:** Add client-side regex validation and error message. — FIXED (edit-username.tsx has regex + Alert)

**Severity:** MEDIUM

---

### LOW

#### L1. Ad ID Regex — `[a-z0-9-]{20,40}`

**Location:** `server/src/routes/ads.ts` route params

**Issue:** CUIDs are 25 chars; regex allows 20–40. Acceptable.

**Severity:** LOW

---

#### L2. /users/lookup — Email Enumeration

**Status:** Fixed. Now requires `requireAuth` and `userLookupLimiter` (10/min).

**Severity:** N/A (resolved)

---

#### L3. IAP requireAuth vs requireVerified

**Location:** `server/src/routes/payments.ts` lines 2257, 2484

**Issue:** IAP verify uses `requireAuth` (not `requireVerified`). Intentional — allow paid users who haven’t verified email. Documented in code comments.

**Severity:** LOW (by design)

---

## 3. Commandments Compliance

| Commandment                             | Status     | Notes                                          |
| --------------------------------------- | ---------- | ---------------------------------------------- |
| app/ thin routing                       | ⚠️ Partial | Screens in app/; some logic in components      |
| Shared assets @/shared                  | ⚠️ Partial | Some duplication; path aliases used            |
| API calls via api/\*                    | ✅ Pass    | No direct fetch in screens                     |
| Loading/error/empty states              | ✅ Pass    | Most screens have explicit states              |
| Deep links handle missing params        | ⚠️ Review  | Verify reset-password, oauth callbacks         |
| Block double submits                    | ✅ Pass    | saving/isLoading guards in most forms          |
| Plan persisted only after payment       | ✅ Pass    | Webhook/IAP verify update plan                 |
| Team creation → org association         | ✅ Pass    | createSchema requires organization_id          |
| Extracurricular → Legend                | ✅ Pass    | Backend enforced                               |
| Payment-success → verify status         | ✅ Pass    | Retries and Try Again                          |
| Ad confirmation → banner, dates, amount | ✅ Pass    | payment-success displays                       |
| Role/plan gates                         | ✅ Pass    | requirePlan, requireVerified, requireOnboarded |
| Never swallow errors                    | ✅ Pass    | Logging and user-facing messages               |

---

## 4. Remediation Plan

### Completed

1. **C1:** `POST /ads/reservations` returns 403 Forbidden (not 410). Reservations via checkout only. Code and doc aligned.
2. **C2:** Resolved by design. Org create during onboarding is intentional; invite/team create require onboarded.
3. **H4:** Added `requireVerified` to team invite.

### Short-Term (HIGH)

3. **H1:** Consolidate PUT/PATCH /me into single handler. — FIXED
4. **H2:** Add lock for finalize-session race. — FIXED
5. **H3:** Align org zip_code validation with ads (or document). — FIXED
6. **H4:** Add `requireVerified` to team invite. — FIXED

### Medium-Term (MEDIUM)

6. **M2:** Add submitting guard to request-join-organization. — Already has `canSubmit = selectedOrg && !submitting`
7. **M3:** Migrate avatar upload to Cloudinary.
8. **M5, M6:** Add frontend validation for password min length and username regex. — FIXED

### Long-Term

9. Run Snyk code scan on modified files.
10. Add Playwright smoke tests for deep links and key tabs.
11. Document architecture decisions (org create, IAP auth).

---

## 5. Pre-Launch Security Checklist

### Snyk Findings (organizations.ts, uploads.ts)

Before launch, assign tickets and verify reachability:

| Finding                  | Severity | Location                      | Action                                                              |
| ------------------------ | -------- | ----------------------------- | ------------------------------------------------------------------- |
| FormatString (CWE-134)   | Medium   | organizations.ts ~524, ~623   | Confirm no unauthenticated/low-privilege path reaches affected code |
| XSS (CWE-79)             | High     | organizations.ts ~1352, ~1421 | Verify file serving path; sanitize or restrict user input           |
| Improper Type Validation | Low      | organizations.ts ~779         | Add explicit type checks                                            |
| Insecure Hash (CWE-916)  | Low      | uploads.ts ~123               | Review MD5/SHA1 usage; consider stronger hash if for security       |

**XSS in uploads** — If the finding is in a path that serves user-uploaded content to browsers, prioritize. Ensure Content-Disposition, CSP, or sanitization prevents script execution.

### Critical List Status (March 2026 Audit)

| ID     | Item                                            | Status                                                            |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| **C1** | Ad reservations bypass (POST /ads/reservations) | **FIXED** — Returns **403** (not 410); code matches doc           |
| **C2** | Org create without requireOnboarded             | **By design** — Onboarding flow; mitigated by admin_approved gate |
| **C3** | Race conditions (team/event/invite limits)      | See below                                                         |
| **C4** | CUID tokens (invite/ID predictability)          | **Open** — See below                                              |
| **C5** | Double-booking (ad slots)                       | **Mitigated** — Serializable transaction + slot check; H2 lock    |

### Race Conditions — Actual Status

| Location                   | Issue                                     | Status                                               |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `teams.ts:471-492`         | Team creation limit                       | **FIXED** — Atomic `$transaction` (count + create)   |
| `organizations.ts:582-594` | Org invite limit                          | **FIXED** — Atomic `$transaction` (count + create)   |
| `events.ts:458-476`        | Event creation limit (3 pending for fans) | **FIXED** — Wrapped in `$transaction` (launch-night) |
| `events.ts:336`            | Event RSVP capacity                       | **FIXED** — Atomic `$transaction`                    |

**Launch decision:** FIXED (launch-night). Event limit now uses atomic `$transaction`.

### C4 — CUID Token Predictability

The L1 "25 chars acceptable" addressed ad ID regex length only. **Separate concern:** CUIDs are time-based and semi-sequential. Invite tokens (`OrganizationInvite.id`, `TeamInvite.id`) are CUIDs in email links. An attacker with one valid token can narrow the search space for nearby tokens. **Action:** Documented risk for launch. Post-launch: consider signed JWT tokens for invites, or rate-limit invite acceptance by IP.

### Snyk XSS — Launch Reachability Check

| Finding              | Location                                              | Reachability                                                                       | Action |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| **organizations.ts** | `res.send()` with `org.name` in approve/reject HTML   | **FIXED** — `org.name` escaped before HTML insert                                  |
| **Upload SVG**       | `uploads.ts` fileFilter allowed `image/*` (incl. SVG) | **FIXED** — Whitelist: jpg/png/gif/webp + mp4/mov only; extension cross-check (M7) |

**Launch-night:** Both XSS vectors fixed.

---

### Launch Date Pressure — Fix vs Risk Acceptance

| Item                   | Status                                          |
| ---------------------- | ----------------------------------------------- |
| Event limit race       | **FIXED** (launch-night)                        |
| C4 CUID invites        | **Accepted risk** — documented; post-launch fix |
| Org approve/reject XSS | **FIXED** (launch-night)                        |
| Upload SVG block       | **FIXED** (launch-night)                        |

---

## 6. Related Documents

- `docs/COMPREHENSIVE_SECURITY_ARCHITECTURE_AUDIT_2026.md` — Prior audit (Jan 2026)
- `docs/EXTERNAL_SETUP_GUIDE.md` — External services config
- `docs/CODEBASE_MAP.md` — API routes

---

**Last Updated:** March 15, 2026
