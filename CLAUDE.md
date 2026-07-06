# VarsityHub Mobile — Claude Instructions

## Instruction Ownership

- `CLAUDE.md` is the authoritative instruction file for Claude Code in this repo.
- `AGENTS.md` is maintained for Codex and Codex-spawned agents. Do not assume Codex reads `CLAUDE.md` as its primary repo instruction source.
- Shared product facts must stay aligned across both files: stack, payments, navigation, deployment risk, and server-enforced invariants.
- If a rule changes for both tools, update both `CLAUDE.md` and `AGENTS.md` in the same pass.

## Stack

- React Native / Expo SDK 54 with Expo Router (file-based routing)
- Backend: Express + Prisma + PostgreSQL on Railway (project: `capable-trust`, service: `api`)
- State: React Context — `AuthProvider`, `PostCacheContext`, `OnboardingContext`, `NavigationHistoryContext`
- API: `api/entities.ts` re-exports from domain modules (`api/teams.ts`, `api/organizations.ts`, etc.)
- EAS Build for iOS/Android. OTA updates via Expo Updates.
- Payments (two distinct flows — do not conflate):
  - **Subscriptions**: Apple IAP (iOS), Google Play Billing via `react-native-iap` (Android, server-verified at `POST /payments/google/verify-purchase`), Stripe PaymentSheet (web fallback only)
  - **Ads**: Apple IAP (iOS), Stripe PaymentSheet (Android + web)
  - No Stripe links/redirects on any iOS path (Apple guideline). Android subscription checkout MUST stay on Play Billing — never route it to Stripe (Play policy).
- Uploads: Direct-to-Cloudinary (signed) with server-proxy fallback
- Push notifications: Expo Server SDK (`sendPushNotification` in `server/src/lib/notifications.ts`)
- Error tracking: Sentry with source maps

## System Architecture — one way to do each thing

Full verified reference: **`docs/ARCHITECTURE.md`** (keep it in sync if these change).
This is a **modular monolith on PostgreSQL + Redis + Railway** — NOT microservices/
Kubernetes, by design. Do not add K8s, Kafka, RabbitMQ, DynamoDB, Elasticsearch,
sharding, partitioning, sidecars, or SFTP — they are correctly absent at this scale.

Features must compose with these single patterns, never stack a parallel mechanism:

- **Outbound third-party calls → `runWithBreaker(name, fn)`** (`server/src/lib/circuitBreaker.ts`) for SendGrid / Cloudinary / Google Play / Apple. Stripe is the lone exception: SDK `timeout` + `maxNetworkRetries` (all 5 client constructions) — do not also breaker-wrap Stripe. No ad-hoc retry loops around external calls.
- **Screen data → react-query, the single `lib/queryClient.ts`.** Gate spinners on `isPending`, never `isFetching`. Never add a second QueryClient or parallel fetch cache. `PostCacheContext` is cross-screen post sharing, NOT a fetch cache — don't duplicate roles.
- **Realtime → the single `server/src/realtime/socketServer.ts`** (JWT handshake, per-conversation room auth, Redis adapter, websocket-only). Polling stays as the fallback, not removed.
- **Startup-once work → `runClusterOnce`** (`distributedLock.ts`) so it runs on one replica only; the scheduler worker still runs on all. Don't invent new leader election.
- **Everything cross-replica coordinates via Redis** (rate limit DB 1, BullMQ DB 0, cache DB 2, locks, socket adapter). No in-process shared state — it breaks under `numReplicas>1` (`railway.toml`).
- **RLS is enabled-not-forced** (dormant defense-in-depth). NEVER `FORCE` without a non-owner DB role + `SET LOCAL app.current_user_id` middleware — and remember `start.sh` runs `prisma migrate deploy` on every deploy, so any committed migration auto-applies to prod.

## Quick Start

```bash
npm run dev         # app (Expo dev client on :8081) + server concurrently
npm run dev:expo    # Expo dev client only
npm run dev:ios     # build/run iOS dev client on a connected device
npm run dev:server  # server only
npm run lint        # expo lint
npm test            # jest
```

