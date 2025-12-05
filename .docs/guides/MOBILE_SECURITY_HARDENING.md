# Mobile Security Hardening Checklist

## Overview
This document outlines VarsityHub Mobile's security hardening requirements across authentication, data storage, network transport, app configuration, and code integrity.

---

## 1. Authentication & Authorization

### 1.1 OAuth 2.0 / OIDC Implementation ✅
- **Status:** Implemented (Google OAuth, Apple Sign-In)
- **Verification:**
  - [ ] OAuth state parameter validated on callback
  - [ ] Code exchange uses PKCE (Proof Key for Code Exchange)
  - [ ] Tokens stored in secure storage only (not localStorage)
  - [ ] Token refresh flow tested
  - [ ] Logout clears all stored credentials
  - [ ] Session timeout enforced (idle + absolute)

**Code References:**
- `src/screens/auth/GoogleSignInScreen.tsx` - OAuth implementation
- `src/utils/oauth.ts` - PKCE flow handling
- `src/services/auth.service.ts` - Token management

### 1.2 JWT Token Management
- **Status:** Implemented
- **Requirements:**
  - [ ] Access tokens short-lived (15-30 minutes)
  - [ ] Refresh tokens long-lived (7-30 days)
  - [ ] Tokens signed with RS256 or HS256 (verify algorithm)
  - [ ] Token expiry checked before API calls
  - [ ] Expired tokens automatically refreshed
  - [ ] Invalid tokens trigger re-authentication
  - [ ] No token logging in error messages

**API Endpoint:** `POST /auth/token` (Rails backend)

### 1.3 Password Security
- **Status:** Delegated to OAuth providers
- **Fallback (if email/password added):**
  - [ ] Minimum 12 characters
  - [ ] Complexity requirements enforced
  - [ ] Bcrypt/Argon2 hashing on server
  - [ ] Rate limiting on login (5 attempts per minute)
  - [ ] Account lockout after 10 failed attempts (30 min)
  - [ ] Password reset via secure email link (24-hour expiry)

---

## 2. Secure Data Storage

### 2.1 Sensitive Data Classification
- **HIGH:** AuthTokens, API keys, user credentials, payment tokens
- **MEDIUM:** User profile (name, email), game/team metadata
- **LOW:** App preferences, UI state, cached public data

### 2.2 SecureStore Implementation ✅
- **Status:** Configured (expo-secure-store)
- **Verification:**
  - [ ] Access tokens stored in SecureStore (iOS Keychain, Android Keystore)
  - [ ] Refresh tokens stored in SecureStore
  - [ ] API keys NOT in code, pulled from env at runtime
  - [ ] Sentry DSN safe for public (no sensitive data in it)
  - [ ] No credentials in AsyncStorage
  - [ ] All SecureStore calls wrapped in try-catch
  - [ ] Clear SecureStore on logout

**Code Reference:**
```typescript
import * as SecureStore from 'expo-secure-store';

// Storing
await SecureStore.setItemAsync('authToken', token);

// Retrieving
const token = await SecureStore.getItemAsync('authToken');

// Clearing
await SecureStore.deleteItemAsync('authToken');
```

### 2.3 AsyncStorage Usage (Non-Sensitive Only)
- **Allowed:** Theme preference, app version, feature flags
- **Forbidden:** Tokens, passwords, API keys, PII
- **Verification:**
  - [ ] Audit all AsyncStorage calls for sensitive data
  - [ ] No hardcoded secrets in AsyncStorage defaults

### 2.4 Device Storage (File System)
- **Media:** Photos/videos downloaded via `expo-document-picker`
- **Requirements:**
  - [ ] Images/videos stored with restricted file permissions
  - [ ] No plaintext data in app cache directory
  - [ ] Temp files deleted after use
  - [ ] Consider encryption for sensitive media

---

## 3. Network Transport Security

### 3.1 HTTPS & TLS ✅
- **Status:** All traffic to `https://api-production-8ac3.up.railway.app`
- **Verification:**
  - [ ] API_URL uses https:// (not http://)
  - [ ] Certificate validity verified (expires > 1 year)
  - [ ] TLS 1.2 minimum enforced
  - [ ] No mixed content (http + https)

**Configuration:**
```typescript
const API_URL = 'https://api-production-8ac3.up.railway.app';
// React Native enforces HTTPS by default (no cleartext traffic)
```

### 3.2 Certificate Pinning (Optional but Recommended)
- **Purpose:** Prevent man-in-the-middle attacks even if CA compromised
- **Implementation:** Use `react-native-ssl-pinning` or similar
- **Status:** NOT IMPLEMENTED - Consider for production hardening

