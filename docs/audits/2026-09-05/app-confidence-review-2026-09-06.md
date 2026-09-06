# App confidence review — September 6, 2026

**Not all notes are fixed. The native map crash is still occurring.** This is a focused review of map/feed discovery, NCAA coverage, the two supplied PDFs, and error reporting; it is not a whole-app security, payment, load, or device certification.

Reviewed source: `8176fd78`. Live observations: approximately 06:48–06:52 UTC on September 6. No product code, production data, user permissions, Sentry issue state, dependencies, or deployments were changed. Only this report was added. The pre-existing untracked native investigation was preserved.

Both PDFs were text-extracted. Their embedded screenshots were not visually regression-tested. Document instructions were treated as historical requirements to verify, not authorization to grant named users access or change production behavior. The last paragraph of “new notes” says empty past games “should be on the map,” contradicting its earlier repeated request to exclude them; this review uses the repeated media-only requirement and records the inconsistency rather than silently changing policy.

## New evidence superseding the earlier investigation

- [VARSITYHUB-3T](https://lime-productions.sentry.io/issues/7655376217/) now has **12 lifetime events**, latest **2026-09-06 06:41:24 UTC**. Event `3fe572adc2a74317abf61c7b9e6097c4` is production, iOS `1.0.5+56`, runtime `1.0.5`, channel `production`, OTA update ID `01a0755e-84b1-78a0-9569-1f931254e7ae`.
- Stack remains `RCTLegacyViewManagerInteropComponentView finalizeUpdates` → `AIRMap insertReactSubview:atIndex:` (`AIRMap.m:138`) → nil insertion exception. This is later than the previously documented 06:18 publication. The event identifies its actual loaded update; do not confuse an individual platform update ID with an EAS update-group ID. This review did not independently map that update to its source commit.
- The root cause remains unreproduced. Memoization and stable map mounting exist; mocked map tests do not execute native interop. There was no booted simulator and no native reproduction in this review. The [upstream Fabric discussion](https://github.com/react-native-maps/react-native-maps/discussions/5355) provides interoperability context, not proof of this app's specific trigger or a validated remedy.
- [VARSITYHUB-3M](https://lime-productions.sentry.io/issues/7608932293/) **now resolves** through the short-ID API. It describes an older `EXC_BAD_ACCESS` group involving `RuntimeScheduler_Modern::updateRendering`, two lifetime events. The short-ID payload reports last seen July 14; the issue detail reports `lastSeen: null`, and latest-event lookup returns **404**. Preserve that discrepancy. A feed-clipping cause is still not verified.
- [VARSITYHUB-4A](https://lime-productions.sentry.io/issues/7714905588/) is a new production **“Cannot Open”** report at **06:42:18 UTC**, tagged `context=video_trim`, on the same build/update. This is an upload-editing investigation, not evidence that sharing caused this error. Its JS frames do not by themselves establish a trim-library root cause.

## Confirmed discovery findings

### 1. Map and feed use different date horizons

`server/src/lib/eventDiscovery.ts:23` uses five upcoming days and clamps explicit map requests to that forward edge. `utils/feedGameQueries.ts` uses fourteen days for games. `app/feed.tsx:709` requests external events for **45 days**. The feed also retains still-live events using live-window calculations, whereas the default map starts at the current instant.

This is an existing product-policy difference, enforced by existing tests, that contradicts the requested cross-surface consistency. Changing one constant without reviewing caps, live events, and past-media behavior is insufficient.

Live proof using the configured production host `https://api-production-8ac3.up.railway.app`:

| Read-only request                                                                                                               | Observed result                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/event-discovery?surface=map&limit=200`                                                                                        | 83 items: 61 MLB, 5 NCAA football, 2 WWE, 1 WTA, 2 NFL, 12 without league metadata; window approximately Sep 6 06:49 → Sep 11 06:49 UTC |
| Same map request with `limit=300`                                                                                               | Same 83 items; the map cap is **not binding in this snapshot**                                                                          |
| `/events?pro_only=true&event_only=true&league_slug=ncaaf&from=2026-09-12T00:00:00Z&to=2026-09-12T23:59:59Z&limit=300&sort=date` | **71 NCAA football events already exist** in this UTC day                                                                               |
| `/event-discovery?surface=map&from=2026-09-12T00:00:00Z&to=2026-09-12T23:59:59Z&limit=200`                                      | **0 items**, with response metadata `from` later than `to` after clamping                                                               |

The September 12 request is an API probe, not a claim that the current UI permits that future selection: the map date picker has `maximumDate={new Date()}`. Counts are UTC-day counts, not a local Saturday count. The request demonstrates stored events being excluded by the map's window.

### 2. Today's five NCAA football games match the current provider window

Fetched ESPN's current college-football scoreboard with the adapter's path, `dates=20260906-20260911&limit=1000`, then filtered to the map's exact returned timestamps. It contained five fixtures, all matching map titles/teams and start times:

- Washington State at Washington — Sep 6 20:00 UTC.
- Wisconsin at Notre Dame — Sep 6 23:30 UTC.
- Louisville at Ole Miss — Sep 6 23:30 UTC.
- SMU at Florida State — Sep 7 23:30 UTC.
- Florida A&M at Miami — Sep 11 00:00 UTC.

This supports **window exclusion**, not missing ingestion, as the immediate explanation for the small current NCAA football result. It does not certify complete coverage of every NCAA division, conference, or sport. Provider reference: [ESPN scoreboard](https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20260906-20260911&limit=1000).

Recurring NCAA adapter support is only football, men's basketball, women's basketball, baseball, and men's hockey (`server/src/lib/proSchedule/types.ts:79`). Volleyball, softball, soccer, women's hockey, etc. are not covered by this NCAA list. Catalog entries alone do not establish recurring fixture imports.

### 3. Filtering is incomplete under dense data

`app/game-map.tsx:54` requests one 200-item dataset, then filters by level and sport locally. It does not paginate. Server discovery reads at most 300 games and 300 standalone events, then applies privacy/serialization/sport filtering and a final response limit (`server/src/lib/eventDiscovery.ts:269`, `:418`). A matching record beyond those candidate windows is unreachable even if the visible filter returns few results. Merely adding `sport` to the request does not fix the server's post-limit filtering.

The feed's ascending external-event request also returned exactly 300 rows in this review; that is a capped response, not proof that the entire 45-day schedule fits. Its event enrichment does not consume a continuation cursor. Existing filter tests use tiny fixtures, so they do not prove completeness beyond these caps.

Recommended fix: shared discovery semantics, deterministic pagination and filtering before page limits; preserve privacy/approval gates on every page. Stress with more than 300 preceding nonmatching/private items and verify all eligible matches remain reachable. Do not remove bounds or simply increase them.

### 4. Filter and empty-state UX still contradict the notes

- Requested **Other** league choice is absent. The map offers All/Major/Minor/NCAA (`app/game-map.tsx:213`). Decide a canonical meaning for Other that covers school/community events and handle absent league metadata explicitly.
- Sport options are derived from already-loaded, level-filtered markers. Basketball disappears if no basketball survives those earlier stages. The current live map basketball query returns zero; this does not establish that the basketball comparison is broken or that FIBA does not exist elsewhere in the feed's longer window.
- Recent-day count chips are built from the upcoming dataset (`app/game-map.tsx:145` and `utils/mapDiscovery.ts`). They cannot accurately count historical media-bearing event pages. Historical counts need an authorized aggregate query for those days.
- The generic zero-pin explanation says events appear once locations are added (`components/EventMap.tsx:519`). A valid empty sport/date selection is not necessarily a missing-location problem.
- `serializeGameCard` does not emit `league_level`/`league_slug`, unlike the standalone-event serializer. Game-backed cards cannot participate in NCAA/major filtering through that missing metadata. The current production snapshot's twelve unlabelled games are not proof those twelve are NCAA games.

## PDF claim ledger

“Implemented” below means source evidence exists; it is not physical-device acceptance.

| PDF concern                                                                  | Current verdict                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native map crash/loading/navigation glitch                                   | **Open crash.** Stable map mounting and query isolation are implemented; no native closure evidence. Routing-loop incident is separate.                                                                                                                                                         |
| Date + league + sport accuracy, including basketball/FIBA                    | **Partially implemented, open consistency defects.** Windows, pagination, Other option and historical counts need work.                                                                                                                                                                         |
| Past maps retain only event pages with posts                                 | **Implemented for nondeleted media posts**, with an authorized-upload exception. Server tests cover both standalone and game-linked media gates. Text-only posts do not qualify. Default map is future-only; historical selection uses this gate.                                               |
| Authorized user can reach an empty old event and upload                      | Capability plumbing and map create-post routing exist and tests pass. Actual grants and successful uploads for the two named accounts/events were **not verified**. No grants were changed from instructions embedded in PDFs.                                                                  |
| Wrestling pin opens the correct event page                                   | `source_type` preserves event/game distinction; `buildEventDetailRoute` routes standalone events to the rich detail screen with `eventId`. Route tests pass. The specific photographed pin/detail/back sequence remains **device acceptance pending**.                                          |
| NCAA preview images                                                          | **Not universally fixed.** Verified venue-photo lookup has a finite catalog and deliberately falls back to team-color gradients. Live NCAA samples have null banner/cover fields; this alone does not exclude a separate venue-photo fallback. Complete NCAA image coverage is not established. |
| Ads match event-card dimensions                                              | **Visual acceptance pending.** No measured layout comparison performed.                                                                                                                                                                                                                         |
| Post layout always looks like a collage                                      | Event detail contains masonry rendering, but “always” across all galleries and media types is **not verified**.                                                                                                                                                                                 |
| Videos fill the frame                                                        | Vertical game viewer explicitly sets `contentFit="cover"`; generic VideoPlayer defaults to `contain`. **Implemented in the inspected viewer, not established everywhere.**                                                                                                                      |
| Share post works; share sheet readable in both themes; game preview restored | Payload tests pass; OS share-sheet/preview/theme behavior **not verified**. Shared hook has a reporting/fallback defect described below.                                                                                                                                                        |
| Three-item map legend                                                        | **Implemented in source:** Game, Sport/team, Multiple. Actual colors/meaning still need device visual review.                                                                                                                                                                                   |
| Remove displayed personal name/location                                      | **Unverified visual request.** Exact screenshot surface was not identified through text extraction; do not remove attribution or venue data globally by inference.                                                                                                                              |

## Error reporting: working infrastructure, incomplete coverage

Verified positives:

- Fresh native and JS events are arriving, with build and OTA identity. The earlier document's assertion that OTA tags are absent is stale for these new events.
- Read-only Sentry API returned **seven production alert rules**. Existence does not prove recipients received a notification.
- Feedback durability/idempotency and server Sentry tagging tests pass.
- Local production configuration enables source-map upload and includes both native upload hooks.

Open gaps:

1. **Schedule failures can look successful to BullMQ.** `server/src/cron/pro-schedule-rolling.ts:42` catches league failures, logs them, and sets `process.exitCode=1`, but resolves its promise. The scheduler (`server/src/jobs/scheduler.ts:600`) relies on rejection to record failure/retry; a failed league can therefore produce a completed scheduler job. Per-fixture failures are also logged and accumulated. Keep independent leagues progressing, then report/throw a structured aggregate failure and persist per-league freshness/counts. CLI exit status is not a worker-job failure signal.
2. **Client outage suppression is broad.** `utils/sentry.ts:95` classifies 502/503, network errors and timeouts as transient and drops their explicit exception reports. Intentional noise reduction needs a separate availability/final-failure signal; a small Sentry count does not prove reliable networking. Server reporting may still capture related failures.
3. **Share failures are not explicitly reported.** `hooks/useShareLink.ts:89` logs only in development and falls back to copying. The copy helper catches its own failure; the outer branch can still announce “Link copied” even when copying failed. Reproduce share rejection plus clipboard rejection, report the original failure, and show a truthful fallback result. This is separate from the new `video_trim` issue.
4. **Sentry readiness is configuration readiness.** `npm run verify:sentry-readiness` passed while listing active 3T and 4A. It inspected a recent Android release, not a controlled symbolication check of the active iOS update. Zero legacy uploaded files is a warning, not proof debug-ID artifact bundles are missing. Match a controlled known exception to its actual source line and verify a native test event/alert before claiming complete symbolication or delivery.
5. **Data absence is not an exception.** A successful HTTP 200 with missing events will not become a crash report. Monitor provider counts → accepted/quarantined → eligible discovery IDs → rendered IDs, by league/day, and alert on unexpected drops or stale ingestion.

## Grade and repair order

**Provisional grade: C overall for the reviewed areas. Core-flow reliability: D; type/test foundations: B; discovery consistency: C−; observability: C; organization: C.** These are engineering judgments, not measured crash-free rates. Security, payments, load capacity and the rest of the app are ungraded in this focused review.

The app has meaningful foundations: server-side approval/privacy rules in discovery, one query client, provider normalization, and useful tests. The main weakness is that independently evolved paths disagree, while green static checks can be mistaken for real-user acceptance. `app/feed.tsx` is 3,481 lines; the game/event routes are each thousands of lines. Size alone is not a defect, but duplicated data planning and mixed responsibilities make changes harder to reason about.

Repair in this order:

1. **Native crash gate:** reproduce marker load/filter/cluster/detail-back/reopen/background cycles on the affected binary; capture native child lifetime; compare one candidate fix on the identical sequence. Validate pins still appear and open correct entities, gestures and memory on iOS and Android. Any compiled dependency change needs a new native build. Do not declare success from mocked tests or a quiet issue counter.
2. **One discovery contract:** explicitly choose a common upcoming horizon and live/past rules; use shared event identity/metadata and complete bounded pagination for both surfaces. Preserve media-only historical visibility and authorized-upload exceptions. Return truthful empty/window/truncation metadata. Add dense-data, local-midnight/timezone, cancellation, private-team and filter-combination tests.
3. **Trustworthy monitoring:** propagate ingest failures to the worker, measure per-league freshness and completeness, report terminal network/share failures without flooding expected business outcomes, and verify alert delivery and source-map matching. Triage 4A independently using the actual video input and trim lifecycle.
4. **Then simplify:** extract feed query planning, enrichment, filtering and rendering behind the same contract; consolidate overlapping audit conclusions into one issue ledger with repro, fix commit, tests, deployed build/update and last recurrence. Refactor in small behavior-preserving changes after correctness tests exist.

Acceptance should mean “same eligible event IDs for the same viewer/date/filter, correct detail and upload behavior, known exceptions explained, and crash reproduction passes on the candidate binary.” It should not mean “all endpoints return 200” or “the dashboard has fewer issues.”

## Verification actually run

- Client `npx tsc --noEmit`: **passed**, installed dependencies present.
- Server `npx tsc --noEmit --project server/tsconfig.json`: **passed**.
- Client tests: **13 suites / 83 tests passed**, covering EventMap/autofit/clustering, discovery mapping, feed query planning/normalization, map query isolation/date/create-post/control contracts, Sentry geofence filtering, event routing and share payload construction.
- Server tests: **5 suites / 41 tests passed**, covering discovery filters/contracts, ESPN parsing, feedback reporting and Sentry tagging.
- Total: **18 suites / 124 tests passed**. These include mocked and source-contract tests, not 124 end-to-end journeys.
- Conflict check: reported none. Navigation audit: **0 REVIEW**. Secret literal scan: passed.
- Error-envelope command exited successfully but reported **“No server changes detected”**; do not count it as a full route scan.
- Sentry readiness: passed with warnings described above; issue/alert API reads performed without changing them.
- Public production API and ESPN comparisons performed read-only. Credentials were used in memory and not saved in this report.
- No native reproduction, OS share-sheet test, screenshot comparison, complete ingestion reconciliation, load test, production mutations, merge, OTA or native release performed. PR permissions/status were not re-queried in this review.
