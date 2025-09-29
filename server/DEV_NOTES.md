After adding logo_url/avatar_url fields to Team in schema.prisma:

1) Apply schema to DB (dev):

   # create migration (preferred for dev)
   npx prisma migrate dev --name add-team-logo-url

   # OR push schema directly (fast, non-migrated)
   npx prisma db push

2) Regenerate Prisma client:

   npx prisma generate

3) Restart the server so the new client is loaded.

4) Test team logo update manually:

   - Upload a file using the mobile app or POST to /uploads (form field 'file'). The response contains { url, path }
   - Update the team using the mobile app, or manually call:

     POST /teams/:id/dev-set-logo  (dev only; not enabled in production)
     body: { "logo_url": "http://localhost:4000/uploads/<filename>" }

   - Or call PUT /teams/:id with { logo_url: "<url or /uploads/...>" }

Notes:
- Server code includes some temporary (any) casts to avoid TypeScript type errors until you run `prisma generate` locally after applying the migration.
- Prefer creating a proper migration when working with shared or production databases.

After adding `banner_url` to the Game model:

1) Apply schema change to DB (dev):

   # create migration (preferred for dev)
   npx prisma migrate dev --name add-game-banner-url

   # OR push schema directly (fast, non-migrated)
   npx prisma db push

2) Regenerate Prisma client:

   npx prisma generate

3) Restart the server.

4) Test creating a game with a banner_url via the API (Quick Add flow will pass banner_url automatically):

   POST /games
   body: { title, date, home_team, away_team, banner_url: "http://localhost:4000/uploads/...." }

Remember: `prisma generate` is required to sync the TypeScript types with the updated schema.

After adding `appearance` to the Game model:

1) Apply schema change to DB (dev):

   # create migration (preferred for dev)
   npx prisma migrate dev --name add-game-appearance

   # OR push schema directly (fast, non-migrated)
   npx prisma db push

2) Regenerate Prisma client:

   npx prisma generate

3) Restart the server.

4) Test creating/updating a game with an appearance via the API (Quick Add will pass `appearance` automatically):

   POST /games
   body: { title, date, home_team, away_team, appearance: 'sparkle', banner_url: 'http://localhost:4000/uploads/...' }

   # to update appearance later
   PATCH /games/:id
   body: { appearance: 'sporty' }

Note: After applying the migration, run `npx prisma generate` to refresh TypeScript types; server route errors complaining about unknown 'appearance' fields will be resolved after generating the client.

## QA: Visual checks for MatchBanner and feed

1) Start dev server and Expo, open app on device/emulator.

2) Feed checks:
   - Find a game whose title contains `Team A vs Team B` or two team names. If both teams exist in the `Team.list()` results and have `logo_url`/`avatar_url`, the feed card should show the compact split-banner rather than a single image.
   - If only one or no logos are available, the card should show the game's `cover_image_url` or the gradient fallback.

3) Game Details checks:
   - Open the Game Details screen for a game with both teams having logos. You should see the full-size MatchBanner with gradients and the animated VS badge.
   - If logos are missing for one side, the previous overlay (logo chip + VS circle) should appear.

4) Upload flow sanity:
   - Upload a team logo (from device) and confirm the server returns a URL in `/uploads` and the Team record can be updated to point to it.
   - Refresh feed and game detail to confirm the new logo appears in both places.

5) Visual polish feedback:
   - If the VS badge feels large, try reducing `vsBadge` width/height in `app/components/MatchBanner.tsx`.
   - For more animation, consider adding Lottie micro-animations (requires adding dependency and an animation JSON).

   6) Sparkle micro-animation (new):
       - A lightweight, dependency-free sparkle effect was added to the `MatchBanner` using React Native's `Animated` API. It should pulse subtly around the VS badge.
       - Verify on-device: open a game with both logos and confirm you can see a subtle sparkle/pulse near the VS badge. This is intentionally low-key to avoid distraction; tweak `sparkle`/`sparkle2` styles in `app/components/MatchBanner.tsx` if you want a stronger effect.

      7) Optional: Lottie micro-animation (native)
          - A Lottie wrapper component was added at `app/components/MatchBannerLottie.tsx`. It dynamically imports `lottie-react-native` so the app won't crash if the package isn't installed.
          - To enable full Lottie animations, install native dependencies:

             # in project root
             npm install lottie-react-native lottie-ios

             # iOS (if using bare or after ejecting from Expo):
             npx pod-install ios

          - If you're using the Expo managed workflow, prefer `expo install lottie-react-native` and follow Expo SDK guidance; some Expo SDKs require `expo prebuild` or using the bare workflow to include native modules.
          - After installing, restart Metro and reload the app. The Lottie animation will auto-play on Game Details when present.

## QA: Appearance presets (coach-facing)

1) Quick Add flow:
   - Open the Manage Season screen and choose "Quick Add" to open the Quick Add modal.
   - In the preview area select the "Appearance" preset (Classic, Sparkle, Sporty).
   - Add the game. The created game payload will include an `appearance` field (e.g. `appearance: "sparkle"`).
   - Verify on the server or in API logs that the new game record contains the `appearance` field. If your API stores `banner_style` instead, map accordingly.


If you want, I can run the matching improvements next or wire a Lottie micro-animation; tell me which to prioritize after you run the QA checks.
