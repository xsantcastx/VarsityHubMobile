# Daily Changelog — 2026-03-31

## Bug Fixes

### `572d115a` — 13 integration bugs + performance fixes (21 files, +81/-47)
- **Critical:** `/team-profile` route fixed (was showing user profile), team-page edit button fixed (was navigating to create), post delete/edit error feedback added
- **High:** Message button added to user profiles, auth double-logout fixed
- **Medium:** Dynamic seasons in edit-team, event_type enum unified, dead `Team.createBasic` removed, org messaging block enforced in message-thread
- **Low:** Rookie tier alert, sign-up race condition, notification tap flash, 502 backoff fix
- **Performance:** Event cancel reminders parallelized, private author query cached (60s TTL)
- **Server changes:** `server/src/routes/events.ts`, `server/src/routes/games.ts`, `server/src/lib/privacyUtils.ts`

### `5e00f561` — Full-stack audit: approval flow, pricing, type safety (26 files, +697/-61)
- Added `api/types.ts` with 170 lines of shared TypeScript types
- 5 new test files (`api-types`, `approval-flow`, `notification-summarizer`, `onboarding-validation`, `payment-polling`)
- Fixed billing page pricing display
- Fixed onboarding pending-approval and step-2-basic flows
- Server: auth, notifications, organizations, payments route fixes
- Updated `shared/plan-definitions.json`
- Added deploy guard GitHub Actions workflow

### `e070da03` — Checklist bug fixes (14 files, +190/-85)
- DOB off-by-one fix in identity verification
- Keyboard gap fix in settings
- Onboarding auto-advance fix in step-3-league
- Search by username in mobile-community discover
- Coach 18+ age enforcement on server
- Suspension email improvements
- Google auth hook improvements

### `46fb7d9b` — Batch fixes from checklist PDF (10 files, +54/-46)
- Forgot-password flow improvements
- Edit-profile fixes
- Sign-in flow cleanup
- DateField component fix
- KeyboardAwareScreen fix
- Onboarding layout cleanup

## Auto-generated Changelogs
- `8fe7311a`, `2b3519b0`, `e6eb9b1f` — auto-generated changelog commits (no code changes)

## Risk Assessment
- **`572d115a` (today's deploy):** Touches auth middleware (`api/auth.ts`), server routes (`events.ts`, `games.ts`), and privacy utils. All changes are additive or fix-only — no schema changes, no env var changes. **Risk: LOW** — OTA deployed successfully, Railway auto-deployed.
- **`5e00f561`:** Touches payments and auth routes. Plan definitions changed. **Risk: MEDIUM** — already deployed and stable.
- **No database migrations** in any commit.
- **No env var changes** in any commit.
