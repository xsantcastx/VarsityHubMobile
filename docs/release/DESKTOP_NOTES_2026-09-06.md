# September 6 desktop-notes repair release

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
| @superfan and Nico story exceptions  | Existing platform-admin grant path writes both required ledgers atomically with seven-day expiry. No blanket geofence change.                                                                           | Pending exact account/event targets and expiry clarification; no production grants made.             |
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
