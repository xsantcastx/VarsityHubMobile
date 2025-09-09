VarsityHub Mobile — Migration Progress

Daily Log

- Day 1 - 2025-09-09
  - Investigated startup warnings from react-native-web about deprecated style props: shadow* and props.pointerEvents.
  - Refactored legacy shadow styles to be platform-specific:
    - Updated `src/pages/AdCalendar.tsx:1` import to include `Platform` and changed `styles.card` to use `boxShadow` on web and `shadowColor/shadowOpacity/shadowRadius/elevation` on native.
    - Verified `app/ad-calendar.tsx:1` already uses `Platform` and `boxShadow` for web.
  - Note: Some warnings originate from dependencies (e.g., expo-router/react-native-web internals) and are non-blocking; our codebase no longer contributes shadow* warnings.
  - Searched for `pointerEvents` usage in app code; none found. If it appears later, switch to `style.pointerEvents` on web.
  - Fixed types: `react-native-calendars` uses `DateData` not `DateObject` in `app/ad-calendar.tsx` and `src/pages/AdCalendar.tsx`.
  - Resolved reanimated type mismatch in `components/ParallaxScrollView.tsx` by narrowing style types.
  - Scoped TypeScript to RN sources by reducing `tsconfig.json` include set to `app/**`, `components/**`, etc., excluding `src/**` web pages to avoid irrelevant TS errors during RN builds.
  - Removed all shadows (boxShadow and shadow*) from our RN code to avoid web deprecation warnings.
  - Patched `node_modules/expo-router/build/views/Sitemap.js:139` header styles to remove shadow* and elevation (source of warning in dev on web). Added `scripts/patch-router-sitemap.js` and a `postinstall` hook to reapply automatically after installs.
  - Added dev-only console.warn filter in `app/_layout.tsx:1` for RN Web to suppress specific deprecation messages (shadow* and props.pointerEvents) without affecting production.
  - Fixed a broken dependency installation where `node_modules/simple-swizzle/index.js` was missing, causing bundling errors via `color-string`. Created a minimal, compatible fallback and added `scripts/ensure-simple-swizzle.js` to regenerate it on postinstall if absent.

- Day 2 - 2025-09-09
  - Error overlay fix: Prevented Base44 SDK from throwing "Service token is required to use asServiceRole" during dev by wrapping the client with a Proxy that hides the `asServiceRole` getter unless a service token is provided (`src/api/base44Client.js`). This avoids incidental access by tooling while keeping normal user modules intact.
  - Verified RN code compiles (scoped TS includes) and that app screens use RN-safe props only.
  - Kept dev-only warn filter in `app/_layout.tsx` to quiet RN Web deprecation logs without affecting production.
  - Reconfirmed no shadow* usages remain in app code; expo-router sitemap shadow patch retained via postinstall.
  - Next up: stabilize any UI encoding artifacts and continue wiring remaining screens to data.
  - Added basic email/password sign-in screen (`app/sign-in.tsx`) using Base44 SDK `loginViaEmailPassword`. On success, token is stored and user is routed to `/feed`.
  - Profile screen now shows a Sign In button when unauthenticated and a Sign Out button when authenticated.
  - Feed shows a Sign In CTA when backend requires auth.
  - Backend scaffolded under `server/` (Express + Prisma + PostgreSQL + JWT):
    - Auth: `POST /auth/register`, `POST /auth/login`, `GET /me`
    - Data: `GET /games`, `GET /posts`, `GET /events`, `GET /messages`
    - Prisma models: User, Game, Post, Event, Message; seeds included.
    - Start with: `cd server && cp .env.example .env && npm i && npx prisma migrate dev && npm run seed && npm run dev`.
  - App now points to local API via new `src/api/http.js`, `src/api/auth.js`, and refactored `src/api/entities.js` (reads `EXPO_PUBLIC_API_URL`).
  - Added `expo-secure-store` dependency for native token storage (falls back to memory if unavailable).

