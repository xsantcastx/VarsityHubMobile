# Tools & Integrations Overview

**Date**: December 2024  
**Status**: ✅ **COMPREHENSIVE TOOLING IN PLACE**

---

## Overview

This document provides a comprehensive overview of all tools, services, and integrations used in the VarsityHub application to ensure it works correctly in production.

---

## 🔍 Error Tracking & Monitoring

### Sentry
**Purpose**: Error tracking, crash reporting, and performance monitoring

**Client-Side (React Native)**:
- **Package**: `@sentry/react-native` (~7.2.0)
- **File**: `utils/sentry.ts`
- **Initialization**: `app/_layout.tsx`
- **Features**:
  - Captures uncaught exceptions with device info
  - Tracks HTTP request/response breadcrumbs
  - Reports timeouts and network failures
  - Filters dev noise (network errors in development)
  - Auto session tracking
  - Performance monitoring (tracesSampleRate: 0.2)
- **Configuration**: `EXPO_PUBLIC_SENTRY_DSN` environment variable
- **Android Config**: `android/sentry.properties`

**Server-Side (Node.js)**:
- **Package**: `@sentry/node`
- **File**: `server/src/lib/sentry.ts`
- **Initialization**: `server/src/index.ts` (first middleware)
- **Features**:
  - HTTP request tracing
  - Uncaught exception tracking
  - Unhandled rejection tracking
  - Performance monitoring (10% sample rate in production)
  - Filters health check requests
- **Configuration**: `SENTRY_DSN` environment variable

**Documentation**: `docs/MONITORING_SETUP.md`

---

## 🐳 Containerization & Deployment

### Docker
**Purpose**: Containerization for consistent deployments

**Files**:
- `server/Dockerfile` - Server container definition
- `server/docker-compose.yml.prod` - Production Docker Compose
- `server/docker-compose.yml.local` - Local development Docker Compose

**Usage**:
- Server runs in Docker container
- Railway uses Dockerfile for deployments
- Local development can use docker-compose

### Railway
**Purpose**: Cloud hosting and deployment platform

**Configuration**:
- `railway.toml` - Railway deployment config
- Uses Dockerfile for builds
- Environment variables managed in Railway dashboard
- Auto-deployments from Git

**Documentation**: 
- `docs/RAILWAY_ENV_SETUP.md`
- `server/docs/RAILWAY_DEPLOYMENT_GUIDE.md`

---

## 📧 Email Services

### Twilio SendGrid
**Purpose**: Transactional email delivery

**Implementation**:
- **Service**: `server/src/services/email/EmailService.ts`
- **Provider**: `server/src/services/email/providers/SendGridProvider.ts`
- **Templates**: `sendgrid-templates/*.html` (31 templates)
- **Configuration**: 
  - `SENDGRID_API_KEY` environment variable
  - Default sender: `noreply@varsityhub.app`
- **Features**:
  - Retry logic
  - Template injection
  - Structured logging
  - Configuration validation

**Documentation**:
- `docs/EMAIL_GUIDE.md`
- `docs/EMAIL_ENV.md`
- `docs/EMAIL_AUDIT.md`

---

## 💳 Payment Processing

### Stripe
**Purpose**: Payment processing and subscriptions

**Implementation**:
- **Routes**: `server/src/routes/payments.ts`
- **Features**:
  - Checkout sessions
  - Subscription management
  - Promo codes
  - Webhook handling
  - Transaction logging
- **Configuration**: 
  - `STRIPE_SECRET_KEY` environment variable
  - `STRIPE_WEBHOOK_SECRET` for webhook verification
- **Plans**: Rookie (free), Veteran ($0.99/month per additional team), Legend ($29.99/year)

**Documentation**:
- `docs/STRIPE_PRICING_CONFIG.md`
- Payment flow tests: `test-payment-security.sh`

---

## 🖼️ Media Storage

### Cloudinary
**Purpose**: Cloud-based media storage and CDN

**Implementation**:
- **Library**: `server/src/lib/cloudinary.ts`
- **Usage**: Image and video uploads
- **Features**:
  - Automatic image optimization
  - Video transcoding
  - CDN delivery
  - Transformations
- **Configuration**:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- **Fallback**: Local disk storage if not configured

**Documentation**:
- `server/docs/CLOUDINARY_SETUP.md`
- `server/docs/CLOUDINARY_QUICK_REF.md`
- `server/CLOUDINARY_TESTING_GUIDE.md`

---

## 🗄️ Database & ORM

### PostgreSQL
**Purpose**: Primary database

**Implementation**:
- Managed via Railway or Docker
- Connection: `DATABASE_URL` environment variable
- Migrations: Prisma migrations

### Prisma
**Purpose**: Database ORM and migrations

