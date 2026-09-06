# September 6 desktop-notes repair release

**Published:** API, iOS/Android OTA and web from code commit `cf46471c`.
Account access is verified below; Nico's renewal target and physical-device acceptance remain open.

Publication authorized by the owner in this session: “keep going … then push to
production through EAS or OTA. I will verify on my end.” The owner owns physical
device acceptance after publication. This is a scoped repair release, not a claim
that the entire app passed the broader launch-readiness checklist.

## Note-by-note status

| Note                                 | Implementation and evidence                                                                                                                                                                             | Remaining acceptance                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Native map crash                     | Two baseline simulator crashes matched the AIRMap nil-insertion path. Deterministic marker keys/order completed two 30-cycle runs. Reproduction harness retained.                                       | Physical iOS/Android; all native causes are not proven eliminated.                                   |
| Combined date/sport/league filters   | Shared 14-day discovery contract, complete bounded pagination, explicit Other, stable sport choices, accurate historical queries; selected preview cleared when filtered out.                           | Compare live rendered results on owner's device.                                                     |
| More NCAA events                     | Existing September 12 fixtures become reachable in the common window; no fabricated schedules. Dense pagination and parity tests pass.                                                                  | Provider coverage outside sampled NCAA football windows is not certified.                            |
| Basketball/FIBA option               | Canonical sport choices do not disappear based on returned records; existing FIBA catalog migration is applied in production.                                                                           | Particular FIBA fixture availability depends on provider records.                                    |
| Old dates retain media-bearing pages | Existing server media/privacy gates retained with temporary authorized-upload exceptions.                                                                                                               | Owner's historical browsing acceptance.                                                              |
| Wrestling navigation                 | Both visible WWE fixtures returned 200 from their actual detail and HTML routes; standalone event routing and duplicate-navigation prevention remain tested.                                            | Tap/detail/back on owner's device.                                                                   |
| NCAA preview images                  | Added verified California Memorial Stadium and Mackay Stadium photos for the two photographed gaps. Shared venue lookup supplies feed/details. Unknown venues retain an honest fallback.                | This does not imply a photo exists for every NCAA venue.                                             |
| Consistent ad dimensions             | Feed ad margins and fixed aspect ratio match event cards even after intrinsic image dimensions load. Creative fit choice preserved. Render test passes.                                                 | Device visual review.                                                                                |
| Collage instead of three-column rows | Existing two-column varied-height EventDetails masonry retained; collage tests passed.                                                                                                                  | Device visual review.                                                                                |
| Video fills the frame                | Post-detail, fullscreen post video, and event stories now explicitly use cover; immersive game viewer already did. Playback gates retained.                                                             | Crop/framing preference on owner's videos.                                                           |
| Share post / menu contrast           | Existing iOS modal-dismiss sequencing and light text on dark menu retained. Both sharing paths now capture failures and never claim copying after failure; canceled video shares do not record success. | Actual iOS/Android share sheet.                                                                      |
| Game link preview                    | Game HTML landing now selects an image; game/event crawler routes fall back to reviewed venue photos after privacy checks. HTTP tests include public preview and pending-game non-disclosure.           | OS preview caches and Messages rendering.                                                            |
| Three map legend entries             | Existing Game / Sport-team / Multiple legend verified in simulator screenshot.                                                                                                                          | Owner's visual acceptance.                                                                           |
| Push status wording                  | Replaced exposed token preview with “Notifications enabled” and plain-language device registration status.                                                                                              | No delivery guarantee implied.                                                                       |
| Remove personal name/location        | Removed those fields from the exact Copyright & DMCA contact card shown in the PDF.                                                                                                                     | Organization/email/website retained.                                                                 |
| @superfan and Nico story exceptions  | Production permission checks pass for both users. @superfan refreshed through September 13; @nico already has both August 29 Yankees grants through September 12. See exact audit below.                | Nico's intended game must be distinguished before renewing either existing grant.                    |
| Catch/report bugs accurately         | Terminal transport reporting, distinct share failure contexts, durable per-league ingestion outcomes, worker rejection after aggregate failure.                                                         | Controlled alert delivery and source-line/native symbolication acceptance; 3M/4A causes remain open. |

