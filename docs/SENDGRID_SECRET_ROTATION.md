# SendGrid Secret Rotation (API Keys & Template IDs)

Use this runbook whenever a SendGrid key is exposed or rotated. Keep real IDs/keys only in your secret manager.

## 1) Revoke + Replace
- In SendGrid: Settings → API Keys → delete the exposed key.
- Create a new key with minimal scope (Mail Send only). Copy it once: `SG.xxxxxxxxxxxxxxxxxxxxx`.
- If needed, rotate Webhook Signing Key (Settings → Mail Settings → Event Webhook → Regenerate) and update the listener.

## 2) Update Secrets
- Update all environments: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, template IDs like `SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxx`.
- Targets: Railway/hosting env vars, GitHub Actions secrets, local `.env` files (both `server/.env` and any ops shells).
- Redeploy/restart services so the new key loads.

## 3) Validate
- Run health probe: `cd server && npm run dev` then `curl http://localhost:4000/health | jq .integrations.sendgrid` (expect `true`).
- Send a test email: `curl -X POST http://localhost:4000/auth/test-email -d '{"email":"you@example.com"}' -H 'Content-Type: application/json'`.
- Watch logs for `[email]` success lines; verify email received within 30s.

## 4) Audit
- Check SendGrid Activity for unusual sends during exposure window; clear suppression list if spammed.
- Remove leaked artifacts (screenshots, tickets); ensure no plaintext keys in git history.
- Enable 2FA on SendGrid and restrict API key IPs if your plan allows.

## 5) Document
- Record rotation date, who rotated, and where the new key was stored.
- Keep template IDs tracked only in secret manager or infra variables—not in source docs.
