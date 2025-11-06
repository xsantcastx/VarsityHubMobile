# 📱 Post Details — Horizontal Swipe Navigation Implementation

## ✅ Feature Complete!

Added horizontal swipe navigation to the Post Details screen (`app/post-detail.tsx`). Users can now swipe left/right between posts, similar to Instagram's post browsing.

## 🎯 What Was Implemented

### 1. Multi-Post URL Parameters
The screen now accepts additional parameters to enable swipe navigation:

```typescript
// Single post (existing behavior)
router.push('/post-detail?id=123');

// Multiple posts with swipe navigation (new!)
router.push('/post-detail?id=123&postIds=123,456,789&index=0');
```

**Parameters:**
- `id` - The current post ID to display
- `postIds` - Comma-separated list of post IDs (enables swipe navigation)
- `index` - Current position in the array (0-based)

### 2. Horizontal FlatList with Paging
When multiple posts are provided:
- ✅ **Horizontal swipe** enabled (left ← → right)
- ✅ **Smooth paging** - one post at a time
- ✅ **Auto-load data** - fetches post details + comments when swiped
- ✅ **Maintains scroll position** - vertical scrolling within each post preserved

### 3. Visual Indicators

#### Post Counter in Header
```
Post Details
2 of 5
```
Shows current position in the sequence.

#### Swipe Hint Banner
```
⇄ Swipe left or right to view more posts
```
Appears below header when multiple posts are available.

### 4. Smart State Management
Each swipe triggers:
1. **Post data load** - Fetches new post via `PostApi.get(postId)`
2. **Comments load** - Fetches comments via `PostApi.comments(postId)`
3. **State reset** - Updates post, comments, follow status, save status
4. **UI update** - Counter updates to show new position

## 🚀 Usage Examples

### From Feed Screen
```typescript
// In app/feed.tsx or similar
const posts = [
  { id: '1', title: 'Post 1' },
  { id: '2', title: 'Post 2' },
  { id: '3', title: 'Post 3' },
];

const openPost = (index: number) => {
  const postIds = posts.map(p => p.id).join(',');
  const currentId = posts[index].id;
  
  router.push(`/post-detail?id=${currentId}&postIds=${postIds}&index=${index}`);
};

// User taps second post
<Pressable onPress={() => openPost(1)}>
  <Text>View Post 2</Text>
</Pressable>
```

### From Notifications
```typescript
// In app/(tabs)/notifications/index.tsx
const handleNotificationTap = (notification: any) => {
  // Single post view (no swipe)
  router.push(`/post-detail?id=${notification.post.id}`);
  
  // OR enable swipe through related posts
  const relatedPosts = ['post1', 'post2', 'post3'];
  const postIds = relatedPosts.join(',');
  router.push(`/post-detail?id=${notification.post.id}&postIds=${postIds}&index=0`);
};
```

### From Team Page
```typescript
// In app/team-page.tsx
const teamPosts = team.posts; // Array of post objects

const openTeamPost = (postIndex: number) => {
  const postIds = teamPosts.map(p => p.id).join(',');
  const currentId = teamPosts[postIndex].id;
  
  router.push(`/post-detail?id=${currentId}&postIds=${postIds}&index=${postIndex}`);
};
```

## 🎨 UI/UX Features

### Responsive Design
- **Single post**: Original behavior unchanged (no swipe indicators)
- **Multiple posts**: Shows counter + hint banner

### Interaction
- **Swipe left** → Next post
- **Swipe right** → Previous post
- **Vertical scroll** → Scroll within post content/comments
- **Back button** → Return to previous screen

### Performance
- **Lazy loading** - Only loads data when post becomes visible
- **Smooth transitions** - Native FlatList paging animation
- **Memory efficient** - Doesn't pre-load all posts

## 📋 Implementation Details

### Key Changes to `app/post-detail.tsx`

#### 1. Updated Parameters
```typescript
const params = useLocalSearchParams<{ 
  id?: string; 
  postIds?: string; 
  index?: string;
}>();

const postIdsArray = params.postIds 
  ? params.postIds.split(',').filter(Boolean) 
  : params.id ? [params.id] : [];
  
const initialIndex = params.index ? parseInt(params.index, 10) : 0;
const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
const currentPostId = postIdsArray[currentPostIndex] || params.id;
```

#### 2. Modified Load Function
```typescript
const load = useCallback(async (postId?: string) => {
  const targetId = postId || currentPostId;
  if (!targetId) return;
  // ... fetch post and comments
}, [currentPostId]);
```

#### 3. Viewable Items Handler
```typescript
const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
  if (viewableItems && viewableItems.length > 0) {
    const visibleIndex = viewableItems[0].index;
    if (visibleIndex !== undefined && visibleIndex !== currentPostIndex) {
      setCurrentPostIndex(visibleIndex);
      const newPostId = postIdsArray[visibleIndex];
      if (newPostId) {
        load(newPostId);
      }
    }
  }
}).current;
```

#### 4. Conditional Rendering
```typescript
{hasMultiplePosts ? (
  <FlatList
    ref={flatListRef}
    data={postIdsArray}
    horizontal
    pagingEnabled
    showsHorizontalScrollIndicator={false}
    initialScrollIndex={initialIndex}
    onViewableItemsChanged={onViewableItemsChanged}
    renderItem={() => (
      <View style={{ width: SCREEN_WIDTH }}>
        {renderPostContent()}
      </View>
    )}
  />
) : (
  renderPostContent()
)}
```

## 🧪 Testing Checklist

### Single Post Mode (Backward Compatibility)
- [ ] Open from notification with just `id` parameter
- [ ] No swipe indicators shown
- [ ] Swipe gestures do nothing (expected)
- [ ] All interactions work (upvote, comment, save, etc.)

