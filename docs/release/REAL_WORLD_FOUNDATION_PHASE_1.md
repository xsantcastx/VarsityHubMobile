# Real World Foundation Readiness - Phase 1 Baseline

Date: 2026-09-02

## Scope

Phase 1 locked the current baseline before product fixes. The goal was to verify
repo state, release guardrails, dependency/security signal, and production reachability.

## Repo State

- Branch: `main`
- Current head: `9bac9c0f`
- Tracking state: ahead of `origin/main` by 97 commits
- Active pushed target observed in history: `fork/main`

## Gates Run

- `npm run check:conflicts`: pass
- `npm run verify:secrets`: pass
- `npm run verify:error-envelope`: pass, no server changes detected at first run
- `npm run audit:navigation:fail`: pass, 0 REVIEW items
- `npm --prefix server run verify:access-matrix`: pass, 46 tests
- `npm run verify:guardrails`: pass
- `npx tsc --noEmit`: pass
- `npx tsc --noEmit --project server/tsconfig.json`: pass
- `npm --prefix server audit --omit=dev --audit-level=high`: pass for high/critical; moderate findings remain
- Railway health: `https://api-production-8ac3.up.railway.app/health` returned `{"status":"ok"}`
- Vercel web reachability: `https://www.varsityhub.app` returned HTTP 200

## Dependency Hardening Applied

Root dependency scan had fixable high advisories for transitive `nanoid` and
`browserslist`. The root package overrides now pin:

- `nanoid`: `3.3.18`
- `browserslist`: `4.28.8`

Server dependency refresh exposed that `sanitize-html@2.17.7` requires Node
`>=22.12.0`, while this project currently runs Node 20 in CI/deploy tooling.
To avoid accidental Node-floor drift, server `sanitize-html` is pinned to the
current compatible version:

- `sanitize-html`: `2.17.5`

Server `nanoid` is also resolved to `3.3.18` through overrides.

## Open Dependency Risks

These remain known, reviewed platform/runtime items:

- Root `npm audit --omit=dev --audit-level=high` still fails because of
  `image-size` through Expo/Metro. npm's proposed fix is a breaking Expo major
  upgrade.
- Root audit also reported `minimatch` through React Native's nested
  `glob@7.2.3` path in this phase. This was later fixed in Phase 4 by bumping
  that compatible lockfile entry to `3.1.5` and validating
  `npm ls minimatch --all`.
- `query-string` / `decode-uri-component` remains moderate through React
  Navigation / Expo Router.
- `sanitize-html` remains moderate on Node 20. The fixed release currently
  requires Node `>=22.12.0`, so resolving it requires a runtime upgrade decision.

## Phase 1 Decision

Phase 1 is mostly green but not a full release approval by itself. The code
guardrails and production reachability checks passed. Dependency tooling is
working, and it correctly surfaces remaining platform-level risks that need
either accepted-risk documentation or an Expo/Node upgrade lane.

## Next Phase

Phase 2 should address the visible UX issues from the notes:

- Map marker preview: remove the `+` and chevron-only actions, make the preview
  text/card open the event page, and add a close `x`.
- Map past-date zoom: keep a normal viewing distance when a selected date has
  only one event.
- Upload blank-screen report: reproduce on the current app runtime before
  changing code.
- Share/Instagram flow: verify share button behavior and light/dark visibility.
- Competitive vs non-competitive event banners: verify dimension parity and
  crop behavior.
