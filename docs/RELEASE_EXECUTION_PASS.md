# Release Execution Pass

Terminal state for this pass:
- Railway deployed from the intended commit
- Migrations applied
- iPhone + Android with the exact reviewed release builds installed
- `HEALTH_CHECK_SECRET` and `SENTRY_CANARY_TOKEN` in shell env
- Stripe test mode keys for payments section

---

## 0 · Metadata
| Item | Value |
|---|---|
| Build / commit under test | __________ |
## 1 · Backend

| # | Check | Command / Action | Expected | Result |
|---|---|---|---|---|
| 1.1 | Detailed `/health` | `curl -sS https://api-production-8ac3.up.railway.app/health -H "x-health-check-secret: $HEALTH_CHECK_SECRET" \| jq .` | Expanded JSON with `integrations`, `ready: true`, migration + queue state | ☐ |
| 1.2 | Basic `/health` | `curl -sS https://api-production-8ac3.up.railway.app/health` | `{"status":"ok"}` only (intentional redaction without secret) | ☐ |
| 1.3 | `X-Request-Id` echo | `curl -sS -D- -H 'X-Request-Id: smoke-auth-1' https://api-production-8ac3.up.railway.app/health 2>/dev/null \| grep -i x-request-id` | Response header contains `X-Request-Id: smoke-auth-1` (NOT just `x-railway-request-id`) | ☐ |
| 1.4 | Request-id generation | `curl -sS -D- https://api-production-8ac3.up.railway.app/posts 2>/dev/null \| grep -i x-request-id` | Response header contains a generated UUID/cuid | ☐ |
| 1.5 | Sentry canary fires | `curl -sS -X POST -H "X-Canary-Token: $SENTRY_CANARY_TOKEN" https://api-production-8ac3.up.railway.app/health/sentry-canary` | 200 with a `marker` string. Event visible in Sentry within 60s tagged with that marker. | ☐ |
| 1.6 | Railway log stream clean | `railway logs --tail 200` | No stack traces, no 5xx loops, no auth errors spiking | ☐ |

**If any 1.x fails → stop. Fix backend before anything else.**

---

## 2 · Auth — iPhone (real device, reviewed build)

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 2.1 | Cold launch | Fresh install → open app | No red error banner. No "Unable to connect to server". Lands on sign-in. | ☐ |
| 2.2 | Email sign-in — valid | Sign in with known good account | Reaches home feed. No error. | ☐ |
| 2.3 | Email sign-in — wrong password | Sign in with wrong password | Shows "Invalid email or password. Please try again." Stays on sign-in. No crash. | ☐ |
| 2.4 | New signup | Fresh email → set password → tap Sign Up | Routes to verify-email screen with "Check Your Email" | ☐ |
| 2.5 | Email verification | Enter code from email | Routes to onboarding step-1-role | ☐ |
| 2.6 | Forgot password | Tap Forgot → enter email → submit | "Reset email sent" confirmation. Email arrives within 1 min. | ☐ |
| 2.7 | Reset password flow | Click reset link → enter new password | Success. Can sign in with new password. | ☐ |
| 2.8 | Apple Sign In — Share Email | Tap Continue with Apple → Share My Email | Apple sheet opens → completes → app lands inside | ☐ |
| 2.9 | Apple Sign In — Hide Email | New account → Hide My Email | Completes. `/me` shows a private-relay address, not real email. `email_verified=true` only if Apple asserted. | ☐ |
| 2.10 | Google Sign In iOS | Tap Continue with Google | Google picker → complete → redirect back to app → signed in. If this fails with "scheme not found" → reviewed build is stale. | ☐ |
| 2.11 | Session persists cold | Kill app, reopen within 5 min | Lands on home feed, not sign-in | ☐ |
| 2.12 | Session persists long | Kill app, wait 15+ min, reopen | Lands on home feed. Refresh token flow worked. | ☐ |

## 2b · Auth — Android (real device, reviewed build)

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 2b.1 | Cold launch | Fresh install → open | No banner, sign-in visible | ☐ |
| 2b.2 | Email sign-in | Known good account | Reaches home | ☐ |
| 2b.3 | Google Sign In Android | Continue with Google | Picker → complete → signed in | ☐ |
| 2b.4 | Session persists long | Kill, wait 15+ min, reopen | Lands on home feed | ☐ |

---

## 3 · Approvals

