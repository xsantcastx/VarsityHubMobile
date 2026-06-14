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

| Primitive | When to use | Dead-end risk |
|-----------|-------------|---------------|
| `safeGoBack(router, fallback)` | **Default** for all back/dismiss/cancel actions. Returns the user to where they came from. | None — fallback is only used when there's no history |
| `router.push(route)` | Forward navigation that the user should be able to back out of. | None |
| `router.replace(route)` | **Auth gates** (unauthenticated redirect), **onboarding linear steps** (back would break the flow), **sequential purchase flows** (payment → confirmation). Stack is cleared intentionally. | High if misused — use `// nav-safe: <reason>` to document intent |
| `router.replace('/(tabs)')` | **Banned.** Drops all history and lands on the tab root with no back stack. Use `safeGoBack(router, '/(tabs)/feed')` instead. | Always — pre-commit guardrail blocks this |

**When in doubt:** use `safeGoBack`. If the destination must be deterministic regardless of history (auth gate, purchase confirmation), use `router.replace` with a `// nav-safe: <reason>` comment so `npm run audit:navigation` classifies it correctly.

## Plans (Billing)

- Rookie: free, 3 teams, 50 roster, 6 authorized users/team
- Veteran: $0.99/mo/team (teams over 3), 100 roster, 5 authorized users/team
- Legend: $19.99/yr, unlimited teams + clubs + authorized users

## OTA Updates

- `runtimeVersion` uses `{ "policy": "appVersion" }` — auto-derived from `version` field, never hardcode a string
- OTA only delivers JS bundle changes. New native modules (ios/android native code) require a new binary via `eas build` + App Store submission
- Any native module added after the current App Store binary MUST be dynamically imported with try-catch (see `OfflineBanner.tsx` pattern for `@react-native-community/netinfo`)
- `fallbackToCacheTimeout: 0` means updates download in background, apply on next cold start — users need two app opens to see changes
- Always verify the App Store binary's runtime version matches what `eas update` is publishing
- **A code fix is NOT live until `eas update` is run.** Committing and pushing to main deploys the server (Railway auto-deploys) but does NOT update the client app. Every client-side fix requires an explicit `eas update --branch production` to reach users. Always remind the user to run this after any client fix.

## Post-mapper Consistency Rule

Two post mapper functions exist and MUST stay in sync:
- `mapHighlightToFeedPost` in `app/game-details/GameVerticalFeedScreen.tsx` — used for highlights API data
- `toFeedPost` in `app/profile.tsx` and `app/features/navigation/screens/ProfileScreen.tsx` — used for profile post data

**When fixing a field mapping in one, always check and fix the other.** Caption/content/title fallback chains, `has_upvoted`, `has_bookmarked`, `author` shape — if they diverge, bugs appear in one context but not the other. The regression test at `app/game-details/__tests__/GameVerticalFeedScreen.caption.test.ts` guards the caption chain.

## Quick Checks

```bash
# TypeScript errors (server)
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -20

# Server test suite — MUST run via npm test (wraps jest with
# node --experimental-vm-modules for ESM). Bare `npx jest` on the full suite
# fails ~100 suites with "Cannot use 'import.meta' outside a module".
cd server && npm test

# Dark mode violations (text colors)
grep -rn "'#000\|'#333\|'#374151\|'#111\|black" app/ --include="*.tsx" | grep -v backgroundColor

# Unbounded queries — Jest checks 50-line context windows; grep misses multi-line take: clauses
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5

# Direct sgMail usage outside provider implementations
rg -n "sgMail.send" server/src --glob "*.ts" -g '!server/src/services/email/providers/**'

# Missing requireAuth on routes using req.user
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

## Audit Checklist (Run Before Each PR)

```bash
# TypeScript errors (server)
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5

# TypeScript errors (client)
npx tsc --noEmit 2>&1 | tail -5

# Unbounded queries — Jest checks 50-line context windows; grep misses multi-line take: clauses
cd server && npx jest --testPathPattern="unbounded-queries" --no-coverage 2>&1 | tail -5

