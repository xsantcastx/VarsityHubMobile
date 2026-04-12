# Release-check scripts

Executable tools that exercise the deployed system the way local tests can't.
Run these from a terminal with Railway/Stripe credentials in env; none of them
mutate production on their own.

## Workflow

```bash
# 1. Source production env (or set the needed vars manually)
export API_URL=https://api-production-…up.railway.app
export STRIPE_API_KEY=sk_live_…          # or sk_test_… against staging
export AUTH_JWT=<access token>
export RECIPIENT_ID=<user id for push test>
export RECIPIENT2_JWT=<optional second account for push trigger>
export SENTRY_CANARY_TOKEN=<shared token set in Railway env>

# 2. Run the driver. It walks the release pass, running what it can and
#    pausing for human y/n confirmations on device/browser/console checks.
bash scripts/release-checks/release-pass.sh
```

## Individual tools

| Script | Purpose | Needs |
|---|---|---|
| [release-pass.sh](release-pass.sh) | Driver that walks every section, prints pass/fail summary. | `API_URL` |
| [stripe-webhook-replay.sh](stripe-webhook-replay.sh) | Trigger + replay a `payment_intent.succeeded`; print SQL to verify `TransactionLog` processed it once. | `STRIPE_API_KEY`, Stripe CLI |
| [push-verify.sh](push-verify.sh) | Trigger a push to a real device, print the SQL that confirms `PushTicket` resolved + dead tokens got reaped. | `AUTH_JWT`, `RECIPIENT_ID`, signed release build on a device |
| [pool-stress.sh](pool-stress.sh) | 50-concurrency / 500-request probe; reports p50/p95/p99 and error rate. | `API_URL` (+ `AUTH_JWT` for protected endpoints) |
| [ota-check.sh](ota-check.sh) | Hits the Expo update URL with real device headers, confirms the manifest is reachable and well-formed for iOS + Android. | Reads `app.json` directly — no env required |

## Sentry canary

`release-pass.sh` hits `POST /health/sentry-canary` when `SENTRY_CANARY_TOKEN`
is set (as header `X-Canary-Token`). The endpoint:

- Returns 404 if the token env var is not configured (invisible to scanners).
- Captures an exception with context `health_sentry_canary` and a fresh
  `marker` UUID.
- Returns the marker in its JSON response so you can grep Sentry for the
  exact event.

Set `SENTRY_CANARY_TOKEN` in Railway env before deploy:

```bash
railway variables set SENTRY_CANARY_TOKEN=$(openssl rand -hex 16)
```

## What these don't replace

- **Real-device smoke** — §4 in the release pass. OAuth, deep-link cold start,
  store-build payments. Script only prompts you to do it.
- **Load testing** — the pool stress is a sanity probe, not a load run.
- **Apple/Google store review** — that's humans.

Run order: always `release-pass.sh` first. The individual scripts are what it
calls under the hood and can be run standalone when you want to iterate on a
single check.