## Hard Rules

**Never run `eas build` or `eas submit`.** These cost money. Provide the commands for the user to run themselves.

**Never use Expo Go.** Always use `npx expo run:ios` or `npx expo run:android` (dev client). Expo Go diverges from production behavior.

**Railway auto-deploys from `main`.** A bad push is an instant production outage. The app is live in the App Store.

**Do not change Railway env vars casually.** Sensitive vars like `JWT_SECRET`, OAuth keys, and Apple signing keys have production blast radius. Only rotate/change them when the task explicitly requires it, or when exposed-secret / provider-remediation work makes it necessary, and coordinate the impact first.

## Claude Worktrees

- `.claude/worktrees/` are Claude-local git worktrees for parallel investigation and implementation. They are operational tooling, not product deliverables.
- Never push `.claude/worktrees/` paths or treat Claude-local report output as app/server source changes.
- Generated local artifacts such as `.snyk-cache/`, `metro.pid`, and ad-hoc Claude reports should not be used as evidence that product code is dirty.
- When using a Claude worktree, pass the current task scope and decisions explicitly. Do not rely on another worktree's transient files as shared memory.

## Debugging Approach

Trace the real data flow: button tap → API call → middleware → handler → DB → response → client state. Don't do surface-level code review.

Check contract mismatches between client TypeScript types and server Zod schemas — they compile independently and can silently diverge. Test against the real API, not static analysis.

Check env vars, Railway logs, and build configs — not just source code.

## Production Must-Not-Break

- iOS bundle ID is `com.varsithub.varsityhub-ios` (typo, permanently registered in App Store Connect — cannot change)
- Apple Sign-In must stay visible whenever Google Sign-In is shown (Apple guideline)
- iOS payments must use Apple IAP only — no Stripe links/redirects on iOS
- Console logs are stripped in production (`babel-plugin-transform-remove-console` keeps error/warn)

## Security Constraints (Already Enforced Server-Side)

- Role escalation: owner role blocked on all generic membership/invite endpoints
- Ad booking horizon: 56-day max from today
- Checkout holds: fatal on failure — no partial bookings
- Team creation enforced inside `$transaction` (race-condition safe)
- Rate limiting requires `DISABLE_RATE_LIMITING=1` to disable (never set in Railway)
- Apple sim tokens require `ALLOW_APPLE_SIM_TOKENS=1` (dev only, never in Railway)
- Don't introduce client-trusted flags for things already enforced server-side

## Navigation Architecture

- Root `_layout.tsx` uses a single `<Stack>` with Expo Router file-based auto-registration — only `+not-found` is declared explicitly; every file under `app/` becomes a route automatically
- Screens shared between root Stack and `(tabs)` use one-line bridge re-exports (one real implementation, the other side re-exports it; direction varies)
- `safeGoBack` is the standard back helper (~180 uses)
- All three goBack implementations (`safeGoBack`, `NavigationHistoryContext.safeGoBack`, `useEdgeSwipeBack`) now use `getNavigationFallback()` from context — no more hardcoded `/(tabs)/feed` fallbacks
- `useEdgeSwipeBack` is disabled on screens with horizontal FlatLists
- Every screen implements its own back button (`headerShown: false` globally)

### Navigation Primitive Taxonomy

| Primitive                      | When to use                                                                                                                                                                                 | Dead-end risk                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `safeGoBack(router, fallback)` | **Default** for all back/dismiss/cancel actions. Returns the user to where they came from.                                                                                                  | None — fallback is only used when there's no history             |
| `router.push(route)`           | Forward navigation that the user should be able to back out of.                                                                                                                             | None                                                             |
| `router.replace(route)`        | **Auth gates** (unauthenticated redirect), **onboarding linear steps** (back would break the flow), **sequential purchase flows** (payment → confirmation). Stack is cleared intentionally. | High if misused — use `// nav-safe: <reason>` to document intent |
| `router.replace('/(tabs)')`    | **Banned.** Drops all history and lands on the tab root with no back stack. Use `safeGoBack(router, '/(tabs)/feed')` instead.                                                               | Always — pre-commit guardrail blocks this                        |

