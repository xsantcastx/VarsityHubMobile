# VarsityHub Go-Live Checklist (Foundation Gate)

> Purpose: provide a repeatable GO/NO-GO gate for real-world readiness.
> Rule: if any P0 gate fails, release is blocked.

---

## 1) Release metadata

- Release version:
- Git commit:
- Environment (staging/production):
- Release manager:
- Date/time (UTC):

---

## 2) Owners

| Area | Primary owner | Backup owner |
| --- | --- | --- |
| Mobile app quality | Mobile Lead | Senior Mobile Engineer |
| Backend/API reliability | Backend Lead | Senior Backend Engineer |
| Payments + webhooks | Payments Owner | Backend Lead |
| Infra/ops/deploy | DevOps Owner | Backend Lead |
| Security/privacy | Security Owner | Backend Lead |
| Product sign-off | Product Owner | Founder/GM |

---

## 3) Gate policy

- **GO**: all P0 gates = PASS, no unresolved Sev-1/Sev-2 incidents.
- **Conditional GO**: all P0 PASS, only documented P1/P2 issues with owners and due dates.
- **NO-GO**: any P0 gate FAIL or unknown.

---

## 4) P0 gates (must pass)

Status legend: `PASS` / `FAIL` / `N/A`

### P0.1 Build and release integrity

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Production build succeeds | Mobile Lead | EAS production build completes for iOS + Android without manual patching | EAS build links + logs | ☐ PASS / ☐ FAIL |
| Runtime config injected | DevOps Owner | Required production env vars present and non-empty (`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, API URL, Sentry DSN, OAuth IDs) | screenshot/export of env config | ☐ PASS / ☐ FAIL |
| App opens cleanly | Mobile Lead | No startup crash/red screen on cold launch (real device) | short test video or QA note | ☐ PASS / ☐ FAIL |

### P0.2 Payments correctness

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Stripe checkout finalize | Payments Owner | Checkout success results in single finalized record and correct DB state (idempotent under retries) | test run + DB row sample | ☐ PASS / ☐ FAIL |
| Webhook resilience | Payments Owner | Duplicate/replayed webhook does not double-apply side effects | replay test output | ☐ PASS / ☐ FAIL |
| Webhook endpoint configured | DevOps Owner | Stripe webhook points to production URL and signs with `STRIPE_WEBHOOK_SECRET` | Stripe dashboard screenshot | ☐ PASS / ☐ FAIL |
| Apple Pay purchase smoke | Mobile Lead | One successful Apple Pay purchase on physical iOS device (not simulator) | test recording + receipt id | ☐ PASS / ☐ FAIL |
| Refund/failure path | Payments Owner | Failed or slot-full payments resolve to expected status (`FAILED`/`REFUNDED`) and user is notified | logs + transaction record | ☐ PASS / ☐ FAIL |

### P0.3 Data integrity and transactions

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Limit checks are atomic | Backend Lead | Team/invite plan limits are enforced inside DB transaction paths | code refs + test evidence | ☐ PASS / ☐ FAIL |
| Finalization lock safety | Backend Lead | Finalize-session lock works for single + multi-instance operation (Redis lock if configured) | logs from concurrent test | ☐ PASS / ☐ FAIL |
| Transaction status consistency | Backend Lead | Status updates work for session, payment intent, and subscription references | test output from server tests | ☐ PASS / ☐ FAIL |

### P0.4 Security + privacy baseline

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Production error redaction | Mobile Lead | Raw exception text is not shown to end users outside development | screenshot from production build | ☐ PASS / ☐ FAIL |
| Upload validation | Backend Lead | MIME + extension allowlists enforced; SVG/XSS vectors blocked | endpoint test results | ☐ PASS / ☐ FAIL |
| Secrets posture | DevOps Owner | No test/demo secrets in production vars; keys are real and scoped/restricted | secrets audit note | ☐ PASS / ☐ FAIL |
| Rate limiting on sensitive routes | Backend Lead | Auth/payment/upload endpoints enforce rate limits | config snapshot + smoke test | ☐ PASS / ☐ FAIL |

### P0.5 Observability and incident readiness

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Sentry enabled client + server | DevOps Owner | Errors from app + API appear in Sentry with env tags | test issue links | ☐ PASS / ☐ FAIL |
| Alerting configured | DevOps Owner | Alerts exist for crash spike, API 5xx spike, webhook failures | alert policy screenshot | ☐ PASS / ☐ FAIL |
| Runbook available | Backend Lead | On-call steps documented for payment outage, webhook backlog, and rollback | docs link | ☐ PASS / ☐ FAIL |

### P0.6 Critical user journeys

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Auth flow | Mobile Lead | Register -> verify -> login works on production backend | QA run notes | ☐ PASS / ☐ FAIL |
| Onboarding flow | Mobile Lead | Coach + fan onboarding complete and persist state | QA run notes | ☐ PASS / ☐ FAIL |
| Team creation flow | Backend Lead | Coach can create team; fan is blocked; limits enforce correctly | API/e2e test output | ☐ PASS / ☐ FAIL |
| HEIC upload flow | Mobile Lead | HEIC image uploads successfully from physical iPhone | test recording | ☐ PASS / ☐ FAIL |

---

## 5) P1 gates (should pass in first launch wave)

| Check | Owner | Pass criteria | Evidence | Status |
| --- | --- | --- | --- | --- |
| Load test baseline | Backend Lead | Sustained traffic test meets agreed p95 latency and error budget | load test report | ☐ PASS / ☐ FAIL |
| Funnel analytics | Product Owner | Core events instrumented: signup, onboarding complete, first payment, retention markers | analytics dashboard | ☐ PASS / ☐ FAIL |
| Feature flag safety | Mobile Lead | High-risk features can be disabled without redeploy | flag list + test | ☐ PASS / ☐ FAIL |

---

## 6) Suggested command checklist (repo-specific)

Run from repository root unless noted.

```bash
# App-level checks
npm run verify:release
npm run typecheck
npm run lint

# Server tests
npm --prefix server test

# Focused payment foundation tests
npm --prefix server test -- --runTestsByPath \
  src/__tests__/distributedLock.test.ts \
  src/__tests__/transaction-logger-update.test.ts \
  src/__tests__/payments-finalization.test.ts
```

If any command is skipped, document why and assign an owner/date.

---

## 7) Risk acceptance log (required for non-pass items)

| Item | Severity | Why accepted | Owner | Mitigation date |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

---

## 8) Final decision

- Decision: ☐ GO / ☐ CONDITIONAL GO / ☐ NO-GO
- Approved by (Release manager):
- Approved by (Product owner):
- Notes:

