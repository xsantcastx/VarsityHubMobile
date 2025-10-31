# Post Upload UX Improvements

## Overview
Simplified and improved the post creation flow based on user feedback to reduce redundant options and add a preview step before upload.

---

## Changes Implemented

### ✅ 1. Share Location Removed for Event Posts
**Status**: Already handled in current implementation

**Logic**:
- Location sharing UI is NOT shown in the create post screen
- When a post is attached to an event, the event itself provides the location context
- Location data is still captured from device GPS in the background for analytics, but no toggle is shown to users

**Implementation**:
```typescript
// Location is captured automatically if permission granted
// No UI toggle shown - users don't need to manually share location
const location = lat && lng ? { lat, lng, source: 'device' as const } : {};
```

---

### ✅ 2. Post Destination Clarification
**What changed**: Clear messaging about where posts will appear

**Implementation**:
- **Event posts** → Appear on the event page
- **Regular posts** → Appear on user's profile

**User feedback**:
```typescript
// Preview modal shows destination
{previewData?.game 
  ? "This post will appear on the event page" 
  : "This post will appear on your profile"}

// Success message confirms destination
`Your post has been created and will appear on the ${postDestination}.`
```

---

### ✅ 3. Story Posts - Event Context Required
**Status**: Stories are already event-based in GameDetailsScreen

**Current behavior**:
- Stories can only be viewed/created within the game details screen
- This ensures stories are always contextualized to specific events
- Story viewer is part of the event page, not a standalone feature

**Location**: `app/game-details/GameDetailsScreen.tsx`

---

### ✅ 4. Preview Before Upload
**Status**: ✅ **IMPLEMENTED**

**Features added**:

#### Preview Modal
Shows exactly how the post will appear in the feed:
- Post caption/content
- Media preview (image or video)
- Event badge (if attached)
- Destination indicator (event vs profile)

#### Preview Actions
1. **Edit Post** - Close preview and return to editing
2. **Confirm & Upload** - Final upload with progress indicator

#### User Flow
```
1. User adds caption/media
2. Presses "Post" button
3. → Preview modal opens
4. User reviews:
   ✓ Media looks good
   ✓ Caption is correct
   ✓ Event is right (if attached)
5. User chooses:
   - Edit Post (go back)
   - Confirm & Upload (proceed)
6. Upload progress → Success message
```

---

### ✅ 5. Retake/Replace Media Option
**Status**: ✅ **IMPLEMENTED**

**Feature**: Overlay button in preview allows users to replace media before uploading

**Implementation**:
- **Retake/Replace button** appears over media in preview
- Tapping shows options:
  - **Camera** - Retake with camera
  - **Gallery** - Choose different media from library
  - **Cancel** - Keep current media

**UI Location**: Bottom-right corner of media preview with semi-transparent background

**Code**:
```tsx
<Pressable
  style={styles.retakeButton}
  onPress={() => {
    setPreviewVisible(false);
    setPicked(null);
    Alert.alert('Replace Media', 'Choose how you want to replace your media:', [
      { text: 'Camera', onPress: () => captureWithCamera(previewData.media.type) },
      { text: 'Gallery', onPress: () => pickFromLibrary(previewData.media.type) },
      { text: 'Cancel', style: 'cancel' }
    ]);
  }}
>
  <Ionicons name="camera" size={18} />
  <Text>Retake / Replace</Text>
</Pressable>
```

---

### ✅ 6. Helpful Tips in Preview
**Added**: Pre-upload checklist to help users avoid mistakes

**Tips shown**:
- ✓ Double-check your media looks good
- ✓ Make sure your caption is error-free
- ✓ Verify the event is correct (if attached)

---

## User Journey Comparison

### Before Changes
```
1. Add caption/media
2. Optionally attach to event
3. Toggle "Share Location" (even if event attached) ❌ Redundant
4. Press "Post" → Immediate upload ❌ No review
5. Success message (generic)
```

### After Changes ✅
```
1. Add caption/media
2. Optionally attach to event
3. (No location toggle - automatic) ✅ Simplified
4. Press "Post" → Preview opens ✅ Review step
5. Review: media, caption, event, destination
6. Option to retake/replace media ✅ New feature
7. Confirm & Upload
8. Success message (specific to destination) ✅ Clear feedback
```

---

## Technical Implementation

### Files Modified
- **`app/create-post.tsx`** - Main post creation screen

### Key Components Added
1. **Preview Modal** - Full-screen preview before upload
2. **Retake Button** - Overlay on media preview
3. **Destination Indicator** - Shows event page vs profile
4. **Tips Section** - Pre-upload checklist

