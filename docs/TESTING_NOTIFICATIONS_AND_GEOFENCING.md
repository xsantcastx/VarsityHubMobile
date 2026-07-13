# Testing Guide: Push Notifications & Geofencing

## Quick Answer to Your Questions

### Do I need another service?

**NO!** Both features use built-in Expo services:

- **Push Notifications**: Expo Push Notification Service (FREE, built-in)
- **Location Access**: Expo Location (FREE, uses native device GPS)

No Firebase, Google Maps API, or third-party services needed! 🎉

---

## Verification Status Helper (Admin Only)

Need to confirm whether a test account has finished email/SMS verification or is marked `is_active`? Use the guarded helper endpoint that now ships with the backend:

```bash
# Requires an admin JWT in the Authorization header
curl "https://YOUR_API_DOMAIN/test-notifications/verification-status?email=test@example.com" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

**Response sample**

```json
{
  "success": true,
  "user": {
    "email": "test@example.com",
    "email_verified": true,
    "phone_verified": false,
    "phone_present": true,
    "phone_masked": "••••1234",
    "is_active": false
  },
  "activation_ready": false,
  "next_steps": ["phone_verification", "activate_account"]
}
```

- Provide either `email` or `userId` query params.
- Endpoint is available anywhere `test-notifications` routes are mounted (dev by default, production when enabled).
- Only admins (emails listed in `ADMIN_EMAILS`) may call it.

---

## Prerequisites

1. **Install Backend Dependency:**

```bash
cd server
npm install expo-server-sdk
```

2. **Rebuild TypeScript:**

```bash
npm run build
# or
npm run dev  # if using nodemon
```

3. **Have the Expo app running** on a physical device (push notifications don't work in simulator)

---

## Part 1: Testing Push Notifications

### Step 1: Register for Push Notifications (Frontend)

Add this to your onboarding or settings:

```typescript
// In app/onboarding/step-9-features.tsx or similar

import * as Notifications from 'expo-notifications';
import { User } from '@/api/entities';

// Request permission and save token
const registerPushNotifications = async () => {
  // Request permission
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert('Permission Denied', 'Enable notifications in settings');
    return;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_PROJECT_ID', // Get from app.json expo.extra.eas.projectId
  });

  const token = tokenData.data;
  console.log('📱 Push token:', token);

  // Save to backend
  await User.updatePreferences({
    push_token: token,
    notifications_enabled: true,
  });

  Alert.alert('Success', 'Notifications enabled!');
};
```

### Step 2: Check if Token is Registered

Use the test endpoint to verify:

```bash
# Replace YOUR_AUTH_TOKEN with your actual JWT token
curl http://localhost:4000/test-notifications/test/check-token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Expected Response:**

```json
{
  "has_token": true,
  "token_preview": "ExponentPushToken[...",
  "notifications_enabled": true,
  "status": "✅ Ready to receive notifications"
}
```

### Step 3: Send Test Notification

```bash
# Send a basic test notification
curl -X POST http://localhost:4000/test-notifications/test/push \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Simulate different notification types
curl -X POST http://localhost:4000/test-notifications/test/simulate/message \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

curl -X POST http://localhost:4000/test-notifications/test/simulate/like \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

curl -X POST http://localhost:4000/test-notifications/test/simulate/comment \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

curl -X POST http://localhost:4000/test-notifications/test/simulate/follow \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**You should see notifications on your device within seconds!** 📱

### Step 4: Test Real Notification Triggers

1. **Test DM Notification:**
   - Have another user send you a message
   - You should get notification: "New message from [name]"

2. **Test Like Notification:**
   - Create a post
   - Have another user like it
   - You should get: "[name] liked your post"

3. **Test Follow Notification:**
   - Have another user follow you
   - You should get: "[name] started following you"

4. **Test Game Reminders:**
   - Create an event 12 hours in the future
   - RSVP to it
   - Run the cron job: `npm run cron:game-reminders`
   - You should get: "Game reminder: [event title]"

---

## Part 2: Testing Geofencing

### Step 1: Get Your Current Location (Frontend)

```typescript
import * as Location from 'expo-location';

