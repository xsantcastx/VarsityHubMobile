# Production Sentry review — September 5, 2026

**There is a real, recent iOS map crash. The entire unresolved issue list is not a count of current production regressions.** Read-only API review covered both projects in `lime-productions`, the frequency-sorted issue list, each returned issue's latest event, a production-environment query and a query since the latest API deployment. No issues were resolved, suppressed, assigned, deleted or otherwise changed.

Snapshot: September 5 evening EDT / September 6 00:00 UTC. `javascript-react` returned no issues in this lookup; `varsityhub` returned 24 unresolved groups in the unfiltered lookup. The production-filtered response returned 12 groups, four with zero events in its 14-day histogram. Counts below use the returned 14-day histogram, not the issue lifetime count.

| Issue                                                                                                                                | Production histogram, 14 days | Latest occurrence UTC | Assessment                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [VARSITYHUB-3T](https://lime-productions.sentry.io/issues/7655376217/)                                                               | 6                             | Sep 5 23:12:15        | **Open native map crash; priority 1**                                                                                                   |
| [VARSITYHUB-3A](https://lime-productions.sentry.io/issues/7600827715/)                                                               | 39                            | Sep 5 17:15:54        | Routing-loop telemetry; predates today's 19:50 session server release and latest client publication; current recurrence not established |
| [VARSITYHUB-49](https://lime-productions.sentry.io/issues/7714008476/)                                                               | 1                             | Sep 5 17:11:21        | **Open native startup/teardown crash investigation**, predates latest publication                                                       |
| [VARSITYHUB-33](https://lime-productions.sentry.io/issues/7597174534/)                                                               | 20                            | Sep 1 07:22:00        | Invalid-credentials reports; not by themselves a crash or proof valid credentials are rejected                                          |
| [VARSITYHUB-3D](https://lime-productions.sentry.io/issues/7601506876/)                                                               | 4                             | Sep 1 07:03:15        | Older fresh-install token-cleanup errors; retain historical issue, retest installed Android lifecycle                                   |
| [VARSITYHUB-2D](https://lime-productions.sentry.io/issues/7493245171/) / [2E](https://lime-productions.sentry.io/issues/7493245278/) | 1 each                        | Sep 2 22:30           | Server could not reach PostgreSQL during notification/RSVP reads; fresh health now passes, incident recovery not audited                |
| [VARSITYHUB-45](https://lime-productions.sentry.io/issues/7703997392/)                                                               | 1                             | Sep 1 06:31:25        | Production event-card schema rejection; current recurrence not established                                                              |

The other production-filtered groups are older Apple dedup failure, decoy-path probe, program truncation and EventStatus validation reports, each with zero in the returned 14-day histogram. The unfiltered list also contains development “Admin only”, user-canceled sign-in, several collage-validation groups, native teardown/index crashes and app hangs. Their latest event environment was checked; they were not relabeled as live production failures merely because the issue is unresolved.

## Native map crash proof

Latest event: `a05876dc212d4a65b2a7634a04f436a1`, production, iPhone15,2, iOS 26.3.1, app version 1.0.5, build 56, App Store distribution. Unhandled `NSInvalidArgumentException`: `insertObject:atIndex: object cannot be nil`.

Stack sequence includes `RCTLegacyViewManagerInteropComponentView finalizeUpdates`, then `AIRMap insertReactSubview:atIndex:` at `AIRMap.m:138`. The installed `react-native-maps` source has `_reactSubviews insertObject:subview atIndex:...` there. Breadcrumbs show the map requested location at 23:12:02, called `/event-discovery?surface=map&limit=200`, received HTTP 200 at 23:12:04, then crashed at 23:12:15.

This establishes a native map child insertion failure after a successful API response. It does **not** establish which marker/component produced a nil child, and it is not proof of a failing discovery API. Current `components/EventMap.tsx` mounts changing cluster/event markers; reproduce opening the map, receiving many markers, changing filters/region, and leaving/reopening on the affected native binary before selecting a fix. Do not treat mocked Marker component tests or a successful web map as native crash acceptance.

It is the only returned issue whose latest occurrence is after the current API deployment at 21:40 UTC. The event's app session started at 14:28 UTC. Therefore the timestamp alone cannot prove the device loaded the 21:25 OTA: it could have retained an earlier JS bundle in that running session.

## Native startup crash proof

Latest VARSITYHUB-49 event: `6916e5a68dc54a13be3c20bc16202ac1`, production, iPhone13,1, iOS 26.6.1, build 56. It crashes roughly two seconds after startup with EXC_BAD_ACCESS in `SharedObjectRegistry.clear` → `EXJavaScriptWeakObject .cxx_destruct` → JSI `WeakObject`/`Pointer` destruction. This is distinct from the map insertion crash. Physical-device reproduction and native dependency/binary validation remain outstanding; no OTA-only fix is asserted.

## Release attribution gap

The mobile events include native release/build/platform, but no Expo update ID, update group, channel or runtime tag. Current `utils/sentry.ts:232` tags service/platform/app version/Expo version; it does not tag the OTA identity. Thus build 56 events cannot be reliably split between successive JavaScript releases sharing that binary. Several JS frames are implausibly mapped to unrelated dependencies; source-map matching should be investigated before treating those frames as root causes.

Recommended observability follow-up: attach Expo update ID/runtime/channel and embedded-versus-OTA state to JS **and native** Sentry scope; attach server source commit/deployment to server events; verify matching source maps with one controlled test event in a test environment. Do not hide all 4xx or mark old issues resolved to reduce the dashboard count. Classify expected auth failures/cancellations separately while retaining genuine payment/auth failures.

## Data handling and limits

API credentials were read in memory from the existing Railway integration and never printed or persisted. Only sanitized issue summaries, selected build/environment tags, stack functions and request paths are retained in the durable audit evidence. No production user email, access token or breadcrumb payload is needed for these findings.

Temporary diagnostic files: `/tmp/varsityhub-current-reaudit-20260905/sentry-{issues,latest-events,scoped}.json`. The durable `current-reaudit-evidence.json` excludes device hashes and user records. A quiet interval after deployment is not proof every installed app is fixed, and this review did not send a new Sentry test event.
