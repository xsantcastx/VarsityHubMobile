# Production Hardening Checklist

> Last updated: November 30, 2025

This document outlines the production hardening roadmap for VarsityHub, covering rate limiting, background jobs, content moderation, search/indexing, push notifications, analytics, security, backup/retention, error triage, and deep-linking infrastructure.

---

## 🔒 Security Upgrades (COMPLETED)

### Environment Validation ✅

- **`server/src/lib/env.ts`** - Zod schema enforces:
  - `DATABASE_URL` required
  - `JWT_SECRET` ≥32 characters (no fallback keys!)
  - All env vars validated at boot (server exits if invalid)

### Config Validator ✅

- **`server/src/lib/config-validator.ts`** - Checks 10 services:
  - Required: database, jwt, stripe, smtp
  - Optional: cloudinary, googleOAuth, googleMaps, twilio, redis, sentry

### Health Endpoints ✅

- **`/health`** - Integration status + warnings
- **`/health/ready`** - Kubernetes-style readiness probe
- **`/health/services`** - Detailed service status for debugging

### CORS & Rate Limiting ✅

- **`server/src/index.ts`** - CORS honors `ALLOWED_ORIGINS` (warns if wildcard in prod)
- Ads/payments routes behind global rate limiter + `no-store` headers
- JWT signing uses validated secret only (no dev fallback)

### Operational Readiness Check (BACKUPS + ALERTS) ✅

Use the repo's operational readiness helper to confirm the app is ready for a production handoff:

```bash
npm run verify:ops
```

This script checks the public `/health` endpoint, confirms Sentry DSN configuration, and prints the remaining manual Railway/Sentry follow-ups for:

- Postgres backup enablement + retention confirmation
- Restore procedure validation and a documented rollback path
- Sentry alerts for 5xx spikes, slow-query bursts, auth failures, and payment errors

If the health probe fails, fix the deployment before treating the release as safe. If the health probe passes but the manual checklist items are still unchecked, treat the rollout as operationally incomplete.

---

## Table of Contents

