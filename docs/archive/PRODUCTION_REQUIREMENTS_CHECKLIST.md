# Production Requirements Checklist

## Overview

This document outlines all the credentials, API keys, and configuration settings required from the client before deploying VarsityHub to production.

**Last Updated**: October 13, 2025  
**Project**: VarsityHub Mobile  
**Environment**: Production Deployment

---

## 🔐 Critical Requirements

### 1. Email Service (SendGrid or Alternative)

**Purpose**: Send verification codes, password resets, and notification emails to users

**Required Information**:
- [ ] **SendGrid API Key** (or alternative email service)
  - Format: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Permissions needed: `Mail Send` (Full Access)
  - Location in code: Email verification, password reset, ad notifications
  
- [ ] **Verified Sender Email Address**
  - Example: `noreply@varsityhub.com` or `support@varsityhub.com`
  - Must be verified in SendGrid dashboard
  - Used as "From" address for all automated emails
  
- [ ] **Domain Authentication** (Recommended)
  - Verify client's domain in SendGrid
  - Add DNS records (CNAME, TXT) to improve deliverability
  - Prevents emails from going to spam

**Testing Requirements**:
- [ ] Test email verification code delivery
- [ ] Test password reset emails
- [ ] Test ad approval notifications
- [ ] Verify emails arrive within 1-2 minutes
- [ ] Check spam folder filtering

**Alternative Providers** (if not using SendGrid):
- AWS SES (Simple Email Service)
- Mailgun
- Postmark
- Resend

**Environment Variable**:
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@varsityhub.com
```

---

### 2. Stripe Payment Processing

**Purpose**: Handle ad purchases, subscriptions, and payment processing

**Required Information**:
- [ ] **Stripe Publishable Key** (Production)
  - Format: `pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Safe to expose in mobile app
  - Used for client-side payment UI
  
- [ ] **Stripe Secret Key** (Production)
  - Format: `sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - ⚠️ **KEEP SECRET** - Never expose to client
  - Used for server-side payment processing
  
- [ ] **Stripe Webhook Secret** (Production)
  - Format: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Used to verify webhook authenticity
  - Set up in Stripe Dashboard → Webhooks
  
- [ ] **Stripe Webhook Endpoint**
  - URL: `https://api.varsityhub.com/webhooks/stripe` (example)
  - Events to listen for:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

**Required Stripe Account Setup**:
- [ ] Activate Stripe account (move from test mode to live mode)
- [ ] Complete business verification
- [ ] Add bank account for payouts
- [ ] Set up tax settings (if applicable)
- [ ] Configure payment methods (card, Apple Pay, Google Pay)
- [ ] Set up customer email receipts
- [ ] Enable 3D Secure (SCA compliance)

**Environment Variables**:
```bash
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Testing Requirements**:
- [ ] Test ad purchase flow ($1.75 weekday ad)
- [ ] Test weekend ad purchase ($2.99)
- [ ] Test promo code application (FIRSTFREE20)
- [ ] Test payment failure handling
- [ ] Test webhook delivery and processing
- [ ] Verify sales tax calculation

---

### 3. Google Maps / Geolocation API

**Purpose**: Display maps, geocode addresses, calculate distances, show game locations

**Required Information**:
- [ ] **Google Cloud Project** (Production)
  - Create new project at https://console.cloud.google.com
  - Name: "VarsityHub Production"
  
- [ ] **Google Maps API Key** (Production)
  - Format: `AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Required APIs to enable:
    - ✅ Maps SDK for Android
    - ✅ Maps SDK for iOS
    - ✅ Places API
    - ✅ Geocoding API
    - ✅ Geolocation API
    - ✅ Distance Matrix API
  