- Day 3 - 2025-09-09
  - Backend up and running locally (Express + Prisma + PostgreSQL + JWT). Seeded data and verified health route.
  - App rewired to use local API via `EXPO_PUBLIC_API_URL`; verified sign‑in and feed/discover fetches.
  - Fixed Prisma relation + ESM/loader + logging issues (`Game.posts`, `tsx` runner, `pino-pretty`).
  - Next targets:
    1) Profile update endpoint ready (PUT /auth/me) and `app/edit-profile.tsx` wired.
    2) Messages tab shows unread badge (polls every 30s).
    3) CORS tightened via `ALLOWED_ORIGINS`; basic rate limiting added.
    4) Docker Compose added for Postgres.
    5) Create Post end-to-end: `POST /posts` (auth required) + `app/create-post.tsx` form + `src/api/entities.js: Post.create()`.

- Day 4 - 2025-09-09
  - Tabs & Navigation
    - Bottom tabs: Feed, Highlights, large center “+” (Create), Discover, Profile.
    - Avoids redirects that leave the tabs group; re-exported screens under `app/(tabs)/*` to keep tab bar visible.
    - Sign-in now `router.replace('/(tabs)')` to preserve the tab bar.
  - Feed redesign
    - Zip-search field (“Search by Zip Code…”). Subtitle: “Showing upcoming and recent games in your area.”
    - Game cards with date/title/location + tag row; sponsored card after first item.
    - Latest Posts section showing images (expo-image) and inline videos (expo-av).
    - Like/comment counts under each post; double‑tap on media to like with heart overlay animation.
    - Infinite scroll for posts via server cursor pagination; refresh on focus to reflect new likes/comments.
  - Create Post (media)
    - Removed manual Media URL input; added “Add Media” actions: Photo/Video (library), Take Photo/Record Video (camera), Remove.
    - Photo compression before upload (expo-image-manipulator; max width ~1280, quality ~0.8).
    - Automatic upload to API then create post; validation surfaces API issues inline.
  - Post Detail
    - New screen `app/post-detail.tsx` with media, content, Like, comments list and add comment.
  - Backend media & posts
    - Uploads: `POST /uploads` (multer), saves to `server/uploads`, served at `/uploads/<file>` with cache headers.
    - Dev helper: `GET /uploads/list` returns file URLs.
    - Posts: `GET /posts` supports `cursor` pagination, includes `_count.comments`; `GET /posts/:id` includes counts.
    - Comments: `GET /posts/:id/comments`, `POST /posts/:id/comments` (auth).
    - Reactions: `POST /posts/:id/reactions/like` (auth).
  - Server polish
    - Static path and Helmet CSP tuned for dev so images load cross-origin in web dev.
    - S3 placeholders added (`S3_REGION`, etc.) and stub route `/uploads/s3-sign` returning 501 until configured.
  - TypeScript migration
    - Replaced JS helpers with TS: `src/api/http.ts`, `src/api/auth.ts`, `src/api/upload.ts`, `src/api/entities.ts`.
    - Removed old JS API files.

How to run (recap)

- Backend (from repo root):
  - `npm run server:install`
  - `npm run server:db:migrate` (or `cd server && npx prisma migrate dev && npx prisma generate`)
  - `npm run server:dev` → http://localhost:4000/health
  - Upload list (dev): http://localhost:4000/uploads/list
- App:
  - Install native deps: `npx expo install expo-image-picker expo-av expo-image-manipulator`
  - Web: `$env:EXPO_PUBLIC_API_URL="http://localhost:4000"`; `npm run web:ci`
  - Android emulator: `$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"`; `npm run android:ci`

Notes & fixes applied

- Fixed tab bar disappearing by routing within `/(tabs)`.
- Resolved JSX errors and stray characters; removed duplicate keys in lists.
- Addressed EADDRINUSE on 4000; allow PORT override or kill stale PID.
- Prisma `_count` error resolved via migrate/generate after adding `Comment` model.

Next (proposed)

