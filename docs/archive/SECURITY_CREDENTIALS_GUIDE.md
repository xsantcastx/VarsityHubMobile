# Production Security & Credentials Management Guide

## Overview

This document outlines security best practices for managing VarsityHub production credentials and protecting sensitive data.

**Last Updated**: October 13, 2025  
**Audience**: Development team and client  
**Criticality**: HIGH - Must follow these guidelines

---

## 🔐 Credential Storage Best Practices

### 1. Environment Variables

**DO**:
✅ Store ALL secrets in environment variables
✅ Use `.env` files locally (NEVER commit to Git)
✅ Use platform-specific secret management (Railway Secrets, AWS Secrets Manager)
✅ Rotate credentials every 6-12 months
✅ Use different credentials for dev/staging/production

**DON'T**:
❌ Never commit `.env` files to version control
❌ Never hardcode API keys in source code
❌ Never share credentials via email or Slack
❌ Never store credentials in client-side code
❌ Never reuse the same credentials across environments

### Example `.gitignore`:
```
# Environment variables
.env
.env.local
.env.production
.env.staging

# Credentials
*.pem
*.p12
*.key
*.keystore
secrets/
credentials/
```

---

## 🗝️ Required Environment Variables

### Server Environment Variables

Create a `.env.production` file (NEVER commit this):

```bash
# ========================================
# CRITICAL: NEVER COMMIT THIS FILE
# ========================================

# Node Environment
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require

# JWT Authentication
JWT_SECRET=generate_with_openssl_rand_hex_64
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@varsityhub.com
EMAIL_REPLY_TO=support@varsityhub.com

# Stripe Payments
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AWS S3 Storage
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=varsityhub-prod-media
AWS_REGION=us-east-1

# Expo Push Notifications
EXPO_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# App URLs
API_URL=https://api.varsityhub.com
WEB_URL=https://varsityhub.com
MOBILE_APP_SCHEME=varsityhub

# Security
CORS_ORIGIN=https://varsityhub.com,https://www.varsityhub.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Error Tracking
SENTRY_DSN=https://xxxxxx@sentry.io/xxxxxx
SENTRY_ENVIRONMENT=production

# Optional: Analytics
MIXPANEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Mobile App Environment Variables

For Expo/React Native apps, use `app.json` or `eas.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.varsityhub.com",
      "stripePublishableKey": "pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "googleMapsApiKey": "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "sentryDsn": "https://xxxxxx@sentry.io/xxxxxx"
    }
  }
}
```

**Access in code**:
```typescript
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const STRIPE_KEY = Constants.expoConfig?.extra?.stripePublishableKey;
```

---

## 🔒 Generating Secure Secrets

### JWT Secret

**Generate a cryptographically secure random string**:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# Python
python3 -c "import secrets; print(secrets.token_hex(64))"
```

Output example:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678
```

### Stripe Webhook Secret

Get from Stripe Dashboard:
1. Go to Developers → Webhooks
2. Add endpoint: `https://api.varsityhub.com/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, etc.
4. Copy the webhook signing secret (`whsec_...`)

### Android Keystore

**Generate keystore for signing APK/AAB**:

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore varsityhub-production.keystore \
  -alias varsityhub \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_SECURE_KEY_PASSWORD
```

**⚠️ CRITICAL**: 
- Backup this keystore file in 3 separate locations
- If lost, you can NEVER update your app on Google Play
- Store password in password manager (1Password, LastPass)

---

## 🛡️ API Key Security

### Google Maps API Key Restrictions

**Production API Key Setup**:

1. Go to Google Cloud Console → Credentials
2. Create API key for production
3. Add restrictions:

**Application Restrictions**:
```
Android apps:
- Package name: com.varsityhub.mobile
- SHA-1 certificate fingerprint: [Get from release keystore]

iOS apps:
- Bundle identifier: com.varsityhub.mobile

HTTP referrers (web):
- https://varsityhub.com/*
- https://www.varsityhub.com/*
```

**API Restrictions** (only enable what you need):
- Maps SDK for Android
- Maps SDK for iOS
- Places API
- Geocoding API
- Geolocation API
- Distance Matrix API

### AWS S3 Bucket Permissions

**Create IAM user with limited permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::varsityhub-prod-media",
        "arn:aws:s3:::varsityhub-prod-media/*"
      ]
    }
  ]
}
```

**Don't give full admin access** - only what's needed!

