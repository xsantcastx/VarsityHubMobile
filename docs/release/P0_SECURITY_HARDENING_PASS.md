# P0 Security Hardening Pass

This checklist is the minimum security pass before broad launch.

---

## 1) API rate-limit verification

Run:

```bash
npm --prefix server run verify:rate-limits
```

Expected: all sensitive endpoint checks pass for auth, payment, and upload routes.

---

## 2) Provider key restriction checks

## Stripe

- Use restricted publishable key in client.
- Server key must remain secret-only.
- Webhook signing secret required.
- Restrict dashboard access with least privilege + MFA.

## Google Maps

- Restrict API key by app package/bundle and allowed APIs.
- Do not use unrestricted key in production.

## Cloudinary

- Verify key/secret are server-only.
- Prefer signed uploads for privileged operations.
- Confirm upload presets and transformations are least-privilege.

Evidence required:

- screenshots of each provider restriction config.

---

## 3) Dependency vulnerability policy

Run:

```bash
npm audit --omit=dev
npm --prefix server audit --omit=dev
```

Policy:

- **No high/critical vulnerabilities** in production dependency graph at release time.
- Any exception requires written risk acceptance and mitigation date.

---

## 4) Additional pre-launch checks

- Ensure secrets are sourced from Railway env (not committed).
- Confirm error responses do not leak internal stack data to end users.
- Confirm upload MIME and extension allowlists block SVG/XSS vectors.