1. [Rate Limiting & Abuse Protection](#1-rate-limiting--abuse-protection)
2. [Background Job Queue](#2-background-job-queue)
3. [Content Moderation & Reporting](#3-content-moderation--reporting)
4. [Search/Indexing](#4-searchindexing)
5. [Push Notifications & Delivery Monitoring](#5-push-notifications--delivery-monitoring)
6. [Analytics/Metrics](#6-analyticsmetrics)
7. [Security Scanning](#7-security-scanning)
8. [Backup/Retention Policies](#8-backupretention-policies)
9. [Error Triage Workflow](#9-error-triage-workflow)
10. [Sharing/Deep-Link Infrastructure](#10-sharingdeep-link-infrastructure)

---

## 1. Rate Limiting & Abuse Protection

### Current State ✅

| Component                     | Status        | Notes                                   |
| ----------------------------- | ------------- | --------------------------------------- |
| `express-rate-limit`          | ✅ Installed  | v7.4.0 in package.json                  |
| Global API limiter            | ✅ Configured | 500 req/15min (prod), unlimited (dev)   |
| Auth limiter                  | ✅ Configured | 50 req/15min for `/auth/*` routes       |
| In-memory auth rate limit     | ✅ Custom     | 5 attempts/15min per email in `auth.ts` |
| Email verification rate limit | ✅ Custom     | 1/30s, 5/hour per user                  |
| Phone verification rate limit | ✅ Custom     | Same as email verification              |
| Trust proxy                   | ✅ Enabled    | Required for Railway/Heroku             |

### Gaps Identified 🔴

| Endpoint                       | Issue                            | Priority |
| ------------------------------ | -------------------------------- | -------- |
| `POST /posts`                  | No per-user post creation limit  | HIGH     |
| `POST /posts/:id/comments`     | No spam protection               | HIGH     |
| `POST /messages`               | No message rate limit            | HIGH     |
| `POST /follows/:userId/follow` | Follow spam possible             | MEDIUM   |
| `POST /posts/:id/upvote`       | No vote rate limit               | LOW      |
| `POST /support/contact`        | No abuse report flood protection | MEDIUM   |

### Recommended Implementation

#### Option A: Redis + rate-limit-redis (Recommended for Scale)

```bash
# Railway: Add Redis service
# Then in server:
npm install rate-limit-redis ioredis
```

```typescript
// server/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    store: redis ? new RedisStore({ client: redis }) : undefined,
    skip: () => process.env.NODE_ENV !== 'production',
  });
};

// Pre-configured limiters
export const postCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 posts/hour
  keyGenerator: req => req.user?.id || req.ip,
});

export const commentLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments/minute
  keyGenerator: req => req.user?.id || req.ip,
});

export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages/minute
  keyGenerator: req => req.user?.id || req.ip,
});

export const followLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 follows/hour
  keyGenerator: req => req.user?.id || req.ip,
});
```

#### Option B: Upstash (Serverless Redis)

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// server/src/middleware/upstashRateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const postRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'ratelimit:post',
});

// Express middleware wrapper
export const upstashMiddleware = (ratelimit: Ratelimit) => {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const identifier = req.user?.id || req.ip || 'anonymous';
    const { success, remaining } = await ratelimit.limit(identifier);

    res.setHeader('X-RateLimit-Remaining', remaining);

    if (!success) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
};
```

### IP/Device Fingerprinting

```typescript
// server/src/middleware/deviceFingerprint.ts
import { Request } from 'express';

export function getDeviceFingerprint(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const acceptLanguage = req.get('Accept-Language') || '';

  // Create a simple hash for fingerprinting
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}:${acceptLanguage}`)
    .digest('hex')
    .substring(0, 16);
}

// Log suspicious activity
export async function logSuspiciousActivity(
  userId: string | null,
  fingerprint: string,
  action: string,
  metadata: Record<string, any>
) {
  console.warn('[SECURITY] Suspicious activity:', {
    userId,
    fingerprint,
    action,
    metadata,
    timestamp: new Date().toISOString(),
  });

  // TODO: Store in database for pattern analysis
  // await prisma.securityLog.create({ data: { ... } });
}
```

---

## 2. Background Job Queue

### Current State ⚠️

| Component                 | Status    | Notes                               |
| ------------------------- | --------- | ----------------------------------- |
| Cron for game reminders   | ✅ Exists | `server/src/cron/game-reminders.ts` |
| Push notification sending | ⚠️ Inline | Blocks API response                 |
| Email sending             | ⚠️ Inline | Has timeout, but still blocks       |
| Media processing          | 🔴 None   | Cloudinary handles it, but no retry |
| Analytics fan-out         | 🔴 None   | No event queuing                    |

### Recommended: BullMQ + Redis

```bash
npm install bullmq ioredis
```

#### Queue Configuration

```typescript
// server/src/jobs/queues.ts
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Define queues
export const notificationQueue = new Queue('notifications', { connection });
export const emailQueue = new Queue('emails', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
export const mediaQueue = new Queue('media', { connection });

// Queue options for different priority levels
export const queueConfig = {
  notification: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
  email: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
  analytics: {
    attempts: 2,
    removeOnComplete: { count: 10000 },
    removeOnFail: { count: 1000 },
  },
};
```

#### Worker Scripts

```typescript
// server/src/jobs/workers/notificationWorker.ts
import { Worker, Job } from 'bullmq';
import { sendPushNotification } from '../../lib/notifications.js';

interface NotificationJob {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

const worker = new Worker<NotificationJob>(
  'notifications',
  async (job: Job<NotificationJob>) => {
    const { userId, title, body, data } = job.data;

    console.log(`[NotificationWorker] Processing job ${job.id} for user ${userId}`);

    await sendPushNotification(userId, title, body, data);

    return { success: true, processedAt: new Date().toISOString() };
  },
  {
    connection: new IORedis(process.env.REDIS_URL!),
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000, // 100 notifications per second
    },
  }
);

worker.on('completed', job => {
  console.log(`[NotificationWorker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
  // TODO: Send to Sentry
});

export { worker as notificationWorker };
```

```typescript
// server/src/jobs/workers/emailWorker.ts
import { Worker, Job } from 'bullmq';
import { sendEmail } from '../../lib/email.js';

interface EmailJob {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: Record<string, any>;
}

const worker = new Worker<EmailJob>(
  'emails',
  async (job: Job<EmailJob>) => {
    const { to, subject, text, html } = job.data;

    console.log(`[EmailWorker] Processing job ${job.id} to ${to}`);

    await sendEmail({ to, subject, text, html });

    return { success: true, processedAt: new Date().toISOString() };
  },
  {
    connection: new IORedis(process.env.REDIS_URL!),
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000, // 20 emails per second
    },
  }
);

export { worker as emailWorker };
```

#### Scheduled Jobs (Cron)

```typescript
// server/src/jobs/scheduler.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!);
const schedulerQueue = new Queue('scheduler', { connection });

// Add repeatable jobs
export async function setupScheduledJobs() {
  // Game reminders - every hour
  await schedulerQueue.add(
    'game-reminders',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // Every hour at minute 0
      removeOnComplete: true,
    }
  );

  // Daily digest emails - 8am UTC
  await schedulerQueue.add(
    'daily-digest',
    {},
    {
      repeat: { pattern: '0 8 * * *' },
      removeOnComplete: true,
    }
  );

  // Cleanup old notifications - daily at 3am
  await schedulerQueue.add(
    'cleanup-notifications',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      removeOnComplete: true,
    }
  );

  console.log('📅 Scheduled jobs configured');
}
```

### Alternative: Trigger.dev (Hosted)

For serverless deployment or simpler setup:

```bash
npm install @trigger.dev/sdk @trigger.dev/react
```

```typescript
// server/src/jobs/trigger.ts
import { TriggerClient, eventTrigger } from '@trigger.dev/sdk';

export const client = new TriggerClient({
  id: 'varsityhub',
  apiKey: process.env.TRIGGER_API_KEY!,
});

// Define job
client.defineJob({
  id: 'send-push-notification',
  name: 'Send Push Notification',
  version: '1.0.0',
  trigger: eventTrigger({
    name: 'notification.send',
  }),
  run: async (payload, io, ctx) => {
    const { userId, title, body, data } = payload;

    await io.runTask('send-notification', async () => {
      await sendPushNotification(userId, title, body, data);
    });
  },
});
```

---

## 3. Content Moderation & Reporting

### Current State ✅

| Component                | Status    | Notes                       |
| ------------------------ | --------- | --------------------------- |
| AbuseReport model        | ✅ Exists | Full schema in Prisma       |
| Support contact endpoint | ✅ Works  | `POST /support/contact`     |
| Admin reports dashboard  | ✅ Works  | `/admin/reports` with CRUD  |
| Bulk operations          | ✅ Works  | Bulk update/delete reports  |
| Admin activity logging   | ✅ Works  | All admin actions logged    |
| AI content filtering     | 🔴 None   | No automated moderation     |
| Post reporting           | 🔴 None   | Can't report specific posts |
| User reporting           | 🔴 None   | Can't report specific users |

### Gaps to Fill

#### 1. Post/User/Comment Reporting Endpoints

```typescript
// server/src/routes/reports.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const reportsRouter = Router();

// Report types
type ReportableType = 'post' | 'user' | 'comment' | 'message' | 'team';

interface ReportPayload {
  target_type: ReportableType;
  target_id: string;
  reason: string;
  details?: string;
}

// POST /reports - Create a new report
reportsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { target_type, target_id, reason, details } = req.body as ReportPayload;

  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate target exists
  let targetExists = false;
  let targetContext: any = {};

  switch (target_type) {
    case 'post':
      const post = await prisma.post.findUnique({
        where: { id: target_id },
        select: { id: true, author_id: true, content: true },
      });
      targetExists = !!post;
      targetContext = {
        post_author: post?.author_id,
        content_preview: post?.content?.substring(0, 100),
      };
      break;
    case 'user':
      const user = await prisma.user.findUnique({
        where: { id: target_id },
        select: { id: true, display_name: true, email: true },
      });
      targetExists = !!user;
      targetContext = { display_name: user?.display_name };
      break;
    case 'comment':
      const comment = await prisma.comment.findUnique({
        where: { id: target_id },
        select: { id: true, author_id: true, content: true },
      });
      targetExists = !!comment;
      targetContext = {
        comment_author: comment?.author_id,
        content_preview: comment?.content?.substring(0, 100),
      };
      break;
  }

  if (!targetExists) {
    return res.status(404).json({ error: `${target_type} not found` });
  }

  // Check for duplicate recent report
  const recentReport = await prisma.contentReport.findFirst({
    where: {
      reporter_id: req.user.id,
      target_type,
      target_id,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
  });

  if (recentReport) {
    return res.status(409).json({ error: 'You have already reported this content' });
  }

  const report = await prisma.contentReport.create({
    data: {
      reporter_id: req.user.id,
      target_type,
      target_id,
      reason,
      details,
      context: targetContext,
      status: 'pending',
    },
  });

  return res.status(201).json({ ok: true, reportId: report.id });
});

// GET /reports/my - Get user's submitted reports
reportsRouter.get('/my', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const reports = await prisma.contentReport.findMany({
    where: { reporter_id: req.user.id },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  return res.json({ reports });
});
```

#### 2. Content Report Schema Addition

```prisma
// Add to schema.prisma

model ContentReport {
  id          String   @id @default(cuid())
  reporter_id String
  target_type String   // post | user | comment | message | team
  target_id   String
  reason      String   // spam | harassment | hate_speech | inappropriate | other
  details     String?  @db.Text
  context     Json?    // Snapshot of content at report time
  status      String   @default("pending") // pending | reviewing | actioned | dismissed
  reviewed_by String?
  reviewed_at DateTime?
  action_taken String? // warned | content_removed | user_banned | none
  created_at  DateTime @default(now())

  reporter    User     @relation(fields: [reporter_id], references: [id], onDelete: Cascade)

  @@index([reporter_id])
  @@index([target_type, target_id])
  @@index([status])
  @@index([created_at])
}
```

#### 3. AI Content Moderation (Optional)

```typescript
// server/src/lib/moderation.ts
import * as Sentry from '@sentry/node';

interface ModerationResult {
  flagged: boolean;
  categories: string[];
  confidence: number;
  suggestedAction: 'allow' | 'review' | 'block';
}

// Option 1: Google Perspective API
export async function moderateWithPerspective(text: string): Promise<ModerationResult> {
  if (!process.env.PERSPECTIVE_API_KEY) {
    return { flagged: false, categories: [], confidence: 0, suggestedAction: 'allow' };
  }

  try {
    const response = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${process.env.PERSPECTIVE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text },
          languages: ['en'],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
          },
        }),
      }
    );

    const data = (await response.json()) as any;
    const scores = data.attributeScores;

    const flaggedCategories: string[] = [];
    let maxScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      const value = (score as any).summaryScore.value;
      if (value > 0.7) flaggedCategories.push(category);
      maxScore = Math.max(maxScore, value);
    }

    return {
      flagged: flaggedCategories.length > 0,
      categories: flaggedCategories,
      confidence: maxScore,
      suggestedAction: maxScore > 0.9 ? 'block' : maxScore > 0.7 ? 'review' : 'allow',
    };
  } catch (error) {
    Sentry.captureException(error);
    return { flagged: false, categories: [], confidence: 0, suggestedAction: 'allow' };
  }
}