# Missing requireAuth on routes using req.user
grep -rn "req.user" server/src/routes/ --include="*.ts" | grep -v requireAuth

# Direct sgMail usage outside providers
rg -n "sgMail.send" server/src --glob "*.ts" -g '!server/src/services/email/providers/**'

# Hardcoded dark text colors (dark mode violations)
grep -rn "'#000\|'#111\|'#222\|'#333\|'#374151\|'#111827\|'#1a1a\|black" app/ --include="*.tsx" | grep -v backgroundColor

# Validation drift — frontend vs backend length constraints
# Manually verify: username (3-20), email format, password (8+ chars), team/org names

# Navigation dead ends — classify all router.replace calls; must show 0 REVIEW items
npm run audit:navigation
```

## Security Audit Framework

Apply this structure for any security or architecture audit. Classify every finding by **exploitability**, **blast radius**, and **recoverability** — not just severity labels.

### Threat-Model Phase (run first)
Check for: auth bypass, privilege escalation, payment spoofing, IDOR, webhook replay, stale cache abuse, deep-link parameter injection.

### Trust Boundary Map
| Boundary | Trust Level | Notes |
|----------|-------------|-------|
| Client → API | Untrusted | JWT-verified only; never trust body fields for user identity |
| Webhooks (Stripe/Apple) | Trusted after sig-verify | Idempotency key required |
| Third-party auth (Google/Apple) | Trusted token only | Verify server-side, not client claim |
| Deep links | Untrusted | Validate params; use `buildRouteParams()` allowlist |
| Admin actions | Privileged | Must emit audit log |

### Source-of-Truth Rules
- **Plan status** — server DB only (`getCanonicalPlan()`); never derived from client state
- **Approval state** — server DB only (`AdminActivityLog`); never from component props
- **Org membership** — server DB only; re-fetched on navigation to protected screens
- **Payment status** — Stripe/Apple webhook confirmed; `payment-success` must verify via API

### Audit Steps (per feature)
1. Map all components: routes, schemas, DB models, frontend screens
2. Trace data flow: client → API → DB → response → client state
3. Identify every permission check point and verify it exists server-side
4. Compare frontend validation vs backend Zod schema vs DB constraints for drift
5. Check every async flow for idempotency (webhooks, retries, background jobs)
6. Verify every `catch {}` block — no silent swallowing in auth/payment/critical paths

### Engineering Commandments
- **Thin routes, thick features** — `app/` is routing only; logic in `src/features/*`
- **Backend validation is law** — frontend validation is UX only; never rely on it for security
- **No client-controlled security-critical state** — payment, approval, role, plan are always server-authoritative
- **One source of truth per domain object**
- **Every protected action checks auth → role → plan → ownership on the server**
- **Every async flow is idempotent**
- **No silent failures in user or payment flows** — log with `[context]` prefix, show user-friendly message
- **No duplicate validation logic** — single Zod schema per domain, shared across routes
- **Every screen handles loading, error, success, and empty states**
- **Every deep link fails gracefully and safely**
- **Every admin action is auditable** — actor, target, action, timestamp
- **Every release change is testable and reversible**

### Release Gate (objective pass/fail)
- [ ] `npx tsc --noEmit --project server/tsconfig.json` — 0 new errors
- [ ] `npx tsc --noEmit` — 0 new errors
- [ ] `npm run lint` — 0 errors (warnings acceptable with justification)
- [ ] `npm run release:verify:local` — exits 0
- [ ] No unbounded `findMany` without `take`
- [ ] No `req.user` access without `requireAuth` middleware
- [ ] No hardcoded dark text colors in tsx files
- [ ] Frontend length/format constraints match backend Zod schemas
- [ ] Prisma schema indexed columns have matching migration SQL


## Working Style

- Be surgical — only change what's needed for the task
- Don't add abstractions, helpers, or error handling for scenarios that can't happen
- Don't refactor or clean up code beyond what was asked
- Fix real bugs, not theoretical issues
- When the fix is in one file, don't touch five
