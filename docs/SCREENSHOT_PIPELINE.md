# Screenshot Pipeline

This guide explains how to capture the required store screenshots in a repeatable way.  
It covers simulator/emulator prep, launching the app with realistic data, and using the helper script we added in `scripts/capture-screenshot.sh`.

---

## 1. Prerequisites

| Tool | Purpose | Install Notes |
| --- | --- | --- |
| Xcode + Command Line Tools | iOS simulators + `xcrun` | App Store or `xcode-select --install` |
| Android Studio + Platform Tools | Android emulators + `adb` | Ensure at least one 1080p phone + tablet virtual device |
| Expo CLI + EAS CLI | Run the client in release configuration | `npm i -g expo eas-cli` |
| Node.js 18+ | For scripts + Metro bundler | Already included in this repo environment |

Environment variables (sample `.env.production`) should point the client at the production/staging API (`EXPO_PUBLIC_API_URL`), and the backend should have data that looks like the real experience (teams, events, feed posts, etc.).

---

## 2. Seed a Realistic Dataset

1. Start the API stack (Docker or local):
   ```bash
   # From repo root
   docker compose up -d postgres
   npm run server:dev
   ```
2. Seed core entities (games, teams, posts). You can use:
   ```bash
   DATABASE_URL="postgresql://..." node server/seed-games.js
   ```
3. Manually create at least one coach account, one fan account, and populate the feed via the admin dashboard.  
   Document the credentials in `docs/QA_ACCOUNTS.md` so screenshot takers can log in without guesswork.

---

## 3. Boot Target Devices

| Platform | Device | Resolution Requirement |
| --- | --- | --- |
| iOS (6.7/6.5") | iPhone 15 Pro Max or iPhone 14 Pro Max | 1290×2796 (Apple requires 1242×2688 min – we resize to 1284×2778) |
| iOS (5.5") | iPhone 8 Plus | 1242×2208 |
| iPad | iPad Pro (12.9") | 2048×2732 |
| Android Phone | Pixel 6/7 or equivalent 1080×1920+ | 1080×1920 |
| Android Tablet (optional) | Pixel Tablet / custom 2560×1600 | 1600×2560 |

Use `xcrun simctl boot "<Device>"` and `adb devices` to make sure the hardware is available before recording.

---

## 4. Launch the App in Release Mode

For iOS, from the repo root:
```bash
EXPO_PUBLIC_API_URL=https://staging.varsityhub.com \
eas build:run --platform ios --profile preview --device "My Test Device"
```

For Android:
```bash
EXPO_PUBLIC_API_URL=https://staging.varsityhub.com \
eas build:run --platform android --profile preview --device "Pixel_6_API_34"
```

This ensures the UI matches what the stores will see (no debug overlays, no dev menu).

---

## 5. Capture Screens with the Helper Script

The `scripts/capture-screenshot.sh` script wraps the OS tooling and normalizes output size. Usage:

```bash
./scripts/capture-screenshot.sh ios "iPhone 15 Pro Max" \
  assets/store-screenshots/ios-6.5in/01-onboarding.png 1284x2778

./scripts/capture-screenshot.sh ios "iPhone 8 Plus" \
  assets/store-screenshots/ios-5.5in/01-onboarding.png 1242x2208

./scripts/capture-screenshot.sh android emulator-5554 \
  assets/store-screenshots/android-phone/01-onboarding.png 1080x1920
```

The script will:
1. Boot the simulator/emulator if needed.
2. Capture a PNG.
3. Resize to the required resolution (uses `sips` on macOS).
4. Save under `assets/store-screenshots/<bucket>/<sequence>.png`.

> Tip: use the same naming convention (`01-onboarding`, `02-feed`, `03-team-hub`, `04-event-map`, `05-messaging`) across every device bucket so upload ordering is trivial.

---

## 6. Recommended Shot List

| Sequence | Screen | Notes |
| --- | --- | --- |
| `01-onboarding` | Welcome/onboarding hero | Show branded gradient + primary CTA |
| `02-feed` | Discover/Feed | Include posts with photos + engagements |
| `03-team-hub` | Team Hub dashboard | Display next event countdown + info cards |
| `04-event-map` | Event map or schedule | Toggle map view with pins + upcoming games |
| `05-messaging` | Team chat | Include avatars + message bubbles |

For tablets, reuse the same flows but ensure the layout demonstrates split views or large-screen optimizations if available.

---

## 7. QA & Compression

1. Verify dimensions with `sips -g pixelWidth -g pixelHeight <file>`.
2. Run lossless compression (optional but recommended):
   ```bash
   npm i -g sharp-cli
   sharp -i assets/store-screenshots/ios-6.5in/*.png -o assets/store-screenshots/ios-6.5in --near-lossless
   ```
3. Commit the screenshots to `assets/store-screenshots` (or upload to a shared drive if the repo should stay lean) and update the store metadata spreadsheet/link.

---

## 8. Upload Checklist

- [ ] Screenshots captured for each required device bucket
- [ ] Dimensions verified
- [ ] Files named and ordered consistently
- [ ] Uploaded to App Store Connect + Play Console
- [ ] Checklist updated in `PRODUCTION_STATUS.md`

Following this pipeline lets anyone on the team regenerate screenshots in <30 minutes once new UI changes land.
