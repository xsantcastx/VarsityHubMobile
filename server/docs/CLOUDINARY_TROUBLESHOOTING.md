# Cloudinary Troubleshooting

## Ensure Real Values Are Used

**Backend** reads from `server/.env`. **Frontend** gets credentials from the backend's `/uploads/cloudinary-signature` endpoint — no frontend env vars needed.

All Cloudinary code uses `getCloudinaryCredentials()` which trims values and rejects placeholders. Never read `process.env.CLOUDINARY_*` directly.

### Verify Credentials Work

```bash
cd server && npm run verify:cloudinary
```

- **✅** = Real values in `.env` are working
- **❌** = Not configured or 401 — fix `.env` and re-run

## 401 "api_secret mismatch" Error

When the wipe script, verify script, or uploads return `401` with `"api_secret mismatch"`, the credentials are invalid.

### Common Causes

1. **Quotes or whitespace in `.env`**
   - Use: `CLOUDINARY_API_SECRET=your_actual_secret`
   - Not: `CLOUDINARY_API_SECRET="your_actual_secret"` or `CLOUDINARY_API_SECRET= your_secret`

2. **Wrong or outdated API secret**
   - Copy the secret again from [Cloudinary Console → API Keys](https://console.cloudinary.com/app/settings/api-keys)
   - If you rotated the secret, update `server/.env` and Railway variables

3. **Placeholder values**
   - Ensure you're not using `your-api-secret` or values from `.env.example`

### Fix Steps

1. Open [Cloudinary Console → API Keys](https://console.cloudinary.com/app/settings/api-keys)
2. Copy **Cloud name**, **API Key**, and **API Secret** (click "Reveal" on secret)
3. In `server/.env`, set (no quotes, no trailing spaces):
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Run `npm run verify:cloudinary` to confirm
5. Restart the server

### Regenerate API Secret

If the secret was leaked or you're unsure:

1. Cloudinary Console → API Keys → **Regenerate** API Secret
2. Update `server/.env` and Railway variables
3. Run `npm run verify:cloudinary` and restart services
