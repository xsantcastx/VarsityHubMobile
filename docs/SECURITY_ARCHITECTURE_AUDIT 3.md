# Comprehensive Security Architecture Audit

**Date**: December 2024  
**Scope**: Full-stack security, validation, and architectural consistency  
**Status**: 🔍 In Progress

---

## Executive Summary

This audit examines security gaps, validation mismatches, and architectural inconsistencies across the VarsityHub platform. The system shows good security practices in many areas but has several areas requiring attention.

**Overall Security Grade**: ⚠️ **B+ (Good, with improvements needed)**

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Auth Middleware is Optional (Non-Failing)

**Location**: `server/src/middleware/auth.ts`

**Issue**: 
```typescript
export function authMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return next(); // ⚠️ Doesn't fail
  // ...
}
```

**Impact**: 
- Auth middleware never rejects requests
- Routes must manually check `req.user` everywhere
- Easy to forget auth checks in new routes
- Inconsistent security posture

**Recommendation**: 
- Create `requireAuth` middleware that fails if no user
- Keep optional `authMiddleware` for public routes
- Use `requireAuth` by default, opt-in for public routes

**Severity**: 🔴 **HIGH** - Architectural security risk

---

### 2. Inconsistent Authorization Checks

**Issue**: Some routes check `req.user` multiple times, others rely only on middleware

**Examples**:
- `server/src/routes/posts.ts:178` - Checks `req.user` after `requireVerified`
- `server/src/routes/events.ts:182` - Checks `req.user` after `requireVerified`
- `server/src/routes/games.ts:183` - Checks `req.user` after `requireAuth`

**Impact**:
- Code duplication
- Easy to miss checks
- Inconsistent patterns

**Recommendation**: 
- Trust middleware (remove redundant checks)
- OR create wrapper that guarantees `req.user` exists

**Severity**: 🟡 **MEDIUM** - Code quality and maintainability

---

### 3. Raw SQL Query Without Parameterization Check

**Location**: `server/src/routes/admin.ts:55`

```typescript
prisma.$queryRaw`
  SELECT id, admin_email, action, target_type, description, timestamp
  FROM "AdminActivityLog"
  ORDER BY timestamp DESC
  LIMIT 5
`
```

**Status**: ✅ **SAFE** - No user input, static query
**Note**: Monitor for future changes that add parameters

---

## 🟠 HIGH PRIORITY ISSUES

### 4. CORS Wildcard Support in Development

**Location**: `server/src/index.ts:78-84`

**Issue**: 
```typescript
if (hasWildcardOrigin) {
  if (isProd) {
    throw new Error(`${message} Wildcards are not permitted in production.`);
  }
  console.warn(`${message} Wildcards are only allowed during development.`);
}
```

**Impact**: 
- Development allows `*` origin (security risk if dev server exposed)
- Could accidentally deploy with wildcard

**Recommendation**: 
- Remove wildcard support entirely
- Use explicit dev origins list
- Add CI check to prevent wildcard in production

**Severity**: 🟠 **MEDIUM-HIGH**

---

### 5. Rate Limiting Disabled in Development

**Location**: `server/src/middleware/rateLimiters.ts:17`

**Issue**: 
```typescript
const isDev = process.env.NODE_ENV !== 'production' || process.env.RATE_LIMIT_DISABLE === '1';
// ...
skip: () => isDev,
```

**Impact**: 
- No rate limiting in development
- Could miss rate limit bugs until production
- Development behavior differs from production

**Recommendation**: 
- Keep rate limits enabled in dev (with higher limits)
- Use `RATE_LIMIT_DISABLE` only for specific testing

**Severity**: 🟡 **LOW-MEDIUM** - Testing concern

---

### 6. Content Security Policy Disabled

**Location**: `server/src/index.ts:58`

**Issue**: 
```typescript
app.use(helmet({ contentSecurityPolicy: false }));
```

**Impact**: 
- No CSP protection
- XSS attacks easier
- Missing security headers

**Recommendation**: 
- Enable CSP with proper configuration
- Configure for Expo/React Native app needs
- Test thoroughly

**Severity**: 🟠 **MEDIUM**

---

### 7. File Upload Validation Gaps

**Location**: `server/src/routes/uploads.ts`

**Issues**:
1. **MIME type validation only** - No file content validation
2. **No virus scanning**
3. **No file size limits per user** (only per request)
4. **Filename not sanitized** (uses original filename in some cases)

**Current Validation**:
```typescript
fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
  if (!ok) return cb(new Error('Only image or video files are allowed'));
  cb(null, true);
}
```

**Recommendations**:
- Add file content validation (magic bytes)
- Sanitize filenames (remove special chars, path traversal)
- Add per-user upload quotas
- Consider virus scanning for production