**Implementation**:
- **Schema**: `server/prisma/schema.prisma`
- **Migrations**: `server/prisma/migrations/`
- **Client**: `server/src/lib/prisma.js`
- **Features**:
  - Type-safe database access
  - Migration management
  - Database introspection

**Documentation**:
- `docs/DATABASE_SETUP.md`
- `server/docs/POSTGRESQL_GUIDE.md`

---

## 🔄 Job Queue & Background Processing

### BullMQ (Redis)
**Purpose**: Background job processing

**Implementation**:
- **Queue**: `server/src/lib/queue.ts`
- **Workers**:
  - `server/src/jobs/workers/emailWorker.ts` - Email sending
  - `server/src/jobs/workers/notificationWorker.ts` - Push notifications
- **Features**:
  - Email queue with retries
  - Notification queue
  - Job scheduling
  - Failed job handling
- **Configuration**: `REDIS_URL` environment variable

**Documentation**: Email queue testing: `test-email-queue.sh`

---

## 🔐 Authentication & OAuth

### Google OAuth
**Purpose**: Google Sign-In

**Configuration**:
- `GOOGLE_CLIENT_ID` environment variable
- `GOOGLE_CLIENT_SECRET` environment variable

**Documentation**: `server/docs/GOOGLE_OAUTH_SETUP.md`

### Apple Sign-In
**Purpose**: Apple Sign-In

**Configuration**:
- Apple Developer credentials
- iOS configuration in `ios/` directory

**Documentation**: 
- `server/docs/APPLE_SIGNIN_SETUP.md`
- `docs/archive/notes/APPLE_SIGNIN_DEPLOYMENT_CHECKLIST.md`

---

## 📝 Logging

### Pino
**Purpose**: Structured logging

**Implementation**:
- **Middleware**: `pino-http` in `server/src/index.ts`
- **Features**:
  - Structured JSON logs
  - Pretty printing in development
  - Request/response logging
- **Configuration**: Automatic, no env vars needed

### Debug Logging
**Purpose**: Development debugging

**Implementation**:
- **File**: `server/src/lib/debugLog.ts`
- **Features**:
  - Conditional logging based on `DEBUG` env var
  - Structured log output
  - Contextual information

---

## 🛡️ Security Tools

### Helmet
**Purpose**: Security headers

**Implementation**:
- **Package**: `helmet`
- **Usage**: `server/src/index.ts`
- **Configuration**: CSP disabled in dev, enabled in production
- **Features**:
  - XSS protection
  - Content Security Policy
  - HSTS headers
  - Frame options

### Express Rate Limiting
**Purpose**: API rate limiting

**Implementation**:
- **Package**: `express-rate-limit`
- **File**: `server/src/middleware/rateLimiters.ts`
- **Features**:
  - Auth endpoints: 5 requests per 15 minutes
  - Password reset: 3 requests per hour
  - Content creation: 10 requests per minute
  - Uploads: 10 per hour (avatars)
  - RSVPs: 20 per minute
  - And more...

---

## 📚 API Documentation

### Swagger/OpenAPI
**Purpose**: API documentation

**Implementation**:
- **Package**: `swagger-ui-express`
- **File**: `server/src/lib/swagger.ts`
- **Endpoint**: `/api-docs` (if enabled)
- **Features**:
  - Interactive API documentation
  - Request/response schemas
  - Endpoint testing

---

## 🧪 Testing Tools

### Playwright
**Purpose**: E2E and API testing

**Implementation**:
- **Package**: `@playwright/test` (^1.40.1)
- **Config**: `playwright.config.ts`
- **Tests**: `tests/` directory
- **Features**:
  - E2E tests for critical flows
  - API integration tests
  - Smoke tests
  - HTML reports

**Documentation**:
- `tests/README.md`
- `docs/TESTING_STRATEGY.md`

### Jest
**Purpose**: Unit testing

**Implementation**:
- **Package**: `jest-expo`
- **Config**: `jest.config.js`
- **Setup**: `jest.setup.ts`
- **Features**:
  - React Native component testing
  - Unit tests

---

## 📦 Build & Development Tools

### Expo
**Purpose**: React Native framework

**Features**:
- Expo Router for navigation
- Expo SDK 54
- EAS Build for production builds
- Over-the-air updates

**Configuration**:
- `app.json` - Expo configuration
- `eas.json` - EAS Build configuration

### TypeScript
**Purpose**: Type safety

**Configuration**:
- `tsconfig.json` - TypeScript config
- Strict mode enabled
- Path aliases configured

### ESLint
**Purpose**: Code linting

**Configuration**:
- `eslint.config.js` - ESLint rules
- Strict rules enabled
- React Hooks rules
- No floating promises

### Prettier
**Purpose**: Code formatting

