# Play Store Submission Checklist

Use this after `npm run verify:play-store`.

## Repo-Verified

- Android build profile ships an AAB with remote EAS credentials.
- Play submit service account can call Android Publisher for `com.xsantcastx.varsityhub`.
- Release manifest disables cleartext traffic.
- High-risk legacy permissions are removed.
- Package name, asset links, and deep links are aligned.
- Public legal pages exist:
  - `/privacy-policy`
  - `/terms`
  - `/support`
  - `/account-deletion`
- In-app account deletion exists in Settings.
- Android subscriptions use Google Play Billing.
- Android ad bookings stay on Stripe PaymentSheet and do not depend on Play ad SKUs.

## Play Console Tasks

- Upload the production AAB from EAS or a signed local release.
- In Play Console `Setup -> API access`, link the service account used by `service-account-key.json`.
- Grant that service account app access for `com.xsantcastx.varsityhub` with a role that can create and manage releases, such as `Release Manager`.
- Confirm Play App Signing is enabled and the upload key matches your credentials.
- Set the Privacy Policy URL to `https://varsityhub.app/privacy-policy`.
- Set the Account Deletion URL to `https://varsityhub.app/account-deletion`.
- Complete Data safety with the permissions and SDKs actually in use:
  - Location
  - Photos/videos
  - Audio
  - User identifiers/account info
  - Purchases/subscriptions
  - Diagnostics/crash reporting
- Complete Content rating.
- Complete App access instructions if any admin/moderation flows require login.
- Make sure Google Play subscription products for coach plans are active and match:
  - `MIDTIER`
  - `TOPTIER`
- Do not create Android ad IAP products for:
  - `MOND_THURS`
  - `FRI_SUN`
- Confirm `/.well-known/assetlinks.json` is live on each production host used by your app links.

## Server & Build Credentials (runtime prerequisites)

These live outside the repo (Railway / EAS / Firebase) and are NOT covered by `npm run verify:play-store`. Each is a real blocker for the corresponding Android feature even when the build itself succeeds.

- **Android subscription verification (Railway)** — set `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`. Without them, `POST /payments/google/verify-purchase` returns **503 in production** and Android users cannot subscribe at all (`server/src/routes/payments.ts`). Optional: `GOOGLE_PLAY_PACKAGE_NAMES` (defaults to `com.xsantcastx.varsityhub`).
- **Android push (EAS / Firebase)** — the repo has no `google-services.json` or FCM config. Upload FCM V1 credentials (Firebase service-account key) to EAS via `eas credentials` (Android → push). Without it, `expo-notifications` registers but Android devices receive no push.
- **Google Maps key (EAS secret)** — `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is intentionally NOT inlined in `eas.json` (an empty value there would shadow the secret). Confirm it is set as an EAS secret and that the Android key is restricted to the **Play app-signing SHA-1**, or maps render blank on Android (`android/app/build.gradle` injects it via `manifestPlaceholders`).

## Final Manual Checks

- Install the release build from an internal track on a physical Android device.
- Verify sign in, onboarding, notifications prompt, camera/media upload, map access, and account deletion.
- Verify Android subscription purchase uses Google Play Billing UI.
- Verify Android ad checkout uses Stripe PaymentSheet, not Play Billing.
- Verify privacy policy, terms, and support links open correctly.
- Verify deep links from `varsityhub.app` open the app.

## Limits

This checklist reduces repo-side approval risk. It does not replace Play Console review outcomes, policy questionnaire accuracy, or production credential validity.