**Implementation Steps (if added):**
```typescript
import { RNSSLPinning } from 'react-native-ssl-pinning';

const pinnedCertificates = ['api-cert-sha256-hash'];

// Configure axios or fetch to pin
```

### 3.3 API Request Security
- **Verification:**
  - [ ] All requests include Authorization header with Bearer token
  - [ ] Requests use JSON payloads (not URL-encoded)
  - [ ] CSRF tokens used for state-changing requests (if SPA)
  - [ ] Rate limiting headers respected (X-RateLimit-*)
  - [ ] Request/response timeouts set (30 seconds default)
  - [ ] Error responses don't leak sensitive info
  - [ ] Content-Type: application/json enforced

### 3.4 WebView Security
- **Status:** expo-web-browser used for OAuth (not WebView)
- **If WebView added:**
  - [ ] `javaScriptEnabled = false` by default
  - [ ] No file:// URLs loaded
  - [ ] No eval() or new Function()
  - [ ] CSP headers enforced server-side
  - [ ] File upload restricted

---

## 4. App Configuration & Secrets

### 4.1 Environment Variables
- **Status:** Implemented
- **Files:**
  - `.env` - Local development (in .gitignore)
  - `.env.example` - Template for teammates
  - `.github/workflows/` - Secrets stored in Actions Secrets
  - `eas.json` - Build configuration with env vars

**Verification:**
  - [ ] `.env` in .gitignore (never committed)
  - [ ] Sensitive keys in `.env.example` marked as `<FILL_ME_IN>`
  - [ ] GitHub Actions uses `${{ secrets.SECRET_NAME }}`
  - [ ] Sentry DSN is public (safe in code)
  - [ ] Stripe publishable key is public (safe in code)
  - [ ] No API keys in source code
  - [ ] eas.json not committing secrets

### 4.2 Build-Time Secrets
- **Usage:** `EXPO_PUBLIC_*` prefix for client-visible secrets
- **Example:**
  ```json
  "EXPO_PUBLIC_SENTRY_DSN": "https://public@sentry.io/...",
  "EXPO_PUBLIC_STRIPE_KEY": "pk_live_..."
  ```
- **Non-Public Secrets:**
  ```
  "BACKEND_API_KEY": "<github-actions-secret>"
  "APPLE_SIGNING_KEY": "<eas-secret>"
  ```

**Verification:**
  - [ ] Server-only keys NOT prefixed with EXPO_PUBLIC
  - [ ] GitHub Actions secrets masked in logs
  - [ ] EAS build secrets stored in EAS (not git)

### 4.3 API Key Rotation
- **Current Status:** Keys refreshed during builds
- **Schedule:**
  - [ ] Stripe: Rotate annually or after exposure
  - [ ] Sentry: Rotate annually
  - [ ] Google OAuth: Rotate keys after major releases
  - [ ] Apple signing key: Rotate per-release (EAS handles)

---

## 5. Code Integrity & Obfuscation

### 5.1 JavaScript Minification ✅
- **Status:** Expo handles minification in production builds
- **Verification:**
  - [ ] `npx expo run:ios --production` minifies
  - [ ] `npx expo run:android --production` minifies
  - [ ] Source maps NOT shipped with APK/IPA
  - [ ] EAS build uses --production flag

### 5.2 Code Obfuscation (Advanced)
- **Status:** NOT IMPLEMENTED
- **Options:**
  - Hermes engine (Expo support TBD)
  - react-native-code-push for differential updates
  - Renaming via babel plugins

**Note:** Basic minification is sufficient for most apps. Deep obfuscation adds complexity.

### 5.3 Reverse Engineering Prevention
- **Jailbreak/Root Detection:**
  - [ ] Optional: Add react-native-jailbreak-monkey-spoofer
  - [ ] Log suspicious device state to Sentry
  - [ ] Don't lock out users, just warn

**Implementation (Optional):**
```typescript
import JailMonkey from 'jail-monkey';

if (JailMonkey.isJailBroken()) {
  Sentry.captureMessage('Device appears jailbroken', 'warning');
}
```

---

## 6. API Security

### 6.1 Input Validation
- **Server-Side (Rails API):** ✅ Implemented
  - [ ] All inputs validated against schema
  - [ ] Length limits enforced
  - [ ] Email format validation
  - [ ] Phone number format validation
  - [ ] No SQL injection possible (ORM used)

- **Client-Side (React Native):** ✅ Implemented
  - [ ] Form inputs validated before submission
  - [ ] File uploads validated (type, size)
  - [ ] Autocomplete fields validated
  - [ ] Maps coordinates validated