### Stripe API Key Security

**Best Practices**:
- Use restricted API keys (not full admin keys)
- Set up IP restrictions if possible
- Enable webhook signature verification
- Monitor Stripe dashboard for unusual activity
- Set up Stripe Radar for fraud detection

```typescript
// Server-side: Always verify webhook signatures
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/webhooks/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Process event
  res.json({received: true});
});
```

---

## 🚨 Security Incident Response

### If API Key is Exposed

**Immediate Actions**:

1. **Revoke the compromised key immediately**
   - Stripe: Dashboard → Developers → API keys → Delete
   - Google: Cloud Console → Credentials → Delete key
   - SendGrid: Settings → API Keys → Delete
   - AWS: IAM Console → Delete access key

2. **Generate new key**
   - Create replacement key with same permissions
   - Update production environment variables
   - Test to ensure app still works

3. **Audit recent activity**
   - Check Stripe dashboard for unauthorized charges
   - Review Google Cloud billing for unusual usage
   - Check AWS CloudTrail logs for suspicious API calls
   - Review SendGrid email logs

4. **Document the incident**
   - When was key exposed?
   - Where was it exposed? (GitHub, logs, etc.)
   - How long was it exposed?
   - What actions were taken?

5. **Implement preventive measures**
   - Add secret scanning to CI/CD
   - Review .gitignore rules
   - Audit all repositories for secrets
   - Consider using secret management service

### Secret Scanning Tools

**Prevent secrets from being committed**:

```bash
# Install git-secrets
brew install git-secrets  # macOS
apt-get install git-secrets  # Linux

# Set up in your repo
cd /path/to/varsityhub
git secrets --install
git secrets --register-aws
```

**Or use GitHub secret scanning** (automatically alerts on pushes):
- Settings → Security → Secret scanning

---

## 🔄 Credential Rotation Schedule

### Quarterly (Every 3 Months)
- [ ] Review IAM permissions (AWS, Google Cloud)
- [ ] Audit user access (remove old team members)
- [ ] Check for unused API keys
- [ ] Review Stripe webhook logs

### Semi-Annually (Every 6 Months)
- [ ] Rotate JWT secret (requires user re-login)
- [ ] Rotate database password
- [ ] Rotate SendGrid API key
- [ ] Update SSL certificates (if manual)

### Annually (Every 12 Months)
- [ ] Rotate AWS access keys
- [ ] Rotate Google Maps API key
- [ ] Review all third-party integrations
- [ ] Audit security logs and incidents
- [ ] Renew Apple Developer account ($99)
- [ ] Renew domain registration

### On Team Changes
- [ ] Remove access for departing team members
- [ ] Change shared passwords
- [ ] Revoke SSH keys
- [ ] Update server access lists

---

## 📦 Secure Credential Sharing

### For Development Team

**Use a password manager**:

1. **1Password Teams** (Recommended)
   - Create shared vault: "VarsityHub Production"
   - Add all credentials
   - Give team members access
   - Enable 2FA

2. **LastPass Business**
   - Similar to 1Password
   - Shared folders for team

3. **Bitwarden**
   - Open-source alternative
   - Organization sharing

### For Client

**When sharing credentials TO client**:

1. Use 1Password shared link (with expiration)
2. Use encrypted email (ProtonMail)
3. Use secure file sharing:
   - Dropbox with password protection
   - Google Drive with link expiration
   - WeTransfer Pro with password

**Never**:
❌ Email credentials in plain text
❌ Send via Slack/Discord
❌ Share via SMS
❌ Post in GitHub issues/PRs

---

## 🏗️ Infrastructure as Code

### Store Configuration (Not Secrets) in Git

**Safe to commit**:
```yaml
# config/production.yml
app:
  name: VarsityHub
  environment: production
  domain: varsityhub.com
  
database:
  host: ${DATABASE_HOST}  # Reference env var
  port: 5432
  name: varsityhub_production
  ssl: required
  
stripe:
  webhook_endpoint: /webhooks/stripe
  
aws:
  region: us-east-1
  bucket: varsityhub-prod-media
```

**Reference secrets from environment**:
```typescript
const config = {
  database: {
    host: process.env.DATABASE_HOST,
    password: process.env.DATABASE_PASSWORD,  // Never hardcode
  },
};
```

---

## 🔍 Monitoring & Alerts

### Set Up Alerts For

**Stripe**:
- Unusual payment volume
- High number of failed payments
- Webhook delivery failures