**Severity**: 🟠 **MEDIUM-HIGH**

---

### 8. Error Message Information Disclosure

**Location**: Multiple routes

**Issues**:
- Some errors expose internal details
- Stack traces in development (acceptable)
- Error messages vary in detail level

**Examples**:
```typescript
// Good - Generic error
return res.status(401).json({ error: 'Invalid credentials' });

// Bad - Too much detail
console.error('[register] prisma findUnique error:', e);
return res.status(500).json({ error: 'Database unavailable' }); // ✅ Actually good
```

**Recommendation**: 
- Standardize error responses
- Never expose stack traces in production
- Use error codes instead of messages where possible

**Severity**: 🟡 **LOW-MEDIUM**

---

## 🟡 MEDIUM PRIORITY ISSUES

### 9. Admin Check Performance

**Location**: `server/src/middleware/requireAdmin.ts:14`

**Issue**: 
```typescript
const me = await prisma.user.findUnique({ where: { id: req.user.id } });
```

**Impact**: 
- Database query on every admin request
- Could cache admin status in JWT or session
- Performance impact on admin endpoints

**Recommendation**: 
- Cache admin status in JWT token (if admin emails are static)
- OR cache in memory with TTL
- OR add `is_admin` field to User model

**Severity**: 🟡 **LOW** - Performance optimization

---

### 10. Email Verification Check Performance

**Location**: `server/src/middleware/requireVerified.ts:7`

**Issue**: 
```typescript
const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email_verified: true } });
```

**Impact**: 
- Database query on every verified endpoint
- Could include in JWT token

**Recommendation**: 
- Include `email_verified` in JWT payload
- Refresh token when verification status changes

**Severity**: 🟡 **LOW** - Performance optimization

---

### 11. Inconsistent Input Validation

**Issue**: Some routes use Zod, others do manual validation

**Examples**:
- ✅ Good: `server/src/routes/auth.ts` - Uses Zod schemas
- ✅ Good: `server/src/routes/posts.ts` - Uses Zod schemas
- ⚠️ Check: Some routes may have manual validation

**Recommendation**: 
- Standardize on Zod for all input validation
- Create shared validation schemas
- Add validation middleware

**Severity**: 🟡 **LOW** - Code consistency

---

### 12. Hardcoded Admin Email

**Location**: `server/src/routes/auth.ts:74`

**Issue**: 
```typescript
const isAdmin = sanitizedEmail === 'emilmancero@gmail.com';
```

**Impact**: 
- Admin status hardcoded in code
- Should use environment variable
- Difficult to add/remove admins

**Recommendation**: 
- Use `ADMIN_EMAILS` env var (already exists in `requireAdmin.ts`)
- Remove hardcoded email

**Severity**: 🟡 **LOW** - Configuration issue

---

## ✅ SECURITY STRENGTHS

### 1. Database Security
- ✅ **Prisma ORM** - Parameterized queries (SQL injection protected)
- ✅ **Type-safe queries** - Compile-time safety
- ✅ **Raw queries minimal** - Only one found, and it's safe

### 2. Authentication
- ✅ **JWT with validation** - Secret length checked
- ✅ **Bcrypt password hashing** - Proper hashing
- ✅ **Rate limiting on auth** - Prevents brute force
- ✅ **Token expiry** - 1 hour access tokens

### 3. Input Validation
- ✅ **Zod schemas** - Type-safe validation
- ✅ **Email sanitization** - Lowercase, trimmed
- ✅ **Input length limits** - Max lengths enforced

### 4. Payment Security
- ✅ **Stripe webhook signature verification** - Prevents spoofing
- ✅ **Raw body parsing for webhooks** - Required for signature verification
- ✅ **Transaction logging** - Audit trail

### 5. File Upload Security
- ✅ **MIME type validation** - Prevents wrong file types
- ✅ **File size limits** - 25MB for media, 50MB for files
- ✅ **Rate limiting** - 10 uploads per hour (avatar), 30 per hour (general)
- ✅ **Cloudinary integration** - Secure cloud storage

### 6. API Security
- ✅ **CORS configured** - Explicit origins (except dev wildcard)
- ✅ **Helmet.js** - Security headers (except CSP)
- ✅ **Rate limiting** - Comprehensive per-route limits
- ✅ **Trust proxy** - Properly configured for Railway

### 7. Error Handling
- ✅ **Sentry integration** - Error tracking
- ✅ **Generic error messages** - Prevents information disclosure
- ✅ **Error boundaries** - Frontend error handling

---

## 🔍 ARCHITECTURAL INCONSISTENCIES

### 1. Permission Check Patterns