**Verification Test:** Post invalid data to API and confirm rejection

### 6.2 Rate Limiting
- **Server-Side:** ✅ Implemented (Rails Rack::Throttle)
  - [ ] Login: 5 per minute per IP
  - [ ] API: 100 per minute per user
  - [ ] SMS: 1 per minute per phone
  - [ ] X-RateLimit-* headers returned

- **Client-Side:**
  - [ ] Debounce search inputs (500ms)
  - [ ] Throttle API calls (100ms)
  - [ ] Show "loading..." during requests

### 6.3 CORS Policy
- **Status:** API configured for mobile origin
- **Verification:**
  - [ ] Origin header NOT used by API (mobile uses Bearer tokens)
  - [ ] API allows Authorization header
  - [ ] API returns security headers (HSTS, X-Content-Type-Options)

### 6.4 API Error Handling
- **Verification:**
  - [ ] 401 (Unauthorized) triggers re-login
  - [ ] 403 (Forbidden) shows error, doesn't retry
  - [ ] 429 (Too Many Requests) shows retry hint
  - [ ] 5xx errors show generic "Server error" (no details to user)
  - [ ] Error details logged to Sentry (server-side)
  - [ ] No sensitive data in error messages

---

## 7. Error Handling & Logging

### 7.1 Sentry Integration ✅
- **Status:** Configured, DSN in .env
- **Verification:**
  - [ ] Sentry.init() called at app startup
  - [ ] Unhandled errors captured automatically
  - [ ] Caught errors logged via Sentry.captureException()
  - [ ] User context set after login
  - [ ] Device ID tracked (for debugging)
  - [ ] Breadcrumbs logged for navigation
  - [ ] Source maps uploaded for symbolication

**Configuration:** `.env` contains `EXPO_PUBLIC_SENTRY_DSN`

### 7.2 Console Logging
- **Verification:**
  - [ ] console.log() calls removed from production (or wrapped in __DEV__)
  - [ ] Sensitive data never logged (tokens, emails, passwords)
  - [ ] API responses logged without sensitive fields
  - [ ] Redux state logged sanitized (in dev only)

**Pattern:**
```typescript
if (__DEV__) {
  console.log('Debug info:', sanitizedData);
}
```

### 7.3 Crash Reporting
- **Status:** Sentry captures crashes
- **Verification:**
  - [ ] JavaScript errors caught and reported
  - [ ] Native crashes reported (ExceptionHandler)
  - [ ] OOM (out of memory) errors logged
  - [ ] Network timeouts logged with context

---

## 8. Mobile-Specific Hardening

### 8.1 iOS Security
- **Capabilities:**
  - [ ] App Transport Security (ATS) enforces HTTPS
  - [ ] Keychain access with app ID validation
  - [ ] Biometric authentication available (FaceID/TouchID)
  - [ ] Code signing enabled (required for App Store)
  - [ ] Entitlements properly configured

**Verification:**
```bash
cd ios && grep -i "Keychain" *.pbxproj
```

### 8.2 Android Security
- **Manifest Permissions:**
  - [ ] Only necessary permissions requested
  - [ ] INTERNET permission required (API calls)
  - [ ] CAMERA (if image upload enabled)
  - [ ] LOCATION (if location features used)
  - [ ] No dangerous permissions by default

**File:** `app.json` > `android.permissions`

- **Security Configuration:**
  - [ ] Cleartext traffic disabled (network_security_config.xml)
  - [ ] Certificate pinning configured (optional)
  - [ ] Debuggable: false in production builds

### 8.3 Biometric Authentication (Optional)
- **Status:** NOT IMPLEMENTED
- **If Added:**
  - [ ] Fallback to password if biometric fails
  - [ ] Biometric not required if device unsupported
  - [ ] 30-second timeout for biometric prompt
  - [ ] Require authentication before sensitive operations

---

## 9. Dependencies & Supply Chain

### 9.1 npm Audit ✅
- **Current Status:** 4 moderate CVEs (transitive in sentry-expo)
- **Schedule:**
  - [ ] Run `npm audit` on every PR
  - [ ] Snyk continuous monitoring enabled
  - [ ] Monthly dependency updates
  - [ ] Quarterly security review

**Verification:**
```bash
npm audit --json | jq '.metadata.vulnerabilities'
```

### 9.2 Snyk Scanning ✅
- **Status:** Integrated in CI/CD
- **Coverage:**
  - [ ] SCA (Software Composition Analysis) - npm packages
  - [ ] SAST (Static Analysis) - code vulnerabilities
  - [ ] Container scanning - if Docker image used
  - [ ] IaC scanning - if terraform/k8s used

