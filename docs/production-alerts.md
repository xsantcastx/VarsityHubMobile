# Production Alerts

These are the Sentry alert rules to configure against the `lime-productions / varsityhub` project once `SENTRY_AUTH_TOKEN` is available:

1. `vh_context:coach_application_admin_notification_failed OR vh_context:coach_application_admin_notification_unsent`
2. `vh_context:admin_approve_coach_failed OR vh_context:admin_reject_coach_failed OR vh_context:approve_league_handler_failed OR vh_context:reject_league_handler_failed`
3. `vh_context:coach_approval_drift_probe OR vh_context:coach_approval_drift_probe_failed`
4. `level:error transaction:/auth/coach-applications`
5. `level:error transaction:/admin/coaches/:id/approve`
6. `level:error transaction:/organizations/:id/approve`

GitHub Actions dependencies for the drift probe:

- `PRODUCTION_DATABASE_URL`

Operational expectation:

- Hourly uptime checks come from [railway-health.yml](/Users/varsityhub/VarsityHubMobile/.github/workflows/railway-health.yml).
- Daily approval-state drift checks come from [production-drift-check.yml](/Users/varsityhub/VarsityHubMobile/.github/workflows/production-drift-check.yml).