**Configuration**:
- `.prettierrc` - Prettier config
- `.prettierignore` - Ignore patterns

---

## 🗺️ Maps & Location

### React Native Maps
**Purpose**: Map display

**Package**: `react-native-maps` (1.20.1)

**Features**:
- Event location display
- User location
- Map markers
- Geocoding integration

### Expo Location
**Purpose**: Location services

**Package**: `expo-location` (~19.0.7)

**Features**:
- GPS location
- Geofencing
- Location permissions
- Background location

---

## 🔔 Push Notifications

### Expo Notifications
**Purpose**: Push notifications

**Package**: `expo-notifications` (~0.32.15)

**Features**:
- Push notification delivery
- Notification scheduling
- Badge management
- Notification permissions

**Implementation**:
- `server/src/lib/notifications.ts`
- `server/src/jobs/workers/notificationWorker.ts`

---

## 📊 Analytics & Tracking

### Current Status
- **Sentry**: ✅ Error tracking and performance
- **User Analytics**: 🔴 Not implemented (Mixpanel/Amplitude recommended)
- **Server Metrics**: 🔴 Not implemented (Prometheus/Grafana recommended)
- **Business Metrics**: 🔴 Not implemented

**Recommendation**: See `docs/PRODUCTION_HARDENING.md` for analytics setup guide

---

## 🔧 Development Tools

### Thunder Client
**Purpose**: API testing

**File**: `thunder-client-collection.json`

**Features**:
- API endpoint testing
- Request collections
- Environment variables

### Scripts
**Purpose**: Automation and utilities

**Key Scripts**:
- `scripts/verify-env-vars.sh` - Environment validation
- `scripts/railway-health-check.sh` - Health monitoring
- `test-email-queue.sh` - Email queue testing
- `test-payment-security.sh` - Payment testing
- `verify-production-ready.sh` - Production readiness check

---

## 📋 Environment Variables Summary

### Required for Production

**Core**:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV=production`

**Sentry**:
- `SENTRY_DSN` - Server Sentry DSN
- `EXPO_PUBLIC_SENTRY_DSN` - Client Sentry DSN

**Email (SendGrid)**:
- `SENDGRID_API_KEY` - SendGrid API key
- `EMAIL_FROM` - Default sender (noreply@varsityhub.app)

**Payments (Stripe)**:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook verification

**Media (Cloudinary)**:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**Queue (Redis)**:
- `REDIS_URL` - Redis connection

**OAuth**:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Security**:
- `ALLOWED_ORIGINS` - CORS allowed origins

**Full List**: See `docs/ENV.md`

---

## 🏗️ Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React Native)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Sentry  │  │   Expo   │  │  Maps    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Server (Node.js/Express)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Sentry  │  │  Helmet  │  │  Pino    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Prisma   │  │  BullMQ  │  │ SendGrid │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Stripe   │  │Cloudinary│  │  Swagger │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis    │  │  Cloudinary  │
│   (Railway)  │  │  (Railway)   │  │     CDN     │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📚 Documentation

**Key Documentation Files**:
- `docs/MONITORING_SETUP.md` - Sentry setup
- `docs/EMAIL_GUIDE.md` - Email system
- `docs/ENV.md` - Environment variables
- `docs/RAILWAY_ENV_SETUP.md` - Railway deployment
- `server/docs/CLOUDINARY_SETUP.md` - Cloudinary setup
- `server/docs/RAILWAY_DEPLOYMENT_GUIDE.md` - Deployment guide

---

## ✅ Health Checks

**Health Endpoint**: `GET /health`

**Checks**:
- Database connectivity
- Redis connectivity
- Email service status
- Cloudinary status (if configured)
- Sentry status

**File**: `server/src/routes/health.ts`

---

## 🔄 CI/CD

**GitHub Actions**:
- `.github/workflows/ci.yml` - Lint, typecheck, format, test

**Railway**:
- Auto-deployments from Git
- Environment variable management
- Build logs and monitoring

---

## 📊 Monitoring Dashboard

**Sentry Dashboard**:
- Error tracking
- Performance monitoring
- Release tracking
- User context

**Access**: https://sentry.io (requires account)

---

## 🛠️ Development Workflow

1. **Local Development**:
   - `npm run server:dev` - Start server
   - `npm start` - Start Expo
   - Docker Compose for local services (optional)

2. **Testing**:
   - `npm run test:smoke` - Quick smoke tests
   - `npm run test:api` - API tests
   - `npm run test:e2e` - E2E tests

3. **Deployment**:
   - Push to Git → Railway auto-deploys
   - EAS Build for mobile apps
   - Environment variables in Railway dashboard

---

**Status**: ✅ **ALL TOOLS CONFIGURED AND DOCUMENTED**  
**Last Updated**: December 2024
