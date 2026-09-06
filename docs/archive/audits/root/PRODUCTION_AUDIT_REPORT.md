# VarsityHub Mobile — Production Build Audit Report

**Date:** March 19, 2026  
**Scope:** Full codebase audit before Apple production submission  
**Target:** Next production build for App Store

---

## Executive summary

The codebase is **in good shape for an Apple production build**. Recent changes (Sentry fixes, security hardening, auth polish, parental consent, Snyk fixes) are consistent and the app config, iOS/EAS setup, and critical flows are aligned. A few items need your attention before you submit.

---

## 1. What was audited

- **Recent changes:** CHANGELOG, git history (last ~25 commits), and diff stats
- **App config:** `app.json`, `eas.json`, `package.json`, env/config
- **iOS / EAS:** Bundle ID, Info.plist, EAS production profile, Apple submit config
- **Entry & routing:** `App.tsx` → `expo-router/entry`, root `_layout.tsx`, `app/index.tsx`, `AuthProvider`
- **Auth & server:** Apple/Google bundle IDs, auth routes, `appleAuth.ts`
- **Verification scripts:** `verify-build-ready.sh`, `verify-release-readiness.sh`, pre-build checks
- **Security:** Frontend/backend audit reports, Sentry config, Stripe (live key), API URL

---

## 2. ✅ What’s correct and working

### 2.1 App and build config

- **Expo:** `app.json` valid; version `1.0.1`, runtimeVersion `1.0.1`, iOS buildNumber `49`.
- **EAS:** `eas.json` has production profile with `distribution: "store"`, `autoIncrement: true`, iOS `credentialsSource: "remote"`, `buildConfiguration: "Release"`.
- **Apple submission:** `eas.json` submit.production.ios has `appleId`, `ascAppId` (6758405187), `appleTeamId` (B5H8F69RW5).
- **Bundle IDs:**
  - iOS: `com.varsithub.varsityhub-ios` in `app.json`, `Info.plist`, server `auth.ts` and `appleAuth.ts` (with env fallback).
  - Android: `com.varsityhub.varsityhub` in `app.json` and `android/app/build.gradle` (namespace + applicationId).
- **Entry point:** `App.tsx` exports `expo-router/entry`; root `_layout.tsx` initializes Sentry, Stripe, theme, and auth; `app/index.tsx` defers to `AuthProvider` for routing.

### 2.2 Auth and routing

- **AuthProvider:** Single source of truth for auth; handles verify → onboarding → tabs; deep links deferred until auth is ready.
- **Apple Sign-In:** Server uses `APPLE_CLIENT_ID` / `APPLE_BUNDLE_ID` with fallback `com.varsithub.varsityhub-ios`; matches app bundle ID.
- **Config:** `config/env.ts` reads from `Constants.expoConfig.extra` and process env; production API URL and Stripe (live) are set in `app.json` extra.

### 2.3 Sentry and build reliability

- **Sentry:** `uploadSourcemaps` in `app.json` is computed dynamically from `SENTRY_DISABLE_AUTO_UPLOAD`. Verified 2026-07-13: `eas.json` only sets `SENTRY_DISABLE_AUTO_UPLOAD: "true"` for the `development` profile — `staging`/`preview`/`production` upload sourcemaps normally, and `SENTRY_AUTH_TOKEN` needed for the upload is present in EAS production env. (Previous note here was stale/incorrect — sourcemaps are NOT disabled for all profiles.)
- **Org/project:** `lime-productions` / `varsity-hub-mobile` in both `app.json` and `eas.json`.

### 2.4 Security and compliance

- **Frontend:** FRONTEND_AUDIT_REPORT.md reports A+; SecureStore, auth-aware deep links, admin guards, URL allowlist.
- **Backend:** INTEGRATION_AUDIT_REPORT and rate limits / payment confidence checks referenced in AUDIT_RUN_SUMMARY.
- **Stripe:** Live publishable key in `app.json` extra and EAS production env (pk*live*\*).
- **API:** Production API URL HTTPS; EXPO_PUBLIC_FORCE_REMOTE_API and localhost override in `config/env.ts`.

### 2.5 TypeScript and lint