- [ ] **API Key Restrictions** (Security)
  - **Android**: Restrict by package name
    - Package: `com.varsityhub.mobile` (or your actual package)
    - SHA-1 certificate fingerprint (release keystore)
  - **iOS**: Restrict by bundle identifier
    - Bundle ID: `com.varsityhub.mobile` (or your actual bundle)
  - **Server**: Restrict by IP address
    - Add production server IP addresses

**Billing Setup**:
- [ ] Enable billing on Google Cloud project
- [ ] Set up billing alerts (recommended: $100/month threshold)
- [ ] Expected monthly cost: $50-$200 (depending on usage)

**Environment Variables**:
```bash
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Expo App Config** (`app.json`):
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        }
      }
    }
  }
}
```

**Testing Requirements**:
- [ ] Test map display on game detail pages
- [ ] Test address geocoding (converting addresses to coordinates)
- [ ] Test distance calculations (20-mile radius for ads)
- [ ] Test zip code fallback system
- [ ] Verify maps work on both iOS and Android

---

### 4. Database (PostgreSQL)

**Purpose**: Store all application data (users, posts, games, teams, ads, etc.)

**Required Information**:
- [ ] **Database Host**
  - Example: `varsityhub-prod.xxxxxx.us-east-1.rds.amazonaws.com`
  
- [ ] **Database Port**
  - Default: `5432`
  
- [ ] **Database Name**
  - Example: `varsityhub_production`
  
- [ ] **Database Username**
  - Example: `varsityhub_admin`
  
- [ ] **Database Password**
  - Strong password (16+ characters, mixed case, numbers, symbols)
  - ⚠️ **KEEP SECRET**
  
- [ ] **SSL Certificate** (if required)
  - RDS typically provides SSL by default

**Database Provider Options**:
- AWS RDS (Recommended for production)
- Railway (Easy setup, good for smaller projects)
- Supabase (Includes auth and real-time features)
- DigitalOcean Managed Databases
- Heroku Postgres

**Connection String Format**:
```bash
DATABASE_URL=postgresql://username:password@host:5432/database_name?sslmode=require
```

**Database Setup Requirements**:
- [ ] Create production database
- [ ] Run Prisma migrations
- [ ] Set up automated backups (daily minimum)
- [ ] Configure connection pooling (PgBouncer or RDS Proxy)
- [ ] Set up monitoring and alerts
- [ ] Configure access security (VPC, IP whitelist)

**Environment Variables**:
```bash
DATABASE_URL=postgresql://varsityhub_admin:xxxxx@host:5432/varsityhub_production?sslmode=require
```

**Testing Requirements**:
- [ ] Test database connection
- [ ] Run all Prisma migrations
- [ ] Seed initial data (if applicable)
- [ ] Test read/write performance
- [ ] Verify backup restoration

---

### 5. Cloud Storage (AWS S3 or Alternative)

**Purpose**: Store user-uploaded images/videos (avatars, post media, team banners, ad banners)

**Required Information**:
- [ ] **AWS Access Key ID**
  - Format: `AKIAXXXXXXXXXXXXXXXX`
  
- [ ] **AWS Secret Access Key**
  - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - ⚠️ **KEEP SECRET**
  
