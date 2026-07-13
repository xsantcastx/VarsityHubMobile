# Secrets Rotation Checklist

> 🔴 **Blocking:** Every credential below was exposed inside the repo. Rotate each provider before you submit any new build to Apple/Google.

## 1. SendGrid

- **Generate:** Dashboard → Email API → API Keys → _Create API Key_ (Full Access). Copy the new key.
- **Templates:** Re-create the dynamic templates:
  - Verification (`SENDGRID_VERIFICATION_TEMPLATE_ID`)
  - Password Reset (`SENDGRID_PASSWORD_RESET_TEMPLATE_ID`)
  - Team Invite (`SENDGRID_TEAM_INVITE_TEMPLATE_ID`)
  - Org + Join Request templates (`SENDGRID_ORG_INVITE_TEMPLATE_ID`, `SENDGRID_JOIN_REQUEST_*`)
  - Optional: Abuse report, moderation, billing.
- **Update Railway:**
  ```bash
  railway variables set SENDGRID_API_KEY "<new-key>"
  railway variables set SENDGRID_VERIFICATION_TEMPLATE_ID "d-..."
  # repeat for each template ID
  ```
- **Verify sender:** Make sure `FROM_EMAIL` (e.g., `noreply@varsityhub.app`) is a verified Single Sender or Domain in SendGrid.

## 2. Twilio

- **Rotate:** Console → Account → API Keys → delete old Auth Token / Verify Service → create new.
- **Record:** New `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, optional `TWILIO_PHONE_NUMBER`.
- **Update Railway:**
  ```bash
  railway variables set TWILIO_ACCOUNT_SID "AC..."
  railway variables set TWILIO_AUTH_TOKEN "..."
  railway variables set TWILIO_VERIFY_SERVICE_SID "VA..."
  railway variables set TWILIO_PHONE_NUMBER "+1..."
  ```

## 3. Stripe

- **Create secret:** Dashboard → Developers → API Keys → _Create secret key_. Revoke the old one.
- **Railway:**
  ```bash
  railway variables set STRIPE_SECRET_KEY "sk_live_..."
  railway variables set STRIPE_WEBHOOK_SECRET "whsec_..."   # from your live webhook endpoint
  ```

## 4. Cloudinary

- **Rotate:** Dashboard → Programmable Media → Account Details → _Generate new API Secret_ (or create fresh credentials).
- **Railway:**
  ```bash
  railway variables set CLOUDINARY_CLOUD_NAME "..."
  railway variables set CLOUDINARY_API_KEY "..."
  railway variables set CLOUDINARY_API_SECRET "..."
  ```

## 5. Database

- **Change password:** For the production PostgreSQL instance (Railway), reset the password or create a new database URL.
- **Railway:**
  ```bash
  railway variables set DATABASE_URL "postgresql://user:newpass@host/db?sslmode=require"
  ```
- **Migrate:** Redeploy backend (`railway up` or CI) so Prisma/clients pick up the new URL.

## 6. FROM_EMAIL / App Config

- Ensure `FROM_EMAIL` matches the verified SendGrid sender. Update both backend (Railway var) and mobile envs if referenced.

## 7. Redeploy & Verify

1. Redeploy backend so the new env vars are active.
2. Restart local services (`cd server && npm run dev`, `npm run web -- --clear`) if you’re testing locally.
3. Re-run the env audit script (`overnight-results/env-check-*.log`) to confirm there are no placeholder warnings.
4. Run health checks/smoke tests to ensure onboarding/email/SMS flows work with the rotated secrets.

## 8. Optional: Purge History

Rotating secrets is the real fix. If you want to remove historical copies from git:

1. Rotate all credentials first.
2. Run `npx @withgraphite/gds filter --path .env --force` _or_ BFG Repo-Cleaner to drop the file.
3. Force-push after coordinating with the team.
