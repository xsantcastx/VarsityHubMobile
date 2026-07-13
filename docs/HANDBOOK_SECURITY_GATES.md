# Handbook Security Gates (Copy/Paste)

Use these blocks in team docs, PR descriptions, and release runbooks.

Canonical policy remains:

- [`AUDIT_STANDARD.md`](./AUDIT_STANDARD.md)
- [`PR_CHECKLIST.md`](./PR_CHECKLIST.md)
- [`release/CHECKLIST.md`](./release/CHECKLIST.md)
- [`release/LAUNCH_READINESS_GATE.md`](./release/LAUNCH_READINESS_GATE.md)

---

## Strict PR Template Block

```md
### Secure Borders (Required)

- [ ] Protected mutations touched here enforce auth + role + plan + ownership server-side where applicable
- [ ] No client-controlled field can set role, plan, approval, payment, or ownership state
- [ ] Privileged flows fail closed on missing/malformed params (public navigation can fail gracefully)
- [ ] Webhook/callback/retry paths touched here are idempotent and replay-safe
- [ ] No fallback/catch/retry path weakens security posture
- [ ] Source of truth is stated for each critical state touched (auth, approval, payment, membership, ownership)
- [ ] Trust boundaries touched are listed (client/API/webhook/job/admin/deep-link/storage)
- [ ] Before/after failure path is documented for security/integrity fixes
- [ ] Observability exists for changed critical flow (logs, audit trail, or metric)
- [ ] Critical regression coverage exists or `N/A` is justified with owner + follow-up
```

---

## GO/NO-GO Release Gate

```md
### Required command gate

- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npx tsc --noEmit --project server/tsconfig.json
- [ ] npm run verify:guardrails
- [ ] npm run verify:release
- [ ] npm run test:regressions (or scoped equivalent with reason)

### Conditional gate (required when relevant)

- [ ] npm run verify:error-envelope (if error-envelope behavior changed)
- [ ] npm --prefix server run test:payments:confidence (if payment/subscription logic changed)
- [ ] npm --prefix server run verify:rate-limits (if auth/abuse/rate-limit behavior changed)

### Runtime security smoke gate

- [ ] Real-device auth flow validated (sign-in, sign-out, token refresh, protected screen access)
- [ ] Role/plan/ownership enforcement validated on server (UI hide + server deny both checked)
- [ ] Payment success path verifies backend state (does not trust query params)
- [ ] Geofence deny/allow paths verified (non-device/out-of-radius denied; in-radius device allowed)
- [ ] Dark/light critical-screen smoke complete

### Release decision

- [ ] GO only if all required gates are green or exception is documented with owner + mitigation + follow-up
- [ ] NO-GO when any required gate is red, unknown, or unverified
```

---

## Deck-Friendly Commandments

- Thin routes, thick features.
- Backend validation is law; frontend validation is guidance.
- No client-controlled security-critical state.
- One source of truth per critical domain object.
- Every protected action checks auth, role, plan, and ownership on the server.
- Every async critical flow is idempotent.
- No silent fallback that weakens security posture.
- No duplicate policy logic across routes or features.
- Every async screen handles loading, error, success, and empty states.
- Every deep link fails gracefully and safely.
- Every admin action is auditable.
- Every release change is testable and reversible.
