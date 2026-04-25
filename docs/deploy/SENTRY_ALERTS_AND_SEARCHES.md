# Sentry Alerts And Searches

This runbook captures the Sentry searches and alert rules calibrated to the current VarsityHub tag schema.

Current server/mobile tagging:

- `service`: `server` or `mobile`
- `route`: Express route template when available, normalized path fallback otherwise
- `method`: HTTP method on server captures
- `vh_context`: app-defined context string
- `provider`: upstream dependency tag such as `cloudinary`, `sendgrid`, `stripe`, `apple_iap`, `google_iap`, `bullmq`
- `job`: scheduled worker/job name when emitted from cron/scheduler flows
- `release`: git SHA from `SENTRY_RELEASE` or `RAILWAY_GIT_COMMIT_SHA`

Important constraints:

- Do not use `service does not equal server` to mean mobile. In Sentry, `does not equal` also matches events where the tag is absent.
- `release` is a git SHA, not app version. Use `release:latest` for burn alerts and specific SHAs for ad hoc queries.
- Prefer `provider:` for upstream dependency alerting. `route:` is still useful, but provider is usually the cleaner slice for Cloudinary, SendGrid, Stripe, and app-store billing flows.

## Saved Searches

Save these in Sentry Issues.

### 1. Live prod errors

```text
environment:production level:error
```

### 2. Live server errors only

```text
environment:production level:error service:server
```

### 3. Live mobile errors only

```text
environment:production level:error service:mobile
```

### 4. Provider-scoped views

```text
environment:production provider:cloudinary
environment:production provider:sendgrid
environment:production provider:stripe
environment:production provider:apple_iap
environment:production provider:google_iap
environment:production provider:bullmq
```

### 5. Scheduler / cron failures

```text
environment:production job:*
```

### 6. Specific drift probe

```text
environment:production job:coach-state-drift-probe
```

### 7. Hot routes

```text
environment:production route:/uploads
environment:production route:/posts/:id
environment:production route:/payments/webhook
environment:production route:/auth/refresh
```

### 8. Tagged contexts

```text
environment:production vh_context:*
```

### 9. One-user triage

```text
environment:production user.id:<paste-id>
```

### 10. Just-deployed soak watch

```text
environment:production timestamp:>=-15m
```

### 11. Specific release

```text
environment:production release:<git-sha>
```

## Issue Alerts

Create these in Sentry Alerts as Issue Alerts.

### 1. Prod Server New Error

- When: a new issue is created
- Filters:
  `event.environment equals production`
  `event.tags[service] equals server`
  `event.tags[level] equals error`
- Actions:
  `Slack #alerts-prod`
  `Email`

### 2. Prod Mobile New Error

- When: a new issue is created
- Filters:
  `event.environment equals production`
  `event.tags[service] equals mobile`
  `event.tags[level] equals error`
- Actions:
  `Slack #alerts-prod`
  `Email`

### 3. Prod Regression

- When: issue changes state from resolved to unresolved
- Filters:
  `event.environment equals production`
- Actions:
  `Slack #alerts-prod`
  `Email`

### 4. Prod Provider Failure - Payments

- When: a new issue is created
- Filters:
  `event.environment equals production`
  `event.tags[level] equals error`
  `event.tags[provider] is one of stripe, apple_iap, google_iap`
- Actions:
  `Slack #alerts-payments`
  `Email`

### 5. Prod Actionable Warning Only

- When: a new issue is created
- Filters:
  `event.environment equals production`
  `event.tags[level] equals warning`
  `event.message does not contain legacy_approved_without_application`
- Actions:
  `Slack #alerts-warnings`

## Metric Alerts

Create these in Sentry Alerts as Metric Alerts using the Errors dataset.

### 1. Prod Error Spike 5m

- Query:
  `environment:production level:error`
- Aggregate:
  `count()`
- Window:
  `5 minutes`
- Trigger:
  `above 10`
- Actions:
  `Slack #alerts-prod`

### 2. Prod Uploads Spike

- Query:
  `environment:production level:error route:/uploads`
- Aggregate:
  `count()`
- Window:
  `5 minutes`
- Trigger:
  `above 5`
- Actions:
  `Slack #alerts-prod`

### 3. Prod Cloudinary Provider Spike

- Query:
  `environment:production level:error provider:cloudinary`
- Aggregate:
  `count()`
- Window:
  `5 minutes`
- Trigger:
  `above 5`
- Actions:
  `Slack #alerts-prod`

### 4. Prod Cron Failures Spike

- Query:
  `environment:production level:error job:*`
- Aggregate:
  `count()`
- Window:
  `30 minutes`
- Trigger:
  `above 3`
- Actions:
  `Slack #alerts-warnings`

### 5. Latest Release Burn

- Query:
  `environment:production level:error release:latest`
- Aggregate:
  `count()`
- Window:
  `15 minutes`
- Trigger:
  `above 5`
- Actions:
  `Slack #alerts-prod`
  `Email`

## Triage Routine

- Default Issues view:
  `Live server errors only`, sorted by last seen.
- Discover pinned query:
  `environment:production timestamp:>=-15m`
- After each deploy:
  check the latest release burn view at `+5m`, `+15m`, and `+30m`.
- For user-reported bugs:
  start with `user.id:<id>`, then add `route:`, `provider:`, or `vh_context:` as needed.

## Follow-up

If org-scoped Sentry API access is added later, encode the same searches/rules from [server/scripts/sentry-observability.templates.json](/Users/varsityhub/VarsityHubMobile/server/scripts/sentry-observability.templates.json) into API calls rather than retyping them from scratch.
