# Launch Readiness Gate (GO/NO-GO)

Use this as the final release sign-off gate for real-world readiness.

- This is a release blocker checklist, not guidance.
- Every required gate must be marked PASS or FAIL.
- Every PASS must include owner + evidence.
- Any required FAIL or UNKNOWN means NO-GO.

Related docs:

- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md)
- [CHECKLIST.md](./CHECKLIST.md)
- [PROVIDER_DASHBOARD_VERIFICATION.md](./PROVIDER_DASHBOARD_VERIFICATION.md)
- [../PR_CHECKLIST.md](../PR_CHECKLIST.md)

---

## Decision Rule

- **GO** only if all required gates below are PASS.
- **NO-GO** if any required gate is FAIL or UNKNOWN.
- Exceptions are allowed only with explicit risk acceptance:
  - approver,
  - mitigation,
  - rollback plan,
  - follow-up owner and deadline.

---

## Sign-Off Header

- Release tag/version:
- Date/time (UTC):
- Release owner:
- Incident commander (if rollback needed):
- Scope summary:

---

## Required Gates

Fill every row before release.

| # | Gate | Owner | Pass Criteria | Evidence | Status (PASS/FAIL/UNKNOWN) |
|---|------|-------|---------------|----------|------------------------------|
| 1 | Real-device smoke (iOS + Android) | Mobile QA | Auth, onboarding, payment, geofence, deep links, dark/light verified on physical devices | Test run IDs / checklist links | |
| 2 | Production-like staging drill | Release owner | Full release flow succeeds in staging with prod-like config and realistic data | Staging runbook result link | |
| 3 | Observability + alerting | Backend/Ops | Alerts fire for auth failures, payment/webhook failures, 5xx spikes, and geofence anomalies; logs support triage | Alert screenshots / dashboard links | |
| 4 | Load + race/concurrency validation | Backend lead | Critical race-sensitive flows show no integrity drift under concurrent traffic | Load test report / logs | |
| 5 | Rollback readiness drill | Incident commander | App/API/schema rollback path validated and time-bounded | Rollback drill notes | |
| 6 | Security operations hygiene | Security owner | Secrets hygiene verified, dependency risks triaged, no unreviewed critical findings | Security scan links / ticket refs | |
| 7 | Backup + restore drill | DB owner | Restore from recent backup works for critical tables and basic read/write checks | Restore drill evidence | |
| 8 | Abuse/fraud controls | Backend/Ops | Rate limits and abuse controls active; suspicious flows are blocked and logged | Config proof / log examples | |
| 9 | Canary and kill-switch readiness | Release owner | Canary plan, abort criteria, and safe stop path are documented and tested | Rollout plan link | |
| 10 | Support and incident readiness | Product/Support | On-call/support runbooks ready for top incidents with ownership | Runbook links / rota snapshot | |

---

## Required Command Gate (must be green)

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npx tsc --noEmit --project server/tsconfig.json`
- [ ] `npm run verify:guardrails`
- [ ] `npm run verify:release`
- [ ] `npm run test:regressions`
- [ ] `npm run test:regressions:server`

Evidence:

- CI run URL:
- Local/agent run logs:

---

## Exception Log (if any)

| Gate # | Approved by | Risk accepted | Mitigation now | Follow-up owner | Follow-up deadline |
|--------|-------------|---------------|----------------|-----------------|--------------------|
|        |             |               |                |                 |                    |

---

## Final Release Decision

- [ ] GO
- [ ] NO-GO

Decision owner:

Notes:
