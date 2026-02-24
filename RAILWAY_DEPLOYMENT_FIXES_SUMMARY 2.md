# Railway Deployment Fixes Summary
**Date:** January 12, 2026

## 🎯 Issues Resolved

### 1. **Prisma Migration Failures (P3009 Error)**
**Problem:** 
- Failed migration `add_severity_to_reports` was blocking all new migrations
- Error: "migrate found failed migrations in the target database"

**Solution:**
- Updated `server/start.sh` to automatically resolve failed migrations before deploying new ones
- Added: `npx prisma migrate resolve --rolled-back add_severity_to_reports`

**Files Changed:**
- `server/start.sh`

---

### 2. **Docker Build Failures - Missing Start Script**
**Problem:**
- Dockerfile was looking for `start.sh` in wrong location
- Build failed: "No such file or directory"

**Solution:**
- Fixed path in Dockerfile from `COPY ./start.sh ./` to `COPY ./server/start.sh ./`

**Files Changed:**
- `server/Dockerfile` (line 24)

---

### 3. **Missing plan-definitions.json (MODULE_NOT_FOUND)**
**Problem:**
- App crashed on startup: `Error: Cannot find module '../../../shared/plan-definitions.json'`
- Subscription plan limits couldn't be loaded

**Solution (2 parts):**

**Part 1:** Copy shared directory in Dockerfile
```dockerfile
COPY ./shared ./shared
```

**Part 2:** Fixed relative path in code to match Docker structure
- Changed from: `../../../shared/plan-definitions.json`
- Changed to: `../../shared/plan-definitions.json`

**Files Changed:**
- `server/Dockerfile` (added COPY ./shared)
- `server/src/lib/planLimits.ts` (fixed relative path)

---

### 4. **Redis Connection Crashes**
**Problem:**
- App crashed on startup when Redis wasn't available
- Error: `Failed to connect to Redis` → `process.exit(1)`

**Solution:**
- Made Redis optional - app now starts without it
- Shows warning instead of crashing
- Email queue disabled until Redis is added

**Files Changed:**
- `server/src/lib/queue.ts`
- `server/package.json` (added `@types/ioredis`)

---

## 📧 Email System Overview

### Current Implementation: **Bull Queue + SendGrid + ioredis**

**Architecture:**
```
Email Request → Bull Queue (Redis-backed) → SendGrid API → Delivery
```

**Components:**
1. **Bull** - Job queue system for email processing
2. **ioredis** - Redis client for queue persistence  
3. **SendGrid** - Email delivery service (via `@sendgrid/mail`)
4. **Redis** - Required for queue storage (currently missing)

**Location:** `server/src/lib/queue.ts`

---

## ⚠️ Current Email System Issues

### Issue 1: **Redis Not Configured**
**Problem:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
❌ [queue] Email queue error: AggregateError [ECONNREFUSED]
```

**Impact:**
- Email queue cannot function
- Emails will NOT be sent
- App continues to run but email features are disabled

**Fix Required:**
Add Redis to Railway:
1. Open Railway dashboard
2. Click **"+ New"** → **"Database"** → **"Add Redis"**
3. Railway auto-generates `REDIS_URL` environment variable
4. App will reconnect automatically on next deployment

---

### Issue 2: **EventEmitter Memory Leak Warnings**
**Problem:**
```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 error listeners added to [Commander]. MaxListeners is 10.
```

**Impact:**
- Performance degradation over time
- Memory leak potential
- Multiple Redis connection attempts

**Root Cause:**
- Queue initialization creating too many event listeners
- Redis client and subscriber both adding listeners
- Bull queue adding additional listeners

**Fix Required:**
Add to `server/src/lib/queue.ts`:
```typescript
import { EventEmitter } from 'events';

// Increase max listeners limit
EventEmitter.defaultMaxListeners = 15;

// OR set on specific instances:
redis.setMaxListeners(15);
redisSubscriber.setMaxListeners(15);
emailQueue.setMaxListeners(15);
```

---

## 🔧 How to Fix Email System

### Step 1: Add Redis to Railway ✅ **REQUIRED**
```bash
# In Railway Dashboard:
1. Click "+ New" button
2. Select "Database" 
3. Choose "Redis"
4. Railway auto-configures REDIS_URL
```

**Expected Result:**
```
✅ Queue system initialized (Redis connected)
```

---

### Step 2: Fix Memory Leak Warning (Optional but Recommended)

**Update:** `server/src/lib/queue.ts`

```typescript
import Queue from 'bull';
import Redis from 'ioredis';
import { debugLog } from './debugLog.js';
import { EventEmitter } from 'events';

// Increase default max listeners to prevent warnings
EventEmitter.defaultMaxListeners = 20;

