# Upload/Post Creation Flow - Implementation Status

## 📸 Current Implementation vs Requirements

### ✅ Currently Implemented

#### 1. **Swipe Toggle (Camera/Review)**
- **Status**: ✅ IMPLEMENTED
- **Location**: `app/create-post.tsx` lines 266-287
- Gesture-based swipe toggle in the middle of screen
- **Swipe UP** = Camera mode (blue highlight)
- **Swipe DOWN** = Review mode (red highlight)
- Visual feedback with scale animations
- Opacity changes during gesture

#### 2. **Rotating Prompts**
- **Status**: ✅ IMPLEMENTED
- **Location**: Lines 385-391
- Uses `<RotatingPrompts>` component
- Shows prompts like "Respect for every player on the field"
- Rotates every 6 seconds
- Integrated into post creation screen

#### 3. **Camera Integration**
- **Status**: ✅ IMPLEMENTED
- **Location**: Lines 205-257
- Direct camera launch with `ImagePicker.launchCameraAsync()`
- Supports both photo and video capture
- Video max duration: 30 seconds
- Image quality: 0.85 compression
- Automatic image resizing to 1280px width

#### 4. **Nearest Event Auto-Suggestion**
- **Status**: ✅ IMPLEMENTED
- **Location**: Lines 114-153
- Automatically suggests nearest game/event based on:
  - Time proximity (within 7 days)
  - Date/time sorting
- Shows top 5 nearby games for selection
- Auto-selects the closest upcoming game

#### 5. **Media Validation**
- **Status**: ✅ IMPLEMENTED
- **Location**: Lines 26-50
- File type validation (JPEG, PNG, GIF, WebP for images; MP4, MOV for videos)
- File size limits (10MB images, 100MB videos)
- Error alerts for invalid files

---

### ❌ Missing Features (To Be Implemented)

#### 1. **Video Recording with In-App Controls**
- **Status**: ❌ MISSING
- **Requirement**: "WHEN USER SELECTS VIDEO, START RECORDING"
- **Current**: Uses system camera app
- **Needed**: Custom in-app video recorder with:
  - Start/stop recording button
  - Recording timer display
  - Preview before saving
  - Consider using `expo-camera` for custom recording UI

#### 2. **Video Cropping/Trimming**
- **Status**: ❌ MISSING
- **Requirement**: "ABLE TO CROP VIDEO ON TOP"
- **Current**: No video editing capabilities
- **Needed**: 
  - Video trimming UI (start/end time selectors)
  - Timeline scrubber
  - Preview playback
  - Libraries to consider:
    - `react-native-video-processing`
    - `expo-video-thumbnails` for preview
    - `ffmpeg` for trimming (via `react-native-ffmpeg`)

#### 3. **Post Destination Selection (Stories-Style)**
- **Status**: ❌ MISSING
- **Requirement**: "AFTER POST BUTTON, OPTIONS SHOWING THEIR FOLLOWING AND PERSONAL PAGE"
- **Current**: Posts directly, no destination choice
- **Needed**: Instagram Stories-style destination selector:
  ```
  ┌────────────────────────────────┐
  │  [Your Story]  [Close Friends] │
  │       ↓              ↓          │
  │  Personal Page   Team Page     │
  └────────────────────────────────┘
  ```
  - Left/Right swipe to select destination
  - Options:
    - Your personal page
    - Team/event page
    - Your followers
    - Close friends list
  - Visual feedback for selection

#### 4. **Multi-Destination Posting**
- **Status**: ❌ MISSING
- **Requirement**: "PROMPTED IF THEY WANT TO POST ON THEIR PAGE, OR THE TEAM/EVENT PAGE"
- **Current**: Single destination only
- **Needed**:
  - Checkbox/toggle for multiple destinations
  - "Post to Personal Page" ✓
  - "Post to Team Page" ✓
  - "Share with Followers" ✓
  - Post to multiple places simultaneously

#### 5. **Story-Specific Upload**
- **Status**: ❌ MISSING
- **Requirement**: "ADD TO STORY, PROMPTS CAMERA NOT PHOTO GALLERY"
- **Current**: Shows both camera and gallery options
- **Needed**:
  - Separate flow for Stories
  - Stories ONLY allow camera (no gallery)
  - Auto-open camera when "Add to Story" is selected
  - Different UI for story creation vs post creation

---

## 🎯 Implementation Plan

### Phase 1: Video Editing (HIGH PRIORITY)