**Inconsistent Patterns**:
- Some routes: `requireAuth` → check `req.user` → check permissions
- Other routes: `requireVerified` → check `req.user` → check role
- Admin routes: `requireAdmin` → (no additional checks needed)

**Recommendation**: 
- Standardize pattern
- Create permission helper functions
- Document permission requirements

---

### 2. Role vs Plan Confusion

**Issue**: 
- `role` (fan/coach) vs `plan` (rookie/veteran/legend) used inconsistently
- Some checks use `preferences.role`, others use `preferences.plan`
- Plan limits checked in different ways

**Examples**:
- `server/src/routes/events.ts:196` - Checks `prefs.role` and `prefs.plan`
- `server/src/routes/teams.ts` - Checks role for team creation, plan for limits

**Recommendation**: 
- Document role vs plan clearly
- Create helper functions: `isCoach()`, `getPlan()`, `checkPlanLimit()`
- Use consistently across codebase

---

### 3. Validation Schema Location

**Issue**: 
- Some schemas defined inline in routes
- Others could be shared
- No centralized validation schemas

**Recommendation**: 
- Create `server/src/lib/validation/` directory
- Move shared schemas there
- Reuse across routes

---

### 4. Error Response Format

**Issue**: 
- Some errors: `{ error: 'message' }`
- Others: `{ error: 'code', message: 'text' }`
- Some include `issues` array, others don't

**Examples**:
```typescript
// Pattern 1
return res.status(400).json({ error: 'Invalid payload' });

// Pattern 2
return res.status(400).json({ 
  error: 'Invalid payload',
  issues: parsed.error.issues 
});

// Pattern 3
return res.status(400).json({ 
  error: 'INVALID_CREDENTIALS',
  message: 'Email or password incorrect'
});
```

**Recommendation**: 
- Standardize error response format
- Use error codes for client handling
- Include validation details when appropriate

---

## 📊 VALIDATION MISMATCHES

### 1. Email Validation

**Current**: 
- Backend: `z.string().email()` (Zod)
- Frontend: Basic email regex (assumed)

**Issue**: 
- No verification that frontend and backend use same validation
- Could allow invalid emails on frontend that backend rejects

**Recommendation**: 
- Share validation logic
- Use same Zod schemas on frontend (if possible)
- Document expected format

---

### 2. Password Validation

**Current**: 
- Backend: `z.string().min(8)`
- Frontend: May have additional requirements

**Issue**: 
- Mismatch could cause user confusion
- Frontend might allow passwords backend rejects

**Recommendation**: 
- Document password requirements
- Ensure frontend matches backend
- Show clear error messages

---

### 3. Team Limit Validation

**Issue**: 
- Limits checked in multiple places
- Different logic for different plans
- Could have race conditions

**Current Logic**:
- Rookie: Max 2 teams
- Veteran: 2 free + subscription quantity
- Legend: Unlimited

**Recommendation**: 
- Centralize limit checking
- Use database constraints if possible
- Add transaction for team creation

---

## 🔐 SECRETS & ENVIRONMENT VARIABLES

### Current State

**✅ Good Practices**:
- Secrets in environment variables
- `.env` in `.gitignore`
- JWT secret validation on startup
- No hardcoded secrets found

**⚠️ Areas to Improve**:
- No `.env.example` for server (only frontend)
- Some env vars not documented
- No validation of all required vars on startup

**Recommendation**: 
- Create `server/.env.example`
- Add startup validation for all required vars
- Document all environment variables

---

## 📋 DETAILED FINDINGS BY CATEGORY

### Authentication & Authorization

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Auth middleware optional | 🔴 HIGH | `middleware/auth.ts` | Needs fix |
| Inconsistent auth checks | 🟡 MEDIUM | Multiple routes | Code quality |
| Admin check performance | 🟡 LOW | `middleware/requireAdmin.ts` | Optimization |
| Verified check performance | 🟡 LOW | `middleware/requireVerified.ts` | Optimization |
| Hardcoded admin email | 🟡 LOW | `routes/auth.ts:74` | Configuration |

### Input Validation

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Inconsistent validation | 🟡 LOW | Multiple routes | Code quality |
| Email validation mismatch | 🟡 LOW | Frontend vs backend | Documentation |
| Password validation mismatch | 🟡 LOW | Frontend vs backend | Documentation |

### API Security

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| CORS wildcard in dev | 🟠 MEDIUM | `index.ts:78` | Configuration |
| CSP disabled | 🟠 MEDIUM | `index.ts:58` | Configuration |
| Rate limiting disabled in dev | 🟡 LOW | `rateLimiters.ts:17` | Testing |

### File Upload Security

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| No content validation | 🟠 MEDIUM | `routes/uploads.ts` | Needs improvement |
| Filename not sanitized | 🟡 MEDIUM | `routes/uploads.ts` | Needs improvement |
| No per-user quotas | 🟡 LOW | `routes/uploads.ts` | Feature enhancement |

