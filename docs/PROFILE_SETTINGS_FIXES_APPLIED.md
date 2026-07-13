# Profile & Settings - Fixes Applied

**Date**: December 2024  
**Status**: ✅ **CRITICAL FIXES APPLIED**

---

## Summary

Fixed **critical real-world issues** in the profile and settings system that would have caused problems in production.

---

## ✅ FIXES APPLIED

### 1. ✅ Username Support in Profile Updates (CRITICAL)

**Problem**:

- Username could not be updated after account creation
- No way to change username or fix typos
- Poor user experience

**Real-World Impact**:

- **User frustration** - Can't change username after creation
- **No way to fix typos** - Must create new account
- **Poor UX** - Username is important for identity

**Fix Applied**:

- Added `username` field to `updateMeSchema` with proper validation
- Added username availability check before update
- Validates format: lowercase letters, numbers, dots, underscores only
- Checks for conflicts with both `username` and `display_name` fields

**Location**: `server/src/routes/auth.ts:492-513`

**Code**:

```typescript
username: z.string()
  .min(3).max(20)
  .regex(/^[a-z0-9_.]+$/, {
    message: 'Username can only contain lowercase letters, numbers, dots, and underscores'
  })
  .optional(),

// In PUT/PATCH /me handler:
if (data.username) {
  const exists = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: data.username, mode: 'insensitive' } },
        { display_name: { equals: data.username, mode: 'insensitive' } }
      ],
      NOT: { id: req.user.id }
    }
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

### 2. ✅ Detailed Validation Error Responses (CRITICAL)

**Problem**:

- Validation errors returned generic "Invalid payload"
- No details about which field failed or why
- Hard to debug for users and developers

**Real-World Impact**:

- **Poor UX** - Users don't know what to fix
- **Developer frustration** - Hard to debug issues
- **Inconsistent** - Other endpoints return detailed errors

**Fix Applied**:

- Changed all validation error responses to include detailed `issues` array
- Each issue includes `path` and `message` for debugging
- Consistent with other endpoints (events, posts, etc.)

**Location**: `server/src/routes/auth.ts:499-513, 516-530, 570-576`

**Code**:

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

### 3. ✅ Improved Preferences Merge Logic (CRITICAL)

**Problem**:

- Shallow merge could overwrite nested preferences
- Could accidentally clear user preferences
- No proper deep merge for nested objects

**Real-World Impact**:

- **Data loss** - Can accidentally clear preferences
- **Security** - Could overwrite sensitive settings
- **Bugs** - Unexpected behavior from partial updates

**Fix Applied**:

- Implemented proper deep merge for nested objects
- Handles null/undefined values correctly
- Preserves existing preferences when updating nested fields
- Only overwrites primitives and arrays (as expected)

**Location**: `server/src/routes/auth.ts:532-559`

**Code**:

```typescript
function mergePreferences(base: any, incoming: any) {
  if (!base && !incoming) return {};
  if (!base) return incoming;
  if (!incoming) return base;

  const out = { ...base };

  // Deep merge for nested objects
  for (const key in incoming) {
    if (incoming[key] === null || incoming[key] === undefined) {
      // Explicit null/undefined means remove (for optional fields)
      if (incoming[key] === null && key in incoming) {
        delete out[key];
      }
    } else if (
      typeof incoming[key] === 'object' &&
      !Array.isArray(incoming[key]) &&
      incoming[key] !== null &&
      incoming[key].constructor === Object
    ) {
      // Deep merge objects (but not arrays or special objects like Date)
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

### 4. ✅ Enhanced Avatar URL Validation (HIGH PRIORITY)

**Problem**:

- Only checked if URL was valid format
- Didn't validate domain, protocol, or content type
- Could set malicious or invalid URLs

**Real-World Impact**:

- **Security** - Can set malicious URLs
- **UX** - Invalid URLs break images
- **Performance** - Can set URLs to slow/unavailable servers

**Fix Applied**:

- Added protocol validation (only HTTPS allowed)
- Added domain whitelist (Cloudinary, VarsityHub CDN)
- Clear error messages for validation failures

**Location**: `server/src/routes/auth.ts:494-503`

**Code**:

```typescript
avatar_url: z.string()
  .url({ message: 'Avatar URL must be a valid URL' })
  .refine((url) => {
    try {
      const parsed = new URL(url);
      // Only allow https
      if (parsed.protocol !== 'https:') return false;
      // Allow specific domains
      const allowedDomains = ['res.cloudinary.com', 'varsityhub.app', 'cdn.varsityhub.app'];
      return allowedDomains.some(d => parsed.hostname.endsWith(d));
    } catch {
      return false;
    }
  }, { message: 'Avatar URL must be from an allowed domain (Cloudinary or VarsityHub CDN)' })
  .optional()
  .nullable(),
```

---

### 5. ✅ Improved Bio Validation (HIGH PRIORITY)

**Problem**:

- Bio could be set to empty string `""`
- Should allow `null` or require minimum length
- Empty strings are different from null

**Real-World Impact**:

- **Data inconsistency** - Empty string vs null confusion
- **Display issues** - Empty string might show differently than null

**Fix Applied**:

- Transform empty strings to `null` automatically
- Maintains backward compatibility
- Cleaner data model

**Location**: `server/src/routes/auth.ts:504`

**Code**:

```typescript
bio: z.string()
  .max(1000)
  .transform((val) => val === '' ? null : val)
  .optional()
  .nullable(),
```

---

### 6. ✅ Enhanced Display Name Validation (MEDIUM)

**Problem**:

- Display name could be set to whitespace-only strings
- Should trim and validate

**Fix Applied**:

- Added refinement to check trimmed length
- Prevents whitespace-only display names

**Location**: `server/src/routes/auth.ts:493`

**Code**:

```typescript
display_name: z.string()
  .min(1)
  .max(120)
  .refine((val) => val.trim().length > 0, {
    message: 'Display name cannot be only whitespace'
  })
  .optional(),
```

---

### 7. ✅ Improved Account Deletion (CRITICAL)

**Problem**:

- Soft delete only set `banned: true` and cleared some fields
- Didn't clean up relationships (follows, upvotes, bookmarks, comments)
- Orphaned data remained in database

**Real-World Impact**:

- **Data bloat** - Orphaned records accumulate
- **Privacy concerns** - User data remains accessible
- **GDPR compliance** - May violate data deletion requirements

**Fix Applied**:

- Use transaction to ensure atomicity
- Anonymize user data (clear username, preferences)
- Remove follows (both directions)
- Remove upvotes and bookmarks
- Delete comments (or can be changed to anonymize)
- Better error handling

**Location**: `server/src/routes/users.ts:239-280`

**Code**:

```typescript
await prisma.$transaction(async tx => {
  // Anonymize user data
  await tx.user.update({
    where: { id },
    data: {
      banned: true,
      email: deletedEmail,
      password_hash: `deleted:${ts}:...`,
      display_name: null,
      username: null, // Also clear username
      avatar_url: null,
      bio: null,
      preferences: {}, // Clear preferences
    },
  });

  // Remove follows
  await tx.follows.deleteMany({
    where: {
      OR: [{ follower_id: id }, { following_id: id }],
    },
  });

  // Remove interactions
  await tx.postUpvote.deleteMany({ where: { user_id: id } });
  await tx.postBookmark.deleteMany({ where: { user_id: id } });

  // Delete comments
  await tx.comment.deleteMany({ where: { author_id: id } });
});
```

---

## 📋 Remaining Recommendations

### High Priority (Should Implement)

1. **Add Username Unique Constraint**
   - Add `@unique` to username in Prisma schema
   - Requires data migration to clean up duplicates first
   - Prevents race conditions at database level

2. **Add Rate Limiting**
   - Add rate limiter for profile updates
   - Prevent spam updates
   - Use existing `rateLimiters` infrastructure

3. **Strict Preference Schema**
   - Replace `z.any()` with strict schema
   - Validate known preference fields
   - Prevent invalid data

### Medium Priority (Nice to Have)

4. **Preferences Defaults Logic**
   - Only apply defaults on first set
   - Don't overwrite existing preferences with defaults

5. **Account Deletion Options**
   - Consider hard delete vs soft delete
   - Add option to anonymize vs delete posts
   - Better GDPR compliance

---

## Testing Scenarios

### Test 1: Update Username

```bash
PATCH /me { username: "newusername" }
# Should: Update username if available
# Should: Return 400 if username taken
```

### Test 2: Invalid Avatar URL

```bash
PATCH /me { avatar_url: "http://evil.com/image.jpg" }
# Should: Return 400 with detailed error
# Should: Only allow HTTPS from allowed domains
```

### Test 3: Preferences Merge

```bash
# User has: { notifications: { game_event_reminders: true } }
PATCH /me/preferences { notifications: { team_updates: true } }
# Should: Result in { notifications: { game_event_reminders: true, team_updates: true } }
# Should: Not overwrite existing notification settings
```

### Test 4: Account Deletion

```bash
DELETE /users/me
# Should: Anonymize user data
# Should: Remove follows and interactions
# Should: Delete comments
# Should: Return success message
```

### Test 5: Validation Errors

```bash
PATCH /me { bio: "x".repeat(1001) }
# Should: Return 400 with detailed error
# Should: Include field path and message
```

---

## Files Modified

1. `server/src/routes/auth.ts` - All fixes applied
2. `server/src/routes/users.ts` - Account deletion improvements
3. `docs/PROFILE_SETTINGS_AUDIT.md` - Audit report
4. `docs/PROFILE_SETTINGS_FIXES_APPLIED.md` - This file

---

## Verification

- ✅ All linter checks pass
- ✅ TypeScript compilation succeeds
- ✅ No breaking changes to API contracts
- ✅ Backward compatible (except improved validation)

---

## Conclusion

The profile and settings system had **critical issues** that would have caused:

- User frustration (can't change username)
- Data loss (preferences overwritten)
- Privacy concerns (incomplete account deletion)
- Poor UX (generic error messages)

**All critical issues have been fixed** and the system is now more reliable, secure, and user-friendly.

---

**Status**: ✅ **CRITICAL FIXES COMPLETE**  
**Next Steps**: Add username unique constraint (requires migration), add rate limiting, implement strict preference schema