**When in doubt:** use `safeGoBack`. If the destination must be deterministic regardless of history (auth gate, purchase confirmation), use `router.replace` with a `// nav-safe: <reason>` comment so `npm run audit:navigation` classifies it correctly.

## Plans (Billing)

- Rookie: free, 4 teams, 50 roster, 6 authorized users/team
- Veteran: $0.99/mo/team (teams over 4), 100 roster, 5 authorized users/team
- Legend: $19.99/yr, unlimited teams + clubs + authorized users

## OTA Updates

- `runtimeVersion` uses `{ "policy": "appVersion" }` — auto-derived from `version` field, never hardcode a string
- OTA only delivers JS bundle changes. New native modules (ios/android native code) require a new binary via `eas build` + App Store submission
- Any native module added after the current App Store binary MUST be dynamically imported with try-catch (see `OfflineBanner.tsx` pattern for `@react-native-community/netinfo`)
- `fallbackToCacheTimeout: 0` means updates download in background, apply on next cold start — users need two app opens to see changes
- Always verify the App Store binary's runtime version matches what `eas update` is publishing
- **A code fix is NOT live until `eas update` is run.** Committing and pushing to main deploys the server (Railway auto-deploys) but does NOT update the client app. Every client-side fix requires an explicit `eas update --branch production` to reach users. Always remind the user to run this after any client fix.

## Post-mapper Consistency Rule

Two LIVE post mapper functions exist and MUST stay in sync:

- `mapHighlightToFeedPost` in `app/game-details/GameVerticalFeedScreen.tsx` — used for highlights API data
- `toFeedPost` in `app/profile.tsx` — used for profile post data (the `/profile` + `/(tabs)/profile` route)

**When fixing a field mapping in one, always check and fix the other.** Caption/content/title fallback chains, `preview_url`, `has_upvoted`, `has_bookmarked`, `author` shape — if they diverge, bugs appear in one context but not the other. Enforced by `app/game-details/__tests__/post-mapper-consistency.test.ts` (parity across both live mappers) and `app/game-details/__tests__/GameVerticalFeedScreen.caption.test.ts` (caption chain). NOTE: a third copy formerly lived in `app/features/navigation/screens/ProfileScreen.tsx`; that screen was orphaned dead code and has been deleted.

## Quick Checks

```bash
# TypeScript errors (server)
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -20

# Server test suite — MUST run via npm test (wraps jest with
# node --experimental-vm-modules for ESM). Bare `npx jest` on the full suite
# fails ~100 suites with "Cannot use 'import.meta' outside a module".
cd server && npm test

# Dark mode violations (text colors) — excludes shadowColor (not text) and
# lines tagged `// audit:` (reviewed-intentional contrast colors).
grep -rn "'#000\|'#333\|'#374151\|'#111\|black" app/ --include="*.tsx" | grep -vE "backgroundColor|shadowColor|audit:"

# Unbounded queries — Jest checks 50-line context windows; grep misses multi-line take: clauses
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5

# Direct sgMail usage outside provider implementations
rg -n "sgMail.send" server/src --glob "*.ts" -g '!server/src/services/email/providers/**'

# Routes using req.user — ADVISORY ONLY (over-reports). requireAuth is applied
# at the router level, not on the same line, so this grep can't confirm coverage.
# Eyeball NEW hits in your diff; the REAL gate is the middleware test suite:
#   cd server && npm test -- --testPathPattern="middleware-coverage|requireOnboarded-bypass"
grep -rn "req.user" server/src/routes/ --include="*.ts" | grep -v requireAuth

