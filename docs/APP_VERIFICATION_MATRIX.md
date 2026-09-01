# VarsityHub App Verification Matrix

Last updated: 2026-09-01

This is the current source-of-truth matrix for verifying that VarsityHub works as advertised.
Older audit files remain useful as history, but they are not a release sign-off unless their
claims are rechecked against current code and tests.

## Current Code Evidence

- Visible app tabs: Feed, Highlights, Create, Discover, Profile (`app/(tabs)/_layout.tsx`).
- Hidden routed workflows behind those tabs include notifications, messages, game/event pages,
  team/program pages, ads, approvals, organization tools, profile editing, and admin tools.
- Current automated coverage inventory found 525 test/spec files across client, server, and
  utility packages.
- Production source-of-truth risk remains: PR #279 carries the current local/fork branch toward
  `origin/main`, but `origin/main` is stale until that PR is merged by an account with permission.

## Verification Levels

| Level     | Meaning                                                                                              | Evidence required                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Automated | Can be checked by local tests, typechecks, scripts, or static audits.                                | Passing command output in the current tree.                                                    |
| Runtime   | Needs a running API/app bundle and seeded accounts or provider config.                               | Manual or scripted run against local/staging/prod with named personas.                         |
| Manual    | Needs human interaction, device capabilities, App Store/TestFlight behavior, or provider dashboards. | QA notes with device, account role, build/update id, and expected vs actual result.            |
| Blocked   | Cannot be honestly verified from this machine alone.                                                 | Missing token, dashboard access, device, account, or merge/deploy permission named explicitly. |

## Tab And Workflow Matrix

| Area                         | Advertised behavior to verify                                                                                                                            | Current automated coverage                                                                                  | Runtime/manual coverage still required                                                                                                    | Status                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Feed                         | Shows followed team/program content, event posts, RSVP/game context, blocking/privacy filters, pagination, and refresh behavior.                         | Feed/post mapper parity tests; server feed and block-filter tests; navigation audit.                        | Seed fan, coach, blocked user, private team, and program-follow personas; verify all team and event pages can surface in feed.            | Partially automated; needs persona QA.                 |
| Highlights                   | Opens vertical event/game media feed without hiding normal event posts; captions, author fields, bookmarks, upvotes, and preview media map consistently. | `GameVerticalFeedScreen` mapper/caption/nav tests; game-details route contract tests.                       | Upload photo/video to real event and confirm appearance in Highlights and event page according to selected destination.                   | Partially automated; needs device media QA.            |
| Create                       | Creates text/media posts, event posts, and highlights without cross-posting to unintended surfaces.                                                      | Event/game id contract tests; create-post payload source tests; upload routing tests.                       | On device, run separate flows for normal post, event post, highlight, and story; confirm each writes only to the intended destination.    | Latest story/post regression covered; needs device QA. |
| Discover                     | Finds nearby games, mobile community content, teams, programs, public events, and maps without exposing private teams.                                   | Route integrity/navigation tests; map component tests; server visibility tests.                             | Seed NCAA/high school/pro/private teams and public/private events; verify map/list results by location and sport.                         | Partially automated; needs seeded data QA.             |
| Profile                      | Shows own profile, public profiles, posts/replies/upvotes, edit settings, followers/following, blocked users, and dark-mode readability.                 | Profile mapper parity tests; navigation guard tests; user display tests.                                    | Test owner vs visitor permissions, private profile gates, blocked-user views, and edit flows on device/web.                               | Partially automated; needs persona QA.                 |
| Messages                     | Supports DMs, group/team chat, notification taps, blocked/minor gates, and websocket/polling fallback.                                                   | Server messaging access/rate-limit tests; notification presentation tests.                                  | Two-device or two-session test for send/receive, reconnect, unread state, minor/adult restrictions, and blocked users.                    | Partially automated; needs multi-user runtime QA.      |
| Game and event pages         | Shows score/voting, details, posts, stories, reviews/photos/highlights, posting-window enforcement, and approval visibility.                             | Game approval/cache/race tests; event/game id contract tests; source tests for game details posting routes. | Verify normal post vs story vs highlight on real event, including the Giants v Jets regression path.                                      | Partially automated; device QA required.               |
| Team and program pages       | One sport page per program where appropriate; level/team picker; follow fan-out; private teams hidden; all teams/events represented in feed.             | Program label/navigation tests; server program follow tests; hidden-team visibility tests.                  | Seed boys/girls/JV/varsity teams per program and confirm event tabs and feed coverage for every team.                                     | Partially automated; seeded program QA required.       |
| Ads and payments             | Enforces platform payment rules, plan limits, booking windows, ad ownership, approval, and lifecycle transitions.                                        | Server payment/ad race tests; payment confidence suite; route guards.                                       | Provider sandbox runs for Stripe, Apple IAP, and Google Play; dashboard confirmation for webhook outcomes.                                | Automated plus provider QA required.                   |
| Admin and approvals          | Admin-only moderation, user/team/ad/event approvals, coach/org access barriers, and audit logs.                                                          | Server access matrix and coach-flow tests; route guard tests.                                               | Admin, org owner, org manager, coach, assistant coach, fan personas must exercise allowed and denied actions.                             | Partially automated; persona QA required.              |
| Auth and onboarding          | Sign in/up, password reset, email verification, coach approval, identity verification, and onboarding redirects work without bypasses.                   | Auth guard, onboarding, session, route, and server middleware tests.                                        | Fresh install/browser sessions for every account state: anonymous, unverified, fan, pending coach, rejected coach, approved coach, admin. | Partially automated; manual account-state QA required. |
| Notifications and deep links | Taps route to the correct screen with allowlisted params; push failures do not block primary flows.                                                      | Notification presentation tests; deep-link/navigation contract tests.                                       | Real push notification delivery and tap tests on iOS and Android production-like builds.                                                  | Partially automated; device/provider QA required.      |
| Web/static export            | Web export prerenders without new warnings; web routes render safely; static bundle reflects current source.                                             | Web export warning guard; route integrity tests.                                                            | Verify deployed web URL is built from the current commit after PR merge/deploy.                                                           | Automated locally; deploy verification required.       |
| Observability                | Sentry/PostHog initialize and meaningful exceptions are captured without over-suppression.                                                               | Sentry config verification script exists; source wiring verified.                                           | Trigger a real client and server test exception and confirm arrival in Sentry dashboard.                                                  | Blocked without dashboard/API token.                   |

