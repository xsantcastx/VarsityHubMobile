# Location-Based Event Posting & Push Notifications

## Overview
This implementation adds two critical features to VarsityHub:
1. **Geofenced Event Posting** - Users can only post to event pages when physically at the venue
2. **Push Notifications** - Automated notifications for social interactions and game reminders

## 1. Geofenced Event Posting

### Business Rules

**Story Posts** (24-hour ephemeral content):
- Posting window: opens on the event's UTC start day, stays open until **48 hours after** game start time
- Location requirement: Within **3km** of the venue
- Stories are temporary content that expire after 24 hours

**Regular Posts** (permanent content):
- Posting window: opens **2 days before** game start, live window runs through **+2 hours** after start; after that, posting stays open-ended (no closing cutoff) only for users who already posted during the live window
- Location requirement: Within **3km** of the venue (only enforced during the pre-event/live window — the post-event grace window skips the geofence check, since the qualifying live post already proved venue presence)
- Posts are permanent and appear on the event page

**General Rules:**
- Prevents users from different states/locations from trolling games
- Maintains authenticity of game content
- Sample events/games (IDs starting with "sample-") bypass all geofencing checks

### Technical Implementation

#### Backend Components
1. **`server/src/lib/geofencing.ts`** - Geolocation utilities
   - `calculateDistance()` - Haversine formula for lat/long distance (km or miles)
   - `isWithinGeofence()` - Check if user is within specified radius (km)
   - `isStoryPostingWindowOpen()` - Verify story posting window (event day through +48h)
   - `isPostPostingWindowOpen()` - Verify post posting window (opens 2 days before, live window +2h, then open-ended grace for live posters)
   - `verifyStoryPostingPermission()` - Story validation (3km radius, event day through +48h window)
   - `verifyEventPostingPermission()` - Post validation (3km radius during pre-event/live window; grace window skips the geofence for users who already posted live)

2. **`server/src/routes/posts.ts`** - Updated post creation
   - Added `event_id` field to post schema
   - Geofencing check before creating event-specific posts
   - Returns `403` error with distance if user too far away

#### API Usage

**Create Event Post:**
```typescript
POST /posts
{
  "content": "Great game!",
  "media_url": "https://...",
  "event_id": "evt_123",
  "location": {
    "lat": 34.0522,
    "lng": -118.2437
  }
}
```

**Responses:**
- ✅ Success (within geofence): `201 Created`
- ❌ Too early/late: `403 { error: "Posting is available from [start] to [end]" }`
- ❌ No location: `403 { error: "Location access required. You must be at the game venue to post." }`
- ❌ Too far: `403 { error: "You must be at [venue] to post. You are X.XX km away.", distance: X.XX }`

**Story Posting:**
- ✅ Success: `201 Created`
- ❌ Outside window: `403 { error: "Story posting is only available during the game (from [start] to [end])" }`
- ❌ Too far: `403 { error: "You must be at [venue] to post a story. You are X.XX km away.", distance: X.XX }`

### Frontend Requirements

1. **Request location permission** before posting to events
2. **Pass user's current lat/lng** in post request
3. **Handle 403 errors** with user-friendly messages
4. **Show distance** to venue when user is too far

Example:
```typescript
import * as Location from 'expo-location';

// Get user location
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Location Required', 'You must enable location to post to events');
  return;
}

const location = await Location.getCurrentPositionAsync({});

// Create post
await Post.create({
  content: "Amazing game!",
  media_url: uploadedUrl,
  event_id: eventId,
  location: {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
  }
});
```

---

## 2. Push Notifications

### Notification Triggers

#### 1. New Direct Message
- **When**: User receives a DM
- **Title**: "New message from {sender_name}"
- **Body**: Message preview (first 100 chars)
- **Data**: `{ type: 'new_message', sender_id, screen: 'messages' }`

#### 2. Post Interactions
- **When**: Someone likes/comments on user's post
- **Title**: "{actor_name} liked your post"
- **Body**: "Tap to view"
- **Data**: `{ type: 'post_interaction', interaction_type: 'like'|'comment', actor_id, post_id }`

#### 3. New Follower
- **When**: Someone follows the user
- **Title**: "{follower_name} started following you"
- **Body**: "Tap to view their profile"
- **Data**: `{ type: 'new_follower', follower_id, screen: 'profile' }`