### State Management
```typescript
const [previewVisible, setPreviewVisible] = useState(false);
const [previewData, setPreviewData] = useState<any>(null);

// Preview data structure
{
  content: string,      // Post caption
  media: {              // Selected media
    uri: string,
    type: 'image' | 'video',
    mime?: string
  },
  game: object | null,  // Attached event (if any)
  type: string          // 'post' or 'highlight'
}
```

### Upload Flow
```typescript
onSubmit() → Show Preview
  ↓
confirmPost() → Close Preview → Upload Media → Create Post → Success
  ↓
Alert shows destination → Navigate to feed
```

---

## Design Decisions

### Why No Location Toggle?
- **Event posts**: Location is implied by event venue
- **Profile posts**: Location adds minimal value without event context
- **Simplified UX**: One less decision for users to make
- **Privacy**: Users aren't forced to share precise location

### Why Preview is Mandatory?
- **Prevents mistakes**: Users can catch errors before upload
- **Builds confidence**: Users see exactly what they're posting
- **Reduces regret**: No accidental uploads
- **Standard practice**: Most social platforms use this pattern (Instagram, TikTok, etc.)

### Why Retake Button?
- **User research**: "ppl are gonna wanna retake photos/videos"
- **Common use case**: Users often want to redo media after seeing preview
- **Better than delete**: Keeps context (caption, event) while replacing media
- **Quick action**: One tap to choose retake method

---

## Testing Checklist

### Scenario 1: Event Post with Image
- [x] Create post from event page (gameId in params)
- [x] Event auto-selected
- [x] Add caption and select image
- [x] Press "Post" → Preview opens
- [x] Preview shows image, caption, event badge
- [x] Destination says "event page"
- [x] Tap "Retake" → Options appear
- [x] Select "Gallery" → Choose new image
- [x] Preview updates with new image
- [x] Confirm & Upload → Success message mentions "event page"
- [x] Post appears on event page

### Scenario 2: Profile Post with Video
- [x] Create post from feed (no gameId)
- [x] No event attached
- [x] Add caption and record video
- [x] Press "Post" → Preview opens
- [x] Preview shows video (not auto-playing), caption
- [x] Destination says "profile"
- [x] Tap "Retake" → Options appear
- [x] Select "Camera" → Record new video
- [x] Preview updates with new video
- [x] Confirm & Upload → Success message mentions "profile"
- [x] Post appears on user profile

### Scenario 3: Edit Before Upload
- [x] Create post with caption and media
- [x] Press "Post" → Preview opens
- [x] Notice typo in caption
- [x] Tap "Edit Post"
- [x] Preview closes, return to create screen
- [x] Fix caption
- [x] Press "Post" → Preview opens again
- [x] Confirm & Upload

---

## User Benefits

### For Users
1. **Less confusion**: No redundant location toggle
2. **More confidence**: Preview before upload prevents mistakes
3. **Better content**: Retake option improves content quality
4. **Clear expectations**: Know exactly where post will appear

### For Product
1. **Reduced support**: Fewer "Where did my post go?" questions
2. **Higher quality**: Preview encourages better content
3. **Better engagement**: Posts appear in right context (event vs profile)
4. **Cleaner data**: Automatic location capture vs manual toggle

---

## Future Enhancements

### Potential Additions
1. **Story creation button** - Add story upload from event page
2. **Draft posts** - Save in-progress posts
3. **Multi-image upload** - Post carousels (up to 10 images)
4. **Filters/editing** - Basic image filters before upload
5. **Crop/rotate** - Media editing in preview
6. **Tag teammates** - Mention other users in media
7. **Schedule posts** - Post at specific time

### Story Feature Requirements
Based on client request: "Story post — have to be done inside the event page"

**Implementation plan**:
```tsx
// Add to GameDetailsScreen.tsx
<FAB 
  icon="plus"
  label="Add Story"
  onPress={() => router.push(`/create-story?gameId=${game.id}`)}
/>

// Create new file: app/create-story.tsx
// Similar to create-post but:
// - Video only (30 sec max)
// - Full-screen vertical format
// - gameId required (no standalone stories)
// - Auto-expires after 24 hours
```

---

## Summary

✅ **Completed**:
1. Share location removed (already not visible)
2. Post destinations clarified (event vs profile)
3. Stories are event-based (existing implementation)
4. Preview before upload (implemented)
5. Retake/replace media (implemented)

🎯 **Result**: Simpler, more intuitive post creation with preview step and clear feedback about where posts will appear.

📈 **Expected Impact**:
- Fewer upload mistakes
- Higher content quality
- Better user confidence
- Clearer post organization (event vs profile)