// Request permission
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Location Required');
  return;
}

// Get current position
const location = await Location.getCurrentPositionAsync({});
console.log('📍 Your location:', {
  lat: location.coords.latitude,
  lng: location.coords.longitude,
});
```

### Step 2: Test Distance Calculation

```bash
# Calculate distance between two points
curl -X POST http://localhost:4000/test-notifications/test/distance \
  -H "Content-Type: application/json" \
  -d '{
    "lat1": 34.0522,
    "lng1": -118.2437,
    "lat2": 34.0622,
    "lng2": -118.2537
  }'
```

**Response:**

```json
{
  "distance_miles": "0.87",
  "distance_km": "1.40",
  "within_geofence": false,
  "geofence_radius": "0.5 miles"
}
```

### Step 3: Create Test Event with Location

```bash
# Create an event at a known location
curl -X POST http://localhost:4000/events \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Game",
    "date": "2025-11-18T19:00:00Z",
    "location": "123 Main St, Los Angeles, CA",
    "latitude": 34.0522,
    "longitude": -118.2437
  }'
```

Save the `event_id` from the response!

### Step 4: Test Geofence Check

```bash
# Test if you're allowed to post to this event
curl -X POST http://localhost:4000/test-notifications/test/geofence \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "YOUR_EVENT_ID",
    "lat": 34.0522,
    "lng": -118.2437
  }'
```

**If you're AT the location:**

```json
{
  "allowed": true,
  "distance_miles": 0.02,
  "event": {
    "title": "Test Game",
    "location": "123 Main St...",
    "event_coords": { "lat": 34.0522, "lng": -118.2437 },
    "your_coords": { "lat": 34.0522, "lng": -118.2437 }
  }
}
```

**If you're too far away:**

```json
{
  "allowed": false,
  "reason": "You must be at 123 Main St to post. You are 5.2 miles away.",
  "distance_miles": 5.2
}
```

### Step 5: Test Actual Event Post

```bash
# Try to create a post for the event
curl -X POST http://localhost:4000/posts \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Amazing game!",
    "event_id": "YOUR_EVENT_ID",
    "location": {
      "lat": 34.0522,
      "lng": -118.2437
    }
  }'
```

**Success (within geofence):** `201 Created`
**Failure (too far):** `403 { error: "Location verification failed", message: "You must be at..." }`

---

## Part 3: Testing Game Reminders (Scheduled Notifications)

### Step 1: Create Event in 12 Hours

```typescript
// Create an event exactly 12 hours from now
const now = new Date();
const gameTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);

const event = await Event.create({
  title: 'Reminder Test Game',
  date: gameTime.toISOString(),
  location: 'Test Stadium',
  latitude: 34.0522,
  longitude: -118.2437,
});
```

### Step 2: RSVP to the Event

```typescript
await Event.rsvp(event.id, true);
```

### Step 3: Check Upcoming Games

```bash
curl http://localhost:4000/test-notifications/test/upcoming-games \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**

```json
{
  "current_time": "2025-11-17T20:00:00.000Z",
  "games_in_12_hours": 1,
  "games_in_1_hour": 0,
  "would_receive_12h_reminder": [
    {
      "id": "evt_123",
      "title": "Reminder Test Game",
      "date": "2025-11-18T08:00:00.000Z",
      "location": "Test Stadium"
    }
  ]
}
```

### Step 4: Manually Trigger Reminders

```bash
# Run the cron job manually
cd server
npm run cron:game-reminders
```

**You should receive a notification:**
"Game reminder: Reminder Test Game"
"Your game starts in 12 hours at Test Stadium"

---

## Part 4: Frontend Integration

### Complete Push Notification Handler

