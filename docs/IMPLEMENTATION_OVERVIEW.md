## Implementation Snapshot

### Completed in This Pass
- **Upload Gesture Switcher (Story #14):** `app/create-post.tsx` now exposes swipe-up camera access _and_ swipe-down review mode with a modal preview, visual state indicator, and gesture animations.
- **Feed View Consistency (Story #27):** `app/feed.tsx` renders the game feed as a 3-column grid matching the profile gallery, adds contextual stats, and modernizes the sponsored footer CTA.
- **Google Sign-In (Story #3):**
  - **Shared Hook:** `hooks/useGoogleAuth.ts` wraps `expo-auth-session` and exposes a reusable Google login helper.
  - **Client Integration:** `app/sign-in.tsx` and `app/sign-up.tsx` surface Google-branded buttons with loading/error states; `src/api/auth.ts` / `entities.ts` forward ID tokens to the server.
  - **Server Endpoint:** `server/src/routes/auth.ts` verifies Google ID tokens, links existing accounts, or creates new users with `google_id`; Prisma schema stores the new nullable field.

### Still Outstanding
- **Stripe Billing (Stories #4–6):** Product/price wiring, promo enforcement, and transaction reconciliation remain backend work.
- **Calendar Sync & Media Ops (Stories #8, #17):** No changes yet—OAuth calendar import, transcoding, and storage policies still need implementation.
- **Infrastructure Items (Stories #34–36):** Railway connection validation, Stripe charge logging, and media retention documentation are pending.

## Prisma & API Follow-Up
1. **Capture Google OAuth Client IDs**
   - Populate `.env` entries: `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` (optional), and comma-separated `GOOGLE_OAUTH_CLIENT_IDS` for server-side validation.
2. **Run Prisma Migration**
   ```bash
   cd server
   npx prisma migrate dev --name add_google_id_to_user
   npx prisma generate
   ```
   - Confirms the new `google_id` column is applied locally. For production, follow with `npx prisma migrate deploy` during deploy.
3. **Redeploy the API**
   ```bash
   npm run build
   npm run start   # or railway redeploy if using Railway automation
   ```
   - Ensure environment variables are present in staging/production before restart.
4. **Smoke-Test `/auth/google`**
   - Use Postman or curl:
     ```bash
     curl -X POST https://<api>/auth/google \
       -H "Content-Type: application/json" \
       -d '{"id_token":"<GoogleIDToken>"}'
     ```
   - Validate response contains `access_token`, `user`, and `needs_onboarding` where appropriate.
5. **Verify Client Sign-In**
   - Launch Expo app with updated `.env` values.
   - Confirm Google button flows through to onboarding or role-aware landing without errors.
6. **Regression Checklist**
   - Email/password sign-in and onboarding still work.
   - Feed grid renders on devices (iOS/Android) with RSVP badge overlay intact.
   - Create Post review modal appears only when content/media exist.

Keep these steps tracked so backend deliverables (Stripe, calendar, media policy) can proceed once the OAuth and Prisma changes are live.