// Option 2: OpenAI Moderation API (Free)
export async function moderateWithOpenAI(text: string): Promise<ModerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { flagged: false, categories: [], confidence: 0, suggestedAction: 'allow' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text }),
    });

    const data = (await response.json()) as any;
    const result = data.results[0];

    const flaggedCategories = Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);

    const maxScore = Math.max(...(Object.values(result.category_scores) as number[]));

    return {
      flagged: result.flagged,
      categories: flaggedCategories,
      confidence: maxScore,
      suggestedAction: result.flagged ? (maxScore > 0.9 ? 'block' : 'review') : 'allow',
    };
  } catch (error) {
    Sentry.captureException(error);
    return { flagged: false, categories: [], confidence: 0, suggestedAction: 'allow' };
  }
}

// Simple keyword filter (backup)
const BLOCKED_KEYWORDS = [
  // Add your list of blocked words/phrases
];

export function simpleKeywordFilter(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BLOCKED_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}
```

---

## 4. Search/Indexing

### Current State 🔴

No full-text search implementation exists. Users can only filter by exact matches or basic `LIKE` queries.

### Recommended: Meilisearch (Self-hosted) or Algolia (Managed)

#### Option A: Meilisearch

```bash
# Add to Railway as a service or run locally
docker run -d -p 7700:7700 getmeili/meilisearch
```

```typescript
// server/src/lib/search.ts
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_API_KEY,
});

