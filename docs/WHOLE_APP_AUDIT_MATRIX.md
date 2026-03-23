# Whole App Audit Matrix

Last updated: 2026-03-23  
Scope: frontend (`app/`, `context/`, `api/`) + backend (`server/src/`) + release/config scripts.  
Method: static code audit (line-referenced). No end-to-end runtime testing in this cloud runner.

## 1) Control Matrix (whole app)

| Area | Verdict | Notes |
|---|---|---|
| Authentication baseline | PASS | Global auth middleware + `requireAuth` on protected routes is broadly consistent. |
| Authorization (object-level) | PARTIAL | Most domains enforce owner/staff/admin checks, but several endpoints still allow privilege or visibility drift. |
| Coach/admin policy consistency | PARTIAL | Recently improved substantially; a few backend/frontend consistency issues remain. |
| Privacy & account lifecycle | PARTIAL | Account delete/export exists, but not complete for all user-linked data surfaces. |
| Secrets & debug safety | PARTIAL | Good env scaffolding, but non-production dev-code responses can leak verification/reset codes. |
| Transport & API surface hardening | PARTIAL | HTTPS-first posture and Helmet present, but `/api-docs` is publicly mounted with persisted auth tokens. |
| Abuse/rate-limiting | PARTIAL | Strong limiter coverage overall; some script/config drift and route-level inconsistency remain. |
| Release/readiness scripts | PARTIAL | Script parity drift (`.sh` vs `.bat`, env variable naming mismatch). |

## 2) Domain Matrix (feature-level)

| Domain | Guarding status | Verdict |
|---|---|---|
| Auth/Profile (`/auth/me*`) | `PUT/PATCH /me` allow unrestricted `preferences` merge path | FAIL |
| Users | Generally guarded (`requireAuth`, `requireAdmin`) | PASS |
| Teams/Organizations | Strongly improved hierarchy checks, but a few org moderation paths still need consistency review over time | PARTIAL |
| Games/Stories | List endpoints hardened; by-id/summary/stories media visibility can still disclose non-approved game data | PARTIAL |
| Events | Approval and pending queues mostly hardened | PASS |
| Ads | Owner/admin checks and onboarding gates improved | PASS |
| Messaging/Group chats | Conversation access checks are good; non-team group creation has weak membership constraints | PARTIAL |
| Admin panels | Frontend + backend admin controls present, but route discoverability requires strict backend reliance | PASS |
| Deep-link and client gating | Mostly strong, but minor route-policy mismatch remains | PARTIAL |

## 3) Prioritized Findings (whole app)

### Critical

1. **Preference overposting in `PUT/PATCH /auth/me` can bypass policy controls**  
   - `preferences: z.any()` + direct merge lets clients set sensitive preference flags without protected-key stripping.  
   - References:  
     - `server/src/routes/auth.ts:925` (`preferences: z.any().optional()`)  
     - `server/src/routes/auth.ts:928-983` (`PUT /me`)  
     - `server/src/routes/auth.ts:986-1041` (`PATCH /me`)  
     - `server/src/routes/auth.ts:978,1036` (`patch.preferences = mergedPrefs`)  
   - Risk: approval/onboarding/payment gating logic can be influenced via mutable preference blob.

### High

2. **Game visibility drift: by-id and summary endpoints do not enforce approval visibility**  
   - `GET /games/:id` and `GET /games/:id/summary` return records without explicit approval-state access checks.  
   - References: `server/src/routes/games.ts:552-572`, `578-620`.

3. **Story/media listing is keyed only by game id (no visibility check against game approval/state)**  
   - `makeListMediaHandler` queries by `game_id` only.  
   - References: `server/src/routes/gameStories.ts:52-75`.

4. **Group chat creation allows arbitrary member sets when `teamId` is omitted**  
   - Team membership checks apply only inside `if (teamId) { ... }`.  
   - References: `server/src/routes/group-chats.ts:186-227`.

### Medium

5. **Verification/reset codes are returned in non-production responses**  
   - Can leak test OTP/reset codes in staging/misconfigured environments.  
   - References: `server/src/routes/auth.ts:241`, `727`, `1398`.

6. **`/api-docs` exposed with `persistAuthorization: true`**  
   - Public API docs + stored auth tokens in browser session can increase operational risk.  
   - References: `server/src/app.ts:226-230`.

7. **Account deletion/export coverage is incomplete relative to all user-linked records**  
   - Delete flow removes core social records but not all user-associated entities (example: ads use `onDelete: SetNull`).  
   - References:  
     - `server/src/routes/users.ts:95-212` (`/users/me/export`)  
     - `server/src/routes/users.ts:534-562` (delete transaction)  
     - `server/prisma/schema.prisma:572-576` (`Ad.user` relation with `onDelete: SetNull`).

8. **Frontend coach approvals screen loads data before role guard completes**  
   - `loadAll()` runs on mount independently of guard effect.  
   - Reference: `app/(tabs)/event-approvals.tsx:153-179`.

9. **Deep-link public route set is not aligned with auth public route set**  
   - `'/onboarding'` is treated as public in deep links, but auth provider public routes differ.  
   - References:  
     - `utils/deepLinks.ts:32-37`  
     - `context/AuthProvider.tsx:489-490`.

10. **Release/config drift**  
    - Version check mismatch between shell and batch scripts.  
    - Rate-limit env variable naming mismatch (`RATE_LIMIT_DISABLE` vs `DISABLE_RATE_LIMITING`).  
    - References:  
      - `scripts/validate-pre-launch.sh:18-21`  
      - `scripts/validate-pre-launch.bat:18-22`  
      - `.env.example:50`  
      - `server/src/middleware/rateLimiters.ts:17-20`.

## 4) Remediation Priority

- **P0 (immediate):** Fix `PUT/PATCH /auth/me` preference overposting path.
- **P1:** Enforce approval visibility checks for game by-id/summary/stories endpoints.
- **P1:** Add stronger constraints for non-team group chat creation.
- **P2:** Harden non-production debug code behavior (`ENABLE_DEV_CODES` explicit gating), `/api-docs` exposure posture, and release script parity.

## 5) Validation constraints

- This audit is static; no DB-seeded persona matrix execution occurred in this runner.
- Existing cloud-runner constraints still apply for full server build/test execution (dependency/environment mismatch).
