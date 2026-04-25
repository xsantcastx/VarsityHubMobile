# Pending Operator Actions

**Source:** consolidated output from the spring-2026 audit + spiderweb sweep + parallel payment / IAP / SendGrid / smoke-harness work. Code-side fixes are merged on `main`; this document tracks **everything that needs an operator (Railway / Stripe / SendGrid / App Store Connect / Play Console / Namecheap / EAS) — i.e. things I cannot do from a code repo.**

Read top to bottom. Items are ordered so each block can be done independently, with hard ordering called out where it matters.

> **Hard rule reminder (CLAUDE.md):** never run `eas build` / `eas submit` casually — each costs credits.

---

## Block A — Credential rotations (drop-everything tier)

These keys were exposed in commit `97a715ee` (server/.env in git history) and one was independently confirmed dead by a live API check.

| # | Provider | Key | Notes |
|---|---|---|---|
| A1 | **Stripe** | `STRIPE_SECRET_KEY` | **Confirmed dead via live API call (`api_key_expired`).** Rotate first; live subs + ad checkout are blocked until done. |
| A2 | Stripe | `STRIPE_WEBHOOK_SECRET` | Was in 97a715ee. Rotate at the webhook endpoint settings, then update Railway. |
| A3 | **JWT** | `JWT_SECRET` | Was in 97a715ee. ⚠️ Rotation invalidates every active session. Pick a low-traffic window. CLAUDE.md normally bans changing this — exposed-secret overrides that rule, but coordinate. |
| A4 | AWS | `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | Create new IAM key, update Railway, soak 24h, delete old key. |
| A5 | Postgres | `DATABASE_URL` password | Railway dashboard handles the rotation; Prisma reconnects on next deploy. |
| A6 | Google Cloud | Maps API key | Rotate AND restrict to bundle IDs `com.varsithub.varsityhub-ios` + `com.varsityhub.varsityhub`. |
| A7 | SMTP | `SMTP_PASS` | Provider-dependent. |

**After every A-block rotation:** sanity-check the corresponding feature in prod (one Stripe charge, one S3 upload, one email send, etc.).

**Reference:** `docs/security/scrub-secrets-from-history.md` for the full background and the optional history-scrub procedure.

---

## Block B — Railway environment configuration

After A is done, set/verify these in Railway → `capable-trust` → `api` service → Variables.

| # | Var | Value / source | Why |
|---|---|---|---|
| B1 | `APPLE_BUNDLE_ID` | `com.varsithub.varsityhub-ios` | Server now fail-fasts on boot in production if missing (see `server/src/lib/env.ts`). Without it, Apple S2S receipt verification fails later, much harder to debug. |
| B2 | `STRIPE_WEBHOOK_SECRET` | new value from A2 | Server boot already requires this in production. |
| B3 | `STRIPE_SECRET_KEY` | new value from A1 | Same. |
| B4 | `SENDGRID_*_TEMPLATE_ID` (18 keys) | from SendGrid template dashboard | Local smoke still warns several are missing — confirm prod has them. The `getMissingEmailTemplates()` helper lists exactly which are required. |
| B5 | (none — the Maps key now lives in EAS, not Railway) | n/a | After committing the eas.json change in `ec32714a`, prod Maps key flows through EAS secrets, not Railway env. See Block D. |

---

## Block C — Store configuration (App Store Connect + Play Console)

Per the IAP code in `hooks/useIAP.ts` and the `iap-config-invariants.test.ts` regression guard, the SKUs the app expects are:

| Surface | SKU | Type |
|---|---|---|
| Subscriptions | `MIDTIER` | auto-renewing subscription |
| Subscriptions | `TOPTIER` | auto-renewing subscription |
| Apple ad IAP | `MOND_THURS` | non-consumable (weekday slot) |
| Apple ad IAP | `FRI_SUN` | non-consumable (weekend slot) |

| # | Step | Notes |
|---|---|---|
| C1 | App Store Connect → My Apps → VarsityHub → Subscriptions: confirm `MIDTIER` and `TOPTIER` exist with the expected pricing and review state | Required for sandbox + prod. |
| C2 | App Store Connect → In-App Purchases: confirm `MOND_THURS` and `FRI_SUN` exist | Same. |
| C3 | Play Console → Monetize → Subscriptions: confirm `MIDTIER` and `TOPTIER` | Sub flow on Android. |
| C4 | Play Console → Monetize → In-App Products: ensure the ad-day SKUs aren't expected on Android | Apple-only by design — Android uses Stripe for ads. |

**Post-verification:** run a live sandbox purchase per platform per SKU before declaring this block done.

---

## Block D — EAS secrets + binary rebuild

Multiple unrelated changes converge on the next iOS/Android binary. Bundle them — don't burn build credits doing them separately.

| # | Step | Notes |
|---|---|---|
| D1 | `eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value <rotated-key-from-A6> --type string` | Required because `ec32714a` removed the hardcoded value from `eas.json`. `verify-build-ready.sh` will refuse to build without it. |
| D2 | (Optional) commit the uncommitted mobile worktree batch (ad rejection-recovery + coach reapply + theming + companion tests) before building so the next binary picks them up | Listed in the "Worktree" section below. |
| D3 | Bump `@sentry/react-native` from `~7.2.0` to `~7.91.x` to match server `@sentry/node` (Phase 9) | Run `npm install --save @sentry/react-native@~7.91.0`, smoke-test source-map upload locally, commit. |
| D4 | `eas build --platform ios --profile production` | After D1+D3 are confirmed. |
| D5 | `eas build --platform android --profile production` | After D1+D3 are confirmed. |
| D6 | `eas submit --platform ios` and `eas submit --platform android` | After both builds finish + you've confirmed entitlements / IAPs work via TestFlight + internal track. |

**What this rebuild also picks up that's already on `main`:**
- iOS `associatedDomains` + Android `intentFilters` for `varsityhub.app` (commit `c8f0aa44`)
- Universal-link parser plural aliases (commit `fc5258e3`)
- Multiple ad-flow + auth-flow + Sentry mobile changes from this week

---

## Block E — DNS (varsityhub.app)

Started mid-session, paused on Railway-token tier. Picking up where we left off:

| # | Step | Notes |
|---|---|---|
| E1 | Railway dashboard → `capable-trust` → `api` service → Settings → Networking → Custom Domain → add `varsityhub.app` (apex) | Railway issues a CNAME target |
| E2 | Same flow → add `www.varsityhub.app` | Same |
| E3 | Namecheap DNS for `varsityhub.app`: add an **ALIAS** record at apex pointing to the Railway target from E1 (plain CNAME at apex isn't valid DNS) | |
| E4 | Namecheap DNS: add a **CNAME** record at `www` pointing to the Railway target from E2 | |
| E5 | Wait for Let's Encrypt cert provisioning (Railway handles this automatically once DNS resolves) | ~15 minutes typical |
| E6 | Verify: `curl -I https://varsityhub.app/health` returns 200 | |
| E7 | Verify: `curl -I https://varsityhub.app/.well-known/apple-app-site-association` returns 200 with `application/json` | Required for iOS universal-link verification |