## Release Gate For "Works As Advertised"

Run these before claiming an app-wide pass:

```bash
npm run check:conflicts
npm run format:check
npm run audit:navigation:fail
npm run verify:error-envelope
npm run verify:secrets
npx tsc --noEmit
npx tsc --noEmit --project server/tsconfig.json
npm test -- --runInBand
npm --prefix server test -- --runInBand
```

Then complete a manual QA pass with these personas:

| Persona           | Must exercise                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Anonymous visitor | Public team/program/event/profile pages, sign-in redirects, blocked private content.         |
| Fan               | Feed, follow/unfollow teams/programs, create normal posts, RSVP, notifications.              |
| Coach/team owner  | Create/edit games and events, upload stories/highlights/posts separately, roster/team tools. |
| Org owner         | Program/team management, org invites, org pages, manager permission boundaries.              |
| Org manager       | Event/game management only where allowed; no owner-only organization actions.                |
| Admin             | User/team/ad/event approvals, moderation, audit-log-producing actions.                       |
| Minor account     | DM restrictions, follow gates, profile privacy, blocked adult contact.                       |

## Known Gaps That Are Not "All Clear"

- `origin/main` is not current until PR #279 is merged.
- Device-only flows still need real iOS/Android QA: media picker/camera, current location,
  push notifications, native deep links, and OTA update behavior.
- Provider workflows still need dashboard-backed QA: Sentry event arrival, Stripe/Apple/Google
  payment lifecycle, SendGrid delivery, and Cloudinary media transformation behavior.
- NCAA visibility should be verified with seeded NCAA teams/events and feed/discover/game-page
  personas, because a code-only pass cannot prove production data completeness.

## Latest Local Run

Run date: 2026-09-01

| Gate                                              | Result                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check:conflicts`                         | Pass: no conflict markers found.                                                                                                                                   |
| `npm run format:check`                            | Pass after formatting this new matrix file.                                                                                                                        |
| `npm run audit:navigation:fail`                   | Pass: 0 REVIEW items.                                                                                                                                              |
| `npm run verify:error-envelope`                   | Pass: no server changes detected.                                                                                                                                  |
| `npm run verify:secrets`                          | Pass: secret literal scan passed.                                                                                                                                  |
| `npx tsc --noEmit`                                | Pass.                                                                                                                                                              |
| `npx tsc --noEmit --project server/tsconfig.json` | Pass.                                                                                                                                                              |
| Focused story/post/feed regression tests          | Pass: 3 suites, 8 tests.                                                                                                                                           |
| Full client Jest suite                            | Pass before the feed smoke-test isolation fix: 189 suites passed, 1 skipped; 1338 tests passed, 2 skipped. Existing open-handle warning remains test-harness debt. |
| Full server Jest suite                            | Pass: 296 suites, 2824 tests.                                                                                                                                      |

Finding closed during this run: `app/__tests__/feed.smoke.test.tsx` used an incomplete API mock,
so the smoke test could pass while `FeedScreen` logged caught `Game.list`, `Event.filter`, and
notification-loader failures. The test now mocks those feed dependencies explicitly, including the
NCAA/pro event loaders and seed-sample call path.