Admin account in `ADMIN_EMAILS` env + one non-admin fan + one non-admin coach.

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 3.1 | Coach approval request | Non-admin coach signs up, requests coach status | Request stored, shows pending state in app | ☐ |
| 3.2 | Admin approves coach | Admin reviews + approves | Coach can now create orgs + teams. Coach sees approved state. | ☐ |
| 3.3 | Unverified coach blocked | Unverified coach tries `POST /organizations` | 403 `Email verification required` | ☐ |
| 3.4 | Fan blocked from org create | Fan tries `POST /organizations` | 403 `COACH_ROLE_REQUIRED` | ☐ |
| 3.5 | Coach without team blocked from game | Approved coach tries to create game with no managed team | 400 `HOME_TEAM_REQUIRED` | ☐ |
| 3.6 | Pending coach blocked from game | Unapproved coach tries create game | 403 `COACH_APPROVAL_REQUIRED` | ☐ |
| 3.7 | Fan event submit | Fan submits event needing approval | Stored `approval_status=pending` | ☐ |
| 3.8 | Admin approves event | Admin reviews + approves | Event becomes `approval_status=approved`, visible on map | ☐ |
| 3.9 | Cross-team approval blocked | Coach from team B tries to approve team A's event | 403 | ☐ |
| 3.10 | Ad submitted → pending | Verified user submits ad | Ad `status=draft` or `pending` | ☐ |
| 3.11 | Ad approved → active | Admin approves paid ad | Status becomes `active`, appears in feed | ☐ |
| 3.12 | Ad rejected | Admin rejects an ad | Status `rejected`, owner notified | ☐ |

---

## 4 · Payments — Stripe test mode

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 4.1 | Subscription purchase | Buy Veteran plan with `4242 4242 4242 4242` | Stripe checkout completes → app reflects upgraded plan | ☐ |
| 4.2 | Ad checkout (paid) | Submit ad, pay with test card | Stripe checkout → ad `status=active`, `payment_status=paid` | ☐ |
| 4.3 | Ad checkout (free promo) | Use 100% promo → $0 total | Ad active, promo redeemed ONCE in `PromoRedemption` table | ☐ |
| 4.4 | Webhook received | Stripe dashboard → Events → latest `payment_intent.succeeded` | Status: Delivered, 200 response | ☐ |
| 4.5 | Webhook idempotency | Stripe dashboard → resend the same event | `TransactionLog` still shows ONE row with that `stripe_event_id` (SQL: `SELECT COUNT(*) FROM "TransactionLog" WHERE stripe_event_id = '<evt_id>'` → 1) | ☐ |
| 4.6 | Cancelled checkout | Start checkout, close Stripe sheet | Ad stays `draft`, no reservation rows created | ☐ |
| 4.7 | Plan change reflected | Change subscription in Stripe dashboard | `/payments/subscription/summary` reflects new plan within 30s | ☐ |
| 4.8 | Webhook sig failure | Post to `/payments/webhook` with bad signature | 400, no state change, Sentry event fired | ☐ |

---

## 5 · Push notifications

Two accounts. Both logged in on real devices (not simulator).

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 5.1 | Token registered | After login, check DB: `SELECT preferences->>'push_token' FROM "User" WHERE id=...` | Token string present, Expo format | ☐ |
| 5.2 | DM push delivered | Account A sends DM to Account B | B receives push within 10s. Badge updates. | ☐ |
| 5.3 | `PushTicket` persisted | After 5.2, `SELECT * FROM "PushTicket" WHERE user_id=<B> ORDER BY created_at DESC LIMIT 1` | Row present, `status=pending` | ☐ |
| 5.4 | Receipts resolved | Wait 15+ min, repeat query | Same row → `status=ok` or `status=error` with code | ☐ |
| 5.5 | Dead-token reaper works | If any row has `error_code=DeviceNotRegistered`, check that user's `preferences.push_token` | Push token cleared (null/empty) | ☐ |
| 5.6 | Background/terminated | Kill B's app, send push, tap notification | App opens to correct thread (DM view) | ☐ |
| 5.7 | Denied permission path | Fresh install, deny notifications → sign in | App doesn't crash, doesn't nag every launch | ☐ |

---

## 6 · Deep links

