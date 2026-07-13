# VarsityHub Bug Fix Plan

> Generated from fresh codebase audit. No fixes applied yet.
> Each bug has a unique ID, root cause, exact fix, and risk assessment.
> Fixes will be applied one feature group at a time, in order.

---

## Feature 1: Coach Onboarding (10 bugs)

### ONBOARD-01: Reducer INIT_FROM_PROFILE blocks second user on same device

- **Files:** `context/onboardingReducer.ts` (~line 122)
- **Root cause:** `initialized` flag persists in AsyncStorage. When user B logs in after user A completed onboarding, `INIT_FROM_PROFILE` no-ops because `initialized` is already `true` from user A's session.
- **Fix:** Clear `initialized` flag when `INIT_FROM_PROFILE` receives a profile with a different `user_id` than what was previously stored. Add `userId` to persisted reducer state and compare on init.
- **Risk:** LOW. Only affects multi-user-on-same-device scenario. No shared logic touched.

### ONBOARD-02: Returning coach always sent to step 2, not their actual incomplete step

- **Files:** `app/onboarding/index.tsx` (line 47)
- **Root cause:** `calculatedStepIndex = state?.role ? 1 : 0` ignores actual completion state. Should use `nextIncompleteStep()` which is already imported but unused for routing.
- **Fix:** Replace line 47 with `const calculatedStepIndex = nextIncompleteStep(state, state?.role);` — this function already exists in the reducer and correctly returns the first incomplete step index.
- **Risk:** LOW. `nextIncompleteStep` is already tested and used elsewhere. Only changes the routing entry point.

### ONBOARD-03: Username availability check shows own username as "taken"

