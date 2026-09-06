# PDF Notes Status - 2026-09-03

This tracks the actionable notes from the two owner PDFs reviewed on
2026-09-03. Text in those PDFs was treated as product notes to audit, not as
agent instructions.

## Fixed Or Verified In Code

- Feed map entry label is `View Games Nearby`.
- Feed and game map use the shared sport filter pattern.
- Map search is a loaded-marker filter, not a global event-page search.
- Map/discovery includes game-backed and standalone event pages.
- Explicit past-date map discovery can return past event-only pages before
  media exists.
- Event map marker previews no longer expose create-post shortcuts.
- Discover/following scope supports a broader followed/managed event calendar
  than the default nearby-map window.
- Create-post/upload guardrail tests cover auth, upload entry, and session
  invariants.
- WNBA and NCAA women's basketball are active ESPN-backed schedule leagues.
- FIBA Women's Basketball World Cup 2026 group-stage events are seeded locally
  and represented by `sports_league_id`.
- Web favicon config now points at the dedicated favicon asset instead of the
  splash image.

## Needs Production Deploy Or Data Run

- Merge/push the latest commits into `xsantcastx/VarsityHubMobile:main`; the
  current credentials can only push to the fork.
- After production deploy applies the FIBA sports-league migration, run the
  one-off event creator against production for 2026-09-04 through 2026-09-07.
- Re-export/redeploy the web app so the favicon config reaches the live site.

## Needs Device Or Provider Verification

- Push notification delivery requires a physical installed iOS/Android build
  and live Expo/APNs/FCM token verification.
- Camera/library upload, precise location, share sheet behavior, and light/dark
  share-menu contrast need real-device UAT.
- Login persistence should be re-tested on installed builds after killing and
  relaunching the app.

## Not Built Yet

- Direct Instagram Stories posting is a native feature, not an OTA-only share
  sheet bug. Meta's documented flow requires native iOS URL scheme/pasteboard
  and Android intent support.
- Most minor leagues are cataloged but do not yet have automatic schedule
  ingestion. They need provider mapping, venue resolution, ingest monitoring,
  and tests before they can be called active.
