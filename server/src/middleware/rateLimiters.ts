/**
 * Rate Limiting Middleware for VarsityHub API
 *
 * Provides per-route rate limiting to prevent spam and abuse.
 * Uses express-rate-limit with Redis store for production scalability.
 * Falls back to memory store if Redis is unavailable.
 *
 * @module middleware/rateLimiters
 */

import type { Request, Response } from 'express';
import rateLimit, { Options, Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { debugLog } from '../lib/debugLog.js';

/**
 * Check if we're in development mode
 * In dev mode, rate limits are disabled for easier testing
 */
const isDev = process.env.NODE_ENV !== 'production' || process.env.RATE_LIMIT_DISABLE === '1';

/**
 * Create a separate Redis connection for rate limiting only
 * This prevents connection pool exhaustion when queues are also using Redis
 */
let rateLimitRedis: any = null;
let redisStore: Store | undefined;

async function initializeRateLimitRedis() {
  if (isDev || rateLimitRedis) return;
  
  try {
    const REDIS_URL = process.env.REDIS_URL;
    if (!REDIS_URL) {
      debugLog('⚠️ REDIS_URL not set, rate limiter will use memory store');
      return;
    }
    
    // Import Redis using CommonJS style (same as queue.ts)
    const RedisModule = await import('ioredis');
    const Redis = RedisModule.default;
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    
    rateLimitRedis = new RedisCtor(REDIS_URL, {
      maxRetriesPerRequest: null, // Disable retry limit
      enableReadyCheck: false,
      enableOfflineQueue: true,
    });

    redisStore = new RedisStore({
      sendCommand: (...args: string[]) => rateLimitRedis.call(...(args as [string, ...string[]])),
      prefix: 'rl:', // rate limit prefix
    });
    debugLog('✅ Rate limiter using dedicated Redis connection (isolated from queues)');
  } catch (error) {
    console.warn('⚠️ Failed to initialize Redis for rate limiting, using memory store:', error);
    rateLimitRedis = null;
    redisStore = undefined;
  }
}

// Initialize rate limit Redis on module load
initializeRateLimitRedis().catch((err) => {
  console.error('[RateLimit] Failed to initialize Redis:', err);
});

/**
 * Get user identifier for rate limiting
 * Prefers user ID if authenticated, falls back to IP
 */
function getUserIdentifier(req: Request): string {
  const user = (req as any).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Create a rate limiter with sensible defaults
 * Uses Redis store in production for multi-instance scalability
 */
function createLimiter(options: Partial<Options> & { name: string }): ReturnType<typeof rateLimit> {
  const { name, ...restOptions } = options;

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute default
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    keyGenerator: getUserIdentifier,
    // Use Redis store in production if available
    ...(redisStore && !isDev ? { store: redisStore } : {}),
    handler: (req: Request, res: Response) => {
      console.warn(`[RateLimit] ${name}: User ${getUserIdentifier(req)} exceeded limit`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please slow down and try again later',
        retryAfter: Math.ceil((restOptions.windowMs || 60000) / 1000),
      });
    },
    ...restOptions,
  });
}

// ============================================
// Authentication Rate Limiters
// ============================================

/**
 * Login/Register attempts
 * Strict limit: 10 attempts per 15 minutes per IP
 */
export const authLimiter = createLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 20,
  keyGenerator: (req) => `ip:${req.ip}`, // Always use IP for auth
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

/**
 * Password reset requests
 * 5 requests per hour per email/IP
 */
export const passwordResetLimiter = createLimiter({
  name: 'password-reset',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 5,
  keyGenerator: (req) => `ip:${req.ip}`,
});

/**
 * Token refresh attempts
 * 30 per 15 minutes per IP to prevent brute-force
 */
export const refreshTokenLimiter = createLimiter({
  name: 'refresh-token',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 30,
  keyGenerator: (req) => `ip:${req.ip}`,
});

/**
 * Email/SMS verification requests
 * 5 per hour per user, 1 per 30 seconds minimum
 */
export const verificationLimiter = createLimiter({
  name: 'verification',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 10,
});

// ============================================
// Content Creation Rate Limiters
// ============================================

/**
 * Post creation
 * 20 posts per hour per user
 */