// Index names
export const INDEXES = {
  USERS: 'users',
  TEAMS: 'teams',
  EVENTS: 'events',
  POSTS: 'posts',
};

// Initialize indexes with settings
export async function setupSearchIndexes() {
  // Users index
  const usersIndex = client.index(INDEXES.USERS);
  await usersIndex.updateSettings({
    searchableAttributes: ['display_name', 'username', 'bio'],
    filterableAttributes: ['id'],
    sortableAttributes: ['created_at'],
  });

  // Teams index
  const teamsIndex = client.index(INDEXES.TEAMS);
  await teamsIndex.updateSettings({
    searchableAttributes: ['name', 'description', 'sport', 'city', 'state'],
    filterableAttributes: ['sport', 'city', 'state', 'status'],
    sortableAttributes: ['created_at', 'name'],
  });

  // Events index
  const eventsIndex = client.index(INDEXES.EVENTS);
  await eventsIndex.updateSettings({
    searchableAttributes: ['title', 'description', 'location'],
    filterableAttributes: ['event_type', 'approval_status', 'date'],
    sortableAttributes: ['date', 'created_at'],
  });

  console.log('🔍 Search indexes configured');
}

// Sync functions
export async function indexUser(user: any) {
  await client.index(INDEXES.USERS).addDocuments([
    {
      id: user.id,
      display_name: user.display_name,
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at?.getTime(),
    },
  ]);
}