// Redis connection details
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Rest of the code...
```

---

### Step 3: Monitor Email Queue Health

**Add health check endpoint** (if not exists):

`server/src/routes/health.ts`:
```typescript
router.get('/health', async (req, res) => {
  const redisConnected = redis.status === 'ready';
  const queueHealth = {
    waiting: await emailQueue.getWaitingCount(),
    active: await emailQueue.getActiveCount(),
    failed: await emailQueue.getFailedCount(),
  };

  res.json({
    status: 'ok',
    redis: redisConnected ? 'connected' : 'disconnected',
    emailQueue: queueHealth,
  });
});
```

---

## 📋 Files Modified Summary

| File | Changes | Status |
|------|---------|--------|
| `server/Dockerfile` | Fixed start.sh path, added shared directory copy | ✅ Fixed |
| `server/start.sh` | Added migration failure resolution | ✅ Fixed |
| `server/src/lib/planLimits.ts` | Fixed shared directory path | ✅ Fixed |
| `server/src/lib/queue.ts` | Made Redis optional, fixed TypeScript errors | ✅ Fixed |
| `server/package.json` | Added `@types/ioredis` | ✅ Fixed |

---

## 🚀 Deployment Status

### ✅ Working Now:
- Database migrations deploy successfully
- App starts without crashing
- PostgreSQL connected and healthy
- API server running on Railway

### ⚠️ Needs Attention:
- **Redis not configured** - Email queue disabled
- **EventEmitter warnings** - Potential memory leak
- **Email functionality** - Not operational until Redis added

---

## 🎯 Next Steps (Priority Order)

### 1. **CRITICAL: Add Redis** 
**Why:** Email system completely non-functional
**Time:** 2 minutes
**How:** Railway Dashboard → Add Redis Database

### 2. **HIGH: Fix EventEmitter Warnings**
**Why:** Memory leak potential
**Time:** 5 minutes  
**How:** Add `EventEmitter.defaultMaxListeners = 20;` to queue.ts

### 3. **MEDIUM: Test Email Functionality**
**Why:** Verify email queue works after Redis added
**Time:** 10 minutes
**How:** 
```bash
# Test email sending via API
curl -X POST https://api-production-8ac3.up.railway.app/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test"}'
```

### 4. **LOW: Monitor Queue Metrics**
**Why:** Track email delivery success/failure rates
**Time:** 15 minutes
**How:** Add health check endpoint with queue stats

---

## 📊 Email System Alternatives (If Issues Persist)

### Option 1: **Keep Current System** (Recommended)
- ✅ Reliable with Redis
- ✅ Retry logic built-in
- ✅ Queue persistence
- ❌ Requires Redis infrastructure

### Option 2: **Switch to Direct SendGrid** 
- ✅ No Redis required
- ✅ Simpler setup
- ❌ No retry queue
- ❌ No job persistence
- ❌ Loses email on failure

**Code Example:**
```typescript
// Direct SendGrid (no queue)
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(to: string, subject: string, html: string) {
  await sgMail.send({ to, from: 'noreply@varsityhub.com', subject, html });
}
```

### Option 3: **Use AWS SES + SQS**
- ✅ More scalable
- ✅ Built-in queue
- ❌ More complex setup
- ❌ AWS account required

---

## 🔍 Debugging Commands

```bash
# Check Railway logs
railway logs

# Check Redis connection locally
redis-cli ping

# Test Prisma migrations
npx prisma migrate status
npx prisma migrate deploy

# Build Docker locally
docker build -f server/Dockerfile -t api-test .
docker run -p 4000:4000 api-test

# Check email queue status (once Redis added)
curl https://api-production-8ac3.up.railway.app/health
```

---

## 📝 Environment Variables Required

| Variable | Source | Status |
|----------|--------|--------|
| `DATABASE_URL` | Railway PostgreSQL | ✅ Set |
| `REDIS_URL` | Railway Redis | ❌ **MISSING** |
| `SENDGRID_API_KEY` | SendGrid Dashboard | ✅ Set |
| `JWT_SECRET` | Manual | ✅ Set |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | ✅ Set |

---

## ✅ Success Indicators

Once all fixes are applied, you should see:
```
🗄️  Running database migrations...
Checking for failed migrations...
Migration add_severity_to_reports marked as rolled back.
All migrations have been successfully applied.
✅ Queue system initialized (Redis connected)
🚀 Starting API server...
✅ Environment validation: 11 required variables loaded
✅ Sentry error tracking enabled
Server running on port 4000
```

---

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app/
- **Prisma Migrations:** https://pris.ly/d/migrate-resolve
- **Bull Queue:** https://github.com/OptimalBits/bull
- **SendGrid API:** https://docs.sendgrid.com/api-reference

---

**Last Updated:** January 12, 2026  
**Status:** Migrations Fixed ✅ | Redis Needed ⚠️ | Email Queue Disabled ⚠️
