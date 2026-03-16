# Security & Architecture Audit Methodology

**Audit Type:** Security & Architecture Validation Audit  
**Purpose:** Identify security gaps, validation mismatches, and architectural inconsistencies across interconnected features.

---

## Methodology

### 1. System Mapping Phase

- Identify all related components (routes, schemas, database models, frontend)
- Map data flow from frontend → backend → database
- Identify permission hierarchy and validation points

### 2. Gap Identification Phase

- Search for regex/validation mismatches (frontend vs backend)
- Check for missing authorization validations
- Identify orphaned or inconsistent data states
- Look for predictable code generation (security)
- Check for missing data persistence (webhooks, async operations)

### 3. Severity Classification

| Severity | Definition |
|----------|------------|
| **CRITICAL** | User can bypass intended restrictions |
| **HIGH** | Data integrity at risk, user confusion |
| **MEDIUM** | Architectural inconsistency, design flaw |
| **LOW** | Edge cases, UX improvements |

### 4. Fix Implementation

- Code changes with validation
- Snyk security scans
- TypeScript error checks
- Comprehensive documentation

---

## Commandments (Testable Principles)

### Overall Architecture

- Keep `app/` as thin routing only; real screens live under `src/features/*` with barrel exports and app wrappers.
- Use shared assets via `@/shared/*` (hooks/components/utils/constants) rather than duplicating in root.
- Respect path aliases (`@/features/*`, `@/shared/*`, etc.); no deep relative imports.

### State & Data

- Prefer feature-scoped state; global context only for auth, theme, user/session, location.
- API calls go through `api/*` clients; never call fetch directly in screens.
- Handle loading/error/empty states explicitly (no silent failures).

### Navigation & Deep Links

- All routes must be resolvable via Expo Router; wrappers should be stateless.
- Deep links must parse/handle missing params gracefully; tests should cover reset-password and oauth callbacks.

### UI/UX

- Always render: loading, success, error, and empty states for lists and detail views.
- Inputs must validate before network calls; block double submits (`saving`/`isLoading` guards).
- All touch targets accessible: add `testID`/`accessibilityLabel`, and meaningful alt text for images.

### Plans/Subscriptions

- Before checkout: read current plan; block duplicate paid plan; allow rookie upgrades.
- For paid plans: don't persist plan until payment callback confirms; handle email verification errors by showing modal.
- Veteran team count: enforce free first two teams; compute billing for extras.

### Teams/Organizations

- Team creation must associate an organization; create if missing; fail fast on permission/plan checks.
- Extracurricular clubs require Legend plan; enforce via error handling and UI prompts.
- Uploads (logo/background/avatar): wrap in try/catch; warn but don't block core create flow.

### Payments/Ads

- Payment-success screen must verify status with retries and surface "Try Again" + "Continue" paths.
- Ad confirmation must display banner, dates, amount, and target URL; handle missing params with defaults.

### Testing & Quality

- Tests for critical flows (auth, onboarding, payments, team create) must pass; use `jest-expo` setup with Expo polyfills.
- No `any` without justification; typecheck must stay green.
- Lint/typecheck before PR; add Playwright smoke for deep links and key tabs.

### Security & Errors

- Never swallow errors silently; log with context and show user-friendly messages.
- Guard async effects with mounted flags; avoid state updates after unmount.
- Respect role/plan gates everywhere (coach-only actions, Legend-only features).

---

## Related Documents

- `docs/SECURITY_ARCHITECTURE_AUDIT_2026-03.md` — March 2026 audit findings
- `docs/COMPREHENSIVE_SECURITY_ARCHITECTURE_AUDIT_2026.md` — January 2026 comprehensive audit

---

**Last Updated:** March 15, 2026