export async function indexTeam(team: any) {
  await client.index(INDEXES.TEAMS).addDocuments([
    {
      id: team.id,
      name: team.name,
      description: team.description,
      sport: team.sport,
      city: team.city,
      state: team.state,
      logo_url: team.logo_url,
      status: team.status,
      created_at: team.created_at?.getTime(),
    },
  ]);
}

// Search function
export async function search(
  index: string,
  query: string,
  options?: {
    filter?: string;
    limit?: number;
    offset?: number;
  }
) {
  return client.index(index).search(query, {
    filter: options?.filter,
    limit: options?.limit || 20,
    offset: options?.offset || 0,
  });
}
```

#### Option B: Algolia (Managed)

```bash
npm install algoliasearch
```

```typescript
// server/src/lib/algolia.ts
import algoliasearch from 'algoliasearch';

const client = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);

export const usersIndex = client.initIndex('users');
export const teamsIndex = client.initIndex('teams');
export const eventsIndex = client.initIndex('events');
```

---

## 5. Push Notifications & Delivery Monitoring

### Current State ⚠️

| Component         | Status   | Notes                             |
| ----------------- | -------- | --------------------------------- |
| Expo push helper  | ✅ Works | `server/src/lib/notifications.ts` |
| Token validation  | ✅ Works | `Expo.isExpoPushToken()` check    |
| Preference check  | ✅ Works | Respects `notifications_enabled`  |
| Delivery receipts | 🔴 None  | Tickets returned but not tracked  |
| Retry on failure  | 🔴 None  | Single attempt only               |
| Analytics         | 🔴 None  | No delivery metrics               |

### Enhanced Implementation

```typescript
// server/src/lib/notifications.ts - Enhanced version
import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { prisma } from './prisma.js';
import * as Sentry from '@sentry/node';

const expo = new Expo();

// Store for tracking tickets
const pendingTickets: Map<string, { userId: string; ticket: ExpoPushTicket; sentAt: Date }> =
  new Map();

/**
 * Send a push notification with delivery tracking
 */
export async function sendPushNotificationEnhanced(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const prefs = user.preferences as any;
    if (prefs?.notifications_enabled === false) {
      return { success: false, error: 'Notifications disabled' };
    }

    const pushToken = prefs?.push_token as string;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      return { success: false, error: 'Invalid push token' };
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: { ...data, sentAt: new Date().toISOString() },
      priority: 'high',
      channelId: 'default',
    };

    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];

    if (ticket.status === 'ok' && ticket.id) {
      // Store ticket for receipt checking
      pendingTickets.set(ticket.id, {
        userId,
        ticket,
        sentAt: new Date(),
      });

      // Log notification sent (for analytics)
      await logNotificationEvent(userId, 'sent', {
        ticketId: ticket.id,
        title,
        type: data?.type,
      });

      return { success: true, ticketId: ticket.id };
    } else if (ticket.status === 'error') {
      const error = ticket.message || 'Unknown error';

      // Handle specific errors
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Clear invalid token
        await prisma.user.update({
          where: { id: userId },
          data: {
            preferences: {
              ...(prefs || {}),
              push_token: null,
            },
          },
        });
      }

      await logNotificationEvent(userId, 'failed', { error, details: ticket.details });
      return { success: false, error };
    }

    return { success: false, error: 'Unknown ticket status' };
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Check delivery receipts for pending notifications
 * Should be called periodically (e.g., every 15 minutes)
 */
export async function checkDeliveryReceipts(): Promise<void> {
  const ticketIds = Array.from(pendingTickets.keys());

  if (ticketIds.length === 0) {
    return;
  }

  console.log(`[Notifications] Checking ${ticketIds.length} delivery receipts...`);

  try {
    const receiptChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

    for (const chunk of receiptChunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        const pending = pendingTickets.get(ticketId);
        if (!pending) continue;

        if (receipt.status === 'ok') {
          await logNotificationEvent(pending.userId, 'delivered', { ticketId });
        } else if (receipt.status === 'error') {
          await logNotificationEvent(pending.userId, 'delivery_failed', {
            ticketId,
            error: receipt.message,
            details: receipt.details,
          });

          // Handle DeviceNotRegistered
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const user = await prisma.user.findUnique({
              where: { id: pending.userId },
              select: { preferences: true },
            });

            if (user) {
              await prisma.user.update({
                where: { id: pending.userId },
                data: {
                  preferences: {
                    ...((user.preferences as any) || {}),
                    push_token: null,
                  },
                },
              });
            }
          }
        }

        pendingTickets.delete(ticketId);
      }
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('[Notifications] Receipt check failed:', error);
  }

  // Clean up old tickets (> 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const [ticketId, pending] of pendingTickets.entries()) {
    if (pending.sentAt < oneDayAgo) {
      pendingTickets.delete(ticketId);
    }
  }
}

