# Native map investigation — September 6, 2026

Reviewed both attached session summaries against clean source `8176fd78` (app implementation `63f5a8b1`), installed native dependency source and fresh read-only Sentry API evidence. No production code, dependency, native binary, issue state or deployment changed during this investigation.

## Current evidence

Sentry is accessible through the existing Railway integration credential even without a connector. The credential was kept in memory, never printed or saved.

- `VARSITYHUB-3T`, issue `7655376217`: latest occurrence **2026-09-06 03:21:06 UTC**, latest event `18c6fe9430cf4871949ad38aef98544f`, production, `com.varsithub.varsityhub-ios@1.0.5+56`, dist 56. Issue count **11 lifetime events**; do not compare this directly to the previous report's six events in a 14-day histogram.
- Exception remains **NSInvalidArgumentException**, `insertObject:atIndex: object cannot be nil`, through `RCTLegacyViewManagerInteropComponentView finalizeUpdates` → `AIRMap insertReactSubview:atIndex:`. This differs from the pasted summary's EXC_BAD_ACCESS description.
- Latest occurrence predates OTA `6db590e9` published at 06:18 UTC. That does not prove the new OTA fixes it. This event has no OTA identity tag in the selected tags.
- The same organization's short-ID API resolved 3T but returned **404 for VARSITYHUB-3M**. Neither that response nor its absence from the previous unresolved snapshot proves it never existed. Its alleged feed/FlatList stack remains unverified; obtain its actual event or issue URL before treating it as a second confirmed diagnosis.
- Previously documented `VARSITYHUB-49` is a distinct native teardown/startup exception; it must not be merged into the map diagnosis.

## Corrections to the supplied fix proposal

| Claim                                                          | Source-based assessment                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A falsy JSX child caused the nil insertion                     | Not established. `components/EventMap.tsx` maps nonempty coordinate clusters to Marker elements; controls/previews are outside MapView. React null/false elements are not proof a native child became nil.                                                                                                     |
| `tracksViewChanges={false}` is the primary iOS fix             | Not applicable to this provider in the installed version. `utils/maps.ts` selects Apple Maps on iOS. In maps 1.20.1, the native property is exported by `AirGoogleMaps/AIRGoogleMapMarkerManager.m`, not `AirMaps`. It also does not prevent React insertion/removal.                                          |
| That prop requires a native build                              | A supported prop-only change is JavaScript and can ship via OTA. Upgrading compiled maps/RN implementation requires a new native binary.                                                                                                                                                                       |
| Keep the map mounted during loading                            | Already implemented in `app/game-map.tsx`: EventMap stays at a stable tree position across loading/error/success. Marker navigation uses `router.push`; source does not prove the map remounts on every detail push. Native detachment, React unmount and later reopening a popped route are different events. |
| Memoize markers/clusters                                       | Filtered data, valid-coordinate data and clusters are already memoized. JSX marker elements/callbacks are still recreated on render; that is not independently proof of the crash.                                                                                                                             |
| Disable feed clipping to fix 3T                                | Feed and notification lists do enable clipping on iOS. However 3T's stack names AIRMap, not a feed list. A clipping change needs a separate reproducible feed failure and memory/scroll validation.                                                                                                            |
| Library/Fabric interoperability is a confirmed full root cause | It is the observed failure boundary and a strong lead. The specific native child lifetime/order that makes it nil is still unknown.                                                                                                                                                                            |

In installed RN source, `React/Fabric/Mounting/ComponentViews/LegacyViewManagerInterop/RCTLegacyViewManagerInteropComponentView.mm` reads a legacy child's `contentView` and passes it to `insertReactSubview` during deferred mounts without a nil check (around lines 249–251). `react-native-maps/ios/AirMaps/AIRMap.m` inserts the supplied view into `_reactSubviews` (line 138). This supplies a concrete mechanism for a valid React Marker to reach the map as a nil native view. It is not yet a reproduced lifetime/order defect.

Do not add an unconditional native nil-drop patch and call the crash fixed: silently dropping a mount can hide pins and leave child ordering inconsistent.

## Verification performed

- `EventMap.test.tsx`, `EventMap.autofit.test.tsx`, `mapClustering.test.ts`: **3 suites / 20 tests passed**, current source.
- Native dependency source and provider selection inspected; no typechecks claimed for this documentation-only investigation.
- Simulator inventory checked: no device was booted. No installed-device or simulator native reproduction was performed. Mocked MapView tests do not execute AIRMap or Fabric.
- PR [#281](https://github.com/xsantcastx/VarsityHubMobile/pull/281) is **OPEN / MERGEABLE**, current head `8176fd78`, not just the four commits in the older note. Current GitHub account has `pull:true`, `push:false`, `admin:false` on the upstream repository. No merge attempt or state change was made.

## Concrete native reproduction and fix gate

1. Keep 3T as the map incident; identify the actual 3M issue/event before creating a feed incident. Record native version/build, OS, maps version, provider and OTA identity for each trial.
2. On an installed compatible build, exercise empty → loaded markers, single ↔ cluster, filter away → restore, reorder the same data, pan/zoom, map → detail → back, pop → reopen, and background → foreground. Include hundreds of markers, co-located events, denied location and failed discovery responses. Verify every visible pin still opens the correct entity.
3. In a local diagnostic native build, break at deferred interop mount and `AIRMap insertReactSubview`; record component tag/class, insertion index and native content-view lifetime without recording user coordinates. Compare the failing sequence with an isolated map screen. Do not change feed clipping and maps version simultaneously.
4. Select a supported Fabric maps/native combination using its compatibility requirements and the app's Expo/RN constraints. Re-run the same sequence on old and candidate binaries. Check Apple Maps and Android marker visibility, clusters, gestures, navigation and memory before rollout. Dependency compatibility alone does not prove a crash fix.
5. Publish only the validated fix, record the new build/OTA, then verify affected-flow traffic and Sentry recovery. An idle crash counter is not acceptance.

Upstream sources: [maps Fabric support history](https://github.com/react-native-maps/react-native-maps/discussions/5355), [compatibility table](https://github.com/react-native-maps/react-native-maps), [1.20.1 Marker API](https://raw.githubusercontent.com/react-native-maps/react-native-maps/v1.20.1/docs/marker.md). These provide context, not proof of VarsityHub's exact trigger. The frequently cited [issue #5354](https://github.com/react-native-maps/react-native-maps/issues/5354) describes Android Expo Go on SDK 52 in its initial report; its title alone cannot establish an iOS Apple Maps fix for this app.

The other attached notes (basketball filtering, wrestling entity routing, NCAA imagery, ad sizing, video fit) remain separate claims requiring current payload/UI verification. They were not silently promoted to confirmed fixes or bundled into this native diagnosis.
