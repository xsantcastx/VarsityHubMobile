Local Development — VarsityHub Mobile + Server

Prerequisites
- Node.js 18+ and npm
- Expo CLI (installed via npm when running scripts)
- Android Studio + an Android Virtual Device (AVD) for emulator testing
- PostgreSQL (local) or Docker for Postgres (optional if you already have a DB)

Environment
- Mobile app expects `EXPO_PUBLIC_API_URL` to point at the API (default fallback is `http://localhost:4000`, or `http://10.0.2.2:4000` on Android emulator).
- Server uses `.env` in `server/` for DB and other settings. Copy from `.env.example`.

First‑time setup
1) Install dependencies
   - Root: `npm install`
   - Server: `npm run server:install`

2) Configure server
   - `cd server && cp .env.example .env`
   - Set `DATABASE_URL` in `server/.env`

3) Initialize database (and re-run when schema changes like RSVP/Ads/Teams are added)
   - Migrate: `npm run server:db:migrate`
   - Seed: `npm run server:db:seed`

4) Start the API
   - `npm run server:dev`
   - API runs at `http://localhost:4000`

Running the app (Web)
- Windows CI-friendly: `npm run web:ci`
  - Opens Expo on port 9500 (web)

Running the app (Android)
1) Start the server (as above) and ensure it’s reachable on `http://localhost:4000`.
2) Start the Android emulator from Android Studio (AVD Manager), or via CLI:
   - List AVDs: `emulator -list-avds`
   - Start: `emulator -avd <Your_AVD_Name>`
3) In a new terminal, set API URL for this session (Windows PowerShell):
   - `$env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000'`
4) Launch Android:
   - `npm run android:ci`

Notes & tips (Windows)
- If Metro or Expo ports are busy: kill processes on 19001/19002/9500, or change the port via scripts.
- If AVD fails with `cmd: Can't find service: package`, wait for full boot or wipe AVD data and restart ADB:
  - Wipe: `emulator -avd <Your_AVD_Name> -wipe-data -no-snapshot-load`
  - Restart ADB: `adb kill-server && adb start-server`
- If you see `Cannot find module ...node_modules\debug\src\index.js`, run `npm run fix:deps` (adds a tiny shim) or reinstall deps: `rm -r node_modules` then `npm install`.

Common environment variables
- Mobile: `EXPO_PUBLIC_API_URL` (e.g., `http://localhost:4000` for web, `http://10.0.2.2:4000` for Android emulator)
- Server: `DATABASE_URL`, `PORT` (default 4000), `ALLOWED_ORIGINS` (default `*`)

One‑liners
- Start server + web (two terminals):
  - Terminal A: `npm run server:dev`
  - Terminal B: `npm run web:ci`
- Start server + Android (two terminals):
  - Terminal A: `npm run server:dev`
  - Terminal B: set `$env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000'` then `npm run android:ci`