Screenshots from both PDFs were visually inspected during this follow-up. Earlier
audit documents remain historical snapshots, superseded by this release ledger
for changed items. Neither green tests nor an HTTP 200 imply universal correctness.

Photo provenance verified through Wikimedia image metadata on September 6:
[California Memorial Stadium](https://commons.wikimedia.org/wiki/File:California_Memorial_Stadium_aerial_view.jpg)
(Quintin Soloviev, CC BY 4.0) and
[Mackay Stadium](https://commons.wikimedia.org/wiki/File:Mackay_10oct2015.jpg)
(Lanski, CC BY-SA 4.0). Existing event-page attribution renders their credits.

## Release gates

- `release:verify:local`: passed against isolated, fully migrated local database
  `vh_notes_release_20260906`, with localhost port 4096 for embedded runtime tests.
  Initial failures came from the old local database missing the ad-hold migration,
  then a verifier contacting another server on port 4000; neither was bypassed.
- `release:verify:build`: passed; nonblocking warnings concern dirty tree before
  commit and optional native store submission credentials. No native build or
  store submission requested by this publication path.
- Targeted presentation: 108 client tests and 25 server tests passed. Core
  discovery/map/reporting: 62 client tests plus previously recorded 36 server
  tests passed. These overlap release regressions; do not add totals as unique
  whole-app coverage.
- Sentry configuration check passed with unresolved issues explicitly reported.
- All 151 local migrations are already applied in production; no pending or
  unresolved failed migration. Existing April history drift was recorded and
  not modified. This change adds no migration.

## Deployment and rollback

Upstream GitHub access remains pull-only; pushing the fork does not deploy API
changes. Authorized path: clean commit and fork PR update, direct Railway API
deployment from that commit, runtime verification of paginated discovery, then
`npm run update:production`. Do not publish the client before the server response
contains `next_cursor`. Existing clients can still use the legacy endpoint shape.

Previous API deployment: `c46c3898-1166-4125-9f3e-ba848b35cee9` (already uses the
compatible September ad-inventory adapter). Previous OTA group:
`6db590e9-2e95-4c93-929c-170ce0a67369`, runtime 1.0.5, iOS and Android.
If discovery or native crashes regress, republish that prior OTA first. Retain
the new backward-compatible API until client rollback is confirmed; then restore
the previous API deployment if needed. Do not roll back to pre-ad-hold writers.

Record actual deployment IDs, commit, OTA group and post-deploy counts in the
publication follow-up. Abort client publication if API health, cursor traversal,
or feed/map parity fails. Owner's device review remains an explicit follow-up.

## Publication evidence

- Code commit: `cf46471c9c34bfd91407f14bfdae0c96a829cd31`, pushed to the fork;
  [PR #281](https://github.com/xsantcastx/VarsityHubMobile/pull/281) remains open
  and mergeable. Upstream merge is still unavailable to this account. A future
  upstream deployment must include these changes to avoid overwriting them.
- Railway API deployment: `212ba615-b7c4-4d63-9d7b-1196774e9c02`, SUCCESS.
  Runtime gate was rerun using production Railway environment variables kept
  in memory, and passed. `/health` returned OK after publication.
- [OTA group](https://expo.dev/accounts/varsity-hub/projects/varsityhub/updates/f6d00d02-0588-45d2-a569-753f476002a7):
  `f6d00d02-0588-45d2-a569-753f476002a7`, published 2026-09-06 07:47:32 UTC,
  production branch, runtime 1.0.5, both platforms.
  iOS update `01a075af-d4ac-76c8-b431-4de276a5501c`;
  Android update `01a075af-d4ac-777e-b372-f906e5fd8fab`.
  Sentry artifact-bundle upload completed successfully for bundles/source maps.
- Web deployment: `https://varsityhub-6arntbeyo-emilmancero-devs-projects.vercel.app`.
  Both `www.varsityhub.app` and `varsityhub.app` aliases updated successfully;
  website returned 200.
- Live query, September 6 07:45 UTC: September 6 00:00 through September 19
  23:59:59 UTC returned **379 feed and 379 map items**, identical eligible IDs,
  four pages on each surface. League counts: 154 NCAA football, 180 MLB, 17 NFL,
  12 FIBA women's basketball, 10 WNBA, 5 WWE, 1 WTA.
  September 12 UTC NCAA-football filter returned 71. Other returned 12 with
  no major/minor/college leakage. Anonymous August 28 historical query returned
  one media-bearing event. Forged cursor returned 400.
- Both photographed NCAA examples returned venue-photo data and venue-image OG
  previews. Both visible wrestling URLs returned 200 and event-specific title
  plus image metadata through the production website's Applebot route.
- Additional native stress acceptance: temporarily changed only the diagnostic
  fixture count from 220 to 500, leaving production EventMap unchanged. It
  completed all 30 cycles, final timestamp `1788681149418`, and a simulator
  screenshot showed COMPLETE with 500 events. The diagnostic source was restored
  to its committed 220-fixture baseline afterward. This supplements three
  successful 220-fixture candidate runs; it remains simulator evidence.
- Sentry 4A latest event `940351bed9db4527acea20f72d872ceb` identifies
  `stage=thumbnail_gen`, `uri_scheme=file`, `native_module=present`. The captured
  failure is thumbnail generation, not evidence the actual trim operation failed.
  The original media file is unavailable; no speculative trim fix was shipped.

## September 6 operator follow-up (16:17–16:26 UTC)

The owner identified **@nico**, Yankees home game **August 29, 2026**, and said
to proceed after the standard seven-day grant proposal. Production lookup found
two distinct Red Sox at Yankees records; ESPN's summary endpoint returned both
as completed games, matching their separate source IDs and start times:

| User / event                                           | Production event ID                           | Verified expiry (UTC)      | Action this session       |
| ------------------------------------------------------ | --------------------------------------------- | -------------------------- | ------------------------- |
| @superfan / Giants at Jets, August 28                  | `cmsgoxrtw007bf6nioxe8yllz`                   | September 13, 16:22:53.007 | Refreshed existing access |
| @nico / Red Sox at Yankees, August 29, 1:05 PM Eastern | `cmsgoyfva00qzf6niwaz4axpf` (`mlb:401874913`) | September 12, 07:22:43.568 | Existing access preserved |
| @nico / Red Sox at Yankees, August 29, 7:15 PM Eastern | `cmsgoygmd00rnf6nixj1os096` (`mlb:401816717`) | September 12, 07:22:46.435 | Existing access preserved |

**Correction to earlier assumptions:** access already existed for all three
user/event pairs. Nico's designation rows date to August 30, and both unlocks
were refreshed September 5. This session did not create those Nico grants or
establish who authorized their original scope. Ask which game the owner intends
before refreshing either; do not infer both from the date alone.

Superfan's refresh used the canonical `grantEventPostAccess` helper inside an
outer database transaction that also wrote `AdminActivityLog` record
`operator-grant-superfan-20260906`. The audit identifies an owner-authorized
operator action, with no impersonated app-admin account. Both ledgers and the
audit committed together; a fixed audit ID prevents rerunning this operation
from silently extending the window. Start: `2026-09-06T16:22:53.007Z`.

Read-only production calls to the real `verifyEventPostingPermission` and
`verifyStoryPostingPermission` helpers, with null device coordinates, returned
`allowed: true` for all three pairs. Superfan's checks were also true before the
refresh; this is an expiry refresh, not proof of fixing a denied-upload bug.
Control: Nico remains denied both post and story access to Giants at Jets
(`POSTING_WINDOW_CLOSED`). Audit row readback succeeded. No test media was posted.

Sentry recheck at approximately 16:18 UTC leaves all three investigations open:

- **3T:** 12 occurrences, latest `2026-09-06T06:41:24Z`, before the published
  07:47 OTA. No new occurrence in this issue is evidence of non-recurrence so
  far, not evidence of affected-flow traffic or complete native resolution.
- **3M:** issue lookup succeeds, count 2, `lastSeen: null`; latest-event lookup
  remains 404. Feed-clipping attribution remains unverified.
- **4A:** count 1, latest `2026-09-06T06:42:18.826Z`, stage `thumbnail_gen`, file
  URI. No new event; original input media is still needed for a matched repro.

`xcrun xctrace list devices` still reports the physical iPhone offline. Existing
simulator baseline/candidate evidence remains valid; no physical-device pass is
claimed. No Sentry issues were marked resolved. No code changed or additional
OTA/native build was published for this database-only grant operation.

Physical-device checks, OS preview behavior and alert delivery are not certified
by this publication. Unknown venue photos remain honest fallbacks rather than
invented imagery or fixture data.

## Broader crash/reporting follow-up

**Open native incident 49:** production event
`e5197dda7329450c825ce13392e90ad7`, September 6 **15:40:49 UTC**, explicitly tags
the published iOS OTA `01a075af-d4ac-76c8-b431-4de276a5501c` on build 56.
The issue has two occurrences. Stack: `SharedObjectRegistry.clear` →
`EXJavaScriptWeakObject .cxx_destruct` → `jsi::WeakObject` / `jsi::Pointer`
destruction. Installed expo-modules-core 3.0.30 clears its registry asynchronously
on a lock queue. This identifies a runtime-teardown lifetime investigation,
not a demonstrated AIRMap regression. Do not claim the published app is free
of native crashes. A matched native reproduction and physical-device validation
remain required; changing compiled Expo Modules code needs a native release.

**Confirmed reporting configuration gap:** Metro used Expo's default config,
without Sentry's `getSentryExpoConfig` serializer plugin. The installed Sentry
7.2 implementation adds a runtime `_sentryDebugIds` module that connects event
frames to matching source-map Debug IDs. Upload success alone did not verify
that runtime connection. Changed Metro's base configuration to the Sentry Expo
integration while retaining existing aliases/resolvers; readiness now checks
that integration too. Reference: [Expo Sentry setup](https://docs.expo.dev/guides/using-sentry/).

Local iOS/Android release exports both passed and contained `_sentryDebugIds`
plus the exact Debug ID from their matching source map (3,648 iOS sources;
3,695 Android). Twelve targeted Sentry filtering/terminal-transport tests passed.
This is artifact-level verification, not proof of end-to-end production alert
delivery. Publication details for this reporting fix are recorded separately below.

The retained 4A event has no processing errors, but displayed mapped frames
(for example NativeShareModule at raw `CodedError`) do not correspond to its
raw function names. Treat those historical mapped lines as unreliable. 3M's
event-list endpoint returns 200 with an empty list; latest-event remains 404,
so its original payload is unavailable through these lookups.

**4A controlled native probe:** `scripts/diagnostics/thumbnail-repro-entry.tsx`
runs outside the production entry, against synthetic H.264 MP4 clips generated
with ffmpeg (`testsrc2`, 320×240, 30fps; 0.5 seconds and 3 seconds). On the existing
iOS 26.2 simulator/native dev build, both exact-endpoint and interior-only
sampling returned all ten thumbnails for both videos. The exact-endpoint
hypothesis did not reproduce. Original failing media is still unavailable;
no speculative VideoTrimmer behavior change was made. The harness uses local
HTTP port 8765 and foreground downloads; it sends no Sentry events.

**4B ingestion reporting is working:** the 08:00 production run persisted MLB
as partial: fetched 337, updated 291, rejected 46. All 25 sampled rejection
messages in Railway were `NO_TITLE`. ESPN summary for rejected
`mlb:401907896` identifies a September 29 fixture with both teams TBD. These
unresolved placeholders must not be published with invented identities. NCAA
football independently completed 418 updates with zero failures over the
45-day ingestion horizon; that differs intentionally from the 14-day public
discovery horizon. Other league work continued despite MLB's partial run.
No validator was weakened and no schedule records were fabricated.

Alert-rule readback initially returned seven production email rules, including
the new-error rule; a later readiness query returned HTTP 410 for that API.
Do not equate configured rules with delivered notifications. No alert was sent
to another person as part of these checks.
