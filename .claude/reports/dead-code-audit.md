# Dead Code Audit — VarsityHub Mobile

Generated: 2026-07-11
Repo: /Users/varsityhub/Code/VarsityHubMobile
Routine: .claude/scheduled-tasks/dead-code-audit/SKILL.md

Method: static grep sweep across `api app components hooks context utils lib constants shared server` (excluding `node_modules`, `dist`, `.git`). Every candidate was re-verified with a broad whole-repo search before being reported. "Test-only" means the sole references are under `__tests__`. Findings are grouped by the skill's five steps.

**Scope note:** the skill named `api/teams.ts`, `api/games.ts`, `api/posts.ts`, `api/misc.ts` — none of these files exist on disk (CLAUDE.md still describes them, but they are stale references). That functionality lives in `api/entities.ts` as namespace objects (`Team`, `Game`, `Post`, ...). Step 1 was therefore run against the api files that actually exist: `api/entities.ts` and `api/auth.ts`.

**Actionable findings: 21** — 2 api exports, 2 orphaned screens, 13 unused components, 4 unused hooks — plus 3 server routers uncalled by the mobile client.

---

## 1. Unused exports in api/

| #   | File:Line           | Export                       | Status                                                                                                                                                                                | Safe to delete?                                                                                                         |
| --- | ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | api/entities.ts:982 | `TeamInvites` (const object) | DEAD — zero references anywhere except a test comment in `server/src/__tests__/invite-identifier-routes.test.ts:204` that explicitly calls it "the unused TeamInvites.create helper". | Yes. Pure object literal, no module-level side effects.                                                                 |
| 2   | api/auth.ts:216     | `loadToken`                  | Redundant export — **0 external callers**, but the function is used internally within `auth.ts` (lines 350–460) and re-exposed via `auth.getToken: loadToken` (line 460).             | Not the function — only the `export` keyword. Downgrade to a private (non-exported) helper; do not delete the function. |

All 20 namespace exports in `api/entities.ts` (`User`, `Game`, `Post`, `Event`, `Message`, `Organization`, `Team`, `Program`, `Support`, `Report`, `Payments`, `Subscriptions`, `TeamMemberships`, `Notification`, `Advertisement`, `Search`, `Highlights`, `Feed`, `DataExport`) have live callers. `api/auth.ts` exports `invalidateMeCache` (used by entities.ts) and `clearStaleTokensOnFreshInstall` (used by context/AuthProvider.tsx) — both live.

Limitation: this step audits the _named exports_ only, not the individual methods inside each namespace object. A per-method sweep (e.g. is `Team.someMethod` ever called) is beyond a grep approach and could surface more dead methods.

---

## 2. Orphaned screens (app/)

Expo Router is file-based, so every `app/**/*.tsx` is auto-registered as a route. "Orphaned" here = no in-app navigation (`router.push/replace/navigate`, `href=`, `<Link>`, `<Redirect>`) targets it.

| #   | Screen                   | Status                                                                                                                                                      | Safe to delete?                                                                                        |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 3   | app/env-debug.tsx        | DEAD — zero references anywhere in the repo (no nav, no route constant, no test). Dev/debug screen reachable only by manually typing the URL.               | Likely — confirm it is not an intentional dev-only tool first.                                         |
| 4   | app/account-deletion.tsx | No in-app navigation. Only reference is `constants/legal.ts` building a public web URL `${LEGAL_BASE_URL}/account-deletion`. The app route is never pushed. | Borderline — probably kept as a deep-link/legal landing. Verify deep-link requirement before deleting. |

Investigated but **NOT dead**:

- **app/request-join-organization.tsx** — no in-app nav buttons, but `__tests__/navigation-direct-open-contracts.test.ts` documents it as "deep-link only — in-app entry buttons removed" and asserts the org-detail screen must NOT navigate to it. Intentional. Keep.

The other ~160 route files all have navigation references.

---

## 3. Unused components

All verified with a whole-repo search; zero references except where noted. Top-level `components/`:

| #   | File                                           | Status                                                                     | Safe to delete?                    |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| 5   | components/Collapsible.tsx                     | DEAD (Expo starter boilerplate)                                            | Yes                                |
| 6   | components/EmailPreview.tsx                    | DEAD                                                                       | Yes                                |
| 7   | components/EventMergeSuggestionModal.tsx       | DEAD                                                                       | Yes                                |
| 8   | components/ExternalLink.tsx                    | DEAD (Expo starter boilerplate)                                            | Yes                                |
| 9   | components/HelloWave.tsx                       | DEAD (Expo starter boilerplate)                                            | Yes                                |
| 10  | components/ParallaxScrollView.tsx              | DEAD (Expo starter boilerplate)                                            | Yes                                |
| 11  | components/TeamSearchInput.tsx                 | DEAD                                                                       | Yes                                |
| 12  | components/onboarding/OnboardingBackHeader.tsx | DEAD                                                                       | Yes                                |
| 13  | components/ui/AccessibleButton.tsx             | DEAD                                                                       | Yes                                |
| 14  | components/ui/MessagesTabIcon.tsx              | DEAD                                                                       | Yes                                |
| 15  | components/ZipAlternativesModal.tsx            | TEST-ONLY — referenced only by `__tests__/theme-surface-contract.test.ts`. | Yes (also drop the test reference) |

