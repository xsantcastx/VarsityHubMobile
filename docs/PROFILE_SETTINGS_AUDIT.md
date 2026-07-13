# Profile & Settings - Real-World Audit

**Date**: December 2024  
**Status**: 🟡 **ISSUES FOUND**

---

## Executive Summary

The profile and settings system has **several critical issues** that need fixing:

1. 🟠 **No username validation on profile update** - Can set invalid usernames
2. 🟠 **Username uniqueness not enforced** - Can create duplicate usernames
3. 🟠 **No validation error details** - Generic "Invalid payload" errors
4. 🟠 **Preferences merge can overwrite critical fields** - No protection for sensitive preferences
5. 🟡 **Account deletion doesn't clean up relationships** - Orphaned data
6. 🟡 **No rate limiting on profile updates** - Can spam updates
7. 🟡 **Avatar URL validation too lenient** - Can set invalid URLs

---

## Current Implementation

### What Works ✅

1. **Profile Updates**
   - `PUT /me` and `PATCH /me` endpoints exist
   - Basic validation for display_name, bio, avatar_url
   - Preferences merging works

2. **Settings/Preferences**
   - `PATCH /me/preferences` endpoint
   - Deep merge for nested notification preferences
   - Debouncing on frontend

3. **Profile Viewing**
   - `GET /me` returns current user
   - `GET /users/:id` returns public profile
   - Proper data sanitization (removes password_hash, etc.)

4. **Username Availability**
   - `GET /users/username-available` checks availability
   - Validates format and checks conflicts

---

## 🔴 CRITICAL ISSUES

### Issue #1: No Username Validation on Profile Update

**Problem**:

- `PUT /me` and `PATCH /me` don't validate or update username
- Username can only be set during onboarding
- No way to change username after account creation

**Location**: `server/src/routes/auth.ts:492-513`

**Current Code**:

```typescript
const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  preferences: z.any().optional(),
  // ❌ username is missing!
});
```

**Real-World Impact**:

- **User frustration** - Can't change username after creation
- **No way to fix typos** - Must create new account
- **Poor UX** - Username is important for identity

**Fix Required**:

```typescript
const updateMeSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_.]+$/)
    .optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  preferences: z.any().optional(),
});

// In PUT/PATCH /me handler:
if (data.username) {
  // Check availability
  const exists = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: data.username, mode: 'insensitive' } },
        { display_name: { equals: data.username, mode: 'insensitive' } },
      ],
      NOT: { id: req.user.id },
    },
  });
  if (exists) {
    return res.status(400).json({
      error: 'Username taken',
      message: 'This username is already in use.',
    });
  }
  patch.username = data.username;
}
```

---

### Issue #2: Username Uniqueness Not Enforced at Database Level

**Problem**:

- Schema comment says "Will add unique constraint later"
- No unique constraint on username field
- Race conditions possible when setting username

**Location**: `server/prisma/schema.prisma:21`

**Current**:

```prisma
username String? // Will add unique constraint later after data migration
```

**Real-World Impact**:

- **Data integrity** - Duplicate usernames possible
- **Race conditions** - Two users can set same username simultaneously
- **Confusion** - Can't reliably identify users by username

**Fix Required**:

```prisma
username String? @unique // Add unique constraint
```

**Note**: Requires data migration to clean up existing duplicates first.

---

### Issue #3: No Validation Error Details

**Problem**:

- Validation errors return generic "Invalid payload"
- No details about which field failed or why
- Hard to debug for users and developers

**Location**: `server/src/routes/auth.ts:501-502, 518-519`

**Current Code**:

```typescript
const parsed = updateMeSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
// ❌ No details about what failed
```

**Real-World Impact**:

- **Poor UX** - Users don't know what to fix
- **Developer frustration** - Hard to debug issues
- **Inconsistent** - Other endpoints return detailed errors

**Fix Required**:

```typescript
if (!parsed.success) {
  return res.status(400).json({
    error: 'Invalid payload',
    issues: parsed.error.issues.map(i => ({
      path: i.path,
      message: i.message,
    })),
  });
}
```

---

### Issue #4: Preferences Merge Can Overwrite Critical Fields

**Problem**:

- `mergePreferences` does shallow merge for most fields
- Can accidentally overwrite critical preferences
- No validation of preference values

**Location**: `server/src/routes/auth.ts:533-539`

**Current Code**:

```typescript
function mergePreferences(base: any, incoming: any) {
  const out = { ...(base || {}), ...(incoming || {}) };
  if (base?.notifications || incoming?.notifications) {
    out.notifications = { ...(base?.notifications || {}), ...(incoming?.notifications || {}) };
  }
  return out;
  // ❌ Shallow merge - can overwrite nested objects
}
```

**Real-World Impact**:

- **Data loss** - Can accidentally clear preferences
- **Security** - Could overwrite sensitive settings
- **Bugs** - Unexpected behavior from partial updates

**Fix Required**:

