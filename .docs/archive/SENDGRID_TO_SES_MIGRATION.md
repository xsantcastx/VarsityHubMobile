## AWS SES Migration Playbook

Use this checklist to move every VarsityHub email template from SendGrid to Amazon SES (v2) without breaking the backend contract.

### 1. Prerequisites
- [ ] Confirm the SES region + account you’ll use (e.g., `us-east-1`) and raise sending limits if still in the sandbox.
- [ ] Verify the sending identity (`noreply@varsityhub.app`) and any custom MAIL FROM domain.
- [ ] Collect the new template HTML + JSON samples from `sendgrid-templates/` and `sendgrid-templates/test-data/all-templates.sample.json`.
- [ ] Rotate API credentials: create an IAM user/role for the email worker with `ses:SendEmail` + `ses:GetTemplate`.

### 2. Import Templates
For each `sendgrid-templates/*.html` file (skip `_footer-snippet.html`):
1. Open the AWS console → **SES v2 → Email templates** → **Create template**.
2. Use the filename (without `.html`) as the template name (e.g., `account-suspension-45-days`).
3. Paste the HTML body verbatim. These files already exclude `<subject>` tags, which SES handles separately.
4. Optional: add a short plain-text fallback (copy the key paragraphs from the HTML).
5. Save the template and note the TemplateName.

### 3. Test With Sample Payloads
- Copy the JSON block for the same template from `sendgrid-templates/test-data/all-templates.sample.json`.
- In SES → **Email templates → Send test email**, choose the template and paste the JSON into the “Template data” field.
- Send to your test inbox; confirm CTA buttons, footer links (Instagram/TikTok/YouTube/Facebook/X/LimeProd), and privacy/community links work.
- Repeat for every template that the backend references (`server/src/lib/email.ts` has the authoritative list of template keys).

### 4. Wire Up The Backend
1. Store the SES TemplateName → `process.env.SES_<TEMPLATE_KEY>_NAME` (mirror the SendGrid env vars so you can switch providers via config).
2. Update the email service layer to detect the provider (SendGrid vs. SES) and call `SendTemplatedEmail` with the same dynamic payload. The new `normalizeTemplateData` helper already emits camelCase + snake_case keys, so your templates can keep the snake_case version.
3. Update deployment secrets (Railway, AWS Lambda, etc.) with the SES access key/secret + template names.

### 5. Cutover Plan
- [ ] Pick a low-traffic window, enable SES logging/metrics (CloudWatch) for traceability.
- [ ] Swap the provider flag/environment variables and redeploy the backend.
- [ ] Monitor CloudWatch + application logs for hard failures (`MessageRejected`, throttling, etc.).
- [ ] Once SES is confirmed stable, decommission the SendGrid API key and rotate credentials per `SENDGRID_KEY_ROTATION_GUIDE.md`.

### 6. Rollback Strategy
- Keep the SendGrid template IDs/env vars in place until SES is validated.
- If deliveries fail, toggle the provider flag back to SendGrid and redeploy; no template changes are needed thanks to the shared HTML/JSON assets.

Following these steps ensures every VarsityHub email renders the new footer, uses the latest copy, and can be tested quickly inside SES before the production cutover. Refer back to `sendgrid-templates/export-summary.json` for the authoritative template list. 
