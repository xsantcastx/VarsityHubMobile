# Google Calendar OAuth Setup — Production Runbook

This document provides step-by-step instructions for deploying Google Calendar sync to production.

## Overview

The Google Calendar feature allows users to export their VarsityHub games and events to their personal Google Calendar. The implementation uses OAuth 2.0 for authentication and the Google Calendar API for event management.

**Status**: Phase 2a complete — backend routes production-ready. Phase 2b (settings UI) in progress.

---

## Prerequisites

- Access to a Google Cloud Console project
- Access to Railway production environment variables
- Production API domain (e.g., `api.varsityhub.app`)
- Mobile app rebuild capability (for Android intent filters)

---

## Step 1: Create Google OAuth 2.0 Credentials

### 1.1 Open Google Cloud Console

1. Navigate to [Google Cloud Console](https://console.cloud.google.com)
2. Select your VarsityHub project (or create a new one)
3. Enable the **Google Calendar API**:
   - Go to **APIs & Services > Library**
   - Search for "Google Calendar API"
   - Click **Enable**

### 1.2 Create OAuth 2.0 Web Application Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Select **Web application**
4. Fill in the following:
   - **Name**: `VarsityHub Calendar OAuth (Production)`
   - **Authorized JavaScript origins**: 
     - `https://api.varsityhub.app`
     - `https://www.api.varsityhub.app` (optional, for consistency)
   - **Authorized redirect URIs**:
     - `https://api.varsityhub.app/v1/auth/calendar-oauth-callback`
     - `https://www.api.varsityhub.app/v1/auth/calendar-oauth-callback` (optional)

5. Click **Create**
6. Note the **Client ID** and **Client Secret** (do not share publicly)

### 1.3 Configure OAuth Consent Screen (if not already done)

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External**
3. Fill in the app information:
   - **App name**: VarsityHub
   - **User support email**: support@varsityhub.app
   - **Developer contact**: your-email@varsityhub.app
4. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar` (for creating events)
5. Add test users (VarsityHub team members for testing)
6. Click **Save and Continue** and **Publish**

---

## Step 2: Configure Railway Environment Variables

### 2.1 Set Production Env Vars

Log into Railway and navigate to your VarsityHub API service. Add the following environment variables:

```bash
# Google Calendar OAuth Configuration
GOOGLE_CALENDAR_CLIENT_ID=<your-client-id>
GOOGLE_CALENDAR_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALENDAR_REDIRECT_URI=https://api.varsityhub.app/v1/auth/calendar-oauth-callback
```

**Important**: These are sensitive credentials. Use Railway's secret management UI (don't paste into CLI).

### 2.2 Verify Config Format

Ensure the values match exactly (no extra spaces, correct domain):

```bash
# Example (DO NOT use these values):
GOOGLE_CALENDAR_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX_abcdef1234567890
GOOGLE_CALENDAR_REDIRECT_URI=https://api.varsityhub.app/v1/auth/calendar-oauth-callback
```

---

## Step 3: Test OAuth Flow Locally

### 3.1 Set Up Local Development

1. Add the credentials to `server/.env`:

   ```bash
   GOOGLE_CALENDAR_CLIENT_ID=<your-client-id>
   GOOGLE_CALENDAR_CLIENT_SECRET=<your-client-secret>
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3001/v1/auth/calendar-oauth-callback
   ```

2. For local testing, also add to Google Cloud Console:
   - **Authorized redirect URIs**: `http://localhost:3001/v1/auth/calendar-oauth-callback`

### 3.2 Test OAuth Connection

1. Start the server: `npm run dev:server`
2. Start the app: `npm run dev`
3. Navigate to Settings > Calendar
4. Click "Connect Google Calendar"
5. Verify the OAuth dialog appears and accepts your credentials
6. Confirm the redirect back to `/settings?calendar_code=...` occurs

### 3.3 Test Event Sync

1. After connecting, click "Sync Now"
2. Verify events appear in your Google Calendar (check the calendar app at calendar.google.com)
3. Verify the "Last synced: just now" timestamp updates

### 3.4 Test Disconnect

1. Click "Disconnect"
2. Confirm the token is deleted (POST /v1/calendar/disconnect returns 200)
3. Verify the UI shows "Connect Google Calendar" again

---

## Step 4: Verify Production Deployment

### 4.1 Smoke Test Against Production

After deploying to Railway, run a full end-to-end test:

```bash
# Test 1: Unauthenticated requests fail gracefully
curl -X GET https://api.varsityhub.app/v1/calendar/sync-status
# Expected: 401 Unauthorized

# Test 2: Valid auth token can check status
curl -X GET https://api.varsityhub.app/v1/calendar/sync-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 200 OK with { connected: false } or { connected: true, lastSyncAt: "..." }
```

### 4.2 Full User Flow Test

1. Log into production app
2. Navigate to Settings > Calendar
3. Click "Connect Google Calendar"
4. Complete OAuth flow
5. Verify sync status shows "Connected"
6. Click "Sync Now"
7. Verify events appear in Google Calendar within 30 seconds
8. Verify "Last synced" timestamp updates

### 4.3 Error Handling Tests

1. **Invalid token**: Disconnect, then manually POST /v1/calendar/sync (should fail gracefully)
2. **Rate limiting**: Sync 5 times rapidly (should succeed without quota exceeded errors)
3. **Network failure**: Simulate network outage and verify retry logic (BullMQ job queuing)

---

## Step 5: Production Monitoring

### 5.1 Logging

Calendar operations use structured logging with `[calendar]` prefix:

- `[calendar] Connected` — successful OAuth token exchange
- `[calendar] Synced X events` — successful batch sync
- `[calendar] OAuth denied` — user denied OAuth permission
- `[calendar] Sync failed` — transient or permanent failure

Monitor Railway logs for these prefixes in production.

### 5.2 Sentry Integration

Calendar errors are automatically captured to Sentry via `captureException()`. Monitor the **VarsityHub** project for:

- Google API errors (quota exceeded, invalid credentials)
- Token expiration/refresh failures
- Database constraint violations

### 5.3 Performance Metrics

- **Sync time**: Expected < 5 seconds for 100 events
- **API calls per sync**: ~1 GET (calendar list) + N POST (events)
- **Google API quota**: ~1000 requests per 100 seconds per user (generous)

---

## Step 6: Troubleshooting

### OAuth Code Exchange Fails

**Symptom**: `[auth/calendar] OAuth callback missing code`

**Solution**:
1. Verify `GOOGLE_CALENDAR_REDIRECT_URI` matches exactly in Google Cloud Console
2. Check URL encoding (should include `?code=...` and `&state=...`)
3. Check server logs for exact error message

### Sync Silently Fails

**Symptom**: "Sync Now" returns success but events don't appear in Google Calendar

**Solution**:
1. Verify token is still valid (try disconnecting and reconnecting)
2. Check for quota errors in Sentry
3. Verify the game/event has a valid `date` and `venue_name` in VarsityHub DB
4. Check if 100-event batch size is the issue (very large rosters)

### "Missing Authorization Code" Error

**Symptom**: User sees "Missing authorization code" modal after Google OAuth

**Solution**:
1. Verify OAuth consent screen is published (not in test mode)
2. Verify user is in the test users list (for testing) or add to production access
3. Check Google Cloud Console for OAuth consent screen status

---

## Step 7: Enable for Users

### 7.1 Feature Flag (Optional)

If you want a gradual rollout, add a feature flag:

```typescript
// In server/src/middleware/requireProduction.ts
export function isCalendarSyncEnabled(userId: string) {
  // Gradual rollout: enable for 10% of users first
  return parseInt(userId.slice(-2), 16) < 26; // ~10%
}
```

### 7.2 Release Notes

Notify users of the new feature via in-app messaging or release notes:

> **New Feature: Google Calendar Sync**
> 
> Export your VarsityHub games and events to your personal Google Calendar. Go to Settings > Calendar to connect your account and sync upcoming games.

---

## Rollback Plan

If issues occur in production:

### 7.1 Disable Calendar OAuth (Quick Fix)

Set this env var to disable all calendar endpoints:

```bash
DISABLE_CALENDAR_SYNC=true
```

This will return 503 Service Unavailable for calendar endpoints without breaking existing connections.

### 7.2 Revert Code Changes (Full Rollback)

If critical bugs are discovered:

```bash
git revert <commit-hash>  # Revert calendar integration commit
npm run release:verify:build
git push --force-with-lease
railway up  # Redeploy
```

**Rollback impact**: Users with connected calendars will see 503 errors. They will not be automatically disconnected, so reconnection after re-enabling is seamless.

---

## Security Checklist

- [ ] `GOOGLE_CALENDAR_CLIENT_SECRET` is stored in Railway secrets, not in code
- [ ] `GOOGLE_CALENDAR_REDIRECT_URI` uses HTTPS in production
- [ ] OAuth consent screen is published (not test mode)
- [ ] Tokens are stored encrypted in `User.preferences` (not plaintext)
- [ ] Token refresh happens automatically on 401 (retry logic in place)
- [ ] `calendar.insertEvents` scope is least-privilege (can only create events, not read/delete)
- [ ] User can disconnect at any time (POST /v1/calendar/disconnect)
- [ ] No hardcoded user tokens or debugging credentials in production

---

## Next Steps (Phase 2b & Beyond)

1. **Phase 2b** (In Progress): Settings UI with Connect/Disconnect/Sync buttons
2. **Phase 2c** (Next): Auto-sync via BullMQ background job (hourly)
3. **Phase 3** (Future): Reverse sync — import events FROM Google Calendar
4. **Phase 4** (Future): Calendar selection (primary + other calendars)

---

## Support & Questions

- **Documentation**: `docs/ARCHITECTURE.md` (Google Calendar section)
- **Code Review**: See `server/src/lib/googleCalendar.ts` and `server/src/routes/calendar.ts`
- **Sentry Errors**: Filter by `[calendar]` tag
- **Google API Docs**: https://developers.google.com/calendar/api/guides/overview
