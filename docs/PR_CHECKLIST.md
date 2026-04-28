# Pull Request Checklist

> Every PR answers every line. "N/A" is a valid answer **with a reason.**
> "Not applicable because this PR only touches docs" is valid. "Not applicable"
> alone is not.

## Mechanical gates — must all pass

- [ ] `npx tsc --noEmit --project server/tsconfig.json` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:regressions` passes
- [ ] `npm run verify:guardrails` passes
- [ ] `npm run verify:error-envelope` clean
- [ ] Pre-commit hook ran locally (husky installed via `npm install`)

## Drift / duplication

- [ ] No new inline notification-type switch or if/else on `item.type` outside
      `utils/notificationPresentation.ts`
- [ ] No new `display_name || ... || 'Unknown'`-style fallback chain outside
      `utils/userDisplay.ts` — use `formatUserLabel`
- [ ] No new inline `Alert.alert('Image Error', ...)` in upload error paths
      — use `utils/uploadErrorAlert.ts`
- [ ] If this PR touches `requireAuth` / `requireVerified` / `requireOnboarded`,
      or their bypass lists: both sibling middlewares are updated
- [ ] No new client TypeScript type declaring fields the server doesn't return
      (update the server select if the client needs new fields)

## Security

- [ ] If this PR touches a mutation route: auth, role, plan, AND ownership
      are all checked server-side (not just in the UI)
- [ ] If this PR adds a protected UI action: server enforces it independently
      of client gating
- [ ] If this PR adds a new access to `req.user`: `requireAuth` (or a sibling
      that implies auth) is on the route
- [ ] No client-controlled field sets payment / approval / role / plan state
- [ ] No new `.catch(() => {})` on operations the user expects to succeed
      (push, payment, email, entitlement writes)
- [ ] No PII (email, token, raw user object) logged to console / Sentry
      unredacted — route through `server/src/lib/logRedaction.ts`

## Async / concurrency

- [ ] If this PR mutates state based on current state (approval, plan,
      capacity): uses `updateMany` with state in WHERE + `result.count`
      check, OR a `$transaction` with re-check inside
- [ ] If this PR touches a webhook: idempotent, signature-verified, logged,
      dedupes by provider event id
- [ ] If this PR increments a counter: uses Prisma atomic `increment`, not
      read-then-write
- [ ] If this PR writes to more than one table: wrapped in `$transaction`

## Caching

- [ ] If this PR writes to a cached entity: the matching `invalidate*` helper
      is called in the same code path
- [ ] If this PR adds a new cache: it has an explicit invalidation path and
      its cache key includes all relevant params (user id, org id, filters)

## UI reliability

- [ ] Any new async screen renders: loading, success, error, empty — all four
- [ ] Any new form blocks double-submit (`saving` / `isLoading` guard)
- [ ] Any new button has `accessibilityLabel` and `testID`
- [ ] No hardcoded text color (`#000`, `#111827`, `'black'`) — use
      `useColorScheme()` or theme constants
- [ ] No hardcoded navigation back-route — use `safeGoBack`
- [ ] If this PR adds a `TextInput` on iOS with no autofill intent, consider
      `autoCorrect={false}` + `spellCheck={false}` to minimize QuickType bar

## Payments (skip unless this PR touches payments)

- [ ] No persisted plan / subscription state change before payment provider
      confirmation (webhook or verified receipt)
- [ ] Stripe webhook handler verifies signature AND dedupes by event id
- [ ] Apple S2S notification handler persists `notificationUUID` before any
      side effects
- [ ] Pricing / entitlements / billing quantities are derived server-side, not
      read from client input

## Deep links / navigation (skip unless this PR adds or changes a route)

- [ ] Route resolves in Expo Router when opened via cold deep link
- [ ] Required params validated; missing params fail gracefully for public
      navigation and fail closed for privileged actions
- [ ] Back navigation uses `safeGoBack`; does not grow stack on fallback

## Deploy (skip unless this PR adds/changes a server endpoint or schema)

- [ ] If new required Zod field on an existing endpoint: backward-compat path
      for older OTA clients (field made optional for 1–2 releases)
- [ ] If new endpoint the client calls: server-first deploy order documented
      in PR description
- [ ] If schema change: migration tested locally, rollback plan noted
- [ ] Any touched Railway env var is documented in the PR description
      (normal case is "no env vars touched" — per CLAUDE.md, changing
      `JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_IDS`, `APPLE_KEY_ID`, or
      `APPLE_PRIVATE_KEY` breaks all active sessions)

## Proof of fix (skip unless this PR closes a bug)

- [ ] Regression test that FAILS against pre-fix code (name it in description)
- [ ] Before/after reproduction for security fixes
- [ ] Link to the finding / issue / Sentry event being closed

---

## Reviewer guide

When reviewing, prioritize in this order:

1. Mechanical gates — if any are red, stop and ask the author to fix before
   going further.
2. Drift / duplication — these catch the majority of regressions we've
   actually shipped. Grep for the relevant shared helper; if the PR bypasses
   it, that's the finding.
3. Security + concurrency — read the code, not the PR description. Look for
   the exact patterns listed above.
4. Everything else — standards-of-care. Push back when violated but accept
   "known debt, will fix in follow-up" as an answer **with a linked ticket.**

When in doubt about a rule, consult `AUDIT_STANDARD.md` or the
`source-of-truth table` in that doc. Use `AUDIT_SCORECARD.md` when the PR is
part of a broader audit or release-readiness review.