/**
 * Log notification events for analytics
 */
async function logNotificationEvent(
  userId: string,
  event: 'sent' | 'delivered' | 'failed' | 'delivery_failed',
  metadata: Record<string, any>
): Promise<void> {
  // TODO: Store in analytics table or send to analytics service
  console.log(`[Notification Event] ${event} for user ${userId}:`, metadata);
}
```

---

## 6. Analytics/Metrics

### Current State 🔴

| Component        | Status   | Notes                      |
| ---------------- | -------- | -------------------------- |
| Sentry (errors)  | ✅ Works | Client + server configured |
| User analytics   | 🔴 None  | No event tracking          |
| Server metrics   | 🔴 None  | No Prometheus/Grafana      |
| Business metrics | 🔴 None  | No dashboards              |

### Client-Side: Mixpanel or Amplitude

```typescript
// utils/analytics.ts
import * as Sentry from '@sentry/react-native';

// Analytics events
type AnalyticsEvent =
  | { name: 'post_created'; properties: { hasMedia: boolean; hasGame: boolean } }
  | { name: 'post_viewed'; properties: { postId: string; source: string } }
  | { name: 'game_viewed'; properties: { gameId: string } }
  | { name: 'team_joined'; properties: { teamId: string; role: string } }
  | { name: 'message_sent'; properties: { isGroupChat: boolean } }
  | { name: 'ad_clicked'; properties: { adId: string } }
  | { name: 'checkout_started'; properties: { product: string; amount: number } }
  | { name: 'checkout_completed'; properties: { product: string; amount: number } };

class Analytics {
  private mixpanel: any = null;
  private userId: string | null = null;

  async init() {
    if (!process.env.EXPO_PUBLIC_MIXPANEL_TOKEN) {
      console.log('[Analytics] No Mixpanel token, analytics disabled');
      return;
    }

    try {
      const { Mixpanel } = await import('mixpanel-react-native');
      this.mixpanel = new Mixpanel(process.env.EXPO_PUBLIC_MIXPANEL_TOKEN, true);
      await this.mixpanel.init();
      console.log('[Analytics] Mixpanel initialized');
    } catch (error) {
      console.warn('[Analytics] Failed to initialize:', error);
    }
  }

  identify(userId: string, properties?: Record<string, any>) {
    this.userId = userId;

    if (this.mixpanel) {
      this.mixpanel.identify(userId);
      if (properties) {
        this.mixpanel.getPeople().set(properties);
      }
    }

    Sentry.setUser({ id: userId });
  }

  track<E extends AnalyticsEvent>(event: E['name'], properties: E['properties']) {
    if (this.mixpanel) {
      this.mixpanel.track(event, {
        ...properties,
        user_id: this.userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Also add as Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: event,
      data: properties,
      level: 'info',
    });
  }

  reset() {
    this.userId = null;
    if (this.mixpanel) {
      this.mixpanel.reset();
    }
    Sentry.setUser(null);
  }
}

export const analytics = new Analytics();
```

### Server-Side: Prometheus + Grafana

```typescript
// server/src/lib/metrics.ts
import promClient from 'prom-client';

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (memory, CPU, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10],
});
register.registerMetric(httpRequestDuration);

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
register.registerMetric(httpRequestTotal);

export const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active users in the last hour',
});
register.registerMetric(activeUsers);

export const pushNotificationsSent = new promClient.Counter({
  name: 'push_notifications_sent_total',
  help: 'Total push notifications sent',
  labelNames: ['status'],
});
register.registerMetric(pushNotificationsSent);

export const stripeTransactions = new promClient.Counter({
  name: 'stripe_transactions_total',
  help: 'Total Stripe transactions',
  labelNames: ['type', 'status'],
});
register.registerMetric(stripeTransactions);

// Metrics endpoint handler
export const metricsHandler = async (req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

// Middleware to track request duration
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';

    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);

    httpRequestTotal.inc({ method: req.method, route, status: res.statusCode });
  });

  next();
};
```

---

## 7. Security Scanning

### Current State ⚠️

| Component        | Status        | Notes                   |
| ---------------- | ------------- | ----------------------- |
| Helmet.js        | ✅ Enabled    | CSP disabled for dev    |
| CORS             | ✅ Configured | Origin whitelist in env |
| Input validation | ✅ Zod        | Most routes validated   |
| SQL injection    | ✅ Protected  | Prisma ORM              |
| Dependency audit | ⚠️ Manual     | No automation           |
| Secret scanning  | 🔴 None       | No automated checks     |

### Recommendations

#### 1. GitHub Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10

  - package-ecosystem: 'npm'
    directory: '/server'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
```

