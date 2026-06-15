# Google Play — Data Safety Form Answers

Derived from a code audit of data collection/transmission/sharing (2026-06-15). Package `com.xsantcastx.varsityhub`.

## Global questions
- **Is all data encrypted in transit?** → **Yes** (HTTPS/TLS for API + Cloudinary).
- **Do you provide a way to request data deletion?** → **Yes** (in-app account deletion → anonymization via `deleted_at`). Provide the deletion URL/flow.

## "Collected" vs "Shared"
Transfer to a **service provider acting on your behalf** counts as *collected*, not *shared*. Cloudinary, Sentry, PostHog, SendGrid, AWS Rekognition, Expo push, and payment processors (Stripe/Apple/Google) are all processors → **Shared = No** on every row. No third-party ad SDK / advertising ID in the app (no AdMob/Firebase/tracking ID).

## Data types — Collected = Yes (Shared = No for all)

| Category | Optional/Required | Ephemeral | Purposes |
|---|---|---|---|
| Location – Approximate (zip) | Required | No | App functionality; Advertising/marketing (ad geo-targeting) |
| Location – Precise (GPS) | Optional | No (persisted on Post.lat/lng) | App functionality; Personalization |
| Personal – Name (display/username) | Required | No | App functionality; Account management |
| Personal – Email | Required | No | Account management; App functionality; Developer communications |
| Personal – User IDs | Required | No | App functionality; Analytics; Fraud prevention & security |
| Personal – Other (bio, DOB, parent email) | DOB required; bio optional | No | App functionality; Security/compliance (DOB→COPPA, parent email→consent) |
| Financial – Purchase history | Optional | No | App functionality; Fraud prevention |
| Messages – Other in-app messages | Optional | No | App functionality |
| Photos | Optional | No | App functionality |
| Videos | Optional | No | App functionality |
| App activity – App interactions | Optional | No | Analytics |
| App activity – In-app search history | Optional | No | Analytics |
| App activity – Other user-generated content | Optional | No | App functionality |
| App info & performance – Crash logs | Optional | No | Analytics |
| App info & performance – Diagnostics | Optional | No | Analytics |
| Device or other IDs | Optional | No | App functionality (push); Analytics |

## Do NOT declare (verified not collected)
Contacts · Phone number (Twilio infra unused) · Health/fitness · Calendar · Web browsing · Audio files · Installed apps

## Reminders
- Precise location needs the **Permissions Declaration** + an **in-app prominent disclosure** before the OS prompt (most common `ACCESS_FINE_LOCATION` rejection cause).
- Processors receiving data: Cloudinary (media), Sentry (crash, hashed user ID), PostHog (analytics, redacts email/username), SendGrid (email), AWS Rekognition (ad-banner moderation only), Expo (push token), Stripe/Apple/Google (payments).