#### A. Add Video Trimming UI
```typescript
// New component: VideoTrimmer.tsx
import { Video } from 'expo-av';
import Slider from '@react-native-community/slider';

interface VideoTrimmerProps {
  videoUri: string;
  onTrim: (startTime: number, endTime: number) => void;
  onCancel: () => void;
}

const VideoTrimmer = ({ videoUri, onTrim, onCancel }: VideoTrimmerProps) => {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [duration, setDuration] = useState(30);
  
  return (
    <View style={styles.trimContainer}>
      <Video 
        source={{ uri: videoUri }}
        style={styles.videoPreview}
        resizeMode="contain"
        shouldPlay
        isLooping
      />
      
      <View style={styles.trimControls}>
        <Text>Start: {startTime.toFixed(1)}s</Text>
        <Slider
          value={startTime}
          onValueChange={setStartTime}
          minimumValue={0}
          maximumValue={duration - 1}
          step={0.1}
        />
        
        <Text>End: {endTime.toFixed(1)}s</Text>
        <Slider
          value={endTime}
          onValueChange={setEndTime}
          minimumValue={startTime + 1}
          maximumValue={duration}
          step={0.1}
        />
        
        <View style={styles.trimButtons}>
          <Button title="Cancel" onPress={onCancel} />
          <Button title="Trim" onPress={() => onTrim(startTime, endTime)} />
        </View>
      </View>
    </View>
  );
};
```

#### B. Integrate Video Processing
```typescript
// Add to create-post.tsx
import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const [showTrimmer, setShowTrimmer] = useState(false);
const [trimRange, setTrimRange] = useState({ start: 0, end: 30 });

const handleVideoTrim = async (startTime: number, endTime: number) => {
  try {
    // Option 1: Use FFmpeg (requires expo-av or react-native-ffmpeg)
    // Option 2: Use cloud service for trimming
    // Option 3: Accept full video and trim on backend
    
    setTrimRange({ start: startTime, end: endTime });
    setShowTrimmer(false);
  } catch (error) {
    Alert.alert('Trim Failed', 'Could not trim video. Please try again.');
  }
};
```

---

### Phase 2: Post Destination Selector (HIGH PRIORITY)

#### A. Create Destination Modal Component
```typescript
// New component: PostDestinationModal.tsx
interface Destination {
  id: string;
  type: 'personal' | 'team' | 'followers' | 'close_friends';
  name: string;
  icon: string;
  enabled: boolean;
}

const PostDestinationModal = ({ 
  visible, 
  onClose, 
  onConfirm 
}: Props) => {
  const [destinations, setDestinations] = useState<Destination[]>([
    { id: '1', type: 'personal', name: 'Your Story', icon: '👤', enabled: true },
    { id: '2', type: 'close_friends', name: 'Close Friends', icon: '⭐', enabled: false },
    { id: '3', type: 'team', name: 'Team Page', icon: '⚽', enabled: false },
    { id: '4', type: 'followers', name: 'Followers', icon: '👥', enabled: false },
  ]);

  const toggleDestination = (id: string) => {
    setDestinations(prev => 
      prev.map(dest => 
        dest.id === id ? { ...dest, enabled: !dest.enabled } : dest
      )
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.destinationCard}>
          <Text style={styles.modalTitle}>Share To</Text>
          
          {/* Story-style left/right selector */}
          <View style={styles.primaryOptions}>
            <Pressable
              style={[
                styles.primaryOption,
                destinations[0].enabled && styles.primaryOptionActive
              ]}
              onPress={() => toggleDestination('1')}
            >
              <Text style={styles.primaryIcon}>{destinations[0].icon}</Text>
              <Text style={styles.primaryLabel}>{destinations[0].name}</Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.primaryOption,
                destinations[1].enabled && styles.primaryOptionActive
              ]}
              onPress={() => toggleDestination('2')}
            >
              <Text style={styles.primaryIcon}>{destinations[1].icon}</Text>
              <Text style={styles.primaryLabel}>{destinations[1].name}</Text>
            </Pressable>
          </View>

          {/* Additional destinations */}
          <View style={styles.additionalOptions}>
            <Text style={styles.sectionLabel}>Also Share To</Text>
            {destinations.slice(2).map(dest => (
              <Pressable
                key={dest.id}
                style={styles.optionRow}
                onPress={() => toggleDestination(dest.id)}
              >
                <Text style={styles.optionIcon}>{dest.icon}</Text>
                <Text style={styles.optionName}>{dest.name}</Text>
                <Switch value={dest.enabled} onValueChange={() => toggleDestination(dest.id)} />
              </Pressable>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable 
              style={styles.confirmButton} 
              onPress={() => onConfirm(destinations.filter(d => d.enabled))}
            >
              <Text style={styles.confirmButtonText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
```

