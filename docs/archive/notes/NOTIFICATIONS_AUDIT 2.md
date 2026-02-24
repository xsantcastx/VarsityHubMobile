# Push Notifications System - Audit Report

**Date**: December 5, 2025  
**Status**: ⚠️ **PARTIALLY IMPLEMENTED** (Critical gaps identified)

---

## Summary

Push notifications are **architecturally complete** on the backend but **missing critical frontend implementation**. Users can receive notifications in theory, but the app doesn't actually request permission or save push tokens.

### Faith Level: 3/10 ⚠️

The infrastructure exists but users won't get notified because:
1. ❌ App doesn't request notification permissions
2. ❌ App doesn't register for Expo push tokens
3. ❌ App doesn't save tokens to backend
4. ✅ Backend would send notifications if tokens existed
5. ✅ Backend creates in-app notification records

---

## Backend Implementation Status

### ✅ Notification Functions Implemented

**File**: `server/src/lib/notifications.ts`

All three notification types are implemented:

1. **`notifyNewMessage()`** - Direct messages
   ```typescript
   - Triggered when user receives DM
   - Sends title: "New message from {senderName}"
   - Deep links to `/messages`
   ```

2. **`notifyPostInteraction()`** - Likes & comments
   ```typescript
   - Triggered on upvote: "John liked your post"
   - Triggered on comment: "Jane commented on your post"
   - Deep links to post detail page
   - Skips self-interactions (no notification if user likes own post)
   ```

3. **`notifyNewFollower()`** - New followers
   ```typescript
   - Triggered when user follows you
   - Sends: "Sarah started following you"
   - Deep links to their profile
   ```

### ✅ Integration Points (All Connected)

**Likes/Upvotes** - `server/src/routes/posts.ts` (line ~405)
```typescript
// When user upvotes a post:
await notifyPostInteraction(
  recipient,           // post author
  'like',
  userId,             // who upvoted
  actor.display_name,
  postId
);
```

**Comments** - `server/src/routes/posts.ts` (line ~354)
```typescript
// When user comments on post:
await notifyPostInteraction(
  recipient,          // post author
  'comment',
  req.user.id,
  comment.author?.display_name,
  id
);
```

**Direct Messages** - `server/src/routes/messages.ts` (line ~184)
```typescript
// When user sends message:
await notifyNewMessage(
  toId,              // recipient
  meId,              // sender
  created.sender?.display_name,
  content
);
```

**New Followers** - `server/src/routes/users.ts` (line ~325)
```typescript
// When user follows another:
await notifyNewFollower(
  following_id,      // person being followed
  follower_id,       // person following
  follower.display_name
);
```

### ✅ In-App Notifications (DB Records)

Parallel to push notifications, the app also stores notifications in DB:
- `notification.create()` called in same try/catch blocks
- Types: `FOLLOW`, `UPVOTE`, `COMMENT`
- Visible in app's Notifications tab (working ✅)

### ⚠️ Push Token Requirements

Backend **requires**:
```typescript
// From user.preferences
push_token: "ExponentPushToken[xxxxx...]"
notifications_enabled: true  // User consent
```

If either missing → notification skipped silently
```typescript
if (prefs && prefs.notifications_enabled === false) {
  console.log(`Notifications disabled for user ${userId}`);
  return;
}
if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
  console.log(`Invalid or missing push token for user ${userId}`);
  return;
}
```

---

## Frontend Implementation Status

### ❌ CRITICAL: Push Token Registration NOT Implemented

**Where it should be:**
1. ~~`app/onboarding/step-9-features.tsx`~~ - Asks for permission but doesn't register
2. ~~`app/_layout.tsx`~~ - App initialization
3. ~~`app/settings/index.tsx`~~ - User preferences

**What's missing:**

```typescript
// SHOULD DO in onboarding or app init:
import * as Notifications from 'expo-notifications';
import { User } from '@/api/entities';

const registerPushNotifications = async () => {
  // 1. Request permission
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // 2. Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EXPO_PROJECT_ID',  // From app.json
  });
  
  // 3. Save to backend
  await User.updatePreferences({ 
    push_token: tokenData.data,
    notifications_enabled: true
  });
};
```

### ✅ Notification Handler (Exists)

**File**: `app/_layout.tsx` (lines 54-62)
```typescript
// Android notification channel setup ✅
Notifications.setNotificationChannelAsync('default', {
  name: 'General',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [250, 250],
  sound: 'default',
  enableVibrate: true,
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  lightColor: '#2563EB',
})
```

### ❌ Notification Response Handler (NOT IMPLEMENTED)

**Missing**: Code to handle when user taps notification
```typescript
// Should be in _layout.tsx:
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  
  // Navigate based on notification type
  switch(data.type) {
    case 'new_message':
      router.push('/messages');
      break;
    case 'post_interaction':
      router.push(`/post/${data.post_id}`);
      break;
    case 'new_follower':
      router.push(`/profile/${data.follower_id}`);
      break;
  }
});
```

### ✅ In-App Notifications (Working)

**File**: `app/(tabs)/notifications/index.tsx`
- Fetches notifications from DB
- Shows in-app notifications list
- Types: `FOLLOW`, `UPVOTE`, `COMMENT`
- **This works** ✅ but users won't get push notifications

---

## Testing Status

### ✅ Test Endpoints Available
```bash
# Test all 3 notification types
POST /test-notifications/test  # All types
POST /test-notifications/test/push  # Single notification
GET /test-notifications/test/check-token  # Verify token exists
```

**Important**: Endpoints only work if:
1. User has already called `getExpoPushTokenAsync()` 
2. Token saved to user.preferences.push_token
3. Currently → endpoints return `has_token: false` ⚠️

---

## Documentation Status