#### 2. GitHub Secret Scanning

Enable in repository settings: Settings → Security → Code security and analysis → Secret scanning

#### 3. Pre-commit Hooks

```bash
npm install -D husky lint-staged
npx husky install
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "git secrets --scan"]
  }
}
```

#### 4. Security Headers Audit

```bash
# Install security headers testing
npm install -D helmet-csp-header
```

```typescript
// Harden helmet config for production
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", process.env.API_URL, 'https://api.stripe.com'],
            },
          }
        : false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

## 8. Backup/Retention Policies

### Current State ⚠️

| Component        | Status     | Notes                     |
| ---------------- | ---------- | ------------------------- |
| Database backups | ⚠️ Railway | Automatic daily backups   |
| Media redundancy | 🔴 None    | Single Cloudinary storage |
| Log retention    | 🔴 None    | Logs not persisted        |
| Data export      | 🔴 None    | No GDPR export            |

### Recommendations

#### 1. Database Backup Verification

```bash
# Add to Railway cron or external scheduler
# Weekly backup verification
npx prisma db pull --force
```

#### 2. Media Backup to S3

```typescript
// server/src/jobs/workers/mediaBackup.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function backupMediaToS3(resourceId: string) {
  // Get from Cloudinary
  const result = await cloudinary.api.resource(resourceId);

  // Download and upload to S3
  const response = await fetch(result.secure_url);
  const buffer = Buffer.from(await response.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.BACKUP_BUCKET!,
      Key: `media/${resourceId}`,
      Body: buffer,
      ContentType: result.format,
    })
  );
}
```

#### 3. Log Retention

```typescript
// server/src/lib/logging.ts
import pino from 'pino';

// Production: Send to log aggregation service
const transport =
  process.env.NODE_ENV === 'production'
    ? pino.transport({
        target: 'pino-loki', // Or pino-datadog, pino-cloudwatch, etc.
        options: {
          host: process.env.LOKI_HOST,
          labels: { app: 'varsityhub-api' },
        },
      })
    : pino.transport({ target: 'pino-pretty' });

export const logger = pino(transport);
```

---

## 9. Error Triage Workflow

### Current State ⚠️

| Component          | Status     | Notes                                   |
| ------------------ | ---------- | --------------------------------------- |
| Sentry integration | ✅ Works   | Errors captured                         |
| ErrorBoundary      | ✅ Fixed   | Now sends to Sentry with componentStack |
| Slack alerts       | 🔴 None    | No real-time alerts                     |
| Severity SLAs      | 🔴 None    | No defined response times               |
| User context       | ⚠️ Partial | Basic user ID attached                  |

### Recommendations

#### 1. Sentry Alert Rules

Configure in Sentry Dashboard:

- **Critical**: Any error with > 100 occurrences in 1 hour → Slack + PagerDuty
- **High**: Payment-related errors → Immediate Slack
- **Medium**: Auth errors with > 50 occurrences → Daily digest

#### 2. Enhanced User Context

```typescript
// utils/sentry.ts - Enhanced context
import * as Sentry from '@sentry/react-native';

export function setUserContext(user: {
  id: string;
  email?: string;
  subscription_tier?: string;
  role?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    subscription: user.subscription_tier,
  });

  Sentry.setContext('user_profile', {
    role: user.role,
    subscription_tier: user.subscription_tier,
  });
}

