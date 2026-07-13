# P0 Break-Glass Runbook: Payments and Webhook Outages

Use this when payments are failing or webhook processing is degraded.

---

## 1) Trigger conditions

Enter break-glass mode immediately when any is true:

- payment finalization failures spike
- webhook error rate spikes
- duplicate charges/finalizations observed
- payment provider outage suspected

---

## 2) Immediate containment (first 10 minutes)

1. Announce incident in on-call channel.
2. Assign incident commander + communications owner.
3. Disable risky flows (feature flag or temporary route guard), prioritizing:
   - new checkout start
   - finalize-session fallback endpoints
4. Keep webhook endpoint online for replayability unless it is actively corrupting data.

---

## 3) Triage checklist

- Check Sentry errors tagged:
  - `stripe_webhook_finalize_failed`
  - `stripe_webhook_unhandled_processing_error`
  - `finalize_membership_from_session`
- Check API 5xx and latency dashboard.
- Verify Stripe webhook delivery status in Stripe dashboard.
- Confirm DB connectivity and queue health.

---

## 4) Recovery actions

1. Fix root cause (config, code path, provider issue).
2. Replay pending webhook events safely.
3. Reconcile transaction records:
   - identify `PENDING`/`FAILED` records requiring manual review
   - confirm `COMPLETED` records match actual provider state
4. Communicate user impact and support instructions.

---

## 5) Exit criteria

- error rates return to baseline
- webhook processing stable for at least 30 minutes
- reconciliation complete for impacted payment window
- incident summary posted with follow-up actions

---

## 6) Post-incident artifacts

- incident timeline
- affected transaction IDs/session IDs
- root cause
- preventive actions with owners and due dates
