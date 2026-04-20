# Security Scan Report
Date: 2026-04-10
Codebase: VarsityHub Mobile
Prior scan: 2026-04-03


## Summary
| Severity | Count | Status vs Prior Scan |
|----------|-------|----------------------|
| HIGH     | 3     | All 3 remain open (unchanged) |
| MEDIUM   | 4     | 3 carried over, 1 new |
| LOW      | 2     | 1 carried over, 1 new |
| INFO     | 2     | Unchanged |
| **Total**| **11**| |

---
## Findings

### [HIGH] Live API Keys Committed to Git-Tracked Files
**Status:** OPEN - unchanged since 2026-04-03
**File:** app.json:170-175, eas.json:93-94
**Description:** EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_51Rtgd...), EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (AIzaSyDhct...), EXPO_PUBLIC_POSTHOG_API_KEY (phc_8y7VeT...) hardcoded in git-tracked files. Same values in app.config.js. All baked into the app bundle.
**Risk:** Maps key can accumulate billing charges. PostHog key allows fake analytics injection. All exposed if repo becomes public.
**Recommendation:** Move all EXPO_PUBLIC_* production values to EAS secrets. Remove hardcoded fallbacks from app.config.js. Restrict Maps key to iOS bundle ID + Android package in Google Cloud Console.
---
### [HIGH] plan Preference Is Client-Settable - Bypasses Paid Feature Gates
**Status:** OPEN - unchanged since 2026-04-03
**File:** server/src/routes/auth.ts:1114-1119, auth.ts:1144
**Description:** PROTECTED_PREF_KEYS only strips approval_status, is_admin, paid_by_owner, payment_approved. The 'plan' field (rookie/veteran/legend) is accepted by PATCH /auth/me/preferences Zod schema at line 1144. Any user can POST {plan:legend} to self-upgrade with no payment verification. teams.ts reads prefs.plan for creation limits (Legend=Infinity). ads.ts gate also reads preferences.plan without verifying payment.
**Risk:** Direct revenue bypass. Any user can self-assign Legend and create unlimited teams/ads for free.
**Recommendation:** Add 'plan' to PROTECTED_PREF_KEYS at auth.ts:1114. Only server-side payment handlers (Stripe webhook, Apple /verify-receipt, Google Play /verify-purchase) should write this field.

---
### [HIGH] Apple Developer Personal Email and Team ID Committed to Git
**Status:** OPEN - unchanged since 2026-04-03
**File:** eas.json:111-113, app.config.js:56, app.json:31
**Description:** appleId: sanchezemil82@gmail.com, appleTeamId: B5H8F69RW5, ascAppId: 6758405187 all in git-tracked files.
**Risk:** Personal email + team ID enables targeted phishing or social engineering against the Apple Developer account owner.
**Recommendation:** Remove from eas.json. Use EAS interactive ASC auth or EAS secrets. Replace personal Gmail with a dedicated service Apple ID.

---
### [MEDIUM] queryRaw LIKE Scan on Serialized JSON - No Index, False Positive Risk
**Status:** OPEN - unchanged since 2026-04-03
**File:** server/src/routes/payments.ts:2808-2815
**Description:** Apple S2S handler searches for user via preferences::text LIKE '%txId%'. Prisma template literal parameterizes correctly - NOT SQL injection. But: full sequential scan on serialized JSON, no index, and false positive risk if transaction ID appears in other preference fields.
**Recommendation:** Add indexed column apple_original_transaction_id to User model. Replace with prisma.user.findFirst({ where: { apple_original_transaction_id: txId } }).
---
### [MEDIUM] Upload Error Message Claims 100 MB When Actual Limit Is 25 MB
**Status:** OPEN - unchanged since 2026-04-03
**File:** server/src/routes/uploads.ts:92, uploads.ts:405
**Description:** multer enforces fileSize: 25MB (line 92), but LIMIT_FILE_SIZE handler at line 405 returns 'File too large. Maximum size is 100MB.' Limit is correctly enforced but message is stale.
**Risk:** Users will retry with files up to 100 MB which will always fail.
**Recommendation:** Change uploads.ts:405 to say 'File too large. Maximum size is 25MB.'

---
### [MEDIUM] Auth Token Stored in sessionStorage on Web Platform
**Status:** OPEN - unchanged since 2026-04-03
**File:** api/auth.ts:93-100
**Description:** On Platform.OS === 'web', JWT tokens fall back to window.sessionStorage. Native iOS/Android correctly use expo-secure-store. Legacy migration path (lines 57-65) reads localStorage and migrates to sessionStorage.
**Risk:** sessionStorage readable by any JS in same origin. XSS in web version allows token theft. Limited impact since web is secondary.
**Recommendation:** Accept as known web-platform limitation. Confirm no code path writes tokens to localStorage outside the migration shim.