### Multi-Post Mode (New Feature)
- [ ] Open with `postIds` parameter
- [ ] Counter shows correct position (e.g., "2 of 5")
- [ ] Swipe hint banner appears
- [ ] Swipe left loads next post smoothly
- [ ] Swipe right loads previous post smoothly
- [ ] First post: can't swipe right beyond
- [ ] Last post: can't swipe left beyond
- [ ] Each post loads correct data (title, media, comments)
- [ ] Upvote/comment/save work on each swiped post
- [ ] Back button returns to previous screen

### Edge Cases
- [ ] Single item in `postIds` array (should show no swipe indicators)
- [ ] Invalid post ID in array (should handle gracefully)
- [ ] Swipe while loading (should queue or ignore)
- [ ] Delete current post while in swipe mode (should go back)

## 🎯 Next Steps

### Recommended Migrations

To enable swipe navigation from existing entry points:

#### 1. **Notifications Screen** (High Priority)
**File**: `app/(tabs)/notifications/index.tsx`

**Before:**
```typescript
router.push(`/post-detail?id=${notification.post.id}`);
```

**After:**
```typescript
// Option A: Single post (keep existing)
router.push(`/post-detail?id=${notification.post.id}`);

// Option B: Enable swipe through recent posts
const recentPostIds = notifications
  .filter(n => n.post?.id)
  .map(n => n.post.id)
  .slice(0, 10) // Last 10 posts
  .join(',');
  
router.push(`/post-detail?id=${notification.post.id}&postIds=${recentPostIds}&index=0`);
```

#### 2. **Team Page** (Medium Priority)
**File**: `app/team-page.tsx`

Enable swiping through all team posts:
```typescript
const teamPostIds = teamPosts.map(p => p.id).join(',');
const tappedIndex = teamPosts.findIndex(p => p.id === post.id);

router.push(`/post-detail?id=${post.id}&postIds=${teamPostIds}&index=${tappedIndex}`);
```

#### 3. **Game Details** (Medium Priority)
**File**: `app/game-details/GameDetailsScreen.tsx`

Enable swiping through game highlights:
```typescript
const gamePostIds = gameHighlights.map(h => h.id).join(',');
router.push(`/post-detail?id=${post.id}&postIds=${gamePostIds}&index=0`);
```

#### 4. **Mobile Community** (Low Priority)
**File**: `app/(tabs)/discover/mobile-community.tsx`

Enable swiping through community posts.

## 🎨 Optional Enhancements

### 1. Add Haptic Feedback
```typescript
import * as Haptics from 'expo-haptics';

const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
  // ... existing logic
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}).current;
```

### 2. Pre-load Adjacent Posts
```typescript
useEffect(() => {
  // Pre-fetch next/previous posts for smoother UX
  if (currentPostIndex > 0) {
    const prevId = postIdsArray[currentPostIndex - 1];
    PostApi.get(prevId).catch(() => {}); // Pre-load silently
  }
  if (currentPostIndex < postIdsArray.length - 1) {
    const nextId = postIdsArray[currentPostIndex + 1];
    PostApi.get(nextId).catch(() => {});
  }
}, [currentPostIndex, postIdsArray]);
```

### 3. Animated Position Indicator
```typescript
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const progress = (currentPostIndex / (postIdsArray.length - 1)) * 100;

<View style={styles.progressBar}>
  <Animated.View 
    style={[
      styles.progressFill, 
      { width: `${progress}%` }
    ]} 
  />
</View>
```

### 4. Swipe Gesture Recognizer (Advanced)
For more control over swipe behavior:
```typescript
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const swipeGesture = Gesture.Pan()
  .onEnd((e) => {
    if (e.velocityX < -500 && currentPostIndex < postIdsArray.length - 1) {
      // Swipe left - go to next
      flatListRef.current?.scrollToIndex({ index: currentPostIndex + 1 });
    } else if (e.velocityX > 500 && currentPostIndex > 0) {
      // Swipe right - go to previous
      flatListRef.current?.scrollToIndex({ index: currentPostIndex - 1 });
    }
  });
```

## 📊 Performance Considerations

### Optimizations Implemented
- ✅ **Lazy loading** - Posts load on-demand
- ✅ **Single data source** - One post state updated on swipe
- ✅ **Efficient rendering** - FlatList handles virtualization
- ✅ **Callback optimization** - Using useCallback to prevent re-renders

### Monitoring
Watch for:
- Memory usage with large post arrays (>50 items)
- Load time for posts with many comments (>100)
- Swipe responsiveness on lower-end devices

### Best Practices
- ✅ Limit postIds array to 20-50 items max
- ✅ Use pagination if browsing large collections
- ✅ Cache loaded posts to avoid re-fetching

## 🐛 Known Limitations

1. **Horizontal + Vertical Scroll**: Some devices may have sensitivity issues with simultaneous gestures
2. **Deep Linking**: External links must include all three params (id, postIds, index)
3. **State Persistence**: Swipe position resets on back navigation
4. **Comment Input**: Keyboard may affect swipe gestures on Android

## ✅ Summary

**Implementation Status**: ✅ Complete  
**Compilation Errors**: ✅ None  
**Backward Compatibility**: ✅ Maintained  
**Testing**: ⏳ Pending user testing  

The horizontal swipe navigation feature is fully implemented and ready for testing. Users can now browse through multiple posts seamlessly without returning to the feed, creating a smoother, more engaging experience similar to Instagram and TikTok.

---

**Next Action**: Test the feature by navigating to a post with the new URL format and verify smooth swiping behavior! 🚀