export function addNavigationBreadcrumb(screen: string, params?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated to ${screen}`,
    data: params,
    level: 'info',
  });
}

export function trackApiCall(endpoint: string, method: string, status: number, duration: number) {
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${method} ${endpoint}`,
    data: { status, duration_ms: duration },
    level: status >= 400 ? 'error' : 'info',
  });
}
```

#### 3. Slack Integration

```typescript
// server/src/lib/alerts.ts
export async function sendSlackAlert(message: string, severity: 'critical' | 'high' | 'medium') {
  if (!process.env.SLACK_WEBHOOK_URL) return;

  const colors = {
    critical: '#FF0000',
    high: '#FF6600',
    medium: '#FFCC00',
  };

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [
        {
          color: colors[severity],
          title: `[${severity.toUpperCase()}] VarsityHub Alert`,
          text: message,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }),
  });
}
```

---

## 10. Sharing/Deep-Link Infrastructure

### Current State ⚠️

| Component           | Status   | Notes                  |
| ------------------- | -------- | ---------------------- |
| Native share        | ✅ Works | `utils/share.ts`       |
| Clipboard fallback  | ✅ Works | Web + native           |
| Universal links     | 🔴 None  | No deep linking        |
| Attribution         | 🔴 None  | No tracking            |
| App install banners | 🔴 None  | Web users not prompted |

### Recommendations

#### 1. Expo Linking Setup

```typescript
// app.json additions
{
  "expo": {
    "scheme": "varsityhub",
    "ios": {
      "associatedDomains": [
        "applinks:varsityhub.com",
        "applinks:www.varsityhub.com"
      ]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "varsityhub.com", "pathPrefix": "/share" },
            { "scheme": "https", "host": "www.varsityhub.com", "pathPrefix": "/share" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

#### 2. Deep Link Handler

```typescript
// utils/deepLinks.ts
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

export function parseDeepLink(
  url: string
): { screen: string; params: Record<string, string> } | null {
  try {
    const { hostname, path, queryParams } = Linking.parse(url);

    // Handle different link types
    if (path?.startsWith('/post/')) {
      const postId = path.split('/')[2];
      return { screen: '/post-detail', params: { id: postId } };
    }

    if (path?.startsWith('/game/')) {
      const gameId = path.split('/')[2];
      return { screen: '/game-detail', params: { id: gameId } };
    }

    if (path?.startsWith('/team/')) {
      const teamId = path.split('/')[2];
      return { screen: '/team-detail', params: { id: teamId } };
    }

    if (path?.startsWith('/profile/')) {
      const userId = path.split('/')[2];
      return { screen: '/public-profile', params: { id: userId } };
    }

    return null;
  } catch {
    return null;
  }
}

export function handleDeepLink(url: string) {
  const parsed = parseDeepLink(url);
  if (parsed) {
    router.push({ pathname: parsed.screen as any, params: parsed.params });
  }
}

// Setup listener
export function setupDeepLinkListener() {
  // Handle initial URL (app opened from link)
  Linking.getInitialURL().then(url => {
    if (url) handleDeepLink(url);
  });

  // Handle URL while app is open
  Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });
}
```

#### 3. Enhanced Share with Attribution

```typescript
// utils/share.ts - Enhanced version
import { Alert, Platform, Share } from 'react-native';
import { analytics } from './analytics';

interface ShareContent {
  type: 'post' | 'game' | 'team' | 'profile';
  id: string;
  title?: string;
  message?: string;
}

const BASE_URL = 'https://varsityhub.com/share';

export function generateShareUrl(content: ShareContent): string {
  const params = new URLSearchParams({
    type: content.type,
    id: content.id,
    utm_source: 'app_share',
    utm_medium: 'social',
  });

  return `${BASE_URL}?${params.toString()}`;
}

export async function shareContent(content: ShareContent): Promise<boolean> {
  const url = generateShareUrl(content);
  const message = content.message || `Check this out on VarsityHub: ${url}`;

  try {
    const result = await Share.share({
      message,
      url: Platform.OS === 'ios' ? url : undefined,
    });

    if (result.action === Share.sharedAction) {
      analytics.track('content_shared', {
        contentType: content.type,
        contentId: content.id,
        method: result.activityType || 'unknown',
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Share] Failed:', error);

    // Fallback to clipboard
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(url);
      Alert.alert('Link Copied', 'Share link copied to clipboard.');
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Implementation Priority

### Phase 1: Critical (Week 1)

1. ✅ Rate limiting middleware for posts, comments, messages
2. ✅ Content reporting endpoints
3. ✅ Enhanced push notification with delivery tracking

### Phase 2: High (Week 2-3)

1. BullMQ background job queue
2. Prometheus metrics endpoint
3. Slack error alerts
4. Deep-link handler

### Phase 3: Medium (Week 4-6)

1. Meilisearch or Algolia integration
2. Mixpanel/Amplitude client analytics
3. S3 media backup
4. AI content moderation (Perspective API)

### Phase 4: Low (Month 2+)

1. Branch.io/Firebase Dynamic Links
2. Grafana dashboards
3. GDPR data export
4. Log aggregation (Loki/Datadog)

---

## Environment Variables Needed

```bash
# Rate Limiting
REDIS_URL=redis://...
# or
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=...
# or
ALGOLIA_APP_ID=...
ALGOLIA_ADMIN_KEY=...
ALGOLIA_SEARCH_KEY=...

# Content Moderation
PERSPECTIVE_API_KEY=...
# or
OPENAI_API_KEY=...

# Analytics
EXPO_PUBLIC_MIXPANEL_TOKEN=...
# or
EXPO_PUBLIC_AMPLITUDE_API_KEY=...

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Backup
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
BACKUP_BUCKET=varsityhub-backups
```

---

_Document maintained by: VarsityHub Engineering_
_Last audit: November 30, 2025_
