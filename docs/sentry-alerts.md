# Sentry Alert Runbook

Canonical list of Sentry saved searches and alert rules that should exist on
the VarsityHub project. Configured in Sentry's UI — this file is the source
of truth for what they should be and why they matter.

Every `context:*` tag referenced below is set by a `captureException` /
`captureMessage` call already shipped in the server code. The grep command
under each entry is the way to verify the tag still exists in the code.

---

## P0 — Wake someone up

Alert channel: PagerDuty / SMS / whatever is immediate.

### Payment finalization failure

- **Saved search**: `context:stripe_webhook_finalize_failed`
- **Rule**: fire on first occurrence, 1h cooldown.
- **Why**: Stripe accepted payment, server failed to finalize (ad.status=active, reservations created). Every miss is money paid without access granted.
- **Where it fires**: `server/src/routes/payments.ts` line near `finalizeFromSession` catch block.
- **Grep to verify**: `grep -rn "stripe_webhook_finalize_failed" server/src/`

### Dedup recording failure

- **Saved search**: `message:"Dedup recording failed, will retry"` OR `tags:stripe_webhook level:error`
- **Rule**: fire if rate >3/hr.
- **Why**: the idempotency row couldn't be written. Elevated rate means Stripe retries are piling up un-deduped; concurrent processing risk.
- **Where**: `server/src/routes/payments.ts:1179`

### Admin action failure on critical routes

- **Saved search**: `transaction:POST /admin/coaches/*/approve OR transaction:POST /admin/coaches/*/reject` with `level:error`
- **Rule**: fire on first occurrence.
- **Why**: admin can't approve/reject — onboarding is blocked platform-wide for all pending applicants until fixed.

---

## P1 — Review same day

Alert channel: email digest.

### Coach rejection notification failed (awaited path)

- **Saved search**: `context:coach_rejection_notification_failed`
- **Rule**: fire if rate >3/day.
- **Why**: after `3cbc96f1` the in-app notification on rejection is awaited; if this fires it means the canonical delivery channel failed and the coach has no way to know they were rejected.
- **Where**: `server/src/lib/approvalService.ts:rejectCoach`
- **Grep**: `grep -n "coach_rejection_notification_failed" server/src/lib/approvalService.ts`

### Canonical state drift detected

- **Saved search**: `message:"[coach-state-drift]"`
- **Rule**: fire whenever buckets `application_approved_user_not` or `user_rejected_latest_application_live` have any rows (these are real drift).
  - NOTE: `legacy_approved_without_application` and `stuck_in_final_setup_7d` are informational — route those to a dashboard, not an alert.
- **Why**: new cron `coach-state-drift-probe` runs daily at 03:45 and captures findings. See `server/src/lib/coachStateDriftProbe.ts`.

### Coach rejection email / push failed

- **Saved search**: `context:coach_rejection_email_failed`
- **Rule**: fire if rate >5/day.
- **Why**: email/push are best-effort but persistent failures indicate a SendGrid/APNS regression.

### Application admin notification failed

- **Saved search**: `context:coach_application_admin_notification_failed` (add this tag if not present)
- **Rule**: fire if rate >5/day.
- **Why**: new coach applications aren't reaching admins — review queue goes cold.

---

## P2 — Weekly triage

Alert channel: weekly Slack digest / email.

### 5xx rate on critical routes

- **Saved search**: `transaction:POST /auth/coach-applications OR transaction:POST /organizations OR transaction:POST /ads OR transaction:POST /teams/create` with `http.status_code:[500 TO 599]`
- **Rule**: fire if >10/day.
- **Why**: any of these failing at scale breaks onboarding, org management, ads, or team creation.

### OAuth verification failures

- **Saved search**: `context:apple_auth_failed OR context:google_auth_failed` (grep to confirm tag names)
- **Rule**: fire if rate >10/hr (likely a provider outage) or >3/day new-issue (token format regression).
- **Why**: distinguishes client-side bad tokens (expected) from server-side JWKS/key issues (real regression).

### Push token cleanup misfires

- **Saved search**: `transaction:verify-push-receipts level:error`
- **Rule**: fire if rate >10/day.
- **Why**: the cron that prunes invalid Expo push tokens — failures mean dead tokens accumulate.

---

## Informational dashboards (no alerts, for trend-watching)

- **coach-state-drift bucket counts** — daily rollup of each bucket's row count. Rising `legacy_approved_without_application` means more grandfathered coaches still exist. Rising `stuck_in_final_setup_7d` means a UX problem in post-approval onboarding.
- **`/auth/me` p95 latency** — the response computes `account_state` + `next_step` + `linked_providers` on every request with 60s Redis cache. If p95 climbs, the cache is missing or the state-derivation has slowed.
- **`ProcessedStripeEvent` row count over time** — should grow linearly with traffic and drop every 30 days via the cleanup cron. Flat growth means cleanup isn't running; step growth means dedup is swallowing events correctly.

---

## Noise reduction rules

Suppress / lower severity for:

- `Invalid credentials` — user-typo noise, not a real error.
- `Too many login attempts` / `Too many failed login attempts` — rate-limiter working as intended.
- `Your coach account is pending approval` / `APPROVAL_REQUIRED` — expected response during pre-approval state.
- `Token already used` on `/auth/refresh` — legitimate race between concurrent refresh attempts; safe by design.

---

## How to verify after setup

1. Trigger each alert condition once intentionally in staging (or against a test coach) to confirm the saved search fires.
2. Resolve the test event so it doesn't pollute stats.
3. Document who owns each channel (who gets paged for P0, who owns the weekly review).

---

## Maintenance

When adding a new `captureException`/`captureMessage` call in server code, always:

1. Include `context: 'snake_case_tag'` in the options object — that's what saved searches filter on.
2. Add or update the corresponding entry in this file.
3. If the error represents something a user will report via support, it should be P0 or P1.
