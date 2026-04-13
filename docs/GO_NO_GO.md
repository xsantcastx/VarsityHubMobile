# Final Build Go/No-Go

10 items. Nothing optional. If any box is unchecked or the result doesn't match the expected, **do not ship**.

Terminal state required: shell with `HEALTH_CHECK_SECRET`, `SENTRY_CANARY_TOKEN`, Stripe test key (if verifying payments), real iPhone + real Android with the reviewed release builds installed, Railway on the target commit, migrations applied.
Reviewed build numbers recorded before starting.

---

### 1. No pricing drift anywhere

```bash
rg -n '\$19\.99|\$0\.99|\$29\.99|price_' shared server app docs CLAUDE.md \
  -g '!docs/archive/**' -g '!.docs/**' -g '!docs/superpowers/**'
```

**Expected:** zero `$19.99` hits outside archive. Every `$29.99` and `$0.99` matches current plan-definitions. Every `price_…` reference is current Stripe.

**☐ Pass**

---

### 2. Stripe / IAP / Play prices match code

Pick any one Legend subscription path and purchase with a test card.

| Surface | Expected charge |
|---|---|
| Stripe (Android / web) | $29.99 |
| Apple IAP (`legend_vhub` iOS) | $29.99 |
| Google Play (`legend_vhub` Android) | $29.99 |

Any platform that still charges $19.99 = fail. Fix in the dashboard for that platform, do not ship until all three agree.

**☐ Pass**

---

### 3. Backend is on intended commit

```bash
curl -sS https://api-production-8ac3.up.railway.app/health \
  -H "x-health-check-secret: $HEALTH_CHECK_SECRET" | jq '.ready, .integrations, .metadata'
```

**Expected:** `ready: true`, every integration your app needs is `true` (database, jwt, stripe, sendgrid, googleMaps, sentry, redis), no missing migrations.

**☐ Pass**

---

### 4. Request-ID round-trips

```bash
curl -sS -D- -H 'X-Request-Id: go-nogo-test' \
  https://api-production-8ac3.up.railway.app/health 2>/dev/null \
  | grep -i '^x-request-id'
```

**Expected:** response header `x-request-id: go-nogo-test` (not just `x-railway-request-id`).

**☐ Pass**

---

### 5. Sentry ingests with release tag

```bash
curl -sS -X POST -H "X-Canary-Token: $SENTRY_CANARY_TOKEN" \
  https://api-production-8ac3.up.railway.app/health/sentry-canary
```

**Expected:** JSON with `marker` field. Within 60s, Sentry dashboard shows the event tagged with the current release SHA, environment `production`, context carries the marker.

**☐ Pass**

---

### 6. Reviewed iOS build contains the fixes

The build Apple will install on their reviewer device must include:
- Info.plist Google OAuth scheme matching `app.json` (the ID `814866365020-…`, not `316424843313-…`)
- pino-http X-Request-Id fix is server-side, not in binary — ignore here
- Event-page 2d/2h/2d rule is server-side — ignore here

```bash
git log -1 --format='%H %s' <build-branch>
grep -n "com.googleusercontent.apps" ios/VarsityHub/Info.plist
grep -n "GOOGLE_IOS_CLIENT_ID\|googleusercontent" app.json app.config.js
```

**Expected:** Info.plist scheme matches app.json. Build SHA includes the commit that fixed the scheme.

**☐ Pass**

---

### 7. Android assetlinks has real SHA-256

```bash
curl -sS https://varsityhub.app/.well-known/assetlinks.json | jq '.[].target.sha256_cert_fingerprints'
```

**Expected:** real fingerprint, not `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`. Validate the fingerprint matches the release keystore via:

```
https://developers.google.com/digital-asset-links/tools/generator
```

**☐ Pass**

---

### 8. Real-device auth — all four paths

On the reviewed iOS build on a real iPhone, complete sign-in via:

| Path | Expected |
|---|---|
| Email + password (known good account) | Reaches home feed, no banner |
| Apple Sign In — Share My Email | Apple sheet → complete → signed in |
| Apple Sign In — Hide My Email | Same, `/me` returns private-relay email |
| Google Sign In | Picker → complete → signed in |

On a real Android on the reviewed build, complete email + Google.

**Expected:** zero errors. Any red banner, any "Unable to connect," any loop back to sign-in = fail, fix before shipping.

**☐ Pass**

---

### 9. Deep link from killed app

Text yourself `https://varsityhub.app/posts/<known-id>`. Fully kill the app. Tap the link.

**Expected:** app opens directly to the post. Not a crash, not the home feed, not a login prompt unless truly signed out.

Repeat on Android.

**☐ Pass**

---

### 10. Account deletion reachable in ≤ 3 taps

On the reviewed build, from cold open of a signed-in session, count taps to reach the delete-account action. Apple requires ≤ 3 and will check.

**Expected:** delete-account reachable within 3 taps. Confirmation flow works. Signed-out state after deletion.

**☐ Pass**

---

## If every box is checked

Ship.

## If any box is unchecked

Fix it. Do not re-run the other 9 boxes hoping it'll be fine. Every box is a different failure mode — green on 9 and red on 1 still means you're shipping broken.

## What this list deliberately does NOT cover

- Performance under production load (only time + Sentry tells you)
- Push notification end-to-end (can't prove without 15 min scheduler window + real APNs)
- Stripe webhook idempotency under replay (do in staging, not as a ship gate)
- Rollback rehearsal (separate readiness item, not a go/no-go)

Those are post-ship monitoring items, not pre-ship gates. Don't conflate.

---

## After ship (first 2 hours monitoring window)

| Check | Threshold |
|---|---|
| Sentry new-issue rate | < 5 per 10 min |
| Crash-free session rate | > 99% |
| `/health` `ready: true` | sustained |
| Railway 5xx rate | < 1% |
| Push receipt verification job errors | zero new |

If any breaches, execute rollback (previous Railway deploy + previous OTA group) immediately. Do not investigate first.
