# VarsityHub Production Environment Setup

This document ensures the app runs correctly against production services.

## Environment Variables Required

### iOS App (.env or build configuration)

```bash
# API Endpoint - Points to production backend
EXPO_PUBLIC_API_URL=https://api.varsityhub.app

# OAuth - Google
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=YOUR_GOOGLE_EXPO_CLIENT_ID

# Error Tracking - Sentry
EXPO_PUBLIC_SENTRY_DSN=https://YOUR_SENTRY_KEY@sentry.io/YOUR_PROJECT_ID

# Stripe Payments
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_KEY

# Admin Emails
EXPO_PUBLIC_ADMIN_EMAILS=admin@varsityhub.app,support@varsityhub.app

# App Configuration
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
EXPO_PUBLIC_NODE_ENV=production
```

### Backend Server (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/varsityhub_prod

# API Port & Base URL
PORT=3000
APP_BASE_URL=https://api.varsityhub.app
NODE_ENV=production

# Authentication
JWT_SECRET=YOUR_LONG_RANDOM_SECRET_KEY

# OAuth - Google
GOOGLE_OAUTH_CLIENT_IDS=YOUR_IOS_CLIENT_ID,YOUR_ANDROID_CLIENT_ID,YOUR_WEB_CLIENT_ID
GOOGLE_OAUTH_AUDIENCE=YOUR_WEB_CLIENT_ID

# Email Service - SendGrid
SENDGRID_API_KEY=SG.YOUR_SENDGRID_KEY
SENDGRID_FROM_EMAIL=noreply@varsityhub.app

# Payment Processing - Stripe
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET
STRIPE_PRICE_VETERAN=price_YOUR_VETERAN_PRICE
STRIPE_PRICE_LEGEND=price_YOUR_LEGEND_PRICE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Cloud Storage - AWS S3
S3_REGION=us-east-1
S3_BUCKET=varsityhub-prod-uploads
S3_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
S3_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY

# Error Tracking - Sentry
SENTRY_DSN=https://YOUR_SENTRY_KEY@sentry.io/YOUR_PROJECT_ID

# Admin Configuration
ADMIN_EMAILS=admin@varsityhub.app,support@varsityhub.app
```

## Verification Checklist

### Before iOS Release Build:

- [ ] `EXPO_PUBLIC_API_URL` is set to production backend (NOT localhost)
- [ ] Sentry DSN configured (error tracking enabled)
- [ ] Google OAuth keys are production iOS keys
- [ ] Stripe publishable key is live key (pk*live*)
- [ ] Admin emails configured
- [ ] App scheme is correct: `varsityhubmobile`

### Before Backend Deployment:

- [ ] Database URL points to production database
- [ ] JWT secret is long and random (not in version control!)
- [ ] Stripe secret key is live key (sk*live*)
- [ ] Email service is configured (SendGrid API key works)
- [ ] S3 bucket exists and credentials work
- [ ] Admin emails match expected admins
- [ ] NODE_ENV is "production"
- [ ] All secrets in 1Password or secure vault (NOT .env in git!)

## Production Deployment Steps

### 1. Prepare Backend

```bash
# SSH to production server
ssh prod-server

# Verify environment variables
echo $DATABASE_URL
echo $STRIPE_SECRET_KEY

# Run migrations
npx prisma migrate deploy

# Seed if needed (development data only)
npm run seed

# Start server
npm start

# Verify health check
curl https://api.varsityhub.app/health
```

### 2. Configure iOS Build

```bash
# Create production .env or configure in Xcode
cat > .env.production << EOF
EXPO_PUBLIC_API_URL=https://api.varsityhub.app
EXPO_PUBLIC_SENTRY_DSN=https://YOUR_KEY@sentry.io/YOUR_PROJECT
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
EOF

# Use EAS for production build
eas build --platform ios --profile production
```

### 3. Verify Production Services

```bash
# Health checks
curl https://api.varsityhub.app/health
curl https://api.varsityhub.app/auth/google  # Should 404, not error
curl https://api.varsityhub.app/health/db    # Check database

# Test authentication flow
curl -X POST https://api.varsityhub.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Verify Sentry initialized
# Check: https://sentry.io > Your Project > Issues (should be empty initially)
```

## Common Production Issues & Fixes

### Issue: "Cannot connect to API"

**Check**:

- `EXPO_PUBLIC_API_URL` is correct
- Backend server is running (`pm2 status`)
- Backend logs: `pm2 logs`
- Network: `curl https://api.varsityhub.app/health`

### Issue: "Email verification not working"

**Check**:

- `SENDGRID_API_KEY` is set on backend
- `SENDGRID_FROM_EMAIL` is whitelisted in SendGrid
- Test: `curl -X POST https://api.varsityhub.app/auth/register ...`

### Issue: "Sign in with Apple fails"

**Check**:

- Apple private email relay is enabled (not visible in logs by design)
- App ID configured in Apple Developer account
- Bundle identifier matches: `com.xsantcastx.varsityhub`

### Issue: "Payment processing fails"

**Check**:

- `STRIPE_SECRET_KEY` is live key (starts with `sk_live_`)
- Stripe webhook configured to receive events
- Check Stripe logs: `https://dashboard.stripe.com`

## Database Backups

### Automated Backups

```bash
# Set up daily backups (via hosting provider)
# AWS RDS: Enable automated backups in console
# Heroku: Enable Postgres Backups addon

# Test restore capability monthly
```

### Manual Backup

```bash
# Backup
pg_dump -U postgres varsityhub_prod > backup-$(date +%Y%m%d).sql

# Restore (if needed)
psql -U postgres < backup-20251206.sql
```

## Monitoring & Alerts

### Set up monitoring for:

1. **Sentry** - Error tracking at https://sentry.io
2. **Stripe** - Payment issues at https://dashboard.stripe.com
3. **API Health** - Check endpoint availability
4. **Database** - Query performance and connection pool

### Recommended Alert Rules:

- Alert if API returns 5xx errors (>10 in 5 min)
- Alert if error rate > 1% in Sentry
- Alert if payment failures spike
- Alert if database connection pool exhausted

## First Production Release Checklist

✅ Environment variables configured on all services  
✅ Database migrations applied  
✅ Email service tested (send test verification email)  
✅ Payment processor tested (test transaction)  
✅ Sentry initialized and receiving test events  
✅ Monitoring configured  
✅ Backup strategy in place  
✅ All team members have access documentation  
✅ Support email configured and monitored  
✅ Privacy policy & support pages live

---

**Once verified, you're ready for App Store submission!** 🚀