- **TypeScript:** `npm run typecheck` completes with no errors (verified during audit).
- **Lint:** No linter errors reported for `app/(tabs)/_layout.tsx`, root `_layout.tsx`, or `AuthProvider.tsx`. The historical TS error in AUDIT_RUN_SUMMARY for `tabBarBackground` appears resolved.

### 2.6 Assets and plugins

- **Assets:** app icon, splash, Android adaptive icon, and locale path referenced in `app.json` are present.
- **Plugins:** Custom plugins (e.g. withAndroidManifestCleanup, withGoogleMaps, withGoogleOAuth) and Sentry/Stripe/IAP are listed in `app.json`.

---

## 3. ⚠️ Items to fix or verify before submit

### 3.1 Root-level `app.json` (outside VarsityHubMobile)

- **Location:** `/Users/varsityhub/app.json` (workspace root).
- **Content:** Contains only `ios.bundleIdentifier: "com.varsityhub.varsityhub"`.
- **Issue:** The real app lives in `VarsityHubMobile/` and uses iOS bundle ID `com.varsithub.varsityhub-ios`. The root `app.json` is not used by the Expo app but can cause confusion or misuse if something points at the root.
- **Recommendation:** Either remove the root `app.json` if it’s unused, or add a comment that the canonical app config is in `VarsityHubMobile/app.json`. Ensure any scripts or docs that reference “app.json” point at `VarsityHubMobile/app.json` for builds.

### 3.2 Git status (verify-build-ready.sh)

- **Script:** `verify-build-ready.sh` Step 4b checks for a clean git working tree; with `STRICT_MODE=1` uncommitted changes are treated as errors.
- **Current state:** From the workspace root, `git status` showed “No commits yet” and various untracked/deleted files; the actual app repo is under `VarsityHubMobile/.git` with its own status.
- **Recommendation:** Run `npm run verify:build` from **inside `VarsityHubMobile/`** so the script runs in the app’s git repo. Before submitting to Apple, commit all changes in `VarsityHubMobile` and re-run the script so the “clean git” check passes if you use strict mode.

### 3.3 CHANGELOG duplication

- **Observation:** `CHANGELOG.md` has many repeated “v1.0.0 - Initial release” blocks (different dates).
- **Recommendation:** Consolidate into a single 1.0.0 entry and then append new versions as you ship. Optional for build correctness; good for App Store release notes and maintainability.

### 3.4 Run full verification before each submit

From **VarsityHubMobile** directory:

```bash
cd VarsityHubMobile
npm run typecheck
npm run verify:build
# If you use release readiness:
bash scripts/verify-release-readiness.sh
```

Then trigger the production iOS build:

```bash
eas build --platform ios --profile production
```

After the build, submit with:

```bash
eas submit --platform ios --profile production
# or use EAS Submit from the build page
```

---

## 4. Checklist before Apple submission

| Check                                                                        | Status                         |
| ---------------------------------------------------------------------------- | ------------------------------ |
| iOS bundle ID `com.varsithub.varsityhub-ios` in app.json, Info.plist, server | ✅                             |
| EAS production profile (store, Release, remote credentials)                  | ✅                             |
| eas.json submit.production.ios (appleId, ascAppId, appleTeamId)              | ✅                             |
| Sentry source map upload disabled so builds don’t fail                       | ✅                             |
| Stripe live key and production API URL in app.json / EAS                     | ✅                             |
| TypeScript compiles; no blocking lint errors                                 | ✅                             |
| AuthProvider and Apple Sign-In bundle ID aligned with server                 | ✅                             |
| Run verify:build from VarsityHubMobile                                       | ⚠️ Run before each build       |
| Clean git in VarsityHubMobile and commit before build                        | ⚠️ Recommended                 |
| Root app.json vs VarsityHubMobile/app.json                                   | ⚠️ Clarify or remove root file |

---

## 5. Conclusion

The changes made for the upcoming production build are consistent and the app is configured correctly for an Apple submission. The main actions are: run the verification and build from **VarsityHubMobile**; ensure git is clean and committed there before building; and clarify or remove the root `app.json` to avoid confusion. After that, you’re in good shape to submit the next production build to Apple.