Test from iMessage / Safari / Notes — NOT from inside the app.

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 6.1 | Universal link cold start | Tap `https://varsityhub.app/posts/<known-id>` with app killed | Opens app, lands on that post | ☐ |
| 6.2 | Scheme link cold start | Tap `varsityhubmobile://post/<id>` with app killed | Same result | ☐ |
| 6.3 | Link while signed out | Tap protected link without a session | Routes to sign-in; after signing in, resumes to the deep-linked screen | ☐ |
| 6.4 | Unknown scheme rejected | Tap `varsityhubmobile://<random-path>` | App opens, no crash, lands on a safe fallback | ☐ |
| 6.5 | Untrusted scheme rejected | Tap `javascript:alert(1)` or `data:text/html,<script>...` | Does not resolve in app | ☐ |
| 6.6 | Push → deep link | Push with data payload → tap from lock screen | Opens correct screen | ☐ |

---

## 7 · OTA / release rollout

**Order matters.** Do NOT push OTA before server is deployed.

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 7.1 | Server deployed first | Confirm Railway on target commit. `curl .../health` with secret returns expected SHA. | Matches intended commit | ☐ |
| 7.2 | Migrations applied | Same `/health` response | `pushTicketMigration=true`, `ready=true` | ☐ |
| 7.3 | OTA pipeline reachable | `eas update:list --branch production --limit 1` | Command succeeds and shows the latest production update group | ☐ |
| 7.4 | OTA push | `eas update --branch production --platform all --message "..."` | Update ID returned for both platforms | ☐ |
| 7.5 | OTA post-verify | Re-run `eas update:list --branch production --limit 1` | Top entry `createdAt` and message match the update just pushed | ☐ |
| 7.6 | Client pulls on cold start | Existing installed app: kill + reopen | App starts on new JS bundle. Check for any visual marker in the update. | ☐ |
| 7.7 | Auth flow still works post-OTA | Sign out, sign back in | Clean | ☐ |

---

## 8 · Observability

| # | Check | Action | Expected | Result |
|---|---|---|---|---|
| 8.1 | Sentry ingests server event | `/health/sentry-canary` with token (same as 1.5) | Event in Sentry within 60s, tagged with `release=<sha>`, `environment=production`, context carries `marker` | ☐ |
| 8.2 | Sentry client event | Force a client crash on real device (hidden debug button if exists) | Event appears in Sentry within 60s with correct `release` tag | ☐ |
| 8.3 | Source maps resolved | Click into a client event | Stack frames show real file/line, not `anonymous:1234` | ☐ |
| 8.4 | Request ID in logs | Trigger a 500 path. `railway logs --tail 50` | Log line includes `requestId` field matching response header | ☐ |
| 8.5 | Log redaction | Send a failed login. Grep logs for the password value | Password appears as `[Redacted]` never raw | ☐ |
| 8.6 | Admin audit log | Admin bans a test user. `SELECT * FROM "AdminActivityLog" ORDER BY timestamp DESC LIMIT 1` | Row with actor, action=`ban_user`, target, timestamp | ☐ |
| 8.7 | Snyk latest run | `gh run list --workflow=snyk-security.yml --limit 1` | Most recent run shows `conclusion=success`, NOT skipped | ☐ |
| 8.8 | Snyk actually scanned | `gh run view --log` on that run | Scan step shows findings output, not "skipped" | ☐ |

---

## Go/no-go summary

| Section | Required for ship? | Result |
|---|---|---|
| 1. Backend | YES — hard blocker | ☐ |
| 2. Auth iPhone | YES | ☐ |
| 2b. Auth Android | YES | ☐ |
| 3. Approvals | YES | ☐ |
| 4. Payments | YES | ☐ |
| 5. Push | YES | ☐ |
| 6. Deep links | YES (Apple may test these) | ☐ |
| 7. OTA | YES, in stated order | ☐ |
| 8. Observability | YES — without this, you fly blind post-launch | ☐ |

---

## If any section fails

Capture and paste back:

1. Section + item number
2. Exact command that failed OR exact app screen text
3. Timestamp in UTC
4. Railway log lines within ±10s of the failure
5. Sentry event ID if one fired
6. Build number (iOS `buildNumber`, Android `versionCode`)

With all six, the failure can usually be pinpointed in one read.

---

## What this does NOT cover

- Real-traffic load behavior (pool exhaustion, cache coherency)
- Rare-race concurrent mutations
- Third-party outage resilience (Stripe / SendGrid / APNs down)
- Long-term data growth (PushTicket table size, geocode cache)
- Accessibility reviewer's deep pass

Those are post-launch observation items, not pre-launch checkboxes.