1) Add heart overlay animation to Post Detail as well.
2) Show like/comment counts on game cards (if sourced).
3) Optional “Load more” button as a fallback for posts.
4) Implement S3 presigned upload when credentials available (keep local uploads as fallback).
  - Disabled automatic web redirect in Base44 client (`requiresAuth: false`) to avoid RN native trying to set `window.location`.
  - Start instructions:
    - Web: set `CI=1` to avoid prompts and pick a free port, e.g. `PowerShell> $env:CI=1; npx expo start --web --port 9500`.
    - Android: start the emulator first from Android Studio or `emulator @Medium_Phone_API_36.0`, then run `npx expo run:android`.
    - If you see `cmd: Can't find service: package`, wait for full boot or wipe the AVD: `emulator -avd Medium_Phone_API_36.0 -wipe-data -no-snapshot-load` and restart ADB: `adb kill-server && adb start-server`.
  - Added CI-friendly scripts in `package.json` to avoid interactive prompts:
    - `npm run start:ci` (Metro on explicit port)
    - `npm run web:ci` (Expo web on port 9500)
    - `npm run android:ci` (Launch Android after Metro on fixed port)
  - Scanned `app/**` and `components/**` for web-only props (`className`, `onClick`, `htmlFor`, `rows`, `pointerEvents`): none found.
  - Updated `README.md` with Windows quick commands to fix port conflicts and stabilize AVD startup.

What’s done

- Discover screen (app/discover.tsx): Ported from web. Loads user, events, posts; adds search; navigates to detail screens. Added media thumbnails for posts and cleaned up upvote indicator.
- Feed and Game Detail exist and load data from Base44 SDK wrappers.
- Event Detail (app/event-detail.tsx): Implemented basic data fetch + render.
- Profile (app/profile.tsx): Minimal RN profile with User.me(), avatar, basic info, Edit link.
- Messages (app/messages.tsx): Minimal RN messages list with search and read badge.
- Feed (app/feed.tsx): Added search, date formatting, and pull-to-refresh.
- Detail screens: Event detail gained Share/Open Public and RSVP stub; Game detail gained Share.
- Debug (app/debug.tsx): Quick navigation to major routes and deep links for ids.

What’s next (suggested order)

1) Profile screen: scaffold RN version using User.me(); basic info + edit CTA.
2) Messages screen: list threads/messages with FlatList; basic thread nav.
3) Feed improvements: refine list UI and empty/error states.
4) Event/Game Detail: add extra fields/actions (e.g., RSVP) if available.
5) Create Post / Create Team / Edit Profile: replace forms with RN inputs.
6) Settings (User/Team): port sections incrementally (switches, lists).
7) Teams suite: team-profile, team-contacts, manage-teams, manage-users.
8) Ads/Sponsorship: wire ad-calendar to Advertisement API when available.
9) Remaining pages: favorites, following, highlights, rsvp-history, etc.

How to resume next time

- Tell Codex: “Read PROGRESS.md and continue with the next item.”
- Or: “Open app/<screen>.tsx and finish the migration as outlined in PROGRESS.md.”

Notes

- TypeScript errors under src/ are expected (web-only). Focus on app/ for RN build.

Migration Plan (step-by-step)

- Core targets: prioritize screens used by Discover/Feed, then Profile/Messages, then management/admin.
- Routing & structure: keep expo-router tabs/stacks in app/_layout.tsx and app/(tabs)/_layout.tsx; 1:1 map src/pages/* to app/*.
- UI foundation: extend components/ui (button, card, input, badge, etc.); prefer StyleSheet styles over className.
- Data integration: reuse src/api/entities.js (User, Event, Post, Game); stick to list/filter/get; uniform loading/error states.
- Screen migration order: as listed in “What’s next (suggested order)”.
- Web-only replacements: react-router-dom → expo-router; framer-motion → RN/reanimated (optional later); lucide-react → @expo/vector-icons or omit; div/img/className → View/Text/expo-image/StyleSheet; replace web-only props (htmlFor, rows, type, onClick) with RN equivalents.
- Lists & media: FlatList/SectionList; expo-image for images; defer video/animations until after parity.
- Forms & inputs: use TextInput and components/ui/input; simple inline validation; use Pressable/onPress; label via Text.
- Platform styles: removed all shadows (boxShadow and shadow*) from our code to suppress RN Web warnings. Use borders/backgrounds for depth.
- Error/empty states: every screen has spinner, error text, and empty-state copy; log errors to console.
- Final cleanup: when RN screens stabilize, archive/remove unused src/pages to avoid confusion; keep src/api until fully migrated.

Current focus

- Create Post / Create Team / Edit Profile forms with RN inputs
- Settings (User/Team) sections