---
### [MEDIUM] NEW - Direct sgMail.send() Bypasses EmailService
**Status:** NEW finding (2026-04-10)
**File:** server/src/lib/email.ts:460-477
**Description:** sendAdPendingReviewEmail contains a last-resort fallback that calls sgMail.send() directly after two upstream failures. Violates CLAUDE.md: 'Emails MUST go through EmailService/sendTemplateEmail - never sgMail.send() directly.' Note: SendGridProvider.ts usages are fine (they are the provider implementation).
**Risk:** Low - fires only after two upstream failures. Bypasses service layer error handling and logging.
**Recommendation:** Remove the direct sgMail.send() fallback at email.ts:460-477. The sendEmail() call at line 455 is already a sufficient fallback.
---
### [LOW] AsyncStorage Stores blocked_users Without Encryption
**Status:** OPEN - unchanged since 2026-04-03
**File:** api/settings.ts
**Description:** blocked_users (user ID array), dm_policy, private_account stored in AsyncStorage (unencrypted). Auth tokens correctly in SecureStore.
**Risk:** On rooted/jailbroken device attacker could read blocked user IDs. Not a credential theft risk.
**Recommendation:** Accept for non-credential data. Migrate blocked_users to expo-secure-store if privacy becomes a concern.

---
### [LOW] NEW - dbBackupSync Uses Unsafe Prisma Raw Query APIs
**Status:** NEW finding (2026-04-10)
**File:** server/src/lib/dbBackupSync.ts:104, 107, 136, 165
**Description:** Database backup utility uses $queryRawUnsafe and $executeRawUnsafe. All inputs are internal: table names from hardcoded TABLES_IN_ORDER constant, column names from Object.keys(rows[0]), values parameterized with $1..$N. Not exploitable currently. But Unsafe APIs mean a future developer could add user-controlled input without realizing parameterization is bypassed.
**Risk:** Low currently. Future maintenance risk.
**Recommendation:** Add code comments on each Unsafe call noting all inputs are DB-internal. Low urgency.

---
### [INFO] GitHub Repository URL Embedded in App Bundle
**Status:** OPEN - unchanged since 2026-04-03
**File:** app.config.js:35
**Description:** https://github.com/xsantcastx/VarsityHubMobile hardcoded in githubUrl extra, compiled into the app bundle.
**Risk:** Low - leaks GitHub username and repo name if private.
**Recommendation:** Remove githubUrl if the repository is private.

---
### [INFO] Redis eval() Usage Is Safe - Not JavaScript eval()
**Status:** Unchanged since 2026-04-03
**File:** server/src/lib/redisRateLimit.ts, server/src/lib/distributedLock.ts
**Description:** redis.eval() calls are Redis server-side Lua scripting, not JavaScript eval(). Scripts are hardcoded with no user input path.
**Risk:** None.

---

## Clean Areas (Verified 2026-04-10)

### XSS Vectors
No dangerouslySetInnerHTML found. No WebView components in the codebase. No eval() or new Function() in application code. SVG uploads explicitly blocked (uploads.ts:83). User-generated content rendered through React Native Text/Image only.

### SQL Injection
All route-level queries use Prisma ORM with parameterized tagged template literals. $queryRaw in gameStories.ts:184 and payments.ts:2811 are properly parameterized. No raw string interpolation into route-level queries.

### Auth Middleware
authMiddleware applied globally at app.ts:177. Grep for req.user without requireAuth in route files returned no matches. Test endpoints gated to NODE_ENV !== 'production'. Swagger UI behind requireAuth + requireAdmin in production.

### Token Storage
JWT access and refresh tokens in expo-secure-store (iOS Keychain / Android Keystore) on native platforms. Only non-sensitive flags use AsyncStorage.

### Upload Validation
25 MB size limit enforced at multer layer. MIME type whitelist (no SVG). Magic byte signature validation prevents MIME spoofing. Extension cross-check required.

### Rate Limiting
Comprehensive coverage: authLimiter (10/15min IP-keyed), passwordResetLimiter (5/hr), oauthLimiter (10/15min), verificationConfirmLimiter (5/15min - prevents 6-digit brute force), uploadLimiter (30/hr), paymentLimiter (10/hr). Redis store used when REDIS_URL is set. DISABLE_RATE_LIMITING never set in Railway production.

### .gitignore Coverage
server/.env, service-account-key.json, *.key, *.p8, *.p12, *.pem, *.keystore, android/keystore.properties, credentials.json all gitignored. Comprehensive for sensitive file types.
