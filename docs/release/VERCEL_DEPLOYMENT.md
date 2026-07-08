# Vercel deployment — `www.varsityhub.app`

The web build of this Expo app deploys to Vercel at `https://www.varsityhub.app`. The bare `varsityhub.app` domain stays on Railway (API + Universal-Links + handoff pages); root requests redirect to `www` via `server/src/routes/publicSite.ts`.

## One-time setup (~15 min)

### 1. Create the Vercel project

From repo root:

```bash
npx vercel link
```

Pick the org/team. Project name suggestion: `varsityhub-web`.

Or create via the Vercel dashboard → Add New → Project → import this repo.

### 2. Add environment variables

Vercel needs the same `EXPO_PUBLIC_*` vars Railway has, because they're baked into the bundle at build time. Copy each value from Railway → `api` service → Variables into Vercel → Project Settings → Environment Variables (apply to **Production**, **Preview**, **Development**):

| Env var                                 | Source  | Notes                                                  |
| --------------------------------------- | ------- | ------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`                   | Railway | should be `https://api-production-8ac3.up.railway.app` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`      | Railway | required for Google sign-in on web                     |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`       | Railway | restrict in GCP to `*.varsityhub.app/*` referrer       |
| `EXPO_PUBLIC_POSTHOG_API_KEY`           | Railway | client write-only key (`phc_...`)                      |
| `EXPO_PUBLIC_POSTHOG_HOST`              | Railway | usually `https://us.i.posthog.com`                     |
| `EXPO_PUBLIC_SENTRY_DSN`                | Railway | client DSN, public-by-design                           |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Railway | trace sampling (0.0–1.0)                               |
| `EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME`    | Railway | e.g. `@varsity-hub/varsityhub`                         |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`      | Railway | unused on web but harmless to copy                     |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  | Railway | unused on web but harmless to copy                     |
| `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`     | Railway | unused on web but harmless to copy                     |

**Do not add server-only secrets to Vercel.** `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `JWT_SECRET`, `DATABASE_URL`, etc. stay on Railway only. The web bundle is public; anything in Vercel env can be inspected by anyone who runs the app.

To pull the values from Railway in one shot:

```bash
railway variables --kv | grep '^EXPO_PUBLIC_'
```

### 3. Wire DNS

In your DNS provider, add:

```
www.varsityhub.app    CNAME    cname.vercel-dns.com
```

Then in Vercel → Project Settings → Domains, add `www.varsityhub.app`. Vercel auto-provisions a TLS cert.

### 4. First deploy

Push to `main` → Vercel auto-builds and deploys. Watch the build log; the first build typically takes 3–5 minutes (`npm ci` + `npx expo export --platform web`).

## Static-only production deploy

This repo has a top-level `api/` source folder for the client app. On Vercel Hobby, a repo-root deploy can misclassify those files as Serverless Functions and fail with:

```text
No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.
```

When that happens, deploy the exported web bundle instead of the repo root:

```bash
npm run web:deploy:prod
```

That script:

- runs `npx expo export --platform web`
- copies only `dist/` plus the linked Vercel project metadata into a temp deploy directory
- deploys that static bundle to the existing `varsityhub-web` project

If you need to force a specific Vercel scope, use:

```bash
VERCEL_SCOPE=emilmancero-devs-projects npm run web:deploy:prod
```

## Verification after first deploy

```bash
curl -I https://www.varsityhub.app/
# Expect: HTTP/2 200 + content-type: text/html

curl -I https://varsityhub.app/
# Expect: HTTP/2 308 + location: https://www.varsityhub.app/

curl -sS https://www.varsityhub.app/ | grep -o '<title>[^<]*</title>'
# Expect: <title>VarsityHub</title> or similar

curl -sS https://www.varsityhub.app/_expo/static/ -o /dev/null -w '%{http_code}\n'
# Expect: 200 (or 403/404 for the directory listing — assets exist underneath)
```

Then a real-browser smoke test: visit `https://www.varsityhub.app/`, confirm the app shell loads, navigate to a known route (`/posts`, `/teams`, etc.), confirm Sentry/PostHog initialize without console errors.

## Build behavior notes

- `vercel.json` `ignoreCommand` skips Vercel deploys when only `server/`, `.github/`, `ios/`, or `android/` files changed — those don't affect the web bundle. Saves build minutes and avoids spurious "deploy succeeded" notifications for irrelevant commits.
- `cleanUrls: true` lets `https://www.varsityhub.app/posts/123` find `dist/posts/123.html` automatically (Expo Router for Web exports static HTML per route).
- Static asset folders (`/_expo/static/*`, `/assets/*`) get a 1-year immutable cache because they're content-hashed at build.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) apply globally.

## What stays on Railway (not Vercel)

The bare `varsityhub.app` domain still serves these from the API server — they must NOT be replicated on Vercel:

- `/.well-known/apple-app-site-association` — Universal Links registration
- `/.well-known/assetlinks.json` — Android App Links registration
- `/verify`, `/reset-password` — handoff pages (token pre-validation, manual fallback)
- `/consent/<token>` — parental consent landing
- `/privacy-policy`, `/support` — public pages
- All `/auth/*`, `/posts/*`, `/teams/*` etc. API endpoints

If you ever move any of these to `www.varsityhub.app`, Universal Links and email handoffs will break. Keep the split.

## Troubleshooting

**Build fails with "expo: command not found"**
Vercel's default Node version may be too old. Set `NODE_VERSION=20` in env vars.

**Build succeeds but page is blank**
Most likely missing `EXPO_PUBLIC_API_URL`. Open browser devtools → Network → see if API calls go to `undefined` or fail with CORS.

**404 on routes that work in dev**
`npx expo export --platform web` exports each route as a static HTML file. Routes added without rebuilding won't exist on the deployed bundle. Trigger a fresh deploy.

**CORS errors from `api-production-8ac3.up.railway.app`**
The API's CORS allowlist must include `https://www.varsityhub.app`. Check `server/src/app.ts` cors config and add the new origin if missing.

**Universal Links break after deploy**
You probably accidentally moved `/.well-known/apple-app-site-association` to Vercel. Move it back — it must be served by the AASA-registered domain (`varsityhub.app`), not the web app domain.