#### B. Integrate into Post Flow
```typescript
// Update create-post.tsx onSubmit
const [showDestinationModal, setShowDestinationModal] = useState(false);
const [selectedDestinations, setSelectedDestinations] = useState<Destination[]>([]);

const onSubmit = async () => {
  // First, show destination selector
  setShowDestinationModal(true);
};

const handleDestinationConfirm = async (destinations: Destination[]) => {
  setSelectedDestinations(destinations);
  setShowDestinationModal(false);
  
  // Now actually post to selected destinations
  await createPostsForDestinations(destinations);
};

const createPostsForDestinations = async (destinations: Destination[]) => {
  setSubmitting(true);
  try {
    // Upload media once
    const mediaUrl = picked?.uri ? await uploadFile(baseUrl, picked.uri, 'post-media', picked.mime) : null;
    
    // Create post for each destination
    for (const dest of destinations) {
      if (dest.type === 'personal') {
        await Post.create({
          content,
          media_url: mediaUrl?.url,
          post_type: 'personal',
        });
      } else if (dest.type === 'team' && selectedGameId) {
        await Post.create({
          content,
          media_url: mediaUrl?.url,
          game_id: selectedGameId,
          post_type: 'team',
        });
      }
      // ... handle other destination types
    }
    
    Alert.alert('Success', 'Posted to selected destinations!');
    router.back();
  } catch (error) {
    Alert.alert('Error', 'Failed to create posts');
  } finally {
    setSubmitting(false);
  }
};
```

---

### Phase 3: Story-Specific Flow (MEDIUM PRIORITY)

#### A. Separate Story Creation Screen
```typescript
// New file: app/create-story.tsx
export default function CreateStoryScreen() {
  useEffect(() => {
    // Auto-open camera when screen loads
    captureWithCamera('image');
  }, []);

  const captureWithCamera = async (type: 'image' | 'video') => {
    // Only allow camera, no gallery
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
      videoMaxDuration: 15, // Stories are shorter
    });
    
    if (!result.canceled) {
      // Proceed with story creation
      setStoryMedia(result.assets[0]);
    } else {
      // User cancelled, go back
      router.back();
    }
  };

  return (
    <View>
      {/* Story preview with camera overlay */}
      {/* No gallery button - camera only */}
      {/* Destination selector (Your Story / Close Friends) */}
    </View>
  );
};
```

#### B. Update Create Menu
```typescript
// app/create.tsx - add story option
<Pressable 
  style={styles.item} 
  onPress={() => go('/create-story')}
>
  <Text style={styles.itemText}>Add to Story</Text>
</Pressable>
```

---

## 📱 UI/UX Flow Diagram

### Current Flow:
```
Create Post
    ↓
Swipe Toggle (Camera/Review)
    ↓
Capture Media
    ↓
Add Caption
    ↓
[Post Button] → Post Created → Done
```

### Proposed Flow:
```
Create Post
    ↓
Swipe Toggle (Camera/Review)
    ↓
Capture Media
    ↓
[If Video] → Trim Video (NEW)
    ↓
Add Caption
    ↓
[Post Button] → Destination Selector (NEW)
    ↓
    ├─→ Your Story
    ├─→ Close Friends
    ├─→ Team Page
    └─→ Followers
    ↓
Multi-Destination Selection (NEW)
    ↓
[Share Button] → Posts Created → Done
```

### Story Flow (NEW):
```
Add to Story
    ↓
Camera Opens Automatically
    ↓
Capture Photo/Video (15s max)
    ↓
Add Text/Stickers (optional)
    ↓
Destination: [Your Story] or [Close Friends]
    ↓
[Share] → Story Added → Done
```

---

## 🔧 Technical Requirements

### Dependencies to Add:
```json
{
  "expo-av": "^14.0.0",  // Video playback for trimming
  "@react-native-community/slider": "^4.5.0",  // Trim timeline
  "expo-video-thumbnails": "^8.0.0",  // Video preview frames
  "react-native-ffmpeg": "^0.5.0"  // Video processing (optional)
}
```

### API Changes Needed:
```typescript
// Backend: Add destination field to posts
interface Post {
  // ... existing fields
  destinations: ('personal' | 'team' | 'followers' | 'close_friends')[];
  visibility: 'public' | 'followers' | 'close_friends';
}

// New endpoint: POST /posts/bulk
// Create multiple posts in one request
```

---

## 📋 Priority Implementation Order

1. **HIGH**: Post Destination Selector (Story-style UI)
2. **HIGH**: Multi-destination posting
3. **MEDIUM**: Video trimming UI
4. **MEDIUM**: Story-specific flow
5. **LOW**: Advanced video editing (filters, text overlay)

---

## ✅ Summary

### What's Working:
- ✅ Swipe toggle (blue/red for camera/review)
- ✅ Camera integration
- ✅ Rotating prompts
- ✅ Nearest event suggestion
- ✅ Media validation

### What's Missing:
- ❌ Video trimming/cropping
- ❌ Post destination selector (Stories-style)
- ❌ Multi-destination posting
- ❌ Story-only camera flow

### Next Steps:
Would you like me to implement:
1. The post destination selector modal first? (Instagram Stories-style)
2. Video trimming functionality?
3. Story-specific camera flow?

Let me know which feature you'd like to tackle first!