# Navigation dead ends — classify every router.replace; flag any REVIEW items
npm run audit:navigation
```

## Release Workflow

- Canonical release path: `docs/release/RELEASE_WORKFLOW.md`
- Phase 1 local gate: `npm run release:verify:local`
- Phase 2 build gate: `npm run release:verify:build`
- Phase 3 runtime gate: `BASE_URL="https://your-api" npm run release:verify:runtime`
- Final sign-off: `docs/release/LAUNCH_READINESS_GATE.md`

## Git Workflow

**Never run `git stash apply` directly** — use `npm run stash:apply` instead. This applies the stash and immediately scans for unresolved conflict markers, listing every affected file with block counts.

**Before committing**, run `npm run check:conflicts` to ensure no `<<<<<<<` markers are present in source files. The pre-commit hook (`scripts/verify-guardrails.sh`) also enforces this automatically.

**Format before commit**: `npm run format` runs prettier across all source directories. The pre-commit hook (lint-staged) auto-formats staged files, but running it manually first avoids surprises.

**Quick checks before pushing to main**:

```bash
npm run check:conflicts         # no merge/stash markers
npm run format:check            # all files prettier-clean
npx tsc --noEmit --project server/tsconfig.json  # server TypeScript
npm run verify:error-envelope   # no raw res.status().json()
npm run audit:navigation        # classify all router.replace calls; flag REVIEW items
```

## Known Quirks

- Local `server/.env` has placeholder Cloudinary creds — uploads only work in production
- Sub-screens appear in both root Stack AND as `hiddenTab` in `(tabs)/_layout.tsx` — this is intentional Expo Router behavior
- Email template coverage has grown substantially; do not rely on hardcoded counts in docs. Check `TEMPLATE_IDS`, `REQUIRED_TEMPLATE_KEYS`, and `RECOMMENDED_TEMPLATE_KEYS` directly in `server/src/lib/email.ts`
- `service-account-key.json` in project root is gitignored — needed for Android Play Store submissions
- `@react-native-community/netinfo` is dynamically imported via try-catch in `OfflineBanner.tsx` — safe for OTA to binaries built before it was added
- Server geocoding depends on Railway `GOOGLE_MAPS_API_KEY`; mobile map rendering depends on EAS `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Poll voting now hits the API for all events including those without a linked `gameId` (uses `eventId` as fallback). Previously event-only pages silently discarded votes.
- Signup email send is fire-and-forget — `POST /register` does not await SendGrid before responding.

## Code Rules

- Text colors MUST use `useColorScheme()` or theme constants — never hardcode `#000`, `#111827`, `#374151`, `black`
- Back navigation: use `safeGoBack(router, fallback)` — never `router.replace('/(tabs)')` (drops navigation history and lands users on the tab root with no back stack)
- Emails MUST go through `EmailService`/`sendTemplateEmail`; only provider implementations may call `sgMail.send()` directly
- Database: ALL `findMany` MUST have a `take` limit — no unbounded queries
- Auth: ALL routes accessing `req.user` MUST have `requireAuth` middleware
- Posts: users must pass `requireOnboarded` middleware to create posts
- Teams MUST have `organization_id` — no orphaned teams
- Run `npx tsc --noEmit --project server/tsconfig.json` after backend changes
- Test scripts go in `server/scripts/` — never in `src/`

## Security Invariants (Do Not Break)

- **No client-controlled security-critical state** — payment status, approval state, role, and plan are always server-authoritative
- **Backend validation is law** — frontend validation is UX only; never rely on client-side checks for security
- **One source of truth per domain object** — plan from `getCanonicalPlan()`, membership from DB, approval from `AdminActivityLog`
- **Every protected route must check**: authentication → role → plan → ownership (server-side, not client)
- **IDOR guard on self-action**: users must never approve/reject/modify their own pending requests
- **Deep link params use allowlist** — `buildRouteParams()` in `utils/deepLinks.ts` enforces per-route key allowlists; do not bypass
- **Webhook lock failures return 503** (not 500) so Stripe retries instead of marking failed
- **Apple IAP cert chain must pin to `CN=Apple Root CA - G3`** exactly — loose substring match is not acceptable
- **Org invite role escalation**: only owners can invite at `manager` role; managers may only invite `member`
- **Payment-success inner catch must surface non-auth errors on final retry** — no silent swallowing

## PR Checklist (Run Before Each PR)

The enforcement gate derived from the **Security & Architecture Audit Standard** below. A PR passes only when every box is checked; the tags map each item back to the standard. Run the automated block first, then confirm the human-judgment items in the PR description. Every command here is a real, wired npm script or a grep that runs against this tree today.

