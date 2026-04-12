# VarsityHub Audit Standard

This is the repo-standard framework for security, architecture, and release audits. Every finding should be evidence-based and every rule should answer: how do we know this passed?

## Rule Types

### Audit Step

Reviewer action that must be performed during an audit.

### Engineering Standard

Codebase structure or implementation rule that should hold continuously.

### Business Rule

Product-specific invariant that must remain true.

### Release Gate

Objective pass/fail check that must be satisfied before shipping.

## Finding Format

Every finding should include:

- `title`
- `files + lines`
- `exploit path` or failure path
- `expected`
- `actual`
- `fix`
- `verification command`

## Threat Model

Every audit starts by checking these attack and failure classes:

- Auth bypass
- IDOR / ownership bypass
- Payment spoofing
- Webhook replay or duplicate finalization
- Validation drift across client, server, and schema
- Stale cache authorization errors
- Deep-link abuse and bad-param routing
- Silent third-party failure for Stripe, push, storage, or auth providers

## Trust Boundaries

Reviewers must map data flow across these boundaries:

- Client
- API server
- Database
- Background jobs / cron
- Webhooks
- Third-party auth
- Payment provider
- Media storage

## Engineering Standards

### Architecture

- Keep `app/` thin. Route wrappers should delegate to feature or shared code.
- Use shared modules for repeated policy or billing logic instead of duplicating strings and conditions.
- Screens should not call `fetch` directly; use API clients.

### Validation and Data Integrity

- Backend validation is authoritative.
- Database constraints or indexed lookups must backstop critical invariants when possible.
- Validation rules must not drift across frontend, backend, and schema without explicit documented intent.
- Async flows must be idempotent and retry-safe.

### Auth, Roles, and Permissions

- Every protected mutation checks auth, role, plan, and ownership server-side.
- Client gating is UX only; it is not authorization.
- Sensitive responses must be sanitized before leaving the server.
- Session invalidation paths must also invalidate auth caches.

### Payments and Billing

- No client-controlled security-critical billing fields.
- Paid state is persisted only after verified payment confirmation.
- Webhooks must be signature-verified, idempotent, logged, and safe to retry.
- Pricing displayed in active UI and backend email/job copy must match current billing rules.

### Navigation and Deep Links

- Every public route must resolve through Expo Router.
- Missing or malformed params must fail gracefully.
- In multi-step flows, forward navigation should use `replace` when stack growth would create broken back behavior.

### UI Reliability

- Every screen handles loading, success, error, and empty states where applicable.
- No silent `catch {}` in user-facing or payment-critical flows.
- Async effects that call `setState` after awaits must guard unmounts.
- Double-submit paths require explicit in-flight guards.

### Observability

- Errors must log with enough context to reproduce the flow.
- Admin actions that change auth, moderation, or billing state must be auditable.
- Correlation IDs should propagate across client, API, jobs, and webhook processing for critical flows.

### Reversibility

- High-risk changes should document a rollback path.
- Schema changes require migration verification and deploy notes.
- Feature flags or kill switches are preferred for operationally risky rollouts.

## Business Rules

- `approval_status` is trusted server state, never client state.
- `payment_status` is trusted server state, never client state.
- Paid ads appear in feed only when both approved and paid.
- Paid subscriptions are not activated before confirmed checkout.
- Coach-only and plan-gated features must re-check server-side even if hidden in the client.

## Release Gates

- `npm run typecheck:app`
- `npm run typecheck:server`
- `cd server && npx prisma validate`
- `cd server && npx prisma generate`
- `cd server && npx prisma migrate status`
- `git diff --check`
- Critical audit regressions covered by automated tests where practical
- Real-device smoke coverage for auth, onboarding, billing, messaging, and moderation flows

## Commandments

- Thin routes, thick features.
- Backend validation is law.
- No client-controlled security state.
- One source of truth per domain.
- Every protected action checks auth, role, plan, and ownership server-side.
- Every async flow is idempotent.
- No silent failures.
- No duplicate logic when policy can be shared.
- Every screen handles its required states.
- Deep links fail gracefully.
- Every admin action is auditable.
- Every release is reversible.