**AWS**:
- Billing alerts (e.g., > $100/month)
- Unusual S3 access patterns
- IAM permission changes

**Google Cloud**:
- API usage spikes
- Billing alerts
- Rate limit warnings

**SendGrid**:
- High bounce rate (> 5%)
- Spam complaints
- Daily send limit approaching

**Server**:
- High CPU/RAM usage
- Disk space low
- SSL certificate expiring soon
- Failed login attempts

### Monitoring Tools

**Sentry** (Error tracking):
```bash
npm install @sentry/node @sentry/react-native

# Server
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,
});

# Mobile
Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  enableInExpoDevelopment: false,
  debug: false,
});
```

**Uptime Monitoring**:
- UptimeRobot (free)
- Pingdom
- Datadog

---

## 📋 Security Checklist

### Pre-Production
- [ ] All secrets in environment variables
- [ ] `.env` files in `.gitignore`
- [ ] API keys restricted (IP, domain, package name)
- [ ] SSL certificate installed and valid
- [ ] Database uses SSL connection
- [ ] JWT secret is 64+ characters random
- [ ] Stripe webhook signature verification enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (use Prisma ORM)
- [ ] XSS protection enabled
- [ ] HTTPS enforced (no HTTP)

### Post-Production
- [ ] Monitor error logs daily
- [ ] Review access logs weekly
- [ ] Check for security updates monthly
- [ ] Rotate credentials quarterly/annually
- [ ] Test backup restoration quarterly
- [ ] Security audit annually
- [ ] Update dependencies (npm audit)
- [ ] Check for exposed secrets (GitHub)

---

## 🎯 Compliance & Best Practices

### GDPR Compliance (if applicable)

- [ ] Data encryption at rest (database)
- [ ] Data encryption in transit (SSL/TLS)
- [ ] User data deletion capability
- [ ] Privacy policy published
- [ ] Cookie consent (if web portal)
- [ ] Data processing agreements with vendors

### PCI DSS (Payment Card Industry)

**Good news**: Using Stripe means you don't handle card data directly!

- [ ] Never store credit card numbers
- [ ] Never log credit card data
- [ ] Use Stripe.js/Elements for card input
- [ ] Let Stripe handle PCI compliance

### COPPA (Children's Privacy)

If users under 13:
- [ ] Parental consent required
- [ ] Limited data collection
- [ ] No behavioral advertising

---

## 📞 Emergency Contacts

### In Case of Security Incident

**Client**: [Client Name] - [Phone] - [Email]  
**Lead Developer**: [Your Name] - [Phone] - [Email]  
**Hosting Provider**: [Railway/AWS Support]  
**Stripe Support**: [Stripe Dashboard → Support]  
**Google Cloud Support**: [Cloud Console → Support]

### Escalation Path

1. Detect incident (monitoring, user report, etc.)
2. Assess severity (critical, high, medium, low)
3. Contain threat (revoke keys, block IPs)
4. Notify stakeholders (client, team, users if needed)
5. Fix vulnerability
6. Document and review
7. Implement prevention measures

---

## 🔐 Two-Factor Authentication (2FA)

**Require 2FA on all critical accounts**:

- [ ] Apple Developer account
- [ ] Google Play Console
- [ ] AWS root account
- [ ] Stripe account
- [ ] Google Cloud Console
- [ ] Domain registrar
- [ ] Email provider (SendGrid)
- [ ] Server SSH access
- [ ] GitHub organization

**Use authenticator app** (not SMS):
- Google Authenticator
- Authy
- 1Password (built-in)

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [Stripe Security Guide](https://stripe.com/docs/security/guide)
- [Google Cloud Security](https://cloud.google.com/security/best-practices)

---

## ✅ Final Security Review

Before going live, verify:

- [ ] No secrets committed to Git (search history)
- [ ] All production credentials rotated from staging
- [ ] API keys have proper restrictions
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery tested
- [ ] SSL certificate valid and auto-renewing
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Error messages don't leak sensitive info
- [ ] Security headers configured (helmet.js)
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection enabled
- [ ] Password hashing (bcrypt, 10+ rounds)
- [ ] Input validation on all endpoints
- [ ] File upload security (type/size limits)

---

**Last Updated**: October 13, 2025  
**Review Schedule**: Quarterly  
**Next Review**: January 13, 2026

---

*Keep this document confidential and share only with authorized team members.*
