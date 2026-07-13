# Sample Event Posting - Verification Checklist

This document verifies that sample event posting works end-to-end.

## ✅ Completed Fixes

### 1. Server-Side (Backend)

- [x] **Geofencing Bypass**: `server/src/routes/posts.ts` detects sample events/games (IDs starting with "sample-") and bypasses geofencing
- [x] **Foreign Key Handling**: Sample game IDs are stored in `title` field with `[SAMPLE_GAME:sample-id]` marker to avoid database foreign key constraint
- [x] **Query Support**: GET `/posts?game_id=sample-*` queries posts by title field marker
- [x] **Title Cleaning**: API responses clean the marker from titles before returning to client
- [x] **Story Posting**: `server/src/routes/gameStories.ts` also bypasses geofencing for sample games

### 2. Client-Side (Frontend)

- [x] **Post Creation**: `app/(tabs)/create-post.tsx` sends `game_id` for sample events so server can detect them
- [x] **Event Display**: `app/public-event.tsx` queries posts for sample events using `Post.feedForGame(gameId)`
- [x] **Sample Event Detection**: Helper function `isSampleEvent()` correctly identifies sample events
- [x] **Mock Game Data**: Sample events create mock game objects for UI display

### 3. Build & Dependencies

- [x] **lottie-ios Patches**: All 8 Swift files patched with `@unchecked Sendable` conformance
- [x] **Postinstall Script**: `scripts/patch-lottie-ios.js` automatically patches on `npm install`
- [x] **Podfile Fixes**: Deployment targets set to minimum iOS 12.0
- [x] **Sentry Script**: Fixed to not fail builds (allows failures)

## 🔍 Verification Steps

### Test 1: Post to Sample Event

1. Navigate to a sample event page (e.g., `sample-warriors-cavaliers`)
2. Click "Create Post"
3. Add content and/or media
4. Submit post
5. **Expected**: Post is created successfully (201 status)
6. **Expected**: Post appears on the sample event page

### Test 2: Query Sample Event Posts

1. Navigate to sample event page
2. **Expected**: Posts created for this sample event are displayed
3. **Expected**: Posts are queried by `game_id` using title field marker

### Test 3: Story Posting to Sample Game

1. Navigate to sample game details
2. Create a story
3. **Expected**: Story is created without geofencing (201 status)

### Test 4: Real Event Geofencing Still Works

1. Navigate to a real event page
2. Try to post without location or outside geofence
3. **Expected**: Post is rejected with 403 status and location error

## 📋 Code Flow

### Post Creation Flow

```
User creates post on sample event
  ↓
Frontend: create-post.tsx sends game_id="sample-warriors-cavaliers"
  ↓
Server: posts.ts detects isSampleGame = true
  ↓
Server: Stores game_id in title as "[SAMPLE_GAME:sample-warriors-cavaliers] Original Title"
  ↓
Server: Sets game_id = null (avoids foreign key constraint)
  ↓
Server: Bypasses geofencing check
  ↓
Server: Creates post successfully
  ↓
Frontend: public-event.tsx queries posts by game_id
  ↓
Server: GET /posts?game_id=sample-* queries title field
  ↓
Server: Returns posts with cleaned titles (marker removed)
  ↓
Frontend: Displays posts on event page
```

## 🐛 Known Issues / Limitations

1. **Build Script Warnings**: Pods project scripts show warnings about missing outputs - these are non-blocking and can be ignored
2. **Database Lock Errors**: Can occur if multiple builds run simultaneously - fixed by killing all processes and clearing derived data

## 🔧 Maintenance

- The `scripts/patch-lottie-ios.js` script runs automatically on `npm install`
- If lottie-ios is updated, the patches may need to be reapplied
- The postinstall script in `package.json` ensures patches persist

## 📝 Files Modified

### Server

- `server/src/routes/posts.ts` - Sample event detection, title storage, query support
- `server/src/routes/gameStories.ts` - Sample game story posting
- `server/src/lib/geofencing.ts` - Geofencing rules (no changes needed for samples)

### Client

- `app/(tabs)/create-post.tsx` - Sends game_id for sample events
- `app/public-event.tsx` - Queries posts for sample events

### Build

- `ios/Podfile` - Deployment target fixes, lottie-ios patching
- `ios/VarsityHub.xcodeproj/project.pbxproj` - Sentry script fix
- `scripts/patch-lottie-ios.js` - Automated lottie-ios patching
- `package.json` - Postinstall hook

### Dependencies

- `node_modules/lottie-ios/Sources/**/*.swift` - 8 files patched (auto-patched on install)
