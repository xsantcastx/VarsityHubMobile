# Email Environment

## Required

- `EMAIL_PROVIDER`
  - Use `sendgrid` in normal environments.
  - Use `test` only for local non-delivery testing.
- `EMAIL_FROM`
  - Default sender address for transactional emails.
- `SENDGRID_API_KEY`
  - SendGrid API key.

## Recommended

- `CUSTOMER_SERVICE_EMAIL`
  - Support contact used in moderation and recovery flows.
- `APP_BASE_URL`
  - Base URL used in links embedded in email content.
- `EMAIL_TIMEOUT_MS`
  - Provider timeout in milliseconds. Default is `10000`.
- `EMAIL_RETRY_ATTEMPTS`
  - Number of send attempts. Default is `2`.
- `EMAIL_RETRY_DELAY_MS`
  - Base retry delay. Default is `1000`.
- `EMAIL_ENABLE_LOGGING`
  - `true` to keep structured email logs on.
- `EMAIL_ENABLE_QUEUE`
  - `true` if queue-backed delivery is enabled.
- `REDIS_URL`
  - Required if queue-backed delivery is enabled.

## SendGrid Templates

Configure only the template IDs you actively use. The app currently references:

- `SENDGRID_VERIFICATION_TEMPLATE_ID`
- `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
- `SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID`
- `SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID`
- `SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID`
- `SENDGRID_REPORT_RESOLVED_TEMPLATE_ID`
- `SENDGRID_REPORT_DISMISSED_TEMPLATE_ID`
- `SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID`
- `SENDGRID_CONTENT_REMOVED_TEMPLATE_ID`
- `SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID`
- `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`
- `SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID`
- `SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID`
- `SENDGRID_EVENT_APPROVED_TEMPLATE_ID`
- `SENDGRID_EVENT_DENIED_TEMPLATE_ID`
- `SENDGRID_EVENT_REMINDER_TEMPLATE_ID`
- `SENDGRID_EVENT_UPDATED_TEMPLATE_ID`
- `SENDGRID_EVENT_CANCELED_TEMPLATE_ID`
- `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
- `SENDGRID_TEAM_INVITE_TEMPLATE_ID`
- `SENDGRID_ORG_INVITE_TEMPLATE_ID`
- `SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID`
- `SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID`
- `SENDGRID_ORG_APPROVAL_TEMPLATE_ID`
- `SENDGRID_ORG_DENIAL_TEMPLATE_ID`
- `SENDGRID_CONTENT_MODERATION_TEMPLATE_ID`
- `SENDGRID_BILLING_NOTICE_TEMPLATE_ID`
- `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`
- `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID`

## Sandbox vs Production

- Local development:
  - Prefer `EMAIL_PROVIDER=test` when you only want to validate flows.
  - Use `sendgrid` only when you intentionally want real delivery.
- Production:
  - Use `EMAIL_PROVIDER=sendgrid`
  - Use a verified sender domain
  - Keep `EMAIL_ENABLE_LOGGING=true`
  - Keep retries low to avoid duplicate sends on ambiguous provider timeouts

## Validation

- `npm --prefix server run verify:email`
  - Verifies provider config.
- `tsx server/scripts/verify-email-templates.ts --test-to=you@example.com`
  - End-to-end template exercise when real delivery is enabled.
