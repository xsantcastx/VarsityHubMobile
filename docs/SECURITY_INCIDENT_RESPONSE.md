# 🚨 SECURITY INCIDENT - .env Files Exposed on GitHub

## What Happened
.env files containing sensitive credentials were accidentally pushed to the public GitHub repository.

## Immediate Actions Required

### 1. Database Credentials ⚠️ CRITICAL
- **Current**: `postgresql://postgres:XsaBqcoUKZevhJjRjgBwnzzscgAqBRnM@tramway.proxy.rlwy.net:54913/railway`
- **Action**: Go to Railway dashboard → Postgres-DKC5 → Delete and recreate database
- **Impact**: All data will be lost, need to rerun migrations

### 2. JWT Secret ⚠️ CRITICAL
- **Current**: Whatever is in `server/.env` file
- **Action**: Generate new secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- **Update**: Both local `.env` and Railway environment variables
- **Impact**: All users will be logged out

### 3. Cloudinary Credentials ⚠️ HIGH
- **Action**: Go to Cloudinary dashboard → Settings → Security → Reset API Secret
- **Update**: `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`
- **Impact**: Uploads will fail until updated

### 4. Stripe Keys ⚠️ CRITICAL (LIVE MODE!)
- **Current**: Live mode keys exposed
- **Action**: Go to Stripe dashboard → Developers → API keys → Roll keys
- **Update**: Both `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`
- **Impact**: Payment processing will fail until updated

### 5. SendGrid API Key ⚠️ HIGH
- **Action**: Go to SendGrid → Settings → API Keys → Delete old key, create new
- **Update**: `SMTP_PASSWORD` (SendGrid API key)
- **Impact**: Email sending will fail

### 6. Google Maps API Key ⚠️ MEDIUM
- **Action**: Go to Google Cloud Console → APIs → Credentials → Restrict or regenerate
- **Update**: `GOOGLE_MAPS_API_KEY`
- **Consider**: Add HTTP referrer restrictions

### 7. Google OAuth Client Secrets ⚠️ HIGH
- **Action**: Go to Google Cloud Console → OAuth 2.0 Client IDs → Reset secrets
- **Update**: All `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values
- **Impact**: Google sign-in will fail until updated

## Steps to Rotate Secrets

### Railway Database
```bash
# 1. Export current data (if needed)
railway run -- npx prisma db pull

# 2. Delete old database in Railway dashboard

# 3. Create new PostgreSQL database

# 4. Update DATABASE_URL in Railway and local .env

# 5. Run migrations
railway run -- npx prisma migrate deploy
```

### JWT Secret
```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update in Railway
railway variables --set JWT_SECRET=<new_secret>

# Update in local .env
```

### Stripe Keys
1. Go to https://dashboard.stripe.com/apikeys
2. Click "Roll key" on Secret key
3. Copy new keys
4. Update in Railway: `railway variables --set STRIPE_SECRET_KEY=sk_live_...`
5. Update in local `.env`

### Cloudinary
1. Go to https://cloudinary.com/console/settings/security
2. Click "Reset API Secret"
3. Update in Railway and local `.env`

### SendGrid
1. Go to https://app.sendgrid.com/settings/api_keys
2. Delete old key, create new one
3. Update `SMTP_PASSWORD` in Railway and local `.env`

## Git History Cleanup (Optional but Recommended)

The .env files are still in git history. To completely remove them:

```bash
# WARNING: This rewrites history and will break forks/clones
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env server/.env server/.env.production server/.env.railway server/.env.railway.api" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS!)
git push origin --force --all
```

**OR** Delete and recreate the repository (nuclear option).

## Prevention

✅ Updated `.gitignore` to block all `.env` files
✅ Removed .env files from git tracking

### Additional Recommendations:
1. Use `.env.example` files with dummy values
2. Never commit real credentials
3. Use Railway/Vercel environment variables for production
4. Enable git pre-commit hooks to scan for secrets
5. Consider using tools like `git-secrets` or `gitleaks`

## Checklist

- [ ] Rotate DATABASE_URL (new Railway Postgres)
- [ ] Rotate JWT_SECRET
- [ ] Rotate Stripe keys (LIVE MODE!)
- [ ] Rotate Cloudinary credentials
- [ ] Rotate SendGrid API key
- [ ] Rotate/Restrict Google Maps API key
- [ ] Rotate Google OAuth secrets
- [ ] Update all keys in Railway environment variables
- [ ] Update all keys in local `.env` files
- [ ] Test application with new credentials
- [ ] Consider repository cleanup or deletion

## Timeline
- **Exposure**: Commits since the repository was created
- **Discovery**: November 3, 2025
- **Mitigation Started**: November 3, 2025 (git tracking removed)
- **Secrets Rotation**: PENDING - DO THIS NOW!

## Notes
The .env files are no longer tracked by git, but they exist in the git history. Anyone who cloned the repository before this fix can still access the old secrets. **All secrets must be rotated immediately.**
