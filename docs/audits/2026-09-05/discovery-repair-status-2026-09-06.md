# Map, discovery and reporting repairs — September 6, 2026

Status: implemented locally on top of `8176fd78`; not committed, merged or deployed.
This supplements the earlier confidence review and native investigation, which
describe the pre-repair state. It does not certify every PDF note or the whole app.

## Native evidence

A standalone development bundle, `scripts/diagnostics/map-repro-entry.tsx`, uses
the real EventMap and native stack with 220 synthetic records. Every cycle runs
empty/loading, populated markers, college-football filtering, coincident clusters,
reversed input, a reduced subset, empty/reload, detail navigation and back.
The interval is 800 ms, with a five-second initial delay and 30-cycle limit.
It is not a production route or a backend integration test.

Local Xcode Debug build succeeded with existing installed native dependencies:
react-native-maps 1.20.1, React Native 0.81.5, Fabric, Apple Maps; iPhone 17 Pro
simulator on iOS 26.2. No maps dependency or native source was changed.

The baseline crashed twice in the first cycle, after phase 5. Native system logs
recorded `NSInvalidArgumentException`, `insertObject:atIndex: object cannot be nil`,
with `AIRMap insertReactSubview:atIndex:` and interop `finalizeUpdates` frames,
matching the reported 3T exception path. The first recorded crash was
2026-09-06 07:11:56.868 UTC.

The candidate makes marker group ordering deterministic and namespaces single
marker keys by source type and ID. Reordering input alone no longer reorders
native siblings. It completed 30 cycles (final phase timestamp 1788679304272 ms
since epoch), including an observed background/foreground transition. LLDB
reported zero hits on both the conditional nil-child insertion breakpoint and
`objc_exception_throw` while attached. Attachment did not cover the entire run.
A later run after debugger detachment also completed all 30 cycles (final phase
timestamp 1788679719304). This is evidence for a mitigation of the reproduced sequence,
not proof that every native child lifetime is correct or all map crashes are gone.

Evidence on this workstation: `/tmp/varsityhub-native-map-exceptions.log`,
`/tmp/varsityhub-map-repro-metro.log`, `/tmp/varsityhub-map-repro-build.log`.
These temporary files are not durable CI artifacts. The diagnostic bundle is
retained so the sequence can be rerun. Simulator screenshots during subsequent
Fast Refresh runs are not screenshots of the first run's completion.

Still required: physical iOS and Android acceptance, correct marker taps and
gestures, release-mode memory/performance, and an instrumented capture explaining
the baseline child's full lifetime. The connected physical iPhone was unavailable.

## Discovery changes

- Feed and map consume the same paginated discovery service, with one shared
  14-day upcoming horizon and 18-hour candidate lookback for still-live events.
  Map requires coordinates; feed can display eligible events without coordinates.
- Each database read has a bounded candidate budget. Continuations advance over
  rejected candidates too, so an empty filtered page is not mistaken for the end.
  The client follows all pages and surfaces a failure rather than quietly accepting
  a partial result. Traversal has a 100-page safety limit with a visible error.
- Cursors are authenticated and encrypted, viewer/filter-bound and expire after
  15 minutes. They anchor the date window, not a database snapshot; concurrent
  record edits still require refresh. Privacy is reevaluated on each page.
- Linked-game league metadata is preserved. Other is an explicit league filter;
  sport options no longer depend on a truncated result set. Unknown API sport
  filters are rejected instead of expanding into an unfiltered query.
- Calendar counts query historical records. Existing media/upload eligibility
  remains authoritative. Sharing cannot announce successful copying after a
  failed clipboard write.
- Removed duplicate feed game/event enrichment requests and invalidated the old
  persisted query cache. This narrows one source of disagreement; it is not a
  complete screen-architecture refactor.

Earlier production evidence showed 71 NCAA football fixtures on September 12,
outside the old map's five-day horizon. No fixtures were fabricated or imported
by this repair. Production coverage across all NCAA sports remains a separate
provider/ingestion completeness check.

## Reporting changes

Terminal transport failures reach Sentry after retry exhaustion; recovered retries
and caller cancellation do not generate that terminal signal. Request query
strings are excluded from its endpoint tag. Existing expected business-error
suppression remains in place. Share-sheet, clipboard and tracking failures have
distinct contexts.

Rolling schedule ingestion records running/success/partial/failed outcomes in the
existing SportsIngestRun ledger. Independent leagues continue, then aggregate
failure rejects the worker job. A logging or persistence failure cannot quietly
produce a successful ingestion outcome. Existing scheduler/worker capture paths
may still duplicate server reports; exactly-once reporting is not claimed.

The Sentry readiness script uses a rolling production query and explicitly labels
its result as configuration readiness. Alert delivery and exact source-line
symbolication have not been exercised by a controlled production test here.
3M's feed-clipping theory and 4A's video-trim cause remain unverified.

## Verification

- Client targeted suite: 8 suites, 61 tests passed.
- Server targeted suites: 6 suites, 36 tests passed, including real Express HTTP
  requests through the router/service with a mocked database, dense filtering,
  cursor tampering/expiry, privacy, following and ingestion failure outcomes.
- Client and server TypeScript checks passed with installed dependencies.
- Conflict-marker, error-envelope (HEAD to WORKTREE), navigation and secret
  checks passed. Changed client lint had zero errors; warnings remain.
- The first consolidated client run encountered disk exhaustion after the native
  build. Only this task's disposable Xcode intermediate directory was removed;
  the rerun passed. A server test's ESM linking failure was resolved by sequential
  dynamic imports of the shared dependency graph; its 13 assertions then passed.

## Rollout and remaining acceptance

Deploy the server first and verify the paginated response and ingestion ledger
against the production database. The new client intentionally rejects an old
server response lacking pagination metadata. Then validate feed/map IDs for the
same viewer, dates, sport and league against the live API and native UI.
Only then publish the client through `npm run update:production`; no publication
has occurred in this work. These JS/prop changes do not require a maps-library
upgrade. A future compiled library change requires a native build.

Keep the earlier C overall / D core-flow reliability grade provisional until
device and rollout evidence exists. The remaining PDF visual items (ad framing,
imagery, collage, video fit, sharing previews and theme) have not all been visually
accepted here. Named account grants in those documents were not executed.
No claim is made that every bug will be caught, all NCAA schedules are complete,
or the app is ready for unrestricted real-world use.