Additional dead components under `app/components/` (colocated, not top-level `components/`):

| #   | File                                  | Status                                                                                                                                                                   | Safe to delete? |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 16  | app/components/MatchBannerCapture.tsx | DEAD — 0 importers                                                                                                                                                       | Yes             |
| 17  | app/components/RsvpSheet.tsx          | DEAD — 0 importers. `GameDetailsScreen` uses a local inline Modal (`rsvpSheet*` state), not this component; only other mention is a note in `utils/darkModeFixGuide.ts`. | Yes             |

All are pure presentational components — no module-level side effects.

---

## 4. Unused hooks (hooks/)

| #   | File                             | Status                                                                                                                                                                                                                                                                                                                                           | Safe to delete?                                                                                                                          |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | hooks/useProfileOrganizations.ts | DEAD — 0 references                                                                                                                                                                                                                                                                                                                              | Yes                                                                                                                                      |
| 19  | hooks/useThemedStyles.ts         | DEAD — 0 references                                                                                                                                                                                                                                                                                                                              | Yes                                                                                                                                      |
| 20  | hooks/useUploadProgress.ts       | DEAD — 0 references                                                                                                                                                                                                                                                                                                                              | Yes                                                                                                                                      |
| 21  | hooks/useUser.ts                 | TEST-ONLY — no production caller; referenced only by 6 test files (`__tests__/useUser.test.tsx`, `app/__tests__/profile.smoke.test.tsx`, `__tests__/zip-code-contracts.test.ts`, `__tests__/settings-profile-prefill-contracts.test.ts`, `__tests__/profile-canonical-state-contracts.test.ts`, `__tests__/account-settings-contracts.test.ts`). | Investigate — a tested-but-unused hook usually means it was orphaned by a refactor. Confirm no dynamic use before removing hook + tests. |

All hooks are side-effect-free at module scope.

---

## 5. Dead server routes (server/src/routes/)

Compared each mounted router's endpoints against client path literals in `api/*.ts` and the wider client tree (`app`, `hooks`, `components`, `context`). "Uncalled by client" = the mobile app never issues a request to that mount. Endpoint definitions use the `xRouter.method(...)` pattern (not `router.method`).

Routers mounted in production (`server/src/app.ts`) but with **no mobile-client caller**:

| #   | Router / mount                  | Endpoints                                | Finding                                                                                                                                                                                                                                  |
| --- | ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | group-chats.ts → `/group-chats` | ~8 (2×GET list/detail, 4×POST, 1×DELETE) | No client caller. The only repo reference is a code comment in `app/(tabs)/team-contacts.tsx:149`. The entire router appears unused by the app — either a server-only/planned feature or dead-from-client. Highest-value item to triage. |
| B   | rsvps.ts → `/rsvps`             | `GET /`                                  | No client caller. RSVP UI (`app/rsvp-history.tsx`) goes through the `Event` namespace → `/events/...` endpoints instead; the `/rsvps` list endpoint is never hit.                                                                        |
| C   | consent.ts → `/consent`         | `GET`, 2×`POST`                          | No client caller. Driven by email/web consent links (`handleConsentResend`), not the app. Confirm the web/email flow still needs it before touching.                                                                                     |

Routers intentionally **not** app-client-facing (reported for completeness, NOT flagged as dead):

- `og.ts` (`/og`), `shareLanding.ts`, `publicSite.ts`, `publicAppHandoff.ts`, `well-known.ts` (`/.well-known`) — server-rendered / OpenGraph / deep-link landing pages for crawlers & browsers.
- `sendgrid-webhook.ts` (`/webhooks/sendgrid`) — inbound webhook.
- `test-notifications.ts`, `test-emails.ts` — dev/QA routers; no production client caller by design.
- `dataExport.ts` — mounted without a prefix (`parent.use(dataExportRouter)`), defines its own full paths, exercised by the settings/data-export screen.

`/promos` is partially live: the client calls only `POST /promos/preview` (`app/ad-calendar.tsx:495`); other promos endpoints were not individually confirmed as called.

---

## Recommended quick wins (highest confidence, zero risk)

Delete these 15 files — each has zero references anywhere (or is Expo boilerplate):

- components/Collapsible.tsx, components/EmailPreview.tsx, components/EventMergeSuggestionModal.tsx, components/ExternalLink.tsx, components/HelloWave.tsx, components/ParallaxScrollView.tsx, components/TeamSearchInput.tsx, components/onboarding/OnboardingBackHeader.tsx, components/ui/AccessibleButton.tsx, components/ui/MessagesTabIcon.tsx
- app/components/MatchBannerCapture.tsx, app/components/RsvpSheet.tsx
- hooks/useProfileOrganizations.ts, hooks/useThemedStyles.ts, hooks/useUploadProgress.ts

Then remove the dead `TeamInvites` export (api/entities.ts:982) and triage the `/group-chats` server router.

## Caveats

This is a static grep audit. Before deleting, guard against: dynamic route strings, barrel re-exports resolved at runtime, string-based component lookups, and deep-link-only screens. Two flagged items (`account-deletion`, `request-join-organization`) are deep-link surfaces and one (`env-debug`) is a debug tool — confirm intent before removal.
