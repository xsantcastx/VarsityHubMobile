# Audit Summary & Your Action Items

**Date:** March 2025  
**Scope:** Onboarding, user protection, security, social media tools, remaining todos

---

## Audit Results

### 1. Onboarding — ✅ Confirmed Working

| Check                                                                              | Status                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| AuthProvider uses `onboarding_completed !== true` (treats undefined as incomplete) | ✅                                                   |
| index.tsx uses `!== true`                                                          | ✅                                                   |
| Server GET /me returns `onboarding_completed: false` in defaults                   | ✅                                                   |
| verify-identity.tsx                                                                | ✅ **Fixed** — was using `=== false`, now `!== true` |

**Flow:** New/legacy users with `undefined` or `false` are correctly sent to onboarding. Only `true` skips.

---

### 2. User Protection / Profile Edit — ✅ Secure

| Check                   | Status                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Server PUT/PATCH /me    | Only updates `req.user.id` — no `user_id` param                                              |
| edit-profile.tsx        | No userId param; always updates self via `User.updateMe()`                                   |
| profile.tsx             | Edit button only when `isOwnProfile` (`!viewingUserId \|\| viewingUserId === currentUserId`) |
| Settings, edit-username | Use `User.updateMe()` — self only                                                            |

**Verdict:** Users can only edit their own profile. Backend enforces this.

---

### 3. Social Media Tools — ✅ Working

| Tool           | Location                | Status                                             |
| -------------- | ----------------------- | -------------------------------------------------- |
| useShareLink   | `hooks/useShareLink.ts` | Shares post, game, event, team, user via Share API |
| AppLinks       | `utils/links.ts`        | Generates webUrl + deepLink for all share types    |
| Game share     | GameDetailsScreen       | `useShareLink({ kind: 'game', id })`               |
| Instagram link | feed.tsx                | Opens `https://instagram.com/varsityhub_`          |
| Post share     | Posts API               | `POST /posts/:id/share`                            |

---

### 4. Proceed as Fan — ✅ Implemented

- `pending-approval.tsx` and `league-pending-approval.tsx` both have "Continue as Fan" / "Proceed as Fan"
- Calls `User.updatePreferences({ onboarding_completed: true, proceeding_as_fan: true })`
- Navigates to `/(tabs)` so coach can use app while waiting for approval

---

### 5. Coach Quick Actions — ✅ Working

- **Team Schedule:** Passes `teamId` when coach has exactly one team (`/manage-season?teamId=...`)
- **Manage Teams, Approvals, Manage Org:** Route correctly

---

## Code Changes Made This Session

1. **verify-identity.tsx** — `onboarding_completed === false` → `!== true` (2 places) to prevent bypass when value is `undefined`

---

## Your Action Items (Bullet Points)

### App Store Connect / IAP

- [ ] Create Apple ad IAP products: `MOND_THURS` ($4.99), `FRI_SUN` ($7.99)
- [ ] Set products to "Ready to Submit"
- [ ] Create Sandbox Apple ID for testing (Settings → App Store → Sandbox Account)

### Railway / Server Env

- [ ] Set `APPLE_IAP_SHARED_SECRET` (from App Store Connect → App → App Information → App-Specific Shared Secret)
- [ ] Verify `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` for Stripe
- [ ] Verify SendGrid API key and templates for verification emails
- [ ] Verify Cloudinary vars (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) for uploads

### Build & Test

- [ ] Use EAS build or dev client for IAP testing (not Expo Go)
- [ ] Test on physical device or TestFlight
- [ ] Run `npm run typecheck` and `npm run lint` before release
- [ ] Run `npm test` before release

### Release Checklist

- [ ] Commit or revert: `assets/images/splash.png`, `ios/VarsityHub.xcodeproj/project.pbxproj`, `ios/.../SplashScreenLogo.imageset/*.png`
- [ ] Verify Sentry DSN and error tracking
- [ ] Smoke test against production URL
- [ ] Version bump and CHANGELOG before deploy

### Optional Polish

- [ ] Fix 3 lint warnings in `GameDetailsScreen.tsx` (react-hooks/exhaustive-deps)
- [ ] Add explicit types in `hooks/useIAP.ts` if TypeScript reports any (err: unknown, etc.)

---

## Quick Reference

| Doc                                     | Purpose                         |
| --------------------------------------- | ------------------------------- |
| `docs/AD_IAP_VERIFICATION_CHECKLIST.md` | Pre-build IAP verification      |
| `docs/release/CHECKLIST.md`             | Full release gate               |
| `docs/07-PRODUCTION.md`                 | Store submission, assets, costs |
