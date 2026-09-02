# Real-World Foundation Phase 2

Date: 2026-09-02

## Scope

This phase cross-references the current repo state, the Codex work summary, and
the user-supplied notes in `/Users/varsityhub/Desktop/More notes.pdf`.

The focus is not broad feature expansion. It is tightening the real-world
foundation around gaps that would show up quickly in production:

- map event popup behavior
- selected-event map zoom
- upload screen blank states
- post share failure handling
- Sentry, Snyk, Railway, Vercel, and release-gate readiness

## Fixed In Code

### Map Popup UX

File:

- `components/EventMap.tsx`

Changes:

- Removed the map popup `+` action.
- Removed the chevron-forward action.
- Made the popup text/card body open the event.
- Added an explicit close button.
- Kept marker color behavior intact.

Verification:

- `components/__tests__/EventMap.test.tsx`

### Single Event Map Zoom

File:

- `components/EventMap.tsx`

Change:

- A one-pin map result now uses a bounded region delta instead of fitting to a
  single coordinate, which could zoom too tightly on selected past dates.

Verification:

- `components/__tests__/EventMap.autofit.test.tsx`

### Upload Screen Blank State

File:

- `app/(tabs)/create-post.tsx`

Change:

- Signed-out, auth-loading, and unverified-user handoffs now render a visible
  loading message instead of a blank `SafeAreaView`.

Verification:

- `__tests__/guest-create-entry-contracts.test.ts`

### Post Share Failure Handling

File:

- `app/game-details/GameVerticalFeedScreen.tsx`

Change:

- The full-screen post viewer no longer swallows native share-sheet failures.
  It falls back to copying the post link and shows a user-visible alert.

Verification:

- `app/game-details/__tests__/GameVerticalFeedScreen.nav.test.tsx`
- `utils/__tests__/buildNativeSharePayload.test.ts`

## Tooling Findings

### Sentry

Command run:

```bash
bash scripts/verify-sentry-setup.sh
```

Result:

- Passed locally.
- Mobile and server Sentry packages are present.
- iOS and Android `sentry.properties` are present.
- App initialization is wired through `app/_layout.tsx`.
- Server Sentry wrapper exists.
- EAS production `SENTRY_AUTH_TOKEN` is visible to the verifier.

Required provider-side evidence:

- Sentry alert rules for mobile crash spike, server error spike, webhook errors,
  payment finalization failures, and queue failures.
- A test mobile issue and a test server issue linked in
  `docs/release/LAUNCH_READINESS_GATE.md`.
- Confirmation that alert notifications reach the real on-call channel.

### Snyk And Dependency Scanning

Commands run:

```bash
npm audit --omit=dev --audit-level=high
npm --prefix server audit --omit=dev --audit-level=high
snyk test --all-projects --severity-threshold=high
```

Results:

- Server npm audit has no high-severity production dependency findings, but it
  still reports moderate advisories for `query-string`/`decode-uri-component`
  and `sanitize-html`.
- Root npm audit still reports high-severity advisories through Expo/Metro
  build tooling. React Native's transitive `minimatch` advisory was later fixed
  in Phase 4 by bumping the compatible lockfile entry to `3.1.5`.
- Snyk CLI is installed, but the authenticated scan failed with `401
Unauthorized`.
- Snyk `--all-projects` also scanned local `.claude/worktrees` and iOS sample
  Podfiles, which is local tooling noise and should be excluded from real gates.

Dependency hardening already applied:

- Root overrides now pin `nanoid` to `3.3.18`.
- Root overrides now pin `browserslist` to `4.28.8`.
- Server dependency now pins `sanitize-html` to `2.17.5` so Node 20 installs do
  not drift to Node-22-only `2.17.7`.
- Server override now pins `nanoid` to `3.3.18`.

Required follow-up:

- Re-authenticate Snyk before using Snyk as a launch gate.
- Run Snyk with explicit excludes for `.claude`, `ios/Pods`, and other local
  non-product artifacts.
- Decide whether current Expo/Metro audit findings are accepted as
  build-tooling risk until the next Expo upgrade, or whether to start a native
  dependency upgrade phase.
- Keep all time-boxed `.snyk` ignores reviewed before their 2026-09-30 expiry.

### Railway

Verified:

```bash
curl -fsS https://api-production-8ac3.up.railway.app/health
```

Result:

- Production API health returned `200` with status `ok`.

Required provider-side evidence:

- Railway deployment health and restart history after any server deploy.
- Production env audit for critical vars: `DATABASE_URL`, `REDIS_URL`,
  `JWT_SECRET`, `SENTRY_DSN`, Stripe vars, SendGrid vars, Cloudinary vars,
  Google Maps, Apple/Google payment verification vars, and Expo push behavior.
- Log review for `[notif]`, payment/webhook, and ingest failures after rollout.

### Vercel

Verified:

```bash
curl -I -fsS https://www.varsityhub.app
```

Result:

- Vercel web frontend returned `200`.
- Current response was served from Vercel cache.

Required provider-side evidence:

- Confirm Vercel production points to the intended branch.
- Confirm rewrite routes in `vercel.json` still match Railway production API
  routes for share pages, OG images, posts, teams, users, events, games, and
  programs.
- Add or verify uptime monitoring for `https://www.varsityhub.app` and the API
  health endpoint.

## Deferred By Design

### Instagram Stories Sharing

The current app uses React Native's native share sheet and clipboard fallback.
Direct Instagram Stories integration is a separate native capability. It likely
requires product decisions around media templates, native package support, app
queries/schemes, and an EAS build. It should not be treated as an OTA-only bug.

### Real Push Delivery

The code path and diagnostics exist, but final proof requires a physical device
with a real installed build, logged-in session, Expo/APNs/FCM token, and a live
send. This remains a device UAT item.

## Phase 3 Entry Criteria

Before broad UAT:

- Focused Phase 2 tests pass.
- Client TypeScript passes.
- Formatting and conflict checks pass.
- Snyk auth is fixed or dependency scanning is explicitly marked as not yet a
  launch gate.
- Provider dashboard owners are assigned for Sentry, Railway, Vercel, Snyk,
  EAS, Stripe, SendGrid, Cloudinary, Google Maps, Apple, and Google Play.
