# Release Pass Checklist

Run this list in order before cutting a production build. Each section has the exact commands, queries, and expected outputs to prove "pass." When a check fails, stop and fix — don't paper over.

This is a gate, not a ceremony. Items are ordered by dependency: the later ones only matter when the earlier ones hold.

---

## 1. Production env parity

Verify every required secret exists in the deploy target. Missing secrets don't error in code — they silently disable features.

### 1a. Server env (Railway)

```bash
# Run against Railway's runtime env, not local. Use the Railway CLI or the
# service variables UI. Missing values print empty.
for k in \
  DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
  SENDGRID_API_KEY SENDGRID_FROM_EMAIL \
  SENTRY_DSN ADMIN_EMAILS \
  CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET \
  GOOGLE_OAUTH_CLIENT_IDS REDIS_URL APPLE_CLIENT_ID APPLE_BUNDLE_ID; do
  printf '%-35s %s\n' "$k" "$(railway run printenv "$k" 2>/dev/null | head -c 12)…"
done
```

**Pass:** every line shows a non-empty prefix.

**Common failures:**
- `JWT_REFRESH_SECRET` missing → refresh flow silently falls back to access-token-only.
- `STRIPE_WEBHOOK_SECRET` missing → webhook-signature verification fails on real events.
- `ADMIN_EMAILS` missing → `requireAdmin` middleware rejects everyone including you.

### 1b. EAS build env (mobile app)

`app.config.js` throws in production if `GOOGLE_MAPS_API_KEY` or `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing. Use that as your first gate:

```bash
EAS_BUILD_PROFILE=production eas build --platform ios --profile production
```

**Pass:** build starts. **Fail:** `[app.config] GOOGLE_MAPS_API_KEY (or EXPO_PUBLIC_...) must be set for production builds.`

Provision with:

```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value <rotated-key>
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value <pk_live_…>
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>
```

---

## 2. Production migrations

Four migrations are pending against Railway. The `PushTicket` one is load-bearing — the scheduler job runs every 15 min and throws without it.

```bash
# Railway DATABASE_URL in env, then:
npx prisma migrate status
# expect: "Database schema is up to date!"

npx prisma migrate deploy
```

Then probe the health endpoint:

```bash
curl -s https://<api-host>/health | jq '.integrations.pushTicketMigration, .warnings'
```

**Pass:** `pushTicketMigration: true` and no PushTicket warning in `warnings`.

### Rollback plan

Each migration I wrote is additive-only (`ADD COLUMN`, `CREATE INDEX IF NOT EXISTS`, `CREATE TABLE`). Rollback is:

```sql
DROP TABLE IF EXISTS "PushTicket";
DROP INDEX IF EXISTS "Notification_user_id_read_at_created_at_idx";
DROP INDEX IF EXISTS "Event_approval_status_date_idx";
DROP INDEX IF EXISTS "Message_recipient_id_read_created_at_idx";
DROP INDEX IF EXISTS "Organization_zip_code_status_idx";
DROP INDEX IF EXISTS "User_profile_private_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "profile_private";
```

Take a manual snapshot before deploy:

```bash
railway run pg_dump "$DATABASE_URL" --schema-only > /tmp/varsityhub-pre-release-schema.sql
railway run pg_dump "$DATABASE_URL" --data-only --table=User --table=Transaction > /tmp/varsityhub-critical-data.sql
```

---

## 3. Payments + webhooks

The highest-risk surface because replay and idempotency bugs are invisible in unit tests.

### 3a. Live webhook round-trip

```bash
# From Stripe CLI against the deployed backend:
stripe listen --forward-to https://<api-host>/payments/webhook &
stripe trigger payment_intent.succeeded
# Then in a second terminal, REPLAY the same event:
stripe events resend <evt_id>
```

Confirm in DB:

```sql
SELECT stripe_event_id, COUNT(*) AS processed_count
FROM "TransactionLog"
WHERE stripe_event_id = '<evt_id>'
GROUP BY 1;
```

**Pass:** `processed_count = 1` (idempotency holds). **Fail:** 2+ rows — duplicate processing.

### 3b. Ad checkout paths

Run in staging with a real Stripe test key:

| Path | How to trigger | Expected |
|---|---|---|
| Successful paid ad | Complete checkout | Ad `status='active'`, `payment_status='paid'`, `TransactionLog` row |
| Free-code ad | Use 100% promo | Ad active, `redeemPromo` recorded, Sentry capture if finalize fails (step 18 fix) |
| Cancelled checkout | Close Stripe sheet | Ad stays `draft`, no reservation rows |
| Webhook signature mismatch | Post with wrong secret header | 400, no state change, Sentry event |

### 3c. Subscription plan change

```bash
# In Stripe dashboard: change test user's subscription.
# Then:
curl -H "Authorization: Bearer $USER_JWT" https://<api-host>/payments/subscription/summary
```

**Pass:** plan reflects within 30s of webhook delivery.

---

## 4. Auth + OAuth on real devices

Dev reloads don't reproduce cold-start callback handling. Use a real release build.

| Flow | Device | Check |
|---|---|---|
| Email signup → verify code | iOS + Android | Code arrives, `/me` returns `email_verified: true` |
| Password reset | Both | Reset email arrives, new password works |
| Sign in with Apple | iOS | `email_verified` set correctly (true only if Apple confirmed); nonce warning absent in server logs once client ships `raw_nonce` |
| Sign in with Google | Both | Token verified against `GOOGLE_OAUTH_CLIENT_IDS` |
| Access-token refresh | Both | Kill app for >15 min, reopen, no forced logout |
| Deep link cold start | Both | Tap `varsityhubmobile://post/<id>` from closed state — lands on post |
| Deep link from terminated | Both | Terminate, push arrives, tap, app routes correctly |

