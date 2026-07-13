# VarsityHub Auth & Core Features Testing Checklist

## Phase 1: Authentication Flows (Critical Path)

### Email/Password Registration

- [ ] Navigate to Sign-Up screen
- [ ] Enter valid email and password
- [ ] Verify no validation errors
- [ ] Submit form
- [ ] Check API response in Sentry dashboard
- [ ] Confirm redirect to email verification screen
- [ ] Verify email and proceed

### Email/Password Sign-In

- [ ] Navigate to Sign-In screen
- [ ] Enter registered credentials
- [ ] Submit form
- [ ] Verify user object loads (check AuthProvider logs in Sentry)
- [ ] Confirm redirect to dashboard `/(tabs)`
- [ ] Check user context available (useAuth hook working)

### Google OAuth Sign-In

- [ ] Tap "Sign in with Google"
- [ ] Verify OAuth prompt appears
- [ ] Complete Google login
- [ ] Check redirect URI in console (should be varsityhub.app/auth/google/callback)
- [ ] Confirm redirect back to app with auth token
- [ ] Verify user loads and dashboard appears

### Apple Sign-In

- [ ] Tap "Sign in with Apple"
- [ ] Complete Apple authentication
- [ ] Verify token received and stored
- [ ] Confirm redirect to dashboard

### Password Reset

- [ ] Go to "Forgot Password"
- [ ] Enter email address
- [ ] Verify email is sent (check API logs)
- [ ] Use reset link from email
- [ ] Enter new password
- [ ] Attempt sign-in with new password
- [ ] Confirm successful authentication

### Session Management

- [ ] Sign in completely
- [ ] Kill app and relaunch
- [ ] Verify app remembers auth token (no re-login needed)
- [ ] Sign out
- [ ] Verify redirect to Sign-In screen
- [ ] Verify token cleared from secure storage

---

## Phase 2: Dashboard & Core Features

### Dashboard Navigation

- [ ] Sign in successfully
- [ ] Verify `/(tabs)` dashboard loads
- [ ] Check all 4 tabs appear (Home, Explore, Create, Messages)
- [ ] Tap each tab - verify routing works
- [ ] Check user profile icon visible

### Home Tab

- [ ] Verify feed loads
- [ ] Check nearby games/events display
- [ ] Verify map shows if location enabled
- [ ] Scroll feed smoothly

### Explore Tab (Discover)

- [ ] Check discovery section loads
- [ ] Verify location-based results
- [ ] Test search/filter if available
- [ ] Check maps render for events

### Create Post

- [ ] Tap create button
- [ ] Verify form elements (text, image, etc.)
- [ ] Submit test post
- [ ] Verify success message
- [ ] Check post appears in feed

### Messages

- [ ] Verify message list loads
- [ ] Start new conversation
- [ ] Send test message
- [ ] Verify real-time updates (if applicable)

---

## Phase 3: Optional/Advanced Features

- [ ] Location services (permission prompt, GPS access)
- [ ] Push notifications (registration and delivery)
- [ ] Payment flow (Stripe integration)
- [ ] Image uploads
- [ ] Dark mode toggle
- [ ] User profile editing
- [ ] Team management (if applicable)

---

## Logging & Debugging

### Metro Console (Dev Client)

Watch for:

- No red error messages
- Auth flow logs appear in order
- API calls show 200 status codes
- No "Cannot find module" errors

### Sentry Dashboard

- Monitor real-time error reports
- Check breadcrumb trail for auth flow
- Look for any unhandled exceptions

### Commands to Monitor Logs

```bash
# Tail Metro logs while testing
npx expo start --dev-client --clear

# View simulator native logs
npx react-native log-ios

# Tail app logs
tail -f metro.log | grep ERROR
```

---

## Critical Path to Production

1. ✅ **App Launch Verified** - Done
2. **Auth Flows Tested** - In Progress
3. **Core Features Tested** - Next
4. **EAS Preview Build** - Then
5. **TestFlight/Play Store** - Final

---

## Known Working Configuration

| Component     | Status             | Notes                   |
| ------------- | ------------------ | ----------------------- |
| Sentry        | ✅ Real DSN        | Crash reporting active  |
| Google OAuth  | ✅ Configured      | varsityhub.app redirect |
| Apple Sign-In | ✅ Ready           | iOS 13+ support         |
| API Endpoint  | ✅ Production      | railway.app backend     |
| Maps          | ✅ API Key         | Real Google Maps key    |
| Stripe        | ✅ Publishable Key | Payment ready           |

---

## If Issues Arise

1. **Check Metro Console** - First place to look for errors
2. **Review Stack Trace** - Copy full error message
3. **Check Sentry Dashboard** - Real error telemetry
4. **Verify Network** - Ping API endpoint health
5. **Check Auth Token** - Verify in secure storage
6. **Clear Cache** - `npx expo start --dev-client --clear`

---

**Last Updated:** 2025-12-05  
**App State:** Production Ready  
**Testing Phase:** About to begin
