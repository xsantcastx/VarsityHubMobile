# Guardrail Baseline

VarsityHub uses a layered guardrail baseline for routing, linting, and type safety. This document is the reference artifact for future audits and for prompt-driven code reviews.

## Routing

- `app.config.js` is the source of truth for Expo Router experiments.
- Expo Router typed routes are required and must stay enabled.
- Route mistakes should fail in this order:
  1. TypeScript from Expo Router generated types
  2. `__tests__/route-registry.test.ts` for static navigation callsite coverage
- The route registry test intentionally excludes interpolated template strings in the first pass to avoid noisy false positives.

## Linting

- The canonical lint config is `eslint.config.js`.
- VarsityHub uses flat ESLint config, not `.eslintrc`.
- Baseline rules include:
  - `@typescript-eslint/no-unused-vars`
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-floating-promises`
  - `consistent-return`
  - `import/no-cycle`
  - a narrow `@/features/*` public-barrel boundary rule
- Existing repo-wide debt stays at `warn` so the baseline can land without a large cleanup PR.
- New drift is blocked on staged files through `lint-staged` with `eslint --max-warnings=0`.

## TypeScript

- `tsconfig.json` stays strict and path-alias aware.
- Existing aliases such as `@/api`, `@/components`, `@/features`, `@/shared`, and `@/utils` are part of the baseline.
- JS-to-TS conversion is a refactor boundary:
  - first commit is rename plus types only
  - behavior changes belong in a separate commit

## Verification

Run these commands for the baseline:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand __tests__/route-registry.test.ts
```

Manual sanity checks:

- Introduce a known-bad route literal on a scratch branch and confirm typed routes or the route-registry test fails.
- Stage a file with a new lint warning and confirm the pre-commit hook blocks it.
