# End-to-End Flow Matrix Audit

Date: 2026-09-01

Branch audited: `prod/live-posting-window-fix`

Audit method: `varsityhub-matrix-audit`. Current source and tests are treated as authoritative;
older audit prose is historical unless re-verified against the current tree.

## Bottom Line

The automated audit did not find a new reproducing product bug across the covered end-to-end flow
groups. The local code gates and full client/server suites pass.

This is not a full production sign-off. Several flows still require runtime QA with seeded users,
real devices, and provider dashboards before claiming "every tab and feature works as advertised."

## Gates Run

| Gate                                              | Result                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:conflicts`                         | Pass: no conflict markers found.                                                                                                       |
| `npm run audit:navigation:fail`                   | Pass: 0 REVIEW items; all `router.replace` calls classified; no headerless dead-end screens reported.                                  |
| `npm run verify:error-envelope`                   | Pass: no server changes detected.                                                                                                      |
| `npm run verify:secrets`                          | Pass: secret literal scan passed.                                                                                                      |
| `npx tsc --noEmit`                                | Pass.                                                                                                                                  |
| `npx tsc --noEmit --project server/tsconfig.json` | Pass.                                                                                                                                  |
| `npm run test:regressions:client`                 | Pass: 10 suites, 120 tests.                                                                                                            |
| `npm --prefix server run verify:access-matrix`    | Pass: 46 endpoint/permission checks.                                                                                                   |
| `npm test -- --runInBand`                         | Pass: 189 suites passed, 1 skipped; 1338 tests passed, 2 skipped. Jest still reports an open-handle warning after assertions complete. |
| `npm --prefix server test -- --runInBand`         | Pass: 296 suites, 2824 tests.                                                                                                          |

## Flow Classifications

| Flow                                           | Classification                                 | Automated evidence                                                                                                                                                | Runtime gap                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Auth/session/password reset/email verification | Closed by automated gates                      | Server auth, session epoch, refresh-token, reset, verification, account-boundary tests pass.                                                                      | Manual fresh-install and expired-session checks on iOS/Android/web still needed.                              |
| Onboarding/coach approval/reapply              | Closed by automated gates                      | Coach approval, coach gate matrix, coach flow state, onboarding, fan-mode, agreement, and pending/rejected cooldown tests pass.                                   | Manual persona QA for pending/rejected/approved coach transitions.                                            |
| Feed                                           | Partially verified                             | Feed bundle, post privacy/block filters, mapper parity, feed smoke, route/navigation tests pass.                                                                  | Seeded data QA required for fan/coach/private-team/program-follow and NCAA visibility.                        |
| Highlights                                     | Partially verified                             | Highlights API sorting/privacy/block tests and vertical feed mapper/caption/nav tests pass.                                                                       | Real photo/video upload and playback on device required.                                                      |
| Create posts/highlights/stories                | Partially verified                             | Event/game id contract, story/post separation, post creation, upload routing, geofence posting, and post-event denormalization tests pass.                        | Real camera/media picker/current-location QA required.                                                        |
| Game/event pages                               | Partially verified                             | Game approval, opponent approval, game visibility, live-window, event RSVP, event cancel, posts-on-game/event, and graceful view-access tests pass.               | Manual Giants v Jets-style upload QA across story, highlight, normal post, and event-only post destinations.  |
| Discover/map/search/NCAA                       | Partially verified                             | Event discovery, games proximity, unified search, ESPN/NCAA adapter, pro ingest, map component, and route integrity tests pass.                                   | Seeded NCAA/pro/high school event data must be verified in the actual app UI and production/staging data set. |
| Teams/programs/organizations                   | Closed by automated gates for server contracts | Team create, team privacy, program follow fan-out, sport-program endpoints, organization ownership, membership, invite, and billing-scope tests pass.             | Manual UI QA for org owner, org manager, coach, and fan personas across team/program tabs.                    |
| Messaging/group chats/minor safety             | Closed by automated gates for server contracts | DM/message access, group chat permissions, unread counts, minor DM gate, block filtering, and notification payload tests pass.                                    | Two-device/two-session realtime QA still required for websocket reconnect/unread behavior.                    |
| Notifications/deep links                       | Partially verified                             | Notification tap routing, presentation, upload guardrails, deep-link allowlist, share-link consistency, and well-known route tests pass.                          | Real push delivery and tap routing on iOS/Android production-like builds required.                            |
| Ads/payment/subscriptions                      | Closed by automated gates for server contracts | Payment finalization, Stripe webhook signature, Google expiry, Apple receipt idempotency, ad approval, ad lifecycle, plan limits, and payment utility tests pass. | Stripe/Apple/Google sandbox dashboard runs still required.                                                    |
| Admin/moderation/audit logs                    | Closed by automated gates                      | Access matrix, admin surface, approval self-action, admin activity log, report moderation, email-token review, and route guard tests pass.                        | Manual admin dashboard QA still needed to verify UX and provider email links.                                 |
| Upload/storage/media security                  | Closed by automated gates for server contracts | Upload route auth, Cloudinary/R2 routing, magic-byte validation, media host allowlist, avatar cleanup, and video upload limit contracts pass.                     | Real Cloudinary/R2 transformations and device upload progress require runtime QA.                             |
| Web/static export/deploy                       | Partially verified                             | Web CSP and route/web contract tests pass; navigation audit passes.                                                                                               | Current web deployment must be verified against the deployed commit after PR merge/deploy.                    |
| Observability                                  | Needs runtime QA                               | Sentry source wiring and scrubbing tests pass.                                                                                                                    | A real client and server test event must be confirmed in the Sentry dashboard.                                |

## Verified Open Items

No new reproducing product bug was found in this audit pass.

## Policy Decisions Still Open

| Item                                                           | Classification  | Evidence                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DM send rate is 60/min, not the older matrix target of 100/hr. | Policy Decision | `messageLimiter` is mounted on `POST /messages` and allows 60 messages per minute. Decide whether high-volume active chat or stricter anti-spam is the product target.                                                   |
| SLOT_FULL ad overbooking still auto-refunds.                   | Policy Decision | Payment code issues `stripe.refunds.create({ reason: 'requested_by_customer' })` on SLOT_FULL recovery paths. Decide whether automatic overbooking refunds are desired despite the broader "no refunds" policy language. |

## Deferred Feature

| Item                             | Classification   | Evidence                                                                                                                                                                                                                         |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persisted event auto-archive job | Deferred Feature | `GET /events` applies an archive-style 72-hour visibility window, but `overnightTasks.ts` archives ads, not old events. If the product requires the event row status to become `archived`, that cron is still a net-new feature. |

## Test-Harness Gaps

These did not fail assertions, but they reduce confidence and should be cleaned up before treating
client tests as a strict "no silent failure" gate:

- Full client Jest still reports an open-handle warning after all assertions pass.
- Several React Native smoke tests emit `act(...)` warnings around timers, icons, and
  `InteractionManager`.
- Some client tests still log the production API base or intentionally simulated request failures;
  these should be isolated like the Feed smoke test fixed in `591df074`.
- Watchman reports repeated recrawls during server Jest runs. This is local tooling noise, but it
  can slow or destabilize future runs.

## Source-of-Truth Gap

`origin/main` is still not the audited source. This local branch is ahead of `origin/main`, and
the current fixes/reporting need to be merged through the open PR path before GitHub main reflects
what was audited.