✅ **Good documentation exists:**
- `docs/GEOFENCING_AND_NOTIFICATIONS.md` - Full flow documented
- `docs/TESTING_NOTIFICATIONS_AND_GEOFENCING.md` - Testing guide
- `.docs/ANDROID_POLISH_SUMMARY.md` - Android implementation notes

❌ **But documentation assumes:** Users will implement token registration themselves

---

## What Actually Happens Right Now

### 1. User Onboards
```
Step 9: "Enable Push Notifications?" → Toggle switch → Continue
└─ Saves: notifications_enabled: true
└─ ❌ Does NOT register for push token
```

### 2. User Gets Notified
```
Backend: "User upvoted my post!"
├─ Check: push_token exists? ❌ NO
├─ Check: notifications_enabled? ✅ YES
└─ Result: NOTIFICATION SKIPPED
   (Server logs: "Invalid or missing push token for user")
```

### 3. In-App Notification
```
Backend: Creates notification record in DB ✅
Frontend: Shows in Notifications tab ✅
User: Can see it in app (but didn't get push alert) ⚠️
```

### 4. Test Endpoints
```
GET /test-notifications/test/check-token
{
  "has_token": false,           ← 🚨 THE PROBLEM
  "token_preview": null,
  "notifications_enabled": true
}
```

---

## Detailed Implementation Gaps

### Gap 1: No Permission Request
```
❌ Missing:
- Notifications.requestPermissionsAsync()
- Only onboarding asks user, doesn't request OS permission
```

### Gap 2: No Token Generation
```
❌ Missing:
- Notifications.getExpoPushTokenAsync()
- Token never created, so nothing to save
```

### Gap 3: No Token Persistence
```
❌ Missing:
- User.updatePreferences({ push_token: ... })
- Even if token created, it's not sent to backend
```

### Gap 4: No Notification Tap Handler
```
❌ Missing:
- Notifications.addNotificationResponseReceivedListener()
- If notifications somehow arrived, tapping wouldn't navigate
```

### Gap 5: No In-Foreground Behavior
```
❌ Missing:
- Notifications.setNotificationHandler()
- (Actually this exists in _layout.tsx ✅)
- But without tokens, never matters
```

---

## What Needs to Be Done

### Priority 1: CRITICAL
```typescript
// Add to app/_layout.tsx or AuthProvider.tsx
// Run after user is authenticated

const setupPushNotifications = async (userId: string) => {
  try {
    // 1. Request permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Push notifications permission denied');
      return;
    }

    // 2. Get project ID from Expo config
    const appJson = require('../app.json');
    const projectId = appJson.expo?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('EXPO_PROJECT_ID not in app.json');
      return;
    }

    // 3. Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    const token = tokenData.data;
    console.log('📱 Got push token:', token.substring(0, 30) + '...');

    // 4. Save to backend
    await User.updatePreferences({ 
      push_token: token,
      notifications_enabled: true
    });
    
    console.log('✅ Push token saved to backend');
  } catch (error) {
    console.error('Failed to setup push notifications:', error);
    // Don't block app, just log
  }
};

// Call after auth succeeds
// e.g., in AuthProvider useEffect after user confirmed authenticated
setupPushNotifications(user.id);
```

### Priority 2: IMPORTANT
```typescript
// Add notification tap handler to app/_layout.tsx

useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    
    if (!data || !data.type) return;
    
    console.log('🔔 User tapped notification:', data.type);
    
    // Navigate based on notification type
    switch(data.type) {
      case 'new_message':
        router.push('/messages');
        break;
        
      case 'post_interaction':
        if (data.post_id) {
          router.push({
            pathname: '/post/[id]',
            params: { id: data.post_id }
          });
        }
        break;
        
      case 'new_follower':
        if (data.follower_id) {
          router.push({
            pathname: '/profile/[id]',
            params: { id: data.follower_id }
          });
        }
        break;
    }
  });
  
  return () => subscription.remove();
}, [router]);
```

### Priority 3: NICE-TO-HAVE
- Add notification badge count
- Add notification sound customization
- Add per-notification-type preferences UI
- Add retry logic for failed notifications

---

## Verification Checklist

To verify notifications work end-to-end:

- [ ] Add push token registration code to app
- [ ] User completes onboarding → push token saved
- [ ] Call `GET /test-notifications/test/check-token` → `has_token: true`
- [ ] Call `POST /test-notifications/test/push` → notification appears on device
- [ ] Tap notification → navigates to correct screen
- [ ] Have another user like your post
- [ ] Push notification arrives on your device
- [ ] Tap notification → goes to post detail page
- [ ] Have another user DM you
- [ ] Push notification arrives
- [ ] Tap notification → goes to messages
- [ ] Have another user follow you
- [ ] Push notification arrives
- [ ] Tap notification → goes to their profile

---

## Code Changes Required

**Files to modify:**
1. `app/_layout.tsx` - Add token registration + notification handler
2. `context/AuthProvider.tsx` - Trigger registration after auth
3. `app.json` - Ensure `extra.eas.projectId` is set (needed for token)
4. Optional: `app/settings/index.tsx` - Add "Manage Notifications" page

**Files already correct:**
- ✅ `server/src/lib/notifications.ts`
- ✅ `server/src/routes/posts.ts`
- ✅ `server/src/routes/messages.ts`
- ✅ `server/src/routes/users.ts`
- ✅ Backend integration tests

---

## Conclusion

**The system is 70% complete:**
- ✅ Backend infrastructure: solid
- ✅ Database: ready
- ✅ In-app notifications: working
- ✅ Test endpoints: available
- ❌ Frontend registration: missing (the critical 30%)

**Impact**: Users see notifications in-app but DON'T get push alerts on their home screen or lock screen.

**Fix ETA**: ~30 minutes to add token registration + notification handler