```typescript
// In App.tsx or _layout.tsx

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const router = useRouter();

  useEffect(() => {
    // Handle notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      console.log('📱 Notification tapped:', data);

      // Navigate based on notification type
      switch (data.type) {
        case 'new_message':
          router.push('/messages');
          break;

        case 'post_interaction':
          router.push(`/post-detail?id=${data.post_id}`);
          break;

        case 'new_follower':
          router.push(`/profile?id=${data.follower_id}`);
          break;

        case 'game_reminder':
          router.push(`/event-detail?id=${data.event_id}`);
          break;
      }
    });

    return () => subscription.remove();
  }, []);

  return <YourApp />;
}
```

### Complete Location-Based Posting

```typescript
// In create-post.tsx or similar

const createEventPost = async () => {
  if (!eventId) return;

  // 1. Request location permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Location Required',
      'You must enable location to post to event pages. This ensures only people at the game can post.'
    );
    return;
  }

  // 2. Get current location
  setLoading(true);
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // 3. Create post with location
  try {
    await Post.create({
      content: postContent,
      media_url: mediaUrl,
      event_id: eventId,
      location: {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      },
    });

    Alert.alert('Success', 'Posted to event!');
    router.back();
  } catch (error: any) {
    // Handle geofencing errors
    if (error.status === 403) {
      const message = error.data?.message || 'You must be at the venue to post';
      const distance = error.data?.distance;

      Alert.alert(
        'Location Verification Failed',
        distance ? `${message}\n\nYou are ${distance.toFixed(1)} miles away.` : message
      );
    } else {
      Alert.alert('Error', 'Failed to create post');
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Troubleshooting

### Push Notifications Not Working

1. **Check token is saved:**

   ```bash
   curl http://localhost:4000/test-notifications/test/check-token \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Verify token format:**
   - Should start with `ExponentPushToken[`
   - If it's a different format, regenerate

3. **Check notification permissions:**
   - iOS: Settings > [Your App] > Notifications
   - Android: Settings > Apps > [Your App] > Notifications

4. **Use physical device:**
   - Push notifications don't work in iOS Simulator
   - Android Emulator works but can be unreliable

5. **Check preferences:**
   - Ensure `notifications_enabled: true` in user preferences

### Geofencing Not Working

1. **Check event has coordinates:**

   ```bash
   curl http://localhost:4000/events/YOUR_EVENT_ID
   ```

   Should have `latitude` and `longitude` fields

2. **Verify location permission:**
   - iOS: Settings > [Your App] > Location > While Using
   - Android: Settings > Apps > [Your App] > Permissions > Location

3. **Check accuracy:**
   - Use `Location.Accuracy.High` for best results
   - GPS can be inaccurate indoors (±20-50 meters)

4. **Test with known coordinates:**
   - Use exact event coordinates to test "at venue"
   - Use far-away coordinates to test "too far"

---

## Production Deployment

1. **Install dependency:**

   ```bash
   cd server && npm install expo-server-sdk
   ```

2. **Set up cron job** (choose one):
   - **Heroku Scheduler**: Add hourly job `npm run cron:game-reminders`
   - **AWS EventBridge**: Cron expression `0 * * * *`
   - **Crontab**: `0 * * * * cd /path/to/server && npm run cron:game-reminders`

3. **Remove test endpoints** (or add admin auth):

   ```typescript
   // In server/src/index.ts
   if (process.env.NODE_ENV !== 'production') {
     app.use('/test-notifications', testNotificationsRouter);
   }
   ```

4. **Monitor notification delivery:**
   - Check server logs for "Sent notification to user..."
   - Expo Push Dashboard: https://expo.dev/notifications

---

## Success Checklist

- [ ] `expo-server-sdk` installed
- [ ] User has push token saved
- [ ] Can receive test notification
- [ ] Real notifications work (DM, like, comment, follow)
- [ ] Events have latitude/longitude coordinates
- [ ] Location permission granted
- [ ] Geofence blocks posts from far away
- [ ] Geofence allows posts from venue
- [ ] Game reminders working (12h and 1h)
- [ ] Notification taps navigate correctly

Once all checkboxes are ✅, you're production ready! 🚀
