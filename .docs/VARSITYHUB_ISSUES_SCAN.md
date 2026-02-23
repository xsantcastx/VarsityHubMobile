# VarsityHub Issues Scan — VARSITYHUB-2.pdf Cross-Reference

**Scan date:** February 22, 2025  
**Source:** VARSITYHUB-2.pdf spec + codebase analysis  
**Fixes applied:** February 22, 2025

---

## 🔴 CRITICAL — Confirmed Bugs

### 1. **Maps Don't Work — Missing `utils/maps.ts`** ✅ FIXED
- **PDF:** "Maps not working", "Maps don't work - still doesn't work 2/9"
- **Root cause:** `EventMap.tsx` and `ReachMapPreview.tsx` import `getMapProvider` from `@/utils/maps`, but **`utils/maps.ts` did not exist**.
- **Fix:** Created `utils/maps.ts` with `getMapProvider()` returning `'google'` on native, `undefined` on web.

### 2. **Event Page Doesn't Load** ✅ IMPROVED
- **PDF:** "Event page doesn't load at all" (2/9, 2/22)
- **Fix:** Event detail now accepts both `id` and `eventId` query params and normalizes array params. Reduces load failures from param mismatches.

### 3. **Pinch to Zoom / "Rotate" Doesn't Actually Work**
- **PDF:** "Pinch to zoom doesn't work, replace letterbox with rotate"; "Rotate is only text, does not actually work"
- **Current state:** `BannerUpload.tsx` has pinch/rotate gesture handling (lines 222–330) for banner editor. `BannerAd` supports `fitMode` including `rotate` and `letterbox`. The PDF may refer to:
  - Ad banner display (BannerAd): `rotate` works for `rotate:N` deg transforms.
  - Ad creation flow (BannerUpload): Pinch and rotate gestures exist but may have bugs or platform issues.
- **Gap:** `letterbox` is still a valid option in BannerAd; PDF asks to "replace letterbox with rotate." If users pick "Rotate" in ad creation but the UI only shows text and no actual rotation, that matches the PDF bug.

---

## 🟠 HIGH — Reported Issues Needing Verification

### 4. **Story Upload Works but Doesn't Stay**
- **PDF:** "Story upload works but doesn't stay"
- **Area:** `GameDetailsScreen.tsx` — `handleAddStory`, story persistence, 24h visibility window.
- **Check:** Story creation API, storage, and expiration logic. Confirm stories persist and display for full 24h.

### 5. **Highlights Page Buggy / Doesn't Load Post**
- **PDF:** "Highlights page is buggy, doesn't load post"; "Should be able to swipe left/right for post"
- **Code:** `highlights.tsx` uses `PostCacheContext` for cache-first loading. Swipe gesture added (commit 2dcefac).
- **Verify:** Post detail loading from highlights, swipe navigation, and error states.

### 6. **Google Sign In / Regular Sign In / Sign Up**
- **PDF:** "Google sign in - still doesn't work 2/9"; "regular sign in - still doesn't work 2/9"; "regular sign up - 6 six digit verification work?? - still doesn't work 2/9"
- **Areas:** `useGoogleAuth.ts`, `sign-in.tsx`, `sign-up` flow, `verify-email` / verification codes.
- **Note:** PDF includes Google OAuth client IDs (Android, iOS, Web). Ensure `app.json` and env match these.

### 7. **Coach Onboarding Stops at Step 4**
- **PDF:** "Coach onboarding/sign in - Stops at step 4, doesn't work 2/9"
- **Flow:** Step 4 = `step-4-organization.tsx`. Requires email verification before creating org. If `emailVerified === false`, user is blocked with an alert.
- **Gap:** Email verification may be failing or not recognized, so coaches get stuck.

### 8. **Fan Onboarding — Extra Page Fans Shouldn't See** ✅ FIXED
- **PDF:** "Fan onboarding shouldn't see this page - people gonna get confused"; "Still is in the app 2/6"
- **Fix:** Fans now skip Step 9 (Features). Step 6 (Authorized Users) redirects fans to Step 7.

---

## 🟡 MEDIUM — UI / UX

### 9. **Edit Profile Button Position** ✅ FIXED
- **PDF:** "Edit profile button wasn't moved 2/9 - And move edit profile button to the right"
- **Fix:** Profile page Edit button now right-aligned via `justifyContent: 'flex-end'`.

### 10. **"Adcmky0v z…" Placeholder**
- **PDF:** "Can the Adcmky0v z… be removed? - Removed, not replaced!"
- **Interpretation:** Likely a CUID or random ID shown in UI. Search found no exact match; could be in ad preview, debug output, or a removed component.
- **Action:** Search for any remaining CUID/ID display in ad-related or debug UI.

### 11. **Team Page / Organization Page**
- **PDF:** "Team page (does it work?) - No clue 2/9"; "Organization page, does it work? - No clue 2/9"
- **Routes:** `team-page.tsx`, `organizations/[id].tsx`, `(tabs)/organization.tsx`. Need runtime verification.

---

## 🟢 SPEC / RULES — Compliance Gaps

### 12. **Ad Hosting Timing**
- **PDF rules:** 1 ad = 2 min display, 15 s promo; 2+ ads = 1:30 each, 10 s promo.
- **Code:** `feed.tsx` lines 489–534 implement this. **Compliant.**

### 13. **Event Page Rules**
- Stories: 24h (day of event); Posts: 96h window (day before, day of, day after).
- Geofencing: Only users within 2 km can post.
- **Check:** `server/src/lib/geofencing.ts`, event visibility windows, story expiry.

### 14. **Profile Layout**
- **PDF:** "All profile pages, coach, team, organization should look like this."
- **Ensure:** Unified layout across user profile, team, and organization pages.

### 15. **API Keys in PDF**
- **Security:** PDF contains real keys (SendGrid, Cloudinary, Twilio, Google OAuth, etc.). These should be rotated if the document was shared. Use env vars / secrets manager, never commit.

---

## Summary

| Category   | Count |
|-----------|-------|
| Critical  | 3     |
| High      | 5     |
| Medium    | 3     |
| Spec/Rules| 4     |

**Immediate fix:** Create `utils/maps.ts` with `getMapProvider()` (e.g. return `PROVIDER_GOOGLE` or `PROVIDER_DEFAULT` based on platform) so maps can load.
