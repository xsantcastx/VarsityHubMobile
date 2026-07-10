# Credential Rotation Checklist — 2026-07

Actionable follow-ups from the 2026-07-09 secret/exposure audit. The code-side
scrubs and hardening are already committed; the items below require action in
external consoles (Google Play, Google Cloud) and a posture decision. Check each
off as completed.

> Context that limits urgency: the repo `xsantcastx/VarsityHubMobile` is **public**,
> but the live server secrets (`.env`, `server/.env`, `service-account-key.json`,
> DATABASE_URL, JWT_SECRET, Stripe secret, SendGrid key) are **untracked and were
> never committed** — so they are NOT exposed. The two items below are the only
> real credential exposures, both via the public repo.

## 1. Android `release.keystore` — in public git history (P1)

- **What:** the Android signing keystore was committed in history (commits
  `809379c2`, `715449f9`), later removed. It is publicly downloadable from the
  repo's git history.
- **What limits it:** the keystore **password was never committed**, so the key
  cannot be used without cracking that password offline. It is no longer in the
  working tree, and `.gitignore` now blocks `android/*.keystore`.
- [ ] **Determine key type.** In Google Play Console → your app → Setup → App
      integrity: if **Play App Signing** is enrolled, `release.keystore` is your
      _upload_ key (resettable, no user impact). If not, it is the actual app
      signing key (higher impact — escalate).
- [ ] **Rotate.** If upload key: request an **upload key reset** in Play Console
      and generate a fresh keystore stored OUTSIDE the repo. If app signing key
      and not Play-managed: assess with a release engineer before acting.
- [ ] **History scrub (secondary).** Follow `docs/security/scrub-secrets-from-history.md`.
      NOTE: on a public repo the binary may already be cloned/forked, so scrubbing
      history does NOT un-leak it — **rotation is the real protection**, the scrub
      is cleanup.

## 2. Google Maps API key `AIzaSyD41Nui…` — was in a public tracked doc (P1)

- **What:** a real Maps/Places key was committed in
  `.docs/architecture/GOOGLE_PLACES_IMPLEMENTATION.md`. The value has been
  **scrubbed from the current doc** (replaced with `<YOUR_GOOGLE_MAPS_API_KEY>`),
  but it remains readable in git history and is not in the `.gitleaks.toml`
  "rotated Apr 2026" list, so it may still be active.
- [ ] **Check restrictions** in Google Cloud Console → APIs & Services →
      Credentials: confirm the key is (a) restricted to only the Maps/Places APIs
      in use and (b) referrer/app-bundle locked.
- [ ] **Rotate if unrestricted.** An unrestricted key allows billing abuse —
      regenerate it and apply restrictions.
- [ ] **After rotation,** add the now-dead value to the `.gitleaks.toml`
      allowlist (same pattern as the Apr-2026 keys) so the scanner ignores the
      historical hit. (Do NOT add a still-live key to a tracked file.)

## 3. Repo visibility — posture decision

- [ ] Decide whether `xsantcastx/VarsityHubMobile` should stay **public**. For a
      live paid app, a public repo means every past and future accidental commit
      is instantly internet-visible (this is exactly how the keystore and Maps key
      leaked). Making it private removes the whole class of risk. Only relevant if
      open-source is not an intentional goal.

## Already done in code (this branch)

- Scrubbed the Maps key from `GOOGLE_PLACES_IMPLEMENTATION.md`.
- Dropped stack traces from the upload error log (`server/src/routes/uploads.ts`).
- Added IP-format validation before the geofence IP lookup (`server/src/lib/geofencing.ts`).
