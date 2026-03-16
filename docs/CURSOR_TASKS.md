# Cursor Tasks — Device Testing & Architectural Work

Context from deploy/session summary. Pass these to Cursor when working on them.

---

## 1. Media Upload Broken

**Status:** Code is correct (Cloudinary direct + server fallback). Needs device testing.

**What to do:**
- Run the app on a physical device or simulator
- Try uploading (avatar, post media, team logo, etc.)
- Check the **actual console error** — this will reveal the root cause

**Likely causes:**
- **Cloudinary env vars on Railway:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — if missing, `/uploads/cloudinary-signature` returns 500 or empty
- **Device-specific permission issue:** Camera/photo library permission denied or not requested correctly
- **Network/CORS:** Device can't reach Cloudinary or server

**Code paths:**
- `api/upload.ts` — `uploadFile()`, `uploadFileWithProgress()` — tries direct Cloudinary, falls back to server proxy
- `server/src/routes/uploads.ts` — `/uploads`, `/uploads/cloudinary-signature`
- Callers: `edit-profile.tsx` (avatar/header), `create-post.tsx`, `create-team.tsx` (logo), `edit-organization.tsx` (logo)

**Debug tip:** Add `console.log` or Sentry breadcrumbs at upload entry + catch blocks to capture the exact error when it fails.

---

## 2. Navigation Back to Home Feed

**Status:** Architectural issue. Every hidden screen inside `(tabs)` uses `router.back()` but Expo Router sometimes loses the stack and falls back to the feed index.

**Problem:** User expects to return to the previous screen (e.g. Discover, Profile) but lands on Feed instead.

**Fix options (architectural refactor):**
1. **Move screens to a stack above tabs** — Screens like `post-detail`, `edit-profile`, `team-page` could live in a parent Stack, so back preserves tab context
2. **Custom navigation history tracker** — Track last-visited tab/screen and `router.replace()` to that instead of `router.back()` when stack is empty

**Files to inspect:**
- `app/(tabs)/_layout.tsx` — tab structure
- `app/_layout.tsx` — root layout, Stack vs Tabs nesting
- All `(tabs)/*.tsx` that call `router.back()` — 15+ files

---

## 3. Android Audit

**Status:** Needs an Android device or emulator.

**What to do:**
- Run `npx expo run:android` or use Android emulator
- Test all flows: sign-up, login, create post, upload media, create team, ad flow, profile, etc.
- Document any layout, permission, or behavior differences vs iOS

---

## Deploy Checklist (Not Cursor — Manual)

- **4. Stripe configuration:** If `paymentsTemporarilyDisabled` shows on ad calendar, set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` on Railway.
- **5. Deploy migrations:** Run `npx prisma migrate deploy` in server. Pending: `add_season_and_color_to_team`, `add_logo_url_to_organization`, `add_admin_note_to_ad`.
