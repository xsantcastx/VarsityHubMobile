# Real-World Foundation Phase 3

Date: 2026-09-02

## Scope

Phase 3 is the user-workflow readiness gate. It covers coach, organizer,
org-manager, public fan, upload, map, share, and notification behavior after
the Phase 1-2 repo fixes.

This phase intentionally separates:

- automated gates that can be proven locally
- local runtime probes that can mutate test data safely
- device-only UAT that requires a real installed app and real permissions

## Automated Gates Run

### Coach UAT Baseline

Command:

```bash
npm run coach:uat:baseline
```

Result:

- Passed.
- Expo doctor passed `17/17` checks.
- Client coach guard tests passed: `4` suites, `115` tests.
- Server coach gate tests passed: `5` suites, `56` tests.

Covered areas:

- approved coach access
- pending/rejected coach blocking
- missing-agreement blocking and recovery routing
- coach approval flow
- paid-plan guard behavior
- coach UI approval guards
- onboarding no-skip protections

### Org Manager And Public Fan Runtime Probe

Command:

```bash
npm --prefix server run verify:org-manager-access
```

Result:

- Passed.
- Probe used local `BASE_URL=http://localhost:4000`.
- The script registered a verified fan, completed onboarding, and confirmed the
  fan is blocked from team creation.
- It prepared the coach UAT account matrix.
- It verified fan-role org manager access to review summaries, org detail
  flags, admin summary, and pending events.
- It verified a public fan sees no admin flags and is blocked from organization
  join-request submission with the coach-upgrade message.

### Notification And Push Guard Tests

Command:

```bash
npm --prefix server test -- --runInBand \
  src/__tests__/api-notifications.test.ts \
  src/__tests__/push-receipt-policy.test.ts \
  src/__tests__/approval-notification-guards.test.ts \
  src/__tests__/route-push-awaits.test.ts
```

Result:

- Passed: `4` suites, `20` tests.

Covered areas:

- push diagnostics endpoint does not expose full tokens
- permanent Expo token errors clear stale push tokens
- payload/rate-limit/unknown push errors do not clear tokens
- route handlers do not await push sends
- approval notification failures route through shared capture paths

## UAT Account Matrix

Prepared by:

```bash
npm run coach:uat:prepare
```

Default password:

```text
CoachUAT2026!
```

Accounts:

| State                             | Email                                         | Expected result                                            |
| --------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Approved rookie coach             | `coach-uat-rookie@varsityhub.test`            | Coach tools open; premium-only upsells remain gated        |
| Approved veteran coach            | `coach-uat-veteran@varsityhub.test`           | Paid entitlements persist after restart                    |
| Approved legend coach             | `coach-uat-legend@varsityhub.test`            | Paid entitlements persist after restart                    |
| Paid-by-owner coach               | `coach-uat-owner-covered@varsityhub.test`     | Premium access works without self-checkout                 |
| Approved coach missing agreement  | `coach-uat-missing-agreement@varsityhub.test` | Coach tools blocked until agreement acceptance             |
| Rejected coach in fan mode        | `coach-uat-rejected-fan@varsityhub.test`      | Coach tools blocked; fan-safe actions work                 |
| Non-coach org manager             | `coach-uat-manager@varsityhub.test`           | Management/approval surfaces open where manager is allowed |
| Retired athlete roster role probe | `coach-uat-athlete@varsityhub.test`           | Management surfaces bounce                                 |

## Device UAT Required

Use:

- `docs/COACH_DEVICE_UAT.md`
- `docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md`

Minimum device coverage:

- one iOS installed build
- one Android installed build
- one account from each UAT state above
- one production or production-like API target
- notification permissions enabled and disabled
- location permissions enabled, disabled, and approximate-only where supported

## Manual Checks From User Notes

### Map And Discovery

- Select a past date with a known event, including the previously broken
  `2026-08-28` style case.
- Confirm the map does not over-zoom to one pin.
- Tap a marker and confirm:
  - preview opens
  - no `+` button is shown
  - no chevron button is shown
  - tapping text opens the event
  - close button dismisses the preview
- Confirm team/league color pins still render.

### Upload And Media

- Open upload/create-post while signed out and confirm the visible handoff state
  appears before sign-in routing.
- Open upload/create-post from an event pin when signed in and eligible.
- Upload photo from camera.
- Upload photo from library.
- Upload video from camera.
- Upload video from library.
- Confirm location-required errors are specific when event location or device
  location is missing.
- Confirm crop/pinch does not trap the user or produce a blank preview.

### Share

- Share a post from post detail.
- Share a post from full-screen game/event post viewer.
- Disable or cancel the native share sheet and confirm the copy-link fallback is
  user-visible.
- Verify share button contrast in light and dark mode.
- Treat direct Instagram Stories posting as a deferred native feature, not as an
  OTA bug.

### Coach And Organizer

- Create competitive home game with saved venue.
- Create competitive away game with selected venue.
- Create noncompetitive event with selected location.
- Confirm every created event page shows location.
- Confirm story/post upload buttons respect the live/event window.
- Confirm manual opponent entry behaves correctly for non-rostered opponents.
- Confirm bronze/silver/gold plan buttons route to the intended payment or
  upsell state for the signed-in account.

### Notifications

- In Settings, confirm push readiness/token diagnostics render for a signed-in
  account.
- Confirm unauthenticated access to `/notifications/push-diagnostics` is blocked.
- Trigger one real push notification to a physical installed device.
- Confirm foreground notification handling displays while the app is open.
- Confirm notification tap routes to the expected event/game/post.

## Phase 3 Classification

Closed by automation:

- coach role gating baseline
- approval state handling
- missing-agreement handling
- org-manager API access
- public fan join block
- notification failure capture and non-blocking push behavior

Closed by Phase 2 code changes, pending device confirmation:

- map popup action cleanup
- one-pin map zoom
- upload blank state
- post share fallback

Open device-only checks:

- real APNs/FCM/Expo push delivery
- camera/library upload on physical devices
- location permission edge cases
- entitlement persistence after kill/relaunch
- light/dark visual verification for share and event surfaces

Deferred features:

- direct Instagram Stories integration
- any native deep-link intent-filter changes that require EAS build rather than
  OTA

## Phase 4 Entry Criteria

Before provider/observability sign-off:

- Phase 3 automated gates are green.
- Device UAT template has one row per account state.
- Any failed device UAT item has a screenshot/video, account email, route,
  expected result, actual result, and API response/log snippet if available.
- Snyk authentication is fixed or explicitly marked as unavailable in the
  launch gate.
- Sentry alert and dashboard owners are assigned.