- **Files:** `app/onboarding/step-2-basic.tsx` (lines 120-144), `server/src/routes/auth.ts` (usernameAvailable endpoint)
- **Root cause:** `User.usernameAvailable(normalized)` returns `false` when the username belongs to the currently authenticated user. A returning coach who already set their username in a previous session sees "That username is taken" and is blocked.
- **Fix:** Server-side: modify the `usernameAvailable` endpoint to accept an optional `excludeUserId` param (or auto-exclude the authenticated user's current username). Client-side: no change needed if server handles it. Alternative client-side fix: compare against `existingUsername` from `User.me()` and skip the availability check if the username matches.
- **Risk:** MEDIUM. Server endpoint change, but additive (new optional behavior). Client-only fix is safer.

### ONBOARD-04: `proceeding_as_fan: true` sent on `alreadyExists` path

- **Files:** `app/onboarding/step-3-league.tsx` (line 367)
- **Root cause:** When `alreadyExists` is true (coach already has a team/org), `onContinue` sends `proceeding_as_fan: true` in the `completeOnboarding` payload. This causes AuthProvider to skip the pending-approval wall. Coach bypasses approval and lands in the full app, but server-side `requireOnboarded` still blocks them on API calls.
- **Fix:** Split the `alreadyExists` and `join_request_pending` branches. Only send `proceeding_as_fan: true` when `ob.join_request_pending` is true. When `alreadyExists` is true, send `proceeding_as_fan: false` and route to `coach-agreement` instead of `/(tabs)`.
- **Risk:** MEDIUM. Changes navigation flow for coaches with existing orgs. Must verify against AuthProvider routing logic.

### ONBOARD-05: `pending-approval.tsx` shows "View Your Organization" even when `completionError` is set

- **Files:** `app/onboarding/pending-approval.tsx` (lines 285-303)
- **Root cause:** The "View Your Organization" button renders unconditionally when `approved === true`. If `completionError` is also set, both the retry button AND the nav button show. Tapping "View Your Organization" navigates to `coach-agreement` even though `onboarding_completed` is still `false`, causing a redirect loop.
- **Fix:** Wrap the "View Your Organization" and "Create Your First Team" buttons in a `!completionError` guard. Only show them when onboarding completion actually succeeded.
- **Risk:** LOW. Pure UI conditional, no logic changes.

### ONBOARD-06: `league-pending-approval.tsx` doesn't call `checkAuth()` before navigating to coach-agreement

- **Files:** `app/onboarding/league-pending-approval.tsx` (line 333)
- **Root cause:** When the approved coach taps "View Your Organization", navigation goes directly to `coach-agreement` without refreshing auth state. `coach-agreement` then calls `checkAuth()` which may redirect based on stale state, causing a flicker through `/(tabs)` before snapping to the agreement screen.
- **Fix:** Add `await checkAuth()` before `router.replace(...)` on the "View Your Organization" and "Create Your First Team" button presses — matching the pattern already used in `pending-approval.tsx`.
- **Risk:** LOW. Adding a call that already exists in the parallel screen. No new logic.

### ONBOARD-07: `completedStepIds` never restored from AsyncStorage

- **Files:** `context/OnboardingContext.tsx` (lines 101-113)
- **Root cause:** Persistence writes `completedStepIds: Array.from(...)` but hydration only restores `draftData` and dispatches `INIT_FROM_PROFILE`, which doesn't restore `completedStepIds`. After app restart, `completedStepIds` is always empty.
- **Fix:** On hydration, if `parsed.completedStepIds` exists, restore it into the reducer state via a new `RESTORE_COMPLETED_STEPS` action, or include it in `INIT_FROM_PROFILE`.
- **Risk:** LOW. `completedStepIds` is informational; `nextIncompleteStep` uses field-level checks, not this set. But fixing it prevents future bugs.

### ONBOARD-08: AuthProvider yanks approved coach from pending-approval to /(tabs), bypassing coach-agreement

- **Files:** `context/AuthProvider.tsx` (line 640)
- **Root cause:** When a coach is approved and `onboarding_completed` becomes true, the routing effect fires `router.replace('/(tabs)')` for anyone on `firstSegment === 'onboarding'` who is NOT `isPendingCoach` and NOT on the agreement screen. The coach on `pending-approval` gets auto-redirected to `/(tabs)`, then immediately redirected again to `coach-agreement` (because `coach_agreement_accepted_at` is null), causing a visible flicker.
- **Fix:** Add `pending-approval` and `league-pending-approval` to the exception list in the routing effect. These screens should not be auto-redirected — the user must tap a button to proceed.
- **Risk:** MEDIUM. Touches AuthProvider routing, which is the central navigation gate. Must be precise.

### ONBOARD-09: Reducer persistence omits `completedStepIds` restoration (duplicate of ONBOARD-07)

- **Merged into ONBOARD-07.** Same root cause, same fix.

### ONBOARD-10: `step-2-basic.tsx` hard-codes `role: 'fan'` in else branch

- **Files:** `app/onboarding/step-2-basic.tsx` (line 343)
- **Root cause:** The else branch for non-coach users hard-codes `role: 'fan'`. If a race condition caused `ob.role` to not be set, the server would complete onboarding as fan regardless. However, the branch is properly guarded by `currentRole === 'coach'` check.
- **Fix:** SKIP. This is a theoretical concern, not an active bug. The guard is correct.
- **Risk:** N/A.

---

## Feature 2: Approval Process (8 bugs)

### APPROVAL-01: Coach sees their own join requests with approve/deny buttons that always 403

- **Files:** `app/(tabs)/event-approvals.tsx` (lines 152-166, 303-336)
- **Root cause:** Section 3 ("Authorized User Requests") calls `GET /organizations/join-requests/me` which returns the current user's OWN join requests. But the UI renders approve/deny buttons that call `POST /join-requests/:id/approve` — the server checks if the caller is an org owner/manager, which the requester is not. Buttons always fail with 403.
- **Fix:** Remove approve/deny buttons from Section 3. Replace with read-only status badges (Pending/Approved/Denied). The approve/deny actions belong in `approvals.tsx` (the org owner's screen), not here.
- **Risk:** LOW. Removing non-functional buttons. No backend changes.

### APPROVAL-02: `Alert.prompt` is iOS-only — approve button is no-op on Android

- **Files:** `app/(tabs)/approvals.tsx` (lines 128-163)
- **Root cause:** `Alert.prompt()` does not exist on Android. When a league owner taps "Approve" on Android, nothing happens — no callback fires, no feedback shown.
- **Fix:** Replace `Alert.prompt` with a modal + TextInput pattern (matching the decline flow at lines 386-436 which already uses a proper Modal). Create an `approveModal` state with `visible`, `reason`, and `targetCoach` fields.
- **Risk:** LOW. UI-only change. The decline modal is already a working reference implementation.

### APPROVAL-03: PENDING coaches see empty event-approvals screen; team invites are independent of coach status

- **Files:** `app/(tabs)/event-approvals.tsx` (lines 169-182)
- **Root cause:** `loadAll()` aborts entirely if `approval_status !== 'APPROVED'`, then the guard effect calls `safeGoBack()`. This blocks PENDING coaches from seeing their team invites (Section 2), which don't require coach approval status.
- **Fix:** Only gate Sections 1 and 3 on `approval_status === 'APPROVED'`. Always load Section 2 (team invites) regardless of coach status. Remove the `safeGoBack` redirect.
- **Risk:** MEDIUM. Changes access control behavior. Must verify team invites don't leak data for unapproved coaches.

### APPROVAL-04: Permission inconsistency — manager can approve join-requests but can't see pending-coaches list

- **Files:** `server/src/routes/organizations.ts` (lines 1117, 1662, 1698)
- **Root cause:** `POST /join-requests/:id/approve` allows `owner || manager`. `GET /:id/pending-coaches` and `POST /:id/coaches/:userId/approve` only allow `owner`. The `approvals.tsx` UI uses the per-coach endpoints, so managers can never approve coaches from the UI despite having server permission on the generic endpoint.
- **Fix:** Align permissions — add `manager` to the `pending-coaches` and per-coach approve/reject endpoints. Alternatively, restrict the generic join-request endpoint to `owner` only. Decision: expand `pending-coaches` and per-coach endpoints to include `manager`.
- **Risk:** MEDIUM. Server permission change. Must verify no unintended escalation.

### APPROVAL-05: Fan events without team_id silently 403 on approve

- **Files:** `server/src/routes/events.ts` (lines 739-761), `app/(tabs)/event-approvals.tsx` (line 222)
- **Root cause:** Events created by fans with no `team_id` can never be approved by coaches — `canApprove` stays `false` and returns 403. The client shows a generic "Failed to approve event" error with no explanation.
- **Fix:** Client-side: detect 403 on approve and show "This event requires admin approval" message. Server-side: allow org-level owners to approve team_id-less events within their org.
- **Risk:** MEDIUM. Server logic change for event approval scope.

### APPROVAL-06: Pending games fetched globally — data leak to all coaches

- **Files:** `app/(tabs)/event-approvals.tsx` (lines 108-132), `server/src/routes/games.ts`
- **Root cause:** `GET /games?show_pending=true` returns all pending games system-wide. No scoping to coach's managed teams. Any coach can see all pending games from all teams.
- **Fix:** Server-side: scope `show_pending` results to games where the coach is a member of the home or away team, or an owner/manager of the game's organization.
- **Risk:** MEDIUM. Server query change. Must verify the scope filter doesn't break other uses of the games endpoint.

### APPROVAL-07: Denial reason overwrites coach's original application message

- **Files:** `server/src/routes/organizations.ts` (line 1278)
- **Root cause:** `message: reason || joinRequest.message` overwrites the `message` column with the admin's denial reason. The coach's original application note is lost.
- **Fix:** Add a `rejection_reason` column to `OrganizationJoinRequest` model in Prisma schema. Store denial reason there instead of in `message`. Requires a migration.
- **Risk:** HIGH. Schema migration on production database. Must be done carefully.

### APPROVAL-08: Denial notification uses `JOIN_REQUEST_APPROVED` type

- **Files:** `server/src/routes/organizations.ts` (lines 1290-1302)
- **Root cause:** Denial notifications are stored with `type: 'JOIN_REQUEST_APPROVED'` and a `denied: true` meta flag. Any UI filtering by notification type will misclassify denials as approvals.
- **Fix:** Use a distinct type: `JOIN_REQUEST_DENIED`. Update the notification rendering logic to handle this new type.
- **Risk:** LOW. New notification type. Existing `denied: true` meta check in frontend still works as fallback.

---

## Feature 3: Ad Hosting (10 bugs)

### ADS-01: `withIAPContext` missing — all iOS IAP calls are dead

- **Files:** `app/_layout.tsx`, `hooks/useAdIAP.ts`
- **Root cause:** `react-native-iap` v14 requires wrapping the app with `withIAPContext(App)` or `<IAPProvider>`. Neither exists. All IAP hooks return undefined/noop values. iOS ad payments are completely non-functional.
- **Fix:** Wrap the root layout export with `withIAPContext` from `react-native-iap`.
- **Risk:** MEDIUM. Touches root layout. Must verify it doesn't conflict with StripeProvider. Requires native rebuild (not OTA).

### ADS-02: No upgrade prompt when Rookie users try to create ads

- **Files:** `app/submit-ad.tsx` (lines 104-133)
- **Root cause:** Server returns 403 with `code: 'PLAN_REQUIRED'` for Rookie users. Client shows generic error alert with no upgrade CTA.
- **Fix:** Check for `PLAN_REQUIRED` code in the error response. Show an upgrade prompt that routes to `/subscription-paywall` or `/billing`.
- **Risk:** LOW. Client-side error handling only.

### ADS-03: After rejection, stale adStatus cache prevents re-submission UI

- **Files:** `app/ad-calendar.tsx` (lines 168-172, 258-260)
- **Root cause:** When an ad is rejected, the screen doesn't refresh ad status from server on mount. `adStatus` stays as `pending` from cache. User sees "Awaiting Admin Approval" instead of the "Submit for Approval" button.
- **Fix:** Always fetch fresh ad status from server on screen mount/focus, not just from passed params. Add a `useFocusEffect` that re-fetches the ad details.
- **Risk:** LOW. Adding a data refresh on focus.

### ADS-04: Free-promo path passes undefined amount_cents to confirmation

- **Files:** `app/ad-calendar.tsx` (lines 499-527)
- **Root cause:** When server returns `{ free: true }`, `data.amount_cents` is undefined. The client falls back to `calculatePrice(selected)` but `selected` may have been cleared.
- **Fix:** When `data.free === true`, explicitly set `paidAmount = '$0.00'` and `totalAmount = 0` before navigating to confirmation.
- **Risk:** LOW. Edge case for promo codes only.

### ADS-05: Client uses addWeeks(today, 8) local time vs server 56 days UTC

- **Files:** `app/ad-calendar.tsx` (line 24), `server/src/routes/ads.ts` (lines 189-196)
- **Root cause:** Client computes max date as `addWeeks(startOfToday(), 8)` in local time. Server computes `56 days from now` in UTC. They can differ by 1 day around midnight UTC.
- **Fix:** Align both to use the same date computation. Client: use `addDays(startOfToday(), 56)` instead of `addWeeks(startOfToday(), 8)` to match semantics, and format as ISO date string for comparison.
- **Risk:** LOW. Date constant change only.

### ADS-06: Apple IAP receipt verification uses matching.length instead of transaction.quantity

- **Files:** `server/src/routes/payments.ts` (lines 2612-2617)
- **Root cause:** Apple consumable IAP with `quantity > 1` creates ONE transaction entry with a `quantity` field, not multiple entries. `matching.length` is always 1. Multi-block purchases are rejected as underpaid.
- **Fix:** Replace `matching.length` with `parseInt(matching[0]?.quantity || '1', 10)` to correctly read the purchased quantity.
- **Risk:** LOW. Simple field access change. Only affects multi-block purchases which are currently all failing anyway.

### ADS-07: Users without zip/location silently get zero ads

- **Files:** `server/src/routes/ads.ts` (lines 373-377), `app/feed.tsx` (line 712)
- **Root cause:** If user has no zip and no device location, `GET /ads/for-feed` returns `{ ads: [] }`. The location prompt shows correctly when no ads are present and no location is set, BUT `hasDeviceLocation` is set to true when only `userZip` is present — so a user with a zip that has no local ads never sees the prompt to enable GPS.
- **Fix:** Only set `hasDeviceLocation = true` when actual device GPS coords are available, not when only `userZip` is present.
- **Risk:** LOW. Boolean logic fix in feed.tsx.

### ADS-08: Ad radius field ignored — hardcoded to 9km

- **Files:** `server/src/routes/ads.ts` (line 430), `server/prisma/schema.prisma` (line 586)
- **Root cause:** `for-feed` endpoint uses hardcoded `<= 5.59` miles (9km) distance filter. The `radius` column on the Ad model (default 45) is never read.
- **Fix:** Replace hardcoded 9km with `ad.radius` from the database. Update BBOX calculation to use the ad's radius. Ensure schema default (45) represents km consistently.
- **Risk:** MEDIUM. Changes ad delivery radius for all ads. Existing ads with default radius=45 will suddenly reach much farther. May need a data migration to set reasonable defaults.

### ADS-09: Alternative zips endpoint includes draft ads in availability check

- **Files:** `server/src/routes/ads.ts` (lines 783-836)
- **Root cause:** `GET /ads/alternative-zips` queries `status: { in: ['draft', 'active'] }`. Draft ads have no reservations, so all dates appear available. Should only check ads with actual slot holds.
- **Fix:** Change filter to `status: { in: ['active'] }` and add `payment_status: { in: ['paid', 'hold', 'pending_approval'] }`.
- **Risk:** LOW. Query filter change, no schema changes.

### ADS-10: edit-ad.tsx field naming inconsistency (zip_code vs target_zip_code)

- **Files:** `app/edit-ad.tsx` (lines 88, 136)
- **Root cause:** Local storage uses `zip_code`, server response uses `target_zip_code`. The fallback chain works correctly in practice because `my-ads.tsx` normalizes the field.
- **Fix:** SKIP. Not an active bug, just a naming inconsistency.
- **Risk:** N/A.

---

## Feature 4: Geofencing (5 bugs)

### GEO-01: LocationPicker never resolves lat/lng from autocomplete selection

- **Files:** `components/LocationPicker.tsx` (lines 90-101)
- **Root cause:** `handleSelect` passes `address` and `place_id` to parent but never calls Google Places Details API to resolve coordinates. `latitude` and `longitude` are always `undefined`. Server-side auto-geocoding on game save covers this gap, but events and other entities don't have that fallback.
- **Fix:** After autocomplete selection, call `POST /geocoding/location` with the selected address to resolve lat/lng. Pass resolved coordinates to the parent callback.
- **Risk:** MEDIUM. Adds a network call to LocationPicker. Must handle loading state and failure gracefully.

### GEO-02: Client-side geofence warning uses wrong window end

- **Files:** `app/(tabs)/create-post.tsx` (line 562)
- **Root cause:** Client sets `windowEnd = eventDate + 1 day`. Server uses `midnight UTC after event day + 8h Pacific buffer`. They don't match — client shows "posting window closed" prematurely for US timezone users.
- **Fix:** Align client window end to match server: `eventDate + 1 day + 8 hours` (or better, use a shared constant). Since this is just a warning (not enforcement), the server is the source of truth.
- **Risk:** LOW. Only changes when a yellow warning banner appears, not actual posting permission.

### GEO-03: Story posts via POST /posts use 3km check instead of 1km

- **Files:** `server/src/routes/posts.ts` (line 668)
- **Root cause:** Posts with `type: 'story'` submitted to `POST /posts` go through `verifyEventPostingPermission` (3km radius). Only stories posted via `POST /games/:id/stories` get `verifyStoryPostingPermission` (1km radius). Inconsistent enforcement.
- **Fix:** In `posts.ts`, when `type === 'story'` and the post is linked to a game, call `verifyStoryPostingPermission` instead of `verifyEventPostingPermission`.
- **Risk:** MEDIUM. Tightens radius for story posts from 3km to 1km. Some users who could previously post stories will be blocked. May want to keep at 3km and just document the discrepancy.

### GEO-04: GOOGLE_MAPS_API_KEY missing causes silent failures everywhere

- **Files:** `server/src/routes/geocoding.ts`, `server/src/lib/geocoding.ts`
- **Root cause:** If `GOOGLE_MAPS_API_KEY` is not set in Railway env, geocoding returns 500, autocomplete returns 500, `ZipCodeMapPreview` shows errors, and auto-geocoding on game save fails silently. Per CLAUDE.md, this key IS set in Railway.
- **Fix:** SKIP for code changes. Verify the env var is set in Railway. If it is (per CLAUDE.md), this is not an active bug.
- **Risk:** N/A.

### GEO-05: No background geofencing or proximity notifications

- **Files:** N/A (feature doesn't exist)
- **Root cause:** There is no background location monitoring, no enter/exit region triggers, no proximity push notifications. "Geofencing" is purely reactive server-side validation on post creation.
- **Fix:** This is a feature gap, not a bug. Implementing real geofencing (expo-location region monitoring + server-side notification triggers) is a separate feature request. Out of scope for this bug fix plan.
- **Risk:** N/A.

---

## Execution Order

**Phase 1: Coach Onboarding** (ONBOARD-01 through ONBOARD-08, skip 09/10)

- 7 bugs to fix
- All client-side except ONBOARD-03 (server option available)
- No schema migrations

**Phase 2: Approval Process** (APPROVAL-01, 02, 03, 06, 08)

- 5 bugs to fix (defer APPROVAL-04, 05, 07 — they require server permission changes or schema migration)
- Mix of client and server

**Phase 3: Ad Hosting** (ADS-01, 02, 03, 04, 05, 06, 09)

- 7 bugs to fix (defer ADS-07, 08 — they change ad delivery behavior significantly)
- Mix of client and server
- ADS-01 requires native rebuild

**Phase 4: Geofencing** (GEO-01, 02)

- 2 bugs to fix (defer GEO-03 — policy decision on radius; skip GEO-04/05)
- Client-side only

**Deferred (require discussion):**

- APPROVAL-04: Permission alignment for managers (policy decision)
- APPROVAL-05: Fan event approval scope (policy decision)
- APPROVAL-07: Schema migration for rejection_reason column
- ADS-07: Feed location prompt logic (changes UX behavior)
- ADS-08: Ad radius from DB (changes ad delivery reach for all existing ads)
- GEO-03: Story geofence radius tightening (may break existing user behavior)
- GEO-05: Background geofencing (new feature, not a bug)

---

## Total: 21 bugs to fix now, 6 deferred for discussion, 6 skipped (not active bugs or duplicates)
