# Vercel deployment — `www.varsityhub.app`

The web build of this Expo app deploys to Vercel at `https://www.varsityhub.app`.
The bare `varsityhub.app` domain redirects app routes to `www` and must keep
serving valid `/.well-known` association files for iOS and Android app links.

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

To verify the Vercel project without printing values:

```bash
npm run verify:vercel-env-drift
```

This fails if required public web build keys are missing or if server-only
Railway secrets are present in the Vercel project.

### 3. Wire DNS

In your DNS provider, add:

```
www.varsityhub.app    CNAME    cname.vercel-dns.com
```

Then in Vercel → Project Settings → Domains, add `www.varsityhub.app` and, if
Vercel is serving the apex redirect, `varsityhub.app`. Vercel auto-provisions a
TLS cert.

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
- GitHub Actions pulls the cleaned Vercel production env into `.env.local`
  before `expo export`, so all required `EXPO_PUBLIC_*` values are available at
  build time.

## What stays on Railway (not Vercel)

The production API stays on Railway at the configured API base URL. These API
and server-only routes must not be implemented as Vercel serverless functions:

- All `/auth/*`, `/posts/*`, `/teams/*` etc. API endpoints
- Payment, email, media, database, Redis, and admin/server-only backends

The Vercel static export may serve `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json`, but those files must stay byte-aligned with
`docs/well-known/` and `server/well-known/`.

If `varsityhub.app` is served by Vercel, verify after every web deploy:

```bash
curl -fsSI https://varsityhub.app/.well-known/apple-app-site-association
curl -fsSI https://varsityhub.app/.well-known/assetlinks.json
curl -fsSI https://varsityhub.app/
```

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
Check both the Vercel static file and the server copy. `varsityhub.app` must
return the AASA file at exactly `/.well-known/apple-app-site-association` with
`application/json`, regardless of whether the apex redirect is served by Vercel
or Railway.