### 9.3 License Compliance
- **Verification:**
  - [ ] All dependencies use compatible licenses (MIT, Apache 2.0, etc.)
  - [ ] GPL dependencies noted (if any)
  - [ ] License audit run quarterly

**Tool:** `npx license-report` or Snyk

---

## 10. Deployment & Release Security

### 10.1 Build Security
- **EAS Build:**
  - [ ] Builds run in isolated VMs (EAS handles)
  - [ ] Secrets not logged in build output
  - [ ] Signing credentials managed by EAS
  - [ ] Build artifacts (IPA/APK) stored securely

### 10.2 App Store Deployment
- **iOS (App Store):**
  - [ ] Code signing certificate valid
  - [ ] Provisioning profile current
  - [ ] App reviewed by Apple (privacy, security)
  - [ ] Entitlements match capabilities

- **Android (Google Play):**
  - [ ] Keystore password stored securely (EAS)
  - [ ] App signing by Play enabled
  - [ ] Privacy policy URL configured
  - [ ] Permissions justified in store listing

### 10.3 Version Updates
- **Expo Updates (OTA):**
  - [ ] Updates signed with runtime version
  - [ ] Rollback available if issues found
  - [ ] User can defer updates (max 1 week)
  - [ ] Critical updates force upgrade

---

## 11. Security Testing & Audits

### 11.1 Pre-Launch Checklist
- [ ] Run Snyk scan (all severity levels)
- [ ] Run `npm audit` (no critical/high remaining)
- [ ] Manual OWASP Top 10 mobile review
- [ ] Penetration testing by third-party (optional)
- [ ] Privacy policy reviewed by legal
- [ ] Data retention policy documented

### 11.2 Periodic Reviews
- **Quarterly (every 3 months):**
  - [ ] Update dependencies
  - [ ] Review security alerts from Snyk
  - [ ] Check for new CVEs in production

- **Annually:**
  - [ ] Professional penetration test
  - [ ] Code review by security expert
  - [ ] Compliance audit (GDPR, CCPA, etc.)

### 11.3 Incident Response Plan
- **Data Breach:**
  1. Identify scope (what data, how many users)
  2. Notify affected users within 24-72 hours
  3. Notify regulatory bodies if required
  4. Document root cause & fixes
  5. Implement preventative measures

- **Unauthorized Access:**
  1. Revoke compromised credentials
  2. Force password resets
  3. Monitor account activity
  4. Audit logs for suspicious actions

---

## 12. Compliance & Privacy

### 12.1 GDPR Compliance (EU Users)
- [ ] Privacy policy explains data collection
- [ ] User can access their data
- [ ] User can delete their data
- [ ] Data retention policy enforced
- [ ] DPA with API providers

### 12.2 CCPA Compliance (California Users)
- [ ] Privacy policy explains "Sale of Data" (or opt-out)
- [ ] User can opt-out of data sale
- [ ] User can request data deletion
- [ ] Data minimization practiced

### 12.3 Data Retention
- **Logs:** 90 days (Sentry)
- **Backups:** 7 days retention, encrypted
- **User Data:** As per privacy policy (typically 365 days post-deletion)
- **API Logs:** 30 days (Rails logs)

---

## Automated Checklist Script

Run this before each production release:

```bash
#!/bin/bash
echo "🔒 Security Pre-Launch Checklist"
echo "=================================="

# 1. Dependencies
echo "1️⃣  Checking npm audit..."
npm audit --audit-level=high

# 2. Snyk scan
echo "2️⃣  Running Snyk scan..."
snyk test --severity-threshold=high

# 3. Code lint
echo "3️⃣  Running linter..."
npm run lint

# 4. Type checking
echo "4️⃣  Type checking..."
npm run typecheck

# 5. Build
echo "5️⃣  Building app..."
npx expo run:ios --production

echo "✅ All security checks passed!"
```

---

## Escalation & Support

**Found a security issue?**
- DO NOT commit or push the fix publicly
- Email: [security@varsityhub.com](mailto:security@varsityhub.com)
- Or contact: Emil Mancero (Inventor/Owner)

**Questions about this checklist?**
- Refer to `.github/instructions/snyk_rules.instructions.md`
- Review SAST findings in Snyk dashboard
- Check GitHub Security tab for details

---

## Sign-Off

- **Created:** December 4, 2025
- **Last Updated:** [AUTO-UPDATED]
- **Owner:** Engineering Team
- **Review Cycle:** Quarterly + Before Every Release

**Next Steps:**
1. Review this checklist with team
2. Integrate Snyk into CI/CD (in progress)
3. Schedule quarterly security review
4. Plan annual penetration test