```typescript
function mergePreferences(base: any, incoming: any) {
  if (!base && !incoming) return {};
  if (!base) return incoming;
  if (!incoming) return base;

  const out = { ...base };

  // Deep merge for nested objects
  for (const key in incoming) {
    if (incoming[key] === null || incoming[key] === undefined) {
      // Explicit null/undefined means remove
      delete out[key];
    } else if (
      typeof incoming[key] === 'object' &&
      !Array.isArray(incoming[key]) &&
      incoming[key] !== null
    ) {
      // Deep merge objects
      out[key] = mergePreferences(base[key], incoming[key]);
    } else {
      // Overwrite primitives and arrays
      out[key] = incoming[key];
    }
  }

  return out;
}
```

---

### Issue #5: Account Deletion Doesn't Clean Up Relationships

**Problem**:

- Soft delete only sets `banned: true` and clears some fields
- Doesn't clean up posts, comments, follows, etc.
- Orphaned data remains in database

**Location**: `server/src/routes/users.ts:239-259`

**Current Code**:

```typescript
await prisma.user.update({
  where: { id },
  data: {
    banned: true,
    email: deletedEmail,
    password_hash: `deleted:${ts}:${Math.random().toString(36).slice(2)}`,
    display_name: null,
    avatar_url: null,
    bio: null,
    // ❌ Doesn't clean up relationships
  },
});
```

**Real-World Impact**:

- **Data bloat** - Orphaned records accumulate
- **Privacy concerns** - User data remains accessible
- **GDPR compliance** - May violate data deletion requirements

**Fix Required**:

```typescript
// Option 1: Hard delete (if no legal requirements to keep data)
await prisma.$transaction(async tx => {
  // Delete in order (respect foreign key constraints)
  await tx.postUpvote.deleteMany({ where: { user_id: id } });
  await tx.postBookmark.deleteMany({ where: { user_id: id } });
  await tx.comment.deleteMany({ where: { author_id: id } });
  await tx.post.deleteMany({ where: { author_id: id } });
  await tx.follows.deleteMany({ where: { OR: [{ follower_id: id }, { following_id: id }] } });
  await tx.user.delete({ where: { id } });
});

// Option 2: Soft delete with anonymization (if legal requirements exist)
await prisma.user.update({
  where: { id },
  data: {
    banned: true,
    email: deletedEmail,
    password_hash: `deleted:${ts}`,
    display_name: null,
    avatar_url: null,
    bio: null,
    preferences: {}, // Clear preferences
  },
});
// Then anonymize related records
await prisma.post.updateMany({
  where: { author_id: id },
  data: { author_id: null }, // Or set to system user
});
```

---

## 🟠 HIGH PRIORITY ISSUES

### Issue #6: No Rate Limiting on Profile Updates

**Problem**:

- No rate limiting on `PUT /me` or `PATCH /me`
- Can spam profile updates
- Potential for abuse or accidental loops

**Location**: `server/src/routes/auth.ts:499-530`

**Real-World Impact**:

- **Performance** - Can overload database
- **Abuse** - Malicious users can spam updates
- **Costs** - Unnecessary database writes

**Fix Required**:

```typescript
import { rateLimiters } from '../middleware/rateLimiters.js';

// Add rate limiting middleware
authRouter.put('/me', rateLimiters.profileUpdate, async (req: AuthedRequest, res) => {
  // ... existing code
});
```

---

### Issue #7: Avatar URL Validation Too Lenient

**Problem**:

- Only checks if URL is valid format
- Doesn't validate domain, protocol, or content type
- Can set malicious or invalid URLs

**Location**: `server/src/routes/auth.ts:494`

**Current Code**:

```typescript
avatar_url: z.string().url().optional(),
// ❌ No domain validation, no content type check
```

**Real-World Impact**:

- **Security** - Can set malicious URLs
- **UX** - Invalid URLs break images
- **Performance** - Can set URLs to slow/unavailable servers

**Fix Required**:

```typescript
avatar_url: z.string()
  .url()
  .refine((url) => {
    try {
      const parsed = new URL(url);
      // Only allow https
      if (parsed.protocol !== 'https:') return false;
      // Allow specific domains (Cloudinary, etc.)
      const allowedDomains = ['res.cloudinary.com', 'varsityhub.app'];
      return allowedDomains.some(d => parsed.hostname.endsWith(d));
    } catch {
      return false;
    }
  }, { message: 'Avatar URL must be from an allowed domain' })
  .optional(),
```

---

### Issue #8: Bio Validation Allows Empty Strings

**Problem**:

- Bio can be set to empty string `""`
- Should allow `null` or require minimum length
- Empty strings are different from null

**Location**: `server/src/routes/auth.ts:495`

**Current Code**:

```typescript
bio: z.string().max(1000).optional(),
// ❌ Allows empty string
```

**Real-World Impact**:

- **Data inconsistency** - Empty string vs null confusion
- **Display issues** - Empty string might show differently than null

**Fix Required**:

```typescript
bio: z.string().min(1).max(1000).optional().nullable(),
// Or transform empty strings to null
bio: z.string().max(1000).transform(val => val === '' ? null : val).optional().nullable(),
```

---

### Issue #9: No Validation of Preference Values