```bash
# ── [GATE] Type safety — client + server, 0 new errors ────────────────────────
npx tsc --noEmit 2>&1 | tail -5
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5

# ── [GATE] Unbounded queries — Jest checks 50-line windows; grep misses multi-line take:
# Single suite runs fine without the ESM wrapper; the FULL server suite needs `npm test`.
cd server && npm test -- --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5; cd ..

# ── [GATE] Regression battery — the curated client+server invariant suites ─────
npm run test:regressions

# ── [ENG] Routes using req.user — ADVISORY (over-reports; requireAuth is ───────
# applied at the router level, not same-line). Eyeball NEW diff hits; the real
# gate is: cd server && npm test -- --testPathPattern="middleware-coverage|requireOnboarded-bypass"
grep -rn "req.user" server/src/routes/ --include="*.ts" | grep -v requireAuth

# ── [ENG] Direct sgMail usage outside providers ───────────────────────────────
rg -n "sgMail.send" server/src --glob "*.ts" -g '!server/src/services/email/providers/**'

# ── [ENG] No raw error responses — must use the error envelope ────────────────
npm run verify:error-envelope        # no bare res.status().json() (diff-scoped)
npm run verify:async-handlers        # every async route wrapped in asyncHandler

# ── [ENG] No hardcoded secrets introduced ─────────────────────────────────────
npm run verify:secrets

# ── [BIZ] Cache invalidation on user-state mutations ──────────────────────────
npm run verify:user-cache

# ── [GATE] Hardcoded dark text colors — excludes shadowColor + `// audit:` ─────
grep -rn "'#000\|'#111\|'#222\|'#333\|'#374151\|'#111827\|'#1a1a\|black" app/ --include="*.tsx" | grep -vE "backgroundColor|shadowColor|audit:"

# ── [ENG] Screens must not call fetch directly — route through api/* ───────────
# \b excludes refetch(); the trailing filter excludes member calls like X.fetch().
grep -rnE "\bfetch\(" app/ --include="*.tsx" | grep -v "// allow-fetch" | grep -vE "\.fetch\("

# ── [AUDIT] Navigation dead ends — classify all router.replace; 0 REVIEW items ─
npm run audit:navigation:fail        # nonzero exit if any UNREVIEWED item

# ── [GATE] P0 foundation — dep CVEs + rate-limit coverage + payments confidence
npm run verify:p0:foundation
```

Touched payments / auth / webhooks? Also run the matching invariant suite from the **Per-System Audit Playbook** below (e.g. `cd server && npm test -- --testPathPattern="payments-invariants|stripe-webhook-signature"`).

Human-judgment gate (cannot be grepped — confirm explicitly in the PR description):

- [ ] **[BIZ]** No client-controlled payment/approval/role/plan field reaches a security decision (server is authoritative). Server is the only writer of these via `getCanonicalPlan()` / `AdminActivityLog` / DB membership.
- [ ] **[AUDIT]** Validation parity: frontend constraints match the backend Zod schema — username (3–20), email format, password (8+), team/org names — or carry an `// intent:` note explaining the deviation.
- [ ] **[ENG]** Every new async screen renders loading, error, success, and empty states (all four reachable).
- [ ] **[ENG]** No silent `catch {}` in auth/payment/user flows; errors logged with `[context]` prefix and surfaced to the user.
- [ ] **[AUDIT]** New webhooks/retries/jobs are idempotent — replaying the same input is a no-op (replay test or written rationale).
- [ ] **[AUDIT]** New admin/approval action emits an `AdminActivityLog` row (actor/target/action/timestamp) via `server/src/lib/adminActivityLogger.ts`.
- [ ] **[AUDIT]** No silent fallback that changes security posture (e.g. a `catch` that downgrades a failed check to "allowed", or a default that grants instead of denies).
- [ ] **[GATE]** Security fix includes a before/after exploit reproduction; schema change includes migration status, generated-client refresh, and rollback note (remember `start.sh` runs `prisma migrate deploy` on every prod deploy).