**Server log queries to run concurrently:**

```bash
# Nonce rollout telemetry
railway logs | grep 'raw_nonce missing'
# Email verification claim gate
railway logs | grep 'auth/apple'
# Token refresh failures
railway logs | grep -E 'refresh|401.*Unauthorized'
```

---

## 5. Push notifications end-to-end

Can only be validated with real APNs/FCM.

### 5a. Delivery

1. Register push token on device.
2. Trigger a notification (new DM, new follower).
3. Confirm notification appears on device within 10s.

### 5b. Receipt verification (new in this release)

Wait 15 min after a push for the scheduler to run, then:

```sql
SELECT status, error_code, COUNT(*) FROM "PushTicket"
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1, 2;
```

**Pass:** mostly `status='ok'`. Any `error_code='DeviceNotRegistered'` rows should be followed by:

```sql
SELECT id, preferences->>'push_token' FROM "User"
WHERE id IN (SELECT user_id FROM "PushTicket" WHERE error_code = 'DeviceNotRegistered');
```

**Pass:** `push_token` cleared (empty).

### 5c. Dead rows GC

After 7 days, resolved rows should be gone:

```sql
SELECT COUNT(*) FROM "PushTicket"
WHERE status IN ('ok', 'error') AND resolved_at < NOW() - INTERVAL '7 days';
```

**Pass:** `0`.

---

## 6. Approval workflows

These have the most behavior-by-role complexity.

| Flow | Actor | Expected |
|---|---|---|
| Coach signup → pending approval | Fan promoted to coach | `preferences.role='coach'`, `approval_status='PENDING'` |
| Admin approves coach | Admin | Coach can now create org + teams; org creation gate lifts |
| Coach creates org (unverified email) | Unverified coach | 403 `Email verification required` ([step 1 regression](../server/src/__tests__/api-organizations.test.ts)) |
| Fan creates org | Fan | 403 `COACH_ROLE_REQUIRED` |
| Coach creates game without managed team | Approved coach | 400 `HOME_TEAM_REQUIRED` |
| Coach with pending approval creates game | Coach, pending | 403 `COACH_APPROVAL_REQUIRED` |
| Event approval by non-team coach | Coach from team B | 403, confirmed by [api-organization-approval-sync.test.ts](../server/src/__tests__/api-organization-approval-sync.test.ts) |
| Ad approval → active after paid | Admin | Ad becomes `active` when payment already recorded |
| Ad rejection | Admin | Ad becomes `rejected`, owner notified, ad hidden from feed |

After each: hard refresh app and confirm state is consistent (no stale UI showing approved when server shows pending).

---

## 7. Real-device smoke on release artifacts

Not dev client. Not internal TestFlight. The actual App Store / Play Store build.

Golden path, one pass each on iOS and Android:

1. Fresh install → signup → email verification → onboarding → home feed loads.
2. Create post (image) → appears in feed → upvote from second account → notification arrives.
3. DM to second account → delivered → reply → typing indicator / unread badge correct.
4. Create event → RSVP from second account → reminder fires 1h before (use short interval in staging to observe).
5. View map → events render → tap for detail.
6. Ad purchase (test card) → appears in admin queue → approve → ad goes active.
7. Report content → admin sees report → take action.
8. Block user → their posts disappear ([regression locked](../server/src/__tests__/api-posts-visibility.test.ts)).
9. Private profile toggle → non-follower can't see posts → follower can.
10. Dark mode → every screen renders correctly; no hardcoded white backgrounds.
11. Tap push notification from background → correct screen.
12. Tap `https://varsityhub.app/posts/<id>` from Messages → opens app to post.

Log each failure as a GitHub issue with device model + OS version.

---

## 8. Observability

Verify instrumentation BEFORE you need it.

### 8a. Sentry receives client crashes

Force a crash on a real device. In production builds you can add a hidden debug button (remove before release):

```ts
// Do NOT commit
throw new Error('sentry canary ' + new Date().toISOString());
```

Confirm in Sentry within 60s.

### 8b. Sentry receives server errors

```bash
curl -X POST https://<api-host>/__sentry-canary__
# (Only if such an endpoint exists in dev. Otherwise trigger a real error path in staging.)
```

