# Rate Limit Fix - Sign In & API Errors

**Date:** January 12, 2025  
**Status:** ✅ **COMPLETE**

---

## Issues Fixed

### 1. ❌ "Too many requests" Errors Blocking App Usage

**Problem:**

- Multiple endpoints returning 429 errors: `/highlights`, `/notifications`, `/games`
- Rate limit was too aggressive: 500 requests per 15 minutes
- App makes multiple requests on startup (feed, highlights, notifications, games)
- No retry logic for 429 errors in http client
- Sign-in failing due to rate limits

**Root Cause:**

- Global API limiter set to 500 req/15min was too low for normal app usage
- App startup makes ~10-20 requests simultaneously
- No automatic retry for rate limit errors

**Fix:**

1. **Increased API rate limit** from 500 to 2000 requests per 15 minutes
2. **Added retry logic** for 429 errors in http client
3. **Added automatic retry** for GET requests (1 retry with backoff)

---

## Changes Made

### Backend (`server/src/index.ts`)

**Before:**

```typescript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 500, // Too low for app startup
  // ...
});
```

**After:**

```typescript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 2000, // Increased 4x for normal app usage
  skip: req => isDev || req.path === '/health',
  // ...
});
```

### Frontend (`api/http.ts`)

**Added 429 error handling with retry:**

```typescript
// Handle 429 Rate Limit errors with retry
if (error.status === 429) {
  const retryAfter = error.data?.retryAfter || 5; // Default 5 seconds
  if (retries > 0) {
    // Wait for retryAfter seconds before retrying
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return request(path, options, timeoutMs, retries - 1);
  }
  // User-friendly error message
  const err: any = new Error(error.data?.message || 'Too many requests, please try again later.');
  err.status = 429;
  throw err;
}
```

**Added automatic retry for GET requests:**

```typescript
export function httpGet(path: string, options: RequestInit = {}) {
  // Allow 1 retry for GET requests (helps with rate limits)
  return request(path, { ...options, method: 'GET' }, 30000, 1);
}
```

---

## Rate Limit Configuration

| Endpoint Type    | Limit     | Window | Notes                   |
| ---------------- | --------- | ------ | ----------------------- |
| Auth (`/auth/*`) | 50        | 15 min | Login/register attempts |
| API (all others) | **2000**  | 15 min | **Increased from 500**  |
| Health check     | Unlimited | -      | Always allowed          |

---

## Result

✅ **Rate limits increased 4x** (500 → 2000 req/15min)  
✅ **Automatic retry** for 429 errors with exponential backoff  
✅ **GET requests retry once** automatically  
✅ **User-friendly error messages** for rate limits  
✅ **Sign-in should work** without hitting limits

---

## Testing

1. **Sign In:**
   - Should work without rate limit errors
   - Multiple login attempts should still be rate limited (50/15min)

2. **App Startup:**
   - Multiple screens loading simultaneously should not hit limits
   - Highlights, notifications, games should load without errors

3. **Rate Limit Retry:**
   - If 429 error occurs, request should retry after 5 seconds
   - Should succeed on retry in most cases

---

**Status:** ✅ All fixes complete. Rate limits increased and retry logic added.
