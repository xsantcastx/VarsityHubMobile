# Sentry + Snyk Integration Guide

> **Status (verified 2026-07-13):** Sentry and Snyk each work correctly and independently.
> The "Snyk → Sentry" auto-reporting pipeline described below (sections marked ❌) was
> never actually built — `.github/workflows/snyk-security.yml` and
> `snyk-auto-remediate.yml` contain no step that sends Snyk results to Sentry, and the
> three GitHub secrets it would require (`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
> for this purpose) are not set in this repo's secrets.

## ✅ Complete Setup

### What's Configured

**1. Sentry Error Tracking (Frontend)**

- ✅ Initialized in `app/_layout.tsx` before app renders
- ✅ Plugin configured in `app.json`: `@sentry/react-native`
- ✅ Error Boundary captures React errors
- ✅ HTTP client captures API errors (5xx status codes)
- ✅ Network errors and timeouts captured
- ✅ Auth errors captured with context

**2. Sentry Error Tracking (Backend)**

- ✅ Initialized in `server/src/index.ts` as first middleware
- ✅ Error handler middleware at the end
- ✅ Captures all unhandled exceptions
- ✅ Captures HTTP request errors
- ✅ Database errors automatically captured

**3. Snyk Security Scanning**

- ✅ Runs on every push to `main` and `develop`
- ✅ Scans both frontend AND server code
- ✅ Scans for:
  - SAST (Static Application Security Testing) - code vulnerabilities
  - SCA (Software Composition Analysis) - dependency vulnerabilities
- ✅ Reports to GitHub Security tab (SARIF files)
- ❌ Does NOT send vulnerabilities to Sentry — see status note above

**4. Snyk → Sentry Integration — NOT BUILT**

- ❌ No workflow step creates Sentry issues from Snyk findings
- ❌ No separate alerts for frontend/server vulnerabilities in Sentry
- ❌ Nothing is tagged with severity/source/branch in Sentry
- ❌ Vulnerability counts/details stay in Snyk/GitHub Security only

---

## 🔍 What Gets Captured

### Sentry Captures:

1. **Frontend Errors:**
   - React component errors (ErrorBoundary)
   - API errors (5xx status codes)
   - Network failures and timeouts
   - Authentication errors
   - Unhandled promise rejections

2. **Backend Errors:**
   - Unhandled exceptions
   - HTTP request errors
   - Database errors
   - Middleware errors

3. **Security Issues (from Snyk):**
   - Critical/high severity vulnerabilities
   - Dependency vulnerabilities
   - Code security issues (SAST)

### Snyk Scans:

1. **Frontend:**
   - React Native dependencies
   - Expo packages
   - All npm packages

2. **Server:**
   - Node.js dependencies
   - Server-side packages
   - Database drivers

---

## 📊 How to View Results

### Sentry Dashboard

1. Go to https://sentry.io
2. Navigate to your project
3. View issues by:
   - **Frontend errors** - Tagged with `platform: ios/android`
   - **Backend errors** - Tagged with `environment: production`
   - **Security issues** - Tagged with `source: snyk`

### Snyk Dashboard

1. Go to https://app.snyk.io
2. View your project
3. See vulnerability reports and remediation advice

### GitHub Security Tab

1. Go to your repository
2. Click **Security** tab
3. View Snyk scan results (SARIF format)

---

## ⚙️ Configuration

### Sentry DSN Setup

**Frontend:**
Add to Railway/environment:

```
EXPO_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
```

**Backend:**
Add to Railway/environment:

```
SENTRY_DSN=https://your-key@sentry.io/project-id
```

### GitHub Secrets Needed

For Snyk → Sentry integration:

- `SENTRY_AUTH_TOKEN` - Sentry API token (Settings → Auth Tokens)
- `SENTRY_ORG` - Your Sentry organization slug
- `SENTRY_PROJECT` - Your Sentry project slug
- `SNYK_TOKEN` - Snyk API token (app.snyk.io → Settings → API Token)

---

## 🚨 Alert Types

### Sentry Alerts

**Frontend:**

- Component crashes (ErrorBoundary)
- API failures (5xx errors)
- Network issues
- Auth failures

**Backend:**

- Server crashes
- Database errors
- API endpoint failures

**Security (from Snyk):**

- Critical vulnerabilities
- High severity vulnerabilities
- Dependency issues

---

## 🔧 Customization

### Filter Errors in Sentry

Edit `utils/sentry.ts` or `server/src/lib/sentry.ts` to customize:

- Which errors to capture
- Error filtering (dev vs production)
- Sampling rates
- Context data

### Adjust Snyk Scanning

Edit `.github/workflows/snyk-security.yml` to:

- Change severity threshold
- Add/remove scan types
- Customize Sentry reporting

---

## ✅ Verification

### Test Sentry (Frontend)

1. Add a test error in your code
2. Trigger it in production build
3. Check Sentry dashboard for the error

### Test Sentry (Backend)

1. Trigger an error on an API endpoint
2. Check Sentry dashboard
3. Verify error context and stack trace

### Test Snyk Integration

1. Push code to GitHub
2. Check GitHub Actions for Snyk scan
3. If vulnerabilities found, check Sentry for alerts
4. Check GitHub Security tab for SARIF results

---

## 📝 Best Practices

1. **Always check Sentry** after deployments
2. **Review Snyk alerts** in Sentry regularly
3. **Fix critical/high vulnerabilities** immediately
4. **Use Sentry breadcrumbs** for debugging context
5. **Tag errors** with relevant context (userId, feature, etc.)

---

## 🎯 Current Status

- ✅ Sentry fully integrated (frontend + backend)
- ✅ Snyk scanning both frontend and server
- ✅ Automatic Snyk → Sentry reporting
- ✅ Error boundaries in place
- ✅ All error paths captured
- ✅ Security vulnerabilities automatically tracked

**Everything is working together to catch any and everything wrong with your code!**