**Problem**:

- Preferences schema allows `z.any().optional()`
- No validation of preference structure
- Can set invalid preference values

**Location**: `server/src/routes/auth.ts:496, 542-568`

**Current Code**:

```typescript
preferences: z.any().optional(), // ❌ No validation
```

**Real-World Impact**:

- **Data corruption** - Invalid preference values
- **Bugs** - Unexpected behavior from invalid data
- **Security** - Could inject malicious data

**Fix Required**:

```typescript
// Create strict preference schema
const preferencesSchema = z.object({
  notifications: z.object({
    game_event_reminders: z.boolean().optional(),
    team_updates: z.boolean().optional(),
    comments_upvotes: z.boolean().optional(),
  }).optional(),
  // ... other known preference fields
}).passthrough(); // Allow unknown fields but validate known ones

preferences: preferencesSchema.optional(),
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue #10: Display Name Can Be Set to Empty String

**Problem**:

- Display name validation allows empty string after trim
- Should require minimum length or allow null

**Location**: `server/src/routes/auth.ts:493`

**Current Code**:

```typescript
display_name: z.string().min(1).max(120).optional(),
// ✅ This is actually correct - min(1) prevents empty
// But should handle whitespace-only strings
```

**Fix Required**:

```typescript
display_name: z.string()
  .min(1)
  .max(120)
  .refine((val) => val.trim().length > 0, { message: 'Display name cannot be only whitespace' })
  .optional(),
```

---

### Issue #11: No Username Format Validation on Update

**Problem**:

- Username availability check validates format
- But update endpoint doesn't validate format
- Can bypass validation

**Location**: `server/src/routes/auth.ts:492-513`

**Fix Required**: Add username validation to update schema (see Issue #1).

---

### Issue #12: Preferences Defaults Applied on Every Update

**Problem**:

- `PATCH /me/preferences` applies defaults on every update
- Can overwrite user's actual preferences with defaults
- Should only apply defaults on first set

**Location**: `server/src/routes/auth.ts:574-588`

**Current Code**:

```typescript
const defaults = {
  /* ... */
};
const merged = mergePreferences(defaults, mergePreferences(current?.preferences || {}, incoming));
// ❌ Always applies defaults, even if user has set preferences
```

**Fix Required**:

```typescript
// Only apply defaults if preferences are empty
const currentPrefs = current?.preferences || {};
const hasPreferences = Object.keys(currentPrefs).length > 0;
const base = hasPreferences ? currentPrefs : defaults;
const merged = mergePreferences(base, incoming);
```

---

## 📊 Testing Scenarios

### Test 1: Update Username (Currently Fails)

```bash
PATCH /me { username: "newusername" }
# Currently: Username not in schema, ignored
# Should: Update username if available
```

### Test 2: Set Duplicate Username

```bash
# User A sets username to "test"
PATCH /me { username: "test" }
# User B tries to set same username
PATCH /me { username: "test" }
# Currently: No validation, both can have same username
# Should: Return 400 "Username taken"
```

### Test 3: Invalid Bio

```bash
PATCH /me { bio: "x".repeat(1001) }
# Currently: Returns generic "Invalid payload"
# Should: Return detailed error with field and message
```

### Test 4: Account Deletion

```bash
DELETE /users/me
# Currently: Soft delete, relationships remain
# Should: Clean up or anonymize relationships
```

### Test 5: Preferences Merge

```bash
# User has: { notifications: { game_event_reminders: true } }
PATCH /me/preferences { notifications: { team_updates: true } }
# Currently: Should merge correctly
# Should: Result in { notifications: { game_event_reminders: true, team_updates: true } }
```

---

## Summary of Required Fixes

### Critical (Must Fix)

1. ✅ **Add username to profile update schema** - Allow username changes
2. ✅ **Add username uniqueness validation** - Check availability before update
3. ✅ **Add detailed validation errors** - Return field-level errors
4. ✅ **Fix preferences merge logic** - Deep merge, don't overwrite
5. ✅ **Improve account deletion** - Clean up or anonymize relationships

### High Priority (Should Fix)

6. ✅ **Add rate limiting** - Prevent spam updates
7. ✅ **Strengthen avatar URL validation** - Domain and protocol checks
8. ✅ **Fix bio validation** - Handle empty strings properly
9. ✅ **Validate preference values** - Use strict schema

### Medium Priority (Nice to Have)

10. ✅ **Handle whitespace-only display names** - Trim and validate
11. ✅ **Fix preferences defaults** - Only apply on first set
12. ✅ **Add username format validation** - Consistent validation

---

## Files to Modify

1. `server/src/routes/auth.ts` - Add username validation, fix error responses, improve preferences merge
2. `server/prisma/schema.prisma` - Add unique constraint to username (requires migration)
3. `server/src/middleware/rateLimiters.ts` - Add profile update rate limiter
4. `server/src/routes/users.ts` - Improve account deletion

---

**Status**: 🟡 **REQUIRES FIXES**  
**Priority**: **HIGH** - These issues affect user experience, data integrity, and security
