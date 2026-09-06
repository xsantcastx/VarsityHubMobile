# Real-World Foundation Phase 5

Date: 2026-09-02

## Scope

Phase 5 is the final release-validation phase before real-world rollout. It
does not run `eas build` or `eas submit`; those spend credits and are operator
actions. This phase verifies everything available from the repo, EAS metadata,
and local native tooling, then lists the physical-device evidence still needed.

## Build Readiness

Command:

```bash
npm run release:verify:build
```

Result:

- Passed.
- No blocking errors.
- Build can proceed.

Warnings:

- Uncommitted changes are present. This is expected during this work session;
  commit before any production build or OTA publish.
- `appleId` is not set in `eas.json`; acceptable only if submit auth is handled
  outside repo config.
- Android service-account warning appeared in the build verifier, but the
  dedicated Play submit verifier passed separately.
- Release readiness was skipped inside this build phase because the release
  workflow owns it in Phase 1.

Verified by build gate:

- secret literal scan
- client TypeScript
- required app/native config files
- Sentry plugin and native project config
- Android namespace/package
- iOS bundle identifier
- node modules and lockfile consistency
- EAS production build profile
- Google Maps API key availability
- Expo Doctor
- app version/runtime version consistency
- EAS project ID and owner
- custom config plugins
- API connectivity
- bundle ID consistency

## Play Store Readiness

### Fixed

File:

- `docs/well-known/assetlinks.json`

Change:

- Updated Android `package_name` from stale `com.xsantcastx.varsityhub` to the
  current app package `com.varsityhub.varsityhub`.

Why:

- `app.json` and `android/app/build.gradle` already use
  `com.varsityhub.varsityhub`.
- The stale `assetlinks.json` package caused the Play readiness app-link check
  to fail.

### Commands

```bash
npm run verify:play-submit-access
npm run verify:play-store
```

Result:

- `verify:play-submit-access` passed.
- `verify:play-store` passed after the `assetlinks.json` fix.
- Final Play Store repo check result: `13` passed, `0` failed, `0` warnings.

Covered:

- JDK 17 for Android checks
- EAS Android production profile uses store AAB with remote credentials
- Play submit service account key is present
- Play service account can access Android Publisher edits
- Android package/app-links consistency
- cleartext traffic disabled
- release manifest permissions match allowlist
- high-risk legacy permissions absent
- privacy/support/account-deletion routes exist
- in-app account deletion and server deletion endpoint exist
- Android subscription/ad billing paths match Play policy
- Gradle can configure `bundleRelease`
- public-route and IAP invariant tests pass

## Gradle Dry Run

Command:

```bash
./android/gradlew --stop
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
./android/gradlew -p android bundleRelease -m
```

Result:

- Passed.
- `BUILD SUCCESSFUL`.

Note:

- The first Play readiness attempt failed the Gradle dry-run after stale local
  daemon state. Stopping Gradle daemons and rerunning with JDK 17 resolved it.

## EAS Runtime/Branch Observation

Command:

```bash
eas branch:list --json
```

Result:

- EAS CLI returned production branch/update metadata.
- Output was very large and included historical runtime/update manifests.
- The CLI warned that a newer `eas-cli` is available, but the command completed.

Required operator follow-up:

- Confirm the production branch still has the intended latest OTA updates for
  runtime `1.0.5` and `1.0.4`.
- Confirm the OTA to be published after this work uses the committed source
  state, not a dirty tree.

## Device-Only Validation Still Required

These cannot be truthfully proven from code or local scripts:

| Area          | Required evidence                                                                        |
| ------------- | ---------------------------------------------------------------------------------------- |
| iOS install   | TestFlight or production build installed on physical device                              |
| Android       | Internal-track or production build installed on physical device                          |
| Push          | Real notification delivered while app is backgrounded and foregrounded                   |
| Push routing  | Notification tap opens expected post/game/event                                          |
| Upload        | Camera photo, library photo, camera video, and library video upload successfully         |
| Location      | Geofence behavior with precise, approximate, denied, and delayed location states         |
| Map           | Past-date event, one-pin zoom, preview close/open behavior on real device                |
| Share         | Native share and copy fallback in light and dark mode                                    |
| Payments      | iOS sandbox subscription, Android sandbox subscription, Apple ad IAP, Android Stripe ads |
| Entitlements  | Veteran/legend/owner-covered states persist after kill/relaunch                          |
| Offline/error | Server offline banner, retry states, and settings error states                           |

Use:

- `docs/COACH_DEVICE_UAT.md`
- `docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md`
- `docs/release/LAUNCH_READINESS_GATE.md`

## Remaining Launch Blockers

From Phase 4:

- Backup freshness verification is closed; record the successful run in the
  launch gate.
- Snyk authentication fails with `401 Unauthorized`; authenticated Snyk cannot
  currently be used as the security launch gate.
- Root npm audit still reports high-severity advisories through Expo/Metro
  tooling paths. The React Native nested `minimatch` advisory was fixed by
  bumping the lockfile entry to `3.1.5`.
- Server npm audit has no high-severity findings, but moderate advisories remain
  until a Node 22 runtime upgrade and upstream dependency movement.

From Phase 5:

- Physical iOS and Android device evidence is not yet captured.
- No real push delivery has been proven on an installed device in this phase.
- Do not publish an OTA or start native builds from this dirty working tree.

## Launch Decision

Current decision:

- `NO-GO` for broad real-world rollout.

Reason:

- Code/build/store repo gates are materially stronger now, but Snyk
  authentication, unresolved dependency-risk policy, Sentry alert evidence, and
  physical-device evidence are still open.

Allowed next release action after commit:

- OTA publish for the JS-only Phase 2 fixes can be considered after focused
  device smoke passes, because the fixes are client-side JS changes.

Required command after client-side sign-off:

```bash
eas update --branch production
```

Native build note:

- Any native config change, including Android app-link intent-filter changes,
  requires `eas build`; OTA cannot ship native config.