### 8c. Log redaction holds

```bash
# Send a real password through /auth/login from a staging client, then:
railway logs --tail 200 | grep -iE 'password|authorization|identity_token'
```

**Pass:** every hit shows `[Redacted]`, never a raw value. The [PII_REDACT_PATHS list](../server/src/app.ts) is only as good as what you remember to add.

### 8d. Admin/payment/approval actions are traceable

```sql
SELECT admin_id, action, target_type, target_id, timestamp
FROM "AdminActivityLog"
ORDER BY timestamp DESC LIMIT 20;
```

**Pass:** bans, ad approvals, refunds, and org approvals all recorded.

---

## 9. Performance against prod-like data

Staging should be seeded with at least 10k posts, 1k users, 100 teams.

### 9a. Cold start

Device stopwatch from tap to interactive feed. Target: p95 < 3s on mid-range Android, < 2s on iPhone 12+.

### 9b. Feed load

```bash
# Authenticated token for a user with 500+ followed accounts
time curl -H "Authorization: Bearer $JWT" https://<api-host>/posts?limit=20
```

Target: < 300ms p95. With the new composite indexes + SQL visibility filter this should be materially faster than previous.

### 9c. Slow query audit

```sql
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC LIMIT 20;
```

**Pass:** nothing in the top 20 is hit on every request.

### 9d. Connection pool headroom

```sql
SELECT state, count(*) FROM pg_stat_activity WHERE datname = 'railway' GROUP BY 1;
```

Under normal load, `active + idle in transaction` should stay well below `connection_limit=20` per instance.

---

## 10. App Store / Play Store compliance

### 10a. Apple IAP exposure

Apple requires IAP for digital goods. Audit every purchase CTA:

```bash
grep -rn "stripe\|subscribe\|upgrade" app/ --include="*.tsx" | grep -v -i 'test\|mock'
```

Any consumer-facing subscription flow must use StoreKit / expo-in-app-purchases, not Stripe — or carry an accompanying IAP path. Admin/web-only flows are OK.

### 10b. Privacy policy + terms links

Check every signup, checkout, and settings screen. Links must load in-app (not external browser) per current Apple guidance.

### 10c. Account deletion

Required by Apple. Must be reachable from settings in ≤ 3 taps. Verify the server side purges PII within 30 days:

```bash
# Post-deletion probe
curl https://<api-host>/users/<deleted-id>
# Expected: 404 or sanitized stub
```

### 10d. Permission copy

`app.json` `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, etc. — review wording for App Review 5.1.1 compliance.

### 10e. Reviewer-sensitive flows

- Content moderation path for reports — must be responsive within 24h per Apple.
- Safety Net phone: `support@varsityhub.app` reachable.

---

## 11. Backup + rollback

Before pressing deploy:

1. DB snapshot (see §2).
2. Current deployed commit SHA recorded: `railway status | grep -i commit`.
3. Previous EAS build IDs recorded: `eas build:list --limit 5`.
4. Rollback steps pasted into a scratch doc on a second screen:
   ```
   # App rollback
   eas update --branch production --republish --group <previous-update-group>
   # Server rollback
   railway redeploy --environment production --service api --deployment <previous-deployment-id>
   # DB rollback (only if additive migration broke something)
   # Run the DROP statements from §2
   ```

Do not deploy without these four in hand.

---

## 12. Release artifact integrity

Final pre-push:

```bash
# App version/build consistency
jq -r '.expo.version, .expo.runtimeVersion' app.json
jq -r '.expo.ios.buildNumber // "autoIncrement"' app.json
jq -r '.expo.android.versionCode // "autoIncrement"' app.json

# Git state
git status --short
git log --oneline -5
# Expect: clean tree, HEAD matches the tag you're about to push

# EAS profile check
jq '.build.production' eas.json
```

**Pass:** version numbers match intent, tree is clean, eas.json production profile points at the right channel.

Then:

```bash
git tag -a v1.x.x -m "Release 1.x.x"
git push origin v1.x.x
eas build --platform all --profile production
eas submit --platform all --latest
```

---

## Verification script

Most of the repo-side pieces of §1 and §2 are already covered by existing scripts:

```bash
bash scripts/verify-release-readiness.sh
bash scripts/validate-pre-launch.sh
```

Run both. They should both pass or print only the known dirty-tree warning.

---

## How to use this doc

- Each section either PASSES (move on) or FAILS (stop, fix, re-run from the failed section).
- "Pass" means the exact command in the section returns the expected output. Not a mental model of "looks fine."
- If a check is green on staging but red on prod, the miss is in §1 (env parity) — go back there first.
- Nothing here is optional. Skipping a section is signing up to fix a customer-visible bug later.

**Remaining risks this checklist does not cover:**

- Bugs in code paths we never hit in tests or smoke.
- Behavior under load beyond what staging seed captures.
- Third-party service outages during launch window (Stripe, SendGrid, Cloudinary). Have incident comms ready.