export const postCreationLimiter = createLimiter({
  name: 'post-creation',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 20,
});

/**
 * Comment creation
 * 30 comments per 5 minutes per user
 */
export const commentLimiter = createLimiter({
  name: 'comment',
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDev ? 100000 : 30,
});

/**
 * Direct message sending
 * 60 messages per minute per user (allows for active conversations)
 */
export const messageLimiter = createLimiter({
  name: 'message',
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100000 : 60,
});

/**
 * Group chat message sending
 * 30 messages per minute per user
 */
export const groupMessageLimiter = createLimiter({
  name: 'group-message',
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100000 : 30,
});

// ============================================
// Interaction Rate Limiters
// ============================================

/**
 * Follow/Unfollow actions
 * 100 per hour (prevents mass following)
 */
export const followLimiter = createLimiter({
  name: 'follow',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 100,
});

/**
 * Upvote/Bookmark actions
 * 200 per hour (allows for feed scrolling)
 */
export const interactionLimiter = createLimiter({
  name: 'interaction',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 200,
});

/**
 * Report/Support submissions
 * 10 per hour per user
 */
export const reportLimiter = createLimiter({
  name: 'report',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 10,
});

// ============================================
// Resource Creation Rate Limiters
// ============================================

/**
 * Team/Organization creation
 * 5 per day per user
 */
export const teamCreationLimiter = createLimiter({
  name: 'team-creation',
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: isDev ? 100000 : 5,
});

/**
 * Event creation
 * 10 per hour per user
 */
export const eventCreationLimiter = createLimiter({
  name: 'event-creation',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 20,
});

/**
 * Game creation
 * 40 per hour per user
 */
export const gameCreationLimiter = createLimiter({
  name: 'game-creation',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 40,
});

/**
 * Invite sending
 * 50 per hour per user
 */
export const inviteLimiter = createLimiter({
  name: 'invite',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 50,
});

// ============================================
// Upload Rate Limiters
// ============================================

/**
 * File uploads
 * 30 per hour per user
 */
export const uploadLimiter = createLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 30,
});

// ============================================
// RSVP Rate Limiters
// ============================================

/**
 * RSVP actions
 * 50 per hour per user
 */
export const rsvpLimiter = createLimiter({
  name: 'rsvp',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 50,
});

// ============================================
// Voting Rate Limiters
// ============================================

/**
 * Game vote actions
 * 100 per hour per user
 */
export const voteLimiter = createLimiter({
  name: 'vote',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 100,
});

// ============================================
// Ad/Payment Rate Limiters
// ============================================

/**
 * Ad creation
 * 10 per day per user
 */
export const adCreationLimiter = createLimiter({
  name: 'ad-creation',
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: isDev ? 100000 : 10,
});

/**
 * Payment/Checkout attempts
 * 10 per hour per user
 */
export const paymentLimiter = createLimiter({
  name: 'payment',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 10,
});

/**
 * User lookup by email
 * 10 per minute per user (prevents email enumeration)
 */
export const userLookupLimiter = createLimiter({
  name: 'user-lookup',
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100000 : 10,
});

/**
 * Mentions search
 * 30 per minute per user (prevents directory scraping)
 */
export const mentionsSearchLimiter = createLimiter({
  name: 'mentions-search',
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100000 : 30,
});

// ============================================
// Export all limiters for easy application
// ============================================

export const rateLimiters = {
  auth: authLimiter,
  passwordReset: passwordResetLimiter,
  verification: verificationLimiter,
  postCreation: postCreationLimiter,
  comment: commentLimiter,
  message: messageLimiter,
  groupMessage: groupMessageLimiter,
  follow: followLimiter,
  interaction: interactionLimiter,
  report: reportLimiter,
  teamCreation: teamCreationLimiter,
  eventCreation: eventCreationLimiter,
  gameCreation: gameCreationLimiter,
  invite: inviteLimiter,
  upload: uploadLimiter,
  rsvp: rsvpLimiter,
  vote: voteLimiter,
  adCreation: adCreationLimiter,
  payment: paymentLimiter,
  userLookup: userLookupLimiter,
  mentionsSearch: mentionsSearchLimiter,
};

export default rateLimiters;
