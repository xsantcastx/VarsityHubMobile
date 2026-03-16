# P0 Observability, Alerts, and SLOs

This document defines the minimum production observability baseline required before broad launch.

---

## 1) SLO targets (P0)

| Service | SLO | Measurement window |
| --- | --- | --- |
| API availability | 5xx error rate **< 1%** | rolling 1 hour + 24 hours |
| API latency | p95 request latency **< 500ms** | rolling 15 minutes + 1 hour |
| Mobile app stability | crash-free sessions **> 99.5%** | rolling 24 hours + 7 days |
| Payment finalization | finalize success **> 99.9%** without manual repair | rolling 24 hours |

---

## 2) Required alerts (must-have)

## 2.1 Sentry (mobile + server)

1. **Crash spike (mobile)**
   - Condition: crash-free sessions below 99.5% for 15 minutes
   - Severity: Critical
   - Notify: on-call + release manager

2. **Payment finalization failures**
   - Condition: error events containing:
     - `stripe_webhook_finalize_failed`
     - `finalize_membership_from_session`
     - `payment_intent_succeeded_ad`
   - Threshold: >= 3 events in 10 minutes
   - Severity: Critical

3. **Webhook processing failures**
   - Condition: error events containing:
     - `stripe_webhook_verification_failed`
     - `stripe_webhook_unhandled_processing_error`
   - Threshold: >= 3 events in 10 minutes
   - Severity: Critical

## 2.2 Backend platform alerts

1. **API 5xx spike**
   - Condition: 5xx rate > 1% for 10 minutes

2. **Latency regression**
   - Condition: p95 > 500ms for 15 minutes

3. **DB error spike**
   - Condition: DB connection/query errors > 5 in 5 minutes

4. **Queue failures**
   - Condition: failed jobs spike above normal baseline or queue backlog age > 5 minutes

---

## 3) Dashboard minimums

At minimum, maintain one launch dashboard with:

- Requests/sec
- p50/p95/p99 latency
- 4xx/5xx rates
- DB error count
- queue depth + failure count
- payment finalize success/fail count
- webhook received/processed/error count
- crash-free sessions

---

## 4) Verification evidence required per release

- screenshot or link for each alert policy
- screenshot/link to launch dashboard with current build deployed
- Sentry test issue links (client and server)
- confirmation note that alert notifications reach on-call channel

