# Best Capability Checklist

Use this when the goal is not just "it builds" but "the app is operating well, safely, and with high confidence."

This is a current-state checklist for VarsityHub. It does not replace the canonical release workflow. It compresses the highest-value actions into one place and points to the source docs for detail.

Primary references:

- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md)
- [CURRENT_RUNTIME_BLOCKERS.md](./CURRENT_RUNTIME_BLOCKERS.md)
- [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md)
- [LAUNCH_READINESS_GATE.md](./LAUNCH_READINESS_GATE.md)
- [../manual-qa-checklist.md](../manual-qa-checklist.md)
- [../production-alerts.md](../production-alerts.md)

## Current Truth

As of the latest repo audit, Phase 1 code gates are green but runtime/provider readiness is still `NO-GO` until the current operator-side blockers are cleared.

Do not call the app "fully ready" until this checklist and the linked runtime blockers are closed.

## 1. Code Health Gate

Run these from the repo root:

```bash
npm run check:conflicts
npm run format:check
npm run release:verify:local
```

`format:check` is the actionable changed-file gate. Use `npm run format:check:all` only for deliberate repo-wide cleanup work.

Pass criteria:

- no conflict markers
- formatting clean
- `release:verify:local` exits `0`

Why this matters:

- This is the repo's canonical local gate for lint, app/server typecheck, guardrails, release-readiness audit, regression suites, Expo doctor, and coach/UAT checks.

## 2. Build Readiness Gate

Run:

```bash
npm run release:verify:build
```

Pass criteria:

- EAS/build validation exits `0`
- native config is valid
- required EAS secrets are present

Before burning build credits, also confirm the operator-side build items in [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md), especially Maps and Sentry/EAS prerequisites.

## 3. Runtime Readiness Gate

Run with real production values:

```bash
BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime
```

Pass criteria:

- production-health verification exits `0`
- protected integrations are actually checked, not public-only fallback checks
- no failures for Cloudinary, SendGrid, Redis, or Apple IAP health checks

If this command is not green, the app is not at best capability regardless of local test results.

## 4. Operator Blockers To Clear First

These are the highest-value non-code fixes. They are the current bottlenecks to real readiness.

- Replace placeholder or invalid `SENDGRID_API_KEY` and confirm real sends work.
- Recreate stale SendGrid templates and fill all missing `SENDGRID_*_TEMPLATE_ID` values required by code.
- Rotate exposed production credentials called out in [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md): Stripe, webhook secret, JWT, AWS, Postgres, Maps, and SMTP where applicable.
- Re-verify Railway production env after rotations.
- Confirm EAS secrets are present before any production build.
- Rebuild iOS and Android only after build verification is green.
- Verify apex + `www` DNS, TLS, and Apple association endpoints if the custom domain cutover is part of the release.

Minimum proof after operator work:

```bash
npm --prefix server run verify:email-go-live
npm --prefix server run verify:email
BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime
```

## 5. Real Device Confidence Gate

Manual device checks are still required. At minimum, test:

- iOS cold launch
- Android cold launch
- sign up, login, logout
- fan onboarding
- coach onboarding
- iOS Apple IAP subscription flow
- Android Stripe PaymentSheet flow
- push registration and one delivered notification
- maps autocomplete and pin rendering on both platforms
- universal links / deep links
- expired-session recovery
- account deletion path

Use [../manual-qa-checklist.md](../manual-qa-checklist.md) as the baseline and extend it with the payment, push, deep-link, and session-expiry cases above.

## 6. Monitoring Gate

Before calling production healthy, confirm:

- Sentry client and server are both receiving real events
- the Sentry alert rules in [../production-alerts.md](../production-alerts.md) are actually configured
- hourly Railway health checks are active
- daily production drift checks are active
- at least one person knows the break-glass runbooks for payments and DB recovery

If alerts exist only in docs and not in the provider dashboards, monitoring is not complete.

## 7. Automation Gaps Still Worth Closing

The repo already has strong CI, server tests, regression tests, Playwright smoke coverage, and a manual production E2E workflow. The highest remaining automation gaps are:

- add native mobile E2E coverage with Detox or Maestro for sign-in, onboarding, payments, and deep links
- make production E2E part of a regular operating cadence instead of manual-only when release risk is high
- keep runtime/provider verification on a schedule and review failures weekly

These are not blockers for a single release if manual evidence exists, but they are blockers to sustained high-confidence operation.

## 8. Weekly Operating Cadence

For steady-state quality, do this every week:

```bash
npm run release:verify:local
npm run verify:production-ready
```

Also review:

- GitHub Actions failures
- Sentry alert noise vs real incidents
- Railway health and drift-check results
- payment and email provider dashboards

## Exit Standard

You can reasonably say the app is working at its best current capability when all of the following are true:

- local, build, and runtime gates are green
- provider/runtime blockers are closed
- one recent real-device pass exists for iOS and Android
- payments, email, push, maps, and deep links have current evidence
- monitoring is live, not just documented
- no known Sev-1 or Sev-2 issue is being carried without an explicit owner and date