- [ ] **S3 Bucket Name** (Production)
  - Example: `varsityhub-prod-media`
  - Region: `us-east-1` (or client's preferred region)
  
- [ ] **CloudFront Distribution** (Optional but recommended)
  - CDN for faster media delivery
  - Example: `d1234567890abc.cloudfront.net`

**S3 Bucket Configuration**:
- [ ] Enable public read access for media files
- [ ] Set up CORS policy for web/mobile uploads
- [ ] Configure lifecycle rules (delete old temp files after 7 days)
- [ ] Enable versioning (optional, for recovery)
- [ ] Set up CloudFront for CDN delivery

**CORS Configuration** (`s3-cors-policy.json`):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Environment Variables**:
```bash
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=varsityhub-prod-media
AWS_REGION=us-east-1
CLOUDFRONT_URL=https://d1234567890abc.cloudfront.net
```

**Alternative Providers**:
- Cloudinary (Easier setup, includes image transformations)
- DigitalOcean Spaces
- Google Cloud Storage
- Azure Blob Storage

**Testing Requirements**:
- [ ] Test image upload (avatars, post images)
- [ ] Test video upload (highlights, game footage)
- [ ] Test ad banner upload
- [ ] Verify file access via CDN
- [ ] Test file deletion

---

### 6. Push Notifications (Expo Push Notifications)

**Purpose**: Send notifications for messages, follows, comments, game updates

**Required Information**:
- [ ] **Expo Account**
  - Client needs Expo account (or use yours)
  - Organization/team setup for production app
  
- [ ] **Expo Project ID**
  - Found in Expo dashboard
  - Used for push notification configuration
  
- [ ] **Expo Access Token** (for server-side notifications)
  - Generate in Expo dashboard → Access Tokens
  - ⚠️ **KEEP SECRET**

**Setup Requirements**:
- [ ] Build production app with Expo EAS
- [ ] Configure push notification credentials
  - **iOS**: Apple Push Notification Service (APNs) certificate
  - **Android**: Firebase Cloud Messaging (FCM) server key
- [ ] Test push notifications on real devices
- [ ] Set up notification categories and actions

**Environment Variables**:
```bash
EXPO_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**For Native Builds** (if not using Expo push):
- [ ] **Firebase Cloud Messaging** (Android)
  - Server Key: `AAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - google-services.json file
  
- [ ] **Apple Push Notification Service** (iOS)
  - .p8 key file
  - Key ID, Team ID, Bundle ID

**Testing Requirements**:
- [ ] Test push notifications on iOS devices
- [ ] Test push notifications on Android devices
- [ ] Test notification permissions flow
- [ ] Verify notification tap navigation
- [ ] Test notification badges

---

### 7. Authentication / JWT Configuration

**Purpose**: Secure user authentication and session management

**Required Information**:
- [ ] **JWT Secret Key**
  - Generate a random 64-character string
  - Example: `openssl rand -hex 64`
  - ⚠️ **KEEP SECRET** - Never commit to version control
  
- [ ] **JWT Expiration Settings**
  - Access Token: `15m` (15 minutes) or `1h` (1 hour)
  - Refresh Token: `7d` (7 days) or `30d` (30 days)

**Generate Secure JWT Secret**:
```bash
# Run this command to generate a secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Environment Variables**:
```bash
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
```

**Security Best Practices**:
- [ ] Use strong, randomly generated secret
- [ ] Rotate JWT secret periodically (every 6-12 months)
- [ ] Store in environment variables, never in code
- [ ] Use different secrets for dev/staging/production
- [ ] Implement refresh token rotation

---

### 8. App Store / Google Play Credentials

**Purpose**: Deploy mobile app to iOS App Store and Google Play Store

**iOS App Store Requirements**:
- [ ] **Apple Developer Account**
  - Individual or Organization account ($99/year)
  - Account holder email and credentials
  
- [ ] **App Store Connect Access**
  - Create app listing in App Store Connect
  - Bundle ID: `com.varsityhub.mobile` (or client's choice)
  - App Name: "VarsityHub"
  
- [ ] **Certificates & Provisioning Profiles**
  - Distribution certificate
  - App Store provisioning profile
  - Push notification certificate
  
- [ ] **App Store Listing Information**
  - App description (4000 characters max)
  - Keywords (100 characters, comma-separated)
  - Screenshots (6.5", 5.5", 12.9" iPad)
  - App icon (1024x1024px)
  - Privacy policy URL
  - Support URL

**Google Play Store Requirements**:
- [ ] **Google Play Console Account**
  - One-time $25 registration fee
  - Account owner email and credentials
  
- [ ] **Keystore File** (for signing APK/AAB)
  - Generate or provide existing keystore
  - Keystore password
  - Key alias
  - Key password
  - ⚠️ **KEEP SECURE** - Losing this prevents app updates
  
- [ ] **Google Play Listing Information**
  - Short description (80 characters)
  - Full description (4000 characters)
  - Screenshots (phone, tablet, 7", 10")
  - Feature graphic (1024x500px)
  - App icon (512x512px)
  - Privacy policy URL
  - Content rating questionnaire

**Environment Variables** (for build process):
```bash
# iOS
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_APP_ID=com.varsityhub.mobile

# Android
ANDROID_KEYSTORE_PASSWORD=xxxxxxxxxx
ANDROID_KEY_ALIAS=varsityhub
ANDROID_KEY_PASSWORD=xxxxxxxxxx
```

---

### 9. Domain & SSL Certificate

**Purpose**: Custom domain for API and web portal

**Required Information**:
- [ ] **Domain Name**
  - Example: `varsityhub.com`
  - Client must own or purchase domain
  
- [ ] **DNS Access**
  - Access to domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
  - Ability to add A records, CNAME records
  
- [ ] **SSL Certificate**
  - Free option: Let's Encrypt (auto-renewal)
  - Paid option: Cloudflare SSL/TLS
  - Wildcard cert for subdomains: `*.varsityhub.com`

**DNS Records Needed**:
```
# API Server
api.varsityhub.com  →  A Record  →  [SERVER_IP_ADDRESS]

# Web Portal (if applicable)
www.varsityhub.com  →  A Record  →  [WEB_SERVER_IP]
varsityhub.com      →  A Record  →  [WEB_SERVER_IP]

# Email (SendGrid)
em1234.varsityhub.com  →  CNAME  →  sendgrid.net
s1._domainkey.varsityhub.com  →  CNAME  →  s1.domainkey.u12345.wl123.sendgrid.net
s2._domainkey.varsityhub.com  →  CNAME  →  s2.domainkey.u12345.wl123.sendgrid.net
```

**Testing Requirements**:
- [ ] Verify domain resolves to server
- [ ] Test SSL certificate (https://)
- [ ] Check certificate expiration monitoring
- [ ] Test API endpoints via domain
- [ ] Verify email sending via domain

---

### 10. Server Hosting

**Purpose**: Host the Node.js/Express backend API

**Required Information**:
- [ ] **Server Provider Choice**
  - Railway (Easiest deployment)
  - AWS EC2 (Most control)
  - DigitalOcean (Good balance)
  - Heroku (Simple but more expensive)
  - Render (Good alternative to Heroku)
  
- [ ] **Server Specifications** (Minimum for production)
  - CPU: 2 vCPUs
  - RAM: 4GB
  - Storage: 50GB SSD
  - Bandwidth: Unlimited or 5TB+
  
- [ ] **SSH Access** (for EC2/DigitalOcean)
  - SSH private key
  - Server IP address
  - Username (usually `ubuntu` or `root`)

**Deployment Options**:

#### Option A: Railway (Recommended for Ease)
```bash
# Client needs Railway account
# Connect GitHub repo
# Set environment variables in Railway dashboard
# Automatic deployments on push to main branch
```

#### Option B: AWS EC2
```bash
# Launch EC2 instance (t3.medium or larger)
# Configure security groups (port 80, 443, 22)
# Install Node.js, PostgreSQL, Nginx
# Set up PM2 for process management
# Configure Nginx reverse proxy
```

#### Option C: DigitalOcean Droplet
```bash
# Create droplet (2GB RAM minimum)
# Set up SSH keys
# Install Node.js 18+
# Configure firewall (ufw)
# Set up Nginx + PM2
```

**Environment Variables on Server**:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=...
SENDGRID_API_KEY=...
STRIPE_SECRET_KEY=...
GOOGLE_MAPS_API_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## 📋 Quick Checklist Summary

### Must Have (Critical)
- [ ] Email service API key (SendGrid/AWS SES)
- [ ] Stripe production keys (publishable, secret, webhook)
- [ ] Google Maps API key (with all required APIs enabled)
- [ ] PostgreSQL database (production instance)
- [ ] AWS S3 bucket (or alternative cloud storage)
- [ ] JWT secret key (securely generated)
- [ ] Domain name with SSL certificate
- [ ] Server hosting (Railway/AWS/DigitalOcean)

### Nice to Have (Recommended)
- [ ] CloudFront CDN for faster media delivery
- [ ] Cloudflare for DDoS protection and caching
- [ ] Sentry for error tracking and monitoring
- [ ] Datadog/New Relic for performance monitoring
- [ ] Backup strategy and disaster recovery plan

### Optional (Future)
- [ ] Redis for caching and session storage
- [ ] Elasticsearch for advanced search
- [ ] Analytics service (Mixpanel, Amplitude)
- [ ] Customer support tool (Intercom, Zendesk)

---

## 🔧 Environment Variables Template

Create this file as `.env.production` (⚠️ **NEVER commit to Git**):

```bash
# ========================================
# VarsityHub Production Environment
# ========================================

# Node Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@host:5432/varsityhub_production?sslmode=require

# JWT Authentication
JWT_SECRET=YOUR_64_CHARACTER_SECRET_HERE
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@varsityhub.com

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
CLOUDFRONT_URL=https://d1234567890abc.cloudfront.net

# Expo Push Notifications
EXPO_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# App URLs
API_URL=https://api.varsityhub.com
WEB_URL=https://varsityhub.com

# Security
CORS_ORIGIN=https://varsityhub.com,https://www.varsityhub.com

# Optional: Error Tracking
SENTRY_DSN=https://xxxxxx@sentry.io/xxxxxx

# Optional: Analytics
MIXPANEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📞 Client Communication Template

Use this email template to request credentials from your client:

```
Subject: VarsityHub Production Deployment - Required Credentials

Hi [Client Name],

We're ready to deploy VarsityHub to production! To complete the deployment, 
I need the following credentials and information from you:

🔐 CRITICAL (Required Immediately):

1. Email Service (SendGrid)
   - API Key
   - Verified sender email (e.g., noreply@varsityhub.com)

2. Stripe Payment Processing
   - Production Publishable Key (pk_live_...)
   - Production Secret Key (sk_live_...)
   - Webhook Secret (whsec_...)

3. Google Maps API
   - API Key with Maps SDK, Places API, and Geocoding API enabled
   - Billing enabled on Google Cloud project

4. Database (PostgreSQL)
   - Host, port, database name, username, password
   - Or: Railway/Supabase account for managed database

5. Cloud Storage (AWS S3)
   - Access Key ID and Secret Access Key
   - Or: Cloudinary account for easier setup

6. Domain & Hosting
   - Domain name (e.g., varsityhub.com)
   - DNS access for adding records
   - Server hosting provider (or I can set up Railway)

📱 APP STORE DEPLOYMENT (Can be done after):

7. Apple App Store
   - Apple Developer account credentials
   - App Store Connect access

8. Google Play Store
   - Google Play Console credentials
   - Keystore file (if you have one) or I'll generate

⏱️ Timeline:
Once I receive these credentials, deployment will take 2-3 business days.

🔒 Security:
Please share credentials securely (not via regular email). I recommend:
- Password manager (1Password, LastPass)
- Encrypted email (ProtonMail)
- Secure file sharing (Dropbox, Google Drive with password protection)

Let me know if you need help setting up any of these services!

Best regards,
[Your Name]
```

---

## 🚀 Deployment Checklist

Once you receive all credentials:

### Phase 1: Environment Setup (Day 1)
- [ ] Set up production server (Railway/AWS/DigitalOcean)
- [ ] Configure domain and SSL certificate
- [ ] Set up production database
- [ ] Configure S3 bucket and CDN
- [ ] Add all environment variables

### Phase 2: API Deployment (Day 1-2)
- [ ] Deploy backend API to production server
- [ ] Run database migrations
- [ ] Test all API endpoints
- [ ] Configure Stripe webhooks
- [ ] Test email sending
- [ ] Verify Google Maps integration

### Phase 3: Mobile App Build (Day 2-3)
- [ ] Update app.json with production URLs
- [ ] Build iOS app with EAS
- [ ] Build Android app with EAS
- [ ] Test apps on real devices
- [ ] Submit to App Store (1-2 week review)
- [ ] Submit to Google Play (1-3 day review)

### Phase 4: Testing & Launch (Day 3+)
- [ ] End-to-end testing on production
- [ ] Load testing and performance checks
- [ ] Security audit
- [ ] Set up monitoring and alerts
- [ ] Create backup and recovery procedures
- [ ] Soft launch to beta users
- [ ] Full public launch

---

## 📊 Estimated Monthly Costs

Help your client understand ongoing costs:

| Service | Estimated Cost | Notes |
|---------|---------------|-------|
| **Server Hosting** | $25-$100/month | Railway ($20), AWS t3.medium ($50+), DigitalOcean ($50) |
| **Database** | $15-$50/month | Railway ($5+), AWS RDS ($30+) |
| **Email (SendGrid)** | $0-$20/month | Free up to 100 emails/day, $20 for 50k/month |
| **Stripe Fees** | 2.9% + $0.30 per transaction | Only charged when you make money |
| **Google Maps** | $50-$200/month | Depends on usage, $200/month free credit |
| **S3 Storage** | $5-$20/month | Depends on storage and bandwidth |
| **CloudFront CDN** | $10-$50/month | Optional but recommended |
| **Domain** | $12/year | One-time annual cost |
| **SSL Certificate** | $0 | Free with Let's Encrypt |
| **Apple Developer** | $99/year | Required for iOS app |
| **Google Play** | $25 one-time | One-time registration fee |
| **TOTAL** | **$100-$400/month** | Depends on user traffic and features |

---

## 🆘 Support & Maintenance

After deployment, consider offering:

1. **Monitoring & Alerts**
   - Set up Sentry for error tracking
   - Configure server monitoring (CPU, RAM, disk)
   - Email alerts for downtime or errors

2. **Backup Strategy**
   - Automated daily database backups
   - S3 backup to separate region
   - Test backup restoration monthly

3. **Security Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Rotate API keys and secrets every 6 months

4. **Performance Optimization**
   - Monitor API response times
   - Optimize database queries
   - Implement caching where needed

5. **Scaling Plan**
   - Define thresholds for upgrading server
   - Plan for database scaling
   - CDN configuration for high traffic

---

## 📚 Additional Resources

- [SendGrid Setup Guide](https://docs.sendgrid.com/for-developers/sending-email/api-getting-started)
- [Stripe Integration Guide](https://stripe.com/docs/payments/accept-a-payment)
- [Google Maps Platform Setup](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [AWS S3 Bucket Setup](https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html)
- [Expo EAS Build & Submit](https://docs.expo.dev/build/introduction/)
- [Railway Deployment Guide](https://docs.railway.app/deploy/deployments)

---

## ✅ Final Notes

**Security Reminder**: 
- Never commit API keys or secrets to Git
- Use `.env` files and add to `.gitignore`
- Rotate credentials if accidentally exposed
- Use different keys for dev/staging/production

**Client Responsibility**:
- Provide all credentials in a timely manner
- Keep credentials secure and confidential
- Update payment methods for paid services
- Monitor costs and usage

**Your Responsibility**:
- Securely store client credentials
- Test all integrations thoroughly
- Document any issues or limitations
- Provide ongoing support and maintenance

---

**Questions?** 
Contact: [Your Email]  
Last Updated: October 13, 2025