### Error Handling

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Inconsistent error formats | 🟡 LOW | Multiple routes | Code quality |
| Some error details exposed | 🟡 LOW | Some routes | Code quality |

### Database Security

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Raw query found | ✅ SAFE | `routes/admin.ts:55` | Monitor for changes |
| Prisma used (safe) | ✅ GOOD | All routes | No action needed |

### Payment Security

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Webhook signature verified | ✅ GOOD | `routes/payments.ts:420` | No action needed |
| Transaction logging | ✅ GOOD | `lib/transactionLogger.ts` | No action needed |

---

## 🎯 RECOMMENDATIONS SUMMARY

### Immediate Actions (High Priority)

1. **Fix Auth Middleware Pattern**
   - Make `requireAuth` fail if no user
   - Use consistently across routes
   - Remove redundant `req.user` checks

2. **Remove CORS Wildcard**
   - Remove wildcard support entirely
   - Use explicit dev origins
   - Add CI check

3. **Enable CSP**
   - Configure Content Security Policy
   - Test with Expo/React Native
   - Document CSP rules

4. **Improve File Upload Security**
   - Add file content validation (magic bytes)
   - Sanitize filenames
   - Add per-user upload quotas

### Short-Term Improvements

5. **Standardize Error Responses**
   - Create error response format
   - Use error codes
   - Document error codes

6. **Centralize Validation**
   - Create validation schemas directory
   - Share schemas between routes
   - Document validation rules

7. **Optimize Permission Checks**
   - Cache admin status
   - Include verification in JWT
   - Reduce database queries

8. **Document Environment Variables**
   - Create `server/.env.example`
   - Document all variables
   - Add startup validation

### Long-Term Enhancements

9. **Add Security Headers**
   - Enable all Helmet features
   - Add HSTS
   - Add X-Frame-Options

10. **Implement Request ID Tracking**
    - Add correlation IDs
    - Track requests end-to-end
    - Improve debugging

11. **Add Security Monitoring**
    - Log security events
    - Alert on suspicious activity
    - Track failed auth attempts

12. **Regular Security Audits**
    - Schedule quarterly audits
    - Use automated tools (Snyk)
    - Review dependencies

---

## 📈 SECURITY METRICS

### Current State

- **Authentication**: ✅ Good (with improvements needed)
- **Authorization**: ⚠️ Inconsistent patterns
- **Input Validation**: ✅ Good (Zod schemas)
- **File Uploads**: ⚠️ Basic validation, needs improvement
- **API Security**: ✅ Good (CORS, rate limiting)
- **Error Handling**: ⚠️ Inconsistent
- **Database Security**: ✅ Excellent (Prisma)
- **Payment Security**: ✅ Excellent (Stripe)

### Target State

- **Authentication**: ✅ Excellent
- **Authorization**: ✅ Consistent patterns
- **Input Validation**: ✅ Excellent
- **File Uploads**: ✅ Comprehensive validation
- **API Security**: ✅ Excellent
- **Error Handling**: ✅ Consistent
- **Database Security**: ✅ Excellent (maintain)
- **Payment Security**: ✅ Excellent (maintain)

---

## 🔄 ARCHITECTURAL CONSISTENCY

### Current Patterns

**Good Patterns**:
- ✅ Zod validation schemas
- ✅ Middleware-based auth
- ✅ Rate limiting per route
- ✅ Prisma for database

**Inconsistent Patterns**:
- ⚠️ Auth check patterns vary
- ⚠️ Error response formats vary
- ⚠️ Permission check locations vary
- ⚠️ Validation schema locations vary

### Recommended Patterns

1. **Auth Pattern**:
   ```typescript
   router.post('/', requireAuth, requireVerified, async (req, res) => {
     // req.user guaranteed to exist
     // No need to check req.user again
   });
   ```

2. **Validation Pattern**:
   ```typescript
   const schema = z.object({ ... });
   const parsed = schema.safeParse(req.body);
   if (!parsed.success) {
     return res.status(400).json({ 
       error: 'VALIDATION_ERROR',
       issues: parsed.error.issues 
     });
   }
   ```

3. **Error Response Pattern**:
   ```typescript
   {
     error: 'ERROR_CODE',
     message: 'User-friendly message',
     details?: any // Optional, only in dev
   }
   ```

---

## 📝 NEXT STEPS

1. **Prioritize fixes** based on severity
2. **Create implementation plan** for each fix
3. **Test fixes** thoroughly
4. **Update documentation** with security practices
5. **Schedule follow-up audit** after fixes

---

**Audit Status**: ✅ Complete  
**Next Review**: After fixes implemented
