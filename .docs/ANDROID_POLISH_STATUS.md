# ✅ Android Polish Status

Latest round of Android-specific hardening is in place. Focus areas and how to validate each:

## 1. Location Precision UX
- `useDeviceLocation` now exposes `accuracyMeters`, `isPrecise`, and `needsPreciseAccuracy`.
- When Android reports only approximate location (>200 m), we surface a dismissible banner on:
  - **Create Post** (`app/create-post.tsx`) – explains why event suggestions may be off and links to system settings.
  - **Discover › Community Map** (`app/(tabs)/discover/mobile-community.tsx`) – blocks map toggle until precise location is enabled.
  - **Game Details stories** (`app/game-details/GameDetailsScreen.tsx`) – warns that story pins will be imprecise.
- All banners include an “Open settings” CTA that deep-links into Android App Info.

Validation:
1. On Android 12+, set the app’s location permission to “Approximate”.
2. Open the three screens above; banners should appear.
3. Tap “Open settings”, flip the permission to “Precise”, return to the app – banners disappear automatically once a precise fix is fetched.

## 2. Map Toggle Guard Rails
- Map view in Discover now calls `requestPermission()` on demand and blocks entry until both permission and precision requirements are satisfied.
- Users get an actionable alert if they decline permissions so they are not left wondering why the toggle fails.

Validation:
1. Revoke location permission in Android settings.
2. Tap the Map icon – you should be prompted for permission, then warned if denied.
3. Grant permission but keep it approximate – the alert points you to Settings until you enable precise access.

## 3. Story Upload Resilience
- Story uploads request location access again if only approximate data is available.
- Users see a rationale dialog explaining why precise location improves tagging, with a direct Settings shortcut.
- Banners near the Add Story CTA remind users that precise access is optional but recommended.

## 4. Notification Channel
- `app/_layout.tsx` now creates the default Android notification channel (`General`) with high importance, vibration, and light color.
- Prevents Expo Notifications from throwing “missing channel” warnings on Android 8+.

Validation:
1. Run `npx expo run:android` once to ensure the channel is registered.
2. From the Expo console or backend, send a push; it should arrive under the “General” channel without runtime warnings.

---

These changes tighten Android parity without impacting iOS behavior and keep TypeScript/ESLint clean. Let me know if you want automatic tests or telemetry added around the new flows.