## Security & Architecture Audit Standard

The one-page standard. Every rule is **tagged by type** and **testable** — it states how we know it passed, and where the control actually lives in this tree. Do not add a rule here without a `Verify:` clause that points to a real command, file, or test. The four types:

- **[AUDIT]** Audit Step — what a reviewer must actively check during a security/architecture pass.
- **[ENG]** Engineering Standard — how code must be structured (enforced in review/CI).
- **[BIZ]** Business Rule — VarsityHub-specific logic that must hold true (enforced server-side).
- **[GATE]** Release Gate — objective pass/fail before merge/ship.

**Finding classification:** rank every finding by **exploitability × blast radius × recoverability**, mapped onto the P0–P3 rubric — not a bare severity label. Every finding ships with proof: affected files (`path:line`), exploit/repro path, expected vs actual behavior, fix strategy. Every fix ships with verification: typecheck, the relevant invariant test, before/after repro, release-risk note.

### Layering (this repo — there is no `src/features/*`) — [ENG]

The generic "feature folder" model does **not** apply here. The real shape:

- **Client:** `app/` = Expo Router route files, kept thin (no `fetch`, no business logic) → `api/*` typed clients → shared code in `components/`, `hooks/`, `utils/`, `context/`, `constants/`, `lib/`, `shared/`. (`app/features/` exists but is legacy; prefer the dirs above. The orphaned `app/features/navigation/screens` was deleted — don't resurrect that pattern.)
- **Server:** `server/src/routes/*` = thin Express handlers → business logic in `server/src/lib/*`, integrations in `server/src/services/*`, gates in `server/src/middleware/*`, async work in `server/src/workers/*` + `server/src/jobs/*`.

**Verify:** route files (client `app/` and server `server/src/routes`) contain no direct DB access, no `fetch`, and no multi-step business logic — that lives one layer down.

### Threat-Model Phase (run first) — [AUDIT]

Enumerate, per feature: auth bypass, privilege escalation, payment spoofing, IDOR, webhook replay, stale-cache abuse, deep-link parameter injection.
**Verify:** each threat has a named server-side control (file:line) or a written "N/A because…" note in the audit output.

### Trust Boundary Map — [AUDIT]

| Boundary                        | Trust Level              | Control (where it lives)                                                                    | Verify                                                              |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Client → API                    | Untrusted                | JWT-verified in `middleware/requireAuth.ts`; identity from token, never body                | `req.user` derives from token, not body (grep checklist item)       |
| Stripe webhook                  | Trusted after sig-verify | `stripe.webhooks.constructEvent` + `x-idempotency-key` (`routes/payments.ts`)               | `stripe-webhook-signature.test.ts`; replay is a no-op               |
| Apple S2S / IAP                 | Trusted after sig-verify | Cert chain pinned to exact `CN=Apple Root CA - G3` (`routes/payments.ts:2928,3410`) + dedup | `iap-config-invariants.test.ts`, `apple-notification-dedup.test.ts` |
| SendGrid webhook                | Trusted after sig-verify | Signature check in `routes/sendgrid-webhook.ts`                                             | `sendgrid-webhook.test.ts`                                          |
| Third-party auth (Google/Apple) | Trusted token only       | Token re-verified server-side, not a client claim (`routes/auth.ts`)                        | `oauth-account-linking.test.ts`, `require-verified-oauth.test.ts`   |
| Deep links                      | Untrusted                | `buildRouteParams()` per-route allowlist (`utils/deepLinks.ts`)                             | unlisted param is dropped (test)                                    |
| Admin / approval actions        | Privileged               | Must emit `AdminActivityLog` via `lib/adminActivityLogger.ts`                               | audit-log row asserted (e.g. `coach-approval.test.ts`)              |
| Outbound 3rd-party calls        | Untrusted dependency     | `runWithBreaker()` (`lib/circuitBreaker.ts`); Stripe uses SDK timeout/retries instead       | `circuit-breaker.test.ts`                                           |

### Source-of-Truth Rules — [BIZ]

One writer per domain object; the client only ever reads.

- **Plan status** — server DB only via `getCanonicalPlan()` (`server/src/lib/userBillingState.ts`). **Verify:** no plan/entitlement decision derived from client state, props, or query params; `payments-invariants.test.ts`.
- **Approval state** — server DB only, recorded in `AdminActivityLog` (`server/src/lib/adminActivityLogger.ts`). **Verify:** approval never read from component props; IDOR self-action blocked (`coach-approval.test.ts`, `*-approval-race.test.ts`).
- **Org/team membership & role** — server DB only; re-fetched on protected-screen nav. **Verify:** protected screen refetches, not a cached client flag; `team-membership-authorization.test.ts`, `organization-data-access-invariants.test.ts`.
- **Payment status** — Stripe/Apple webhook confirmed; the `payment-success` screen verifies via API, never trusts query params. **Verify:** success path calls the verify endpoint; `payments-finalization.test.ts`.

### Architecture & Validation Standards — [ENG]

- **Thin routes** — see Layering above. **Verify:** route files have no DB/`fetch`/business logic.
- **Screens never call `fetch` directly** — go through `api/*`; data fetching via the single `lib/queryClient.ts` (react-query), spinners gated on `isPending`. **Verify:** `grep -rn "fetch(" app/` returns only `// allow-fetch` hits.
- **No client-controlled security-critical fields** (payment/approval/role/plan). **Verify:** server ignores these on the request body (schema test); owner role blocked on generic membership/invite endpoints.
- **Validation parity** across frontend/backend Zod/DB; any intended deviation carries an `// intent:` note. **Verify:** frontend constraints match the Zod schema (diff in PR checklist).
- **Every async flow is idempotent** (webhooks/retries/jobs/BullMQ). **Verify:** running the handler twice with the same input yields one effect; replay test per webhook.
- **No silent failures** in user/payment/auth flows, and **no fallback that changes security posture** (a `catch` must never downgrade a failed gate to "allowed"). **Verify:** no `catch {}` swallow; logs use `[context]` prefix and surface a user message; payment-success inner catch surfaces non-auth errors on final retry.
- **Errors use the envelope** — no raw `res.status().json()`; async handlers wrapped in `asyncHandler`. **Verify:** `npm run verify:error-envelope`, `npm run verify:async-handlers`.
- **All `findMany` carry a `take`.** **Verify:** `unbounded-queries.test.ts`.
- **Every screen renders loading, error, success, and empty states.** **Verify:** each of the four is reachable in the component.
- **Every deep link validates params** — fails closed for privileged actions, graceful for public nav. **Verify:** missing/malformed param test per route.
- **Every admin action is auditable** (actor/target/action/timestamp). **Verify:** `AdminActivityLog` row asserted in a test.

### Observability & Rollback — [ENG]

- **Structured logging:** user/payment/auth failures log with a `[context]` prefix; exceptions go to Sentry, never raw stacks into the DB (see `dataExportWorker.ts` error-category pattern). **Verify:** grep for the `[context]` prefix on new catch blocks.
- **Admin auditability:** every privileged mutation writes `AdminActivityLog`. **Verify:** asserted in a test.
- **Migrations auto-apply:** `start.sh` runs `prisma migrate deploy` on every Railway deploy — any committed migration hits prod automatically. **Verify:** schema change PRs include migration status + an explicit rollback note (forward-fix or down-migration).
- **No in-process shared state** — coordinate cross-replica via Redis (rate-limit DB 1, BullMQ DB 0, cache DB 2, locks, socket adapter); startup-once work via `runClusterOnce`. **Verify:** new shared state goes through Redis, not module globals (breaks at `numReplicas>1`).

### Per-System Audit Playbook — [AUDIT]

Apply the per-feature loop (map → trace data flow → enumerate gates → check drift → check idempotency → check silent failures) to each major system, and run its invariant suite.

| System                | Routes / source of truth                                                      | Run                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments & Subs       | `routes/payments.ts`; `getCanonicalPlan()`; Stripe/Apple webhooks             | `cd server && npm test -- --testPathPattern="payments-invariants\|stripe-webhook-signature\|payments-finalization\|iap-config-invariants"` + `npm run verify:p0:foundation` |
| Ads                   | `routes/ads.ts`; 56-day horizon; checkout holds fatal-on-failure              | `cd server && npm test -- --testPathPattern="ad-state-invariants\|ad-approval-race"` + `npm --prefix server run verify:ad-approval-flow`                                    |
| Teams & Orgs          | `routes/organizations.ts`, team routes; DB membership; org_id required        | `cd server && npm test -- --testPathPattern="team-membership-authorization\|team-transfer-authorization\|team-invite-race-guards\|organization-data-access-invariants"`     |
| Auth, Roles & Onboard | `routes/auth.ts`; `middleware/requireAuth\|requireVerified\|requireOnboarded` | `cd server && npm run test:invariants` + `npm test -- --testPathPattern="auth-security-hardening\|requireOnboarded-bypass\|oauth-account-linking"`                          |
| Approvals & Admin     | coach/event/game approval; `AdminActivityLog`; IDOR self-action guard         | `cd server && npm test -- --testPathPattern="coach-approval\|event-approval-race\|games-approval-race\|admin-reports-race-guards"`                                          |
| Feed / Post mappers   | `mapHighlightToFeedPost`, `toFeedPost` (see Post-mapper Consistency Rule)     | `npx jest app/game-details/__tests__/post-mapper-consistency.test.ts`                                                                                                       |
| Runtime (post-deploy) | live Railway API health + auth                                                | `cd server && BASE_URL=… HEALTH_CHECK_SECRET=… npm run verify:production-health` + `npm run verify:auth-canary`                                                             |

### Per-Feature Audit Steps — [AUDIT]

1. Map all components: routes, Zod schemas, Prisma models, frontend screens. **Verify:** component map in the audit note.
2. Trace data flow: client → `api/*` → route → middleware → `lib/*` → DB → response → client state. **Verify:** flow documented end-to-end.
3. Identify every permission check point; confirm it exists server-side (auth → role → plan → ownership). **Verify:** each gate has a server test.
4. Compare frontend vs backend Zod vs DB constraints for drift. **Verify:** drift table with `// intent:` notes for any deviation.
5. Check every async flow for idempotency. **Verify:** replay test per webhook/job.
6. Verify every `catch` — no silent swallowing and no security-posture downgrade in auth/payment/critical paths. **Verify:** grep + manual review.

### Release Gate — [GATE] (objective pass/fail)

- [ ] `npx tsc --noEmit` and `npx tsc --noEmit --project server/tsconfig.json` — 0 new errors
- [ ] `npm run lint` — 0 errors (warnings acceptable with justification)
- [ ] `npm run release:verify:local` — exits 0
- [ ] `npm run test:regressions` — passes
- [ ] No unbounded `findMany` without `take` (`unbounded-queries.test.ts`)
- [ ] No `req.user` access without `requireAuth` middleware
- [ ] No hardcoded dark text colors in tsx files
- [ ] `npm run audit:navigation:fail` — 0 REVIEW items
- [ ] Frontend length/format constraints match backend Zod schemas
- [ ] Prisma schema indexed columns have matching migration SQL
- [ ] Security fix includes before/after exploit reproduction
- [ ] Schema change includes migration status, client refresh, and rollback note

### Deck-friendly commandments (the short version)

Thin routes, logic one layer down · Backend validation is law, frontend is guidance · No client-controlled security-critical state · One source of truth per domain object · Every protected action checks auth/role/plan/ownership server-side · Every async flow is idempotent · No silent failures and no fallback that changes security posture · No duplicate logic across routes/features · Every screen handles loading/error/success/empty · Every deep link fails gracefully and safely · Every admin action is auditable · Coordinate cross-replica via Redis, never in-process · Every release change is testable and reversible.

## Working Style

- Be surgical — only change what's needed for the task
- Don't add abstractions, helpers, or error handling for scenarios that can't happen
- Don't refactor or clean up code beyond what was asked
- Fix real bugs, not theoretical issues
- When the fix is in one file, don't touch five