#### 4. Game Reminders (RSVP'd Events)
- **12 Hours Before**: "Game reminder: {event_title}" - "Your game starts in 12 hours at {location}"
- **1 Hour Before**: "Game starting soon: {event_title}" - "Your game starts in 1 hour! Get ready!"
- **Data**: `{ type: 'game_reminder', hours_before: 12|1, event_id }`

### Technical Implementation

#### Backend Components

1. **`server/src/lib/notifications.ts`** - Notification system
   - `sendPushNotification()` - Core notification sender
   - `notifyNewMessage()` - DM notifications
   - `notifyPostInteraction()` - Like/comment notifications
   - `notifyNewFollower()` - Follow notifications
   - `notifyUpcomingGames()` - Game reminder batch sender
   - `scheduleGameReminders()` - Schedule reminders on RSVP
   - `cancelGameReminders()` - Cancel when RSVP removed

2. **Updated Routes:**
   - `server/src/routes/posts.ts` - Upvote & comment notifications
   - `server/src/routes/users.ts` - Follow notifications
   - `server/src/routes/messages.ts` - DM notifications
   - `server/src/routes/events.ts` - RSVP reminder scheduling

3. **`server/src/cron/game-reminders.ts`** - Scheduled job
   - Runs hourly via cron
   - Checks for games in 12h and 1h windows
   - Sends notifications to all RSVP'd users

#### Database Requirements

Users must store push tokens:
```prisma
model User {
  push_token String?
  preferences Json? // Can also store here as { push_token, notifications_enabled }
}
```

#### Cron Setup

**Run hourly:**
```bash
# Manual test
npm run cron:game-reminders

# Production (add to crontab)
0 * * * * cd /path/to/server && node dist/cron/game-reminders.js
```

**Or use a job scheduler:**
- AWS EventBridge (recommended for production)
- Heroku Scheduler
- Google Cloud Scheduler
- Bull/Agenda queue

### Frontend Requirements

1. **Register for push notifications** during onboarding
2. **Save push token** to user preferences
3. **Handle notification taps** with deep linking

Example:
```typescript
import * as Notifications from 'expo-notifications';
import { User } from '@/api/entities';

// Request permission
const { status } = await Notifications.requestPermissionsAsync();
if (status !== 'granted') return;

// Get token
const token = (await Notifications.getExpoPushTokenAsync()).data;

// Save to backend
await User.updatePreferences({ push_token: token });

// Handle notification taps
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  
  switch(data.type) {
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
```

---

## Installation

### Backend Dependencies
```bash
cd server
npm install expo-server-sdk
```

### Package.json Scripts
```json
{
  "scripts": {
    "cron:game-reminders": "tsx src/cron/game-reminders.ts"
  }
}
```

---

## Testing

### Test Geofencing
```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test post",
    "event_id": "evt_123",
    "location": {
      "lat": 34.0522,
      "lng": -118.2437
    }
  }'
```

### Test Push Notifications
```typescript
import { sendPushNotification } from './lib/notifications';

// Test notification
await sendPushNotification(
  'user_123',
  'Test Notification',
  'This is a test',
  { type: 'test' }
);
```

### Test Game Reminders
```bash
npm run cron:game-reminders
```

---

## Production Checklist

- [ ] Install `expo-server-sdk` dependency
- [ ] Set up cron job for game reminders (hourly)
- [ ] Ensure all events have latitude/longitude coordinates
- [ ] Test geofencing with various distances
- [ ] Verify push tokens are being saved
- [ ] Test notification delivery on iOS and Android
- [ ] Set up error monitoring for failed notifications
- [ ] Configure notification sounds and icons
- [ ] Test deep linking from notifications

---

## Security Considerations

1. **Location Privacy**: User location is only checked at posting time, not stored long-term
2. **Notification Spam**: Notifications only sent if user has `notifications_enabled: true`
3. **Self-Interaction**: No notifications sent when user interacts with their own content
4. **Token Validation**: All push tokens validated with `Expo.isExpoPushToken()`

---

## Future Enhancements

- [ ] Adjustable geofence radius per event type
- [ ] Notification preferences (granular control)
- [ ] Group notifications (e.g., "5 people liked your post")
- [ ] Rich notifications with images
- [ ] Scheduled posts (draft until at venue)
- [ ] Admin override for geofencing