---

## Block F — Worktree commits (operator decision)

These are sitting on disk and need a commit decision before Block D can pick them up:

**Mobile UX batch** (looks like coherent ad-rejection-recovery + coach-reapply + theming work):
- `app/ad-calendar.tsx` (+44) — rejected/archived state guards
- `app/my-ads.tsx` (+18/-4) — route rejected/archived to edit flow
- `app/submit-ad.tsx` + `app/submit-ad.web.tsx` (+10/-2 each) — hydrate zip from route params
- `app/onboarding/league-pending-approval.tsx` (+43/-1) — `User.reapplyCoach()` flow + cooldown handling
- `components/onboarding/OnboardingBackHeader.tsx` (+11/-5) — theme refinements
- `__tests__/ad-ux-guards.test.ts` (new) — regression tests for the above
- `__tests__/feed.startup.test.tsx` (new) — feed startup test

**Smoke harness** (verified passing):
- `playwright.config.ts` — boots API server alongside Expo web with `ENABLE_DEV_CODES=1`
- `tests/api/posts-api.spec.ts` + `tests/api/teams-api.spec.ts` — fail-loud on missing dev codes, per-file verified coach

**Long-standing orphans** (deliberate non-action — note for archaeology):
- `server/prisma/migrations/20260422110117_add_story_and_message_hot_query_indexes/` — duplicate of an applied migration; do NOT push
- `server/src/__tests__/session-enforcement.test.ts` — orphan from a prior thread; adopt or delete
- `.claude/worktrees/` — Claude tooling, never push

---

## Block G — Lower priority / deferable

| # | Item | Why deferable |
|---|---|---|
| G1 | Hosted SendGrid template alignment script | Local contract test (`server/src/__tests__/email-template-payload-contract.test.ts`) catches drift in the local files. Live alignment requires a `SENDGRID_API_KEY` in CI to fetch hosted template variables and diff. Real work; valuable but not urgent. |
| G2 | Phase 4 — payment "still processing" UX redesign | Needs a design-call decision on the non-dismissible state shape. Tracked as a known P0 since the original audit. |
| G3 | Phase 6.4 — OAuth `checkAuth()` recovery flow | Needs a design-call decision (silent retry vs sign-out + retry vs email/password fallback). |
| G4 | `~2026-05-25` — drop refresh-token v1 read path in `/auth/refresh` and `/auth/logout` | After 30-day TTL of v2 rollout (`8ed8d5d2`) elapses, all live tokens are v2. |
| G5 | Stale failed-migration row cleanup in prod `_prisma_migrations` (`20260422110117_add_story_and_message_hot_query_indexes`) | Cosmetic; doesn't affect runtime. |
| G6 | Dep upgrades: `@stripe/stripe-react-native` 0.50→0.52, `react-native-calendars` version verify | Backlog. |

---

## Order of operations summary

1. **A1 (Stripe key)** — unblocks live payments. Do first, in any low-traffic window.
2. **A2–A7** — rest of the rotation block. Can do over a few days as long as you set the new value in Railway immediately each time.
3. **B1–B4** — Railway env confirmations. Quick.
4. **C** — store-side SKU verification.
5. **F** — operator decision on the worktree batch (commit it, or not — affects what D5 ships).
6. **D** — EAS rebuild + submit. Bundles A6 (Maps secret), D2 (mobile worktree), D3 (Sentry bump).
7. **E** — DNS attach. Independent of everything above; can run any time you have 10 minutes for Namecheap.
8. **G** — backlog when bandwidth.
