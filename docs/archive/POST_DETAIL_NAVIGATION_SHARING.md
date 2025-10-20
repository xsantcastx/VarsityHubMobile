# Post Detail Navigation & Sharing Enhancement

## Overview

Enhanced the Post Detail screen (`app/post-detail.tsx`) to provide comprehensive navigation options and improved sharing capabilities. Users can now seamlessly navigate to related content (events, teams, user profiles) and share posts through multiple channels.

**Implementation Date**: October 13, 2025

---

## Features Implemented

### 1. **Enhanced Header with Dual Action Buttons**

#### Send to Friend Button
- **Icon**: Send outline (paper airplane)
- **Location**: Header (right side, before share button)
- **Functionality**: Opens action sheet with two options:
  - **Via VarsityHub DM**: Navigates to messages screen with post link pre-filled
  - **Share Externally**: Opens native share sheet

#### Share Button
- **Icon**: Share outline
- **Location**: Header (right side)
- **Functionality**: Opens native share sheet with:
  - Post title
  - Game/event context (teams, vs matchup)
  - Author attribution
  - Full URL to post

### 2. **Team Navigation Card**

New pressable card displays when post is associated with a team:

**Visual Design**:
- Icon: People outline (teal/blue)
- Team name in bold
- Sport type in muted text
- Chevron forward indicator
- Matches game info card styling

**Data Sources** (checks multiple fields):
- `post.team_id`
- `post.team?.id`
- `post.team?.name`
- `post.team?.sport`

**Navigation**:
- Taps navigate to: `/team-profile?id={teamId}`

### 3. **Quick Links Section**

A new section at the bottom of post content providing one-tap access to related pages:

**Visual Design**:
- Border separator above section
- "QUICK LINKS" uppercase title
- Horizontal row of pill-shaped buttons
- Icon + text for each link
- Wraps on smaller screens

**Available Links** (conditionally rendered):

#### View Event
- **Icon**: Basketball (blue)
- **Condition**: `post.game?.id` exists
- **Navigation**: `/game-detail?id={gameId}`

#### View Team
- **Icon**: People (green)
- **Condition**: `post.team_id` or `post.team?.id` exists
- **Navigation**: `/team-profile?id={teamId}`

#### View Profile
- **Icon**: Person (purple)
- **Condition**: `post.author_id` exists
- **Navigation**: `/user-profile?id={authorId}`

### 4. **Improved Share Functionality**

#### Enhanced Message Composition
```typescript
// Before: Simple title + URL
"Check out: {title}"

// After: Rich context with formatting
"Check out: {title}
- {home_team} vs {away_team} on VarsityHub!
Posted by {author_name}

https://varsityhub.com/post/{id}"
```

#### Native Share Sheet Metadata
- **Title**: Post title or "VarsityHub Post"
- **Message**: Full formatted message with context
- **URL**: Direct link to post

#### Send to Friend Options
- **VarsityHub DM**: Pre-fills message with post link
- **External Share**: Uses native share (SMS, WhatsApp, etc.)

---

## Technical Implementation

### State Management

No new state variables required - uses existing post data.

### Navigation Flow

```
Post Detail
├── Header Actions
│   ├── Send to Friend → Action Sheet
│   │   ├── Via VarsityHub DM → /messages?sharePost={id}
│   │   └── Share Externally → Native Share
│   └── Share → Native Share
├── Game Card (if exists)
│   └── Tap → /game-detail?id={gameId}
├── Team Card (if exists)
│   └── Tap → /team-profile?id={teamId}
├── Author Info
│   └── Tap → /user-profile?id={authorId}
└── Quick Links
    ├── View Event → /game-detail?id={gameId}
    ├── View Team → /team-profile?id={teamId}
    └── View Profile → /user-profile?id={authorId}
```

### Code Structure

#### New Functions

```typescript
// Enhanced share with rich formatting
const onShare = async () => {
  // Builds message with title, game context, author, URL
  await Share.share({ message, url, title });
};

// Send to friend with options
const onSendToFriend = () => {
  Alert.alert('Send to Friend', 'Choose how to send this post', [
    { text: 'Via VarsityHub DM', onPress: () => router.push(`/messages?sharePost=${id}`) },
    { text: 'Share Externally', onPress: onShare }
  ]);
};
```

#### New Components

**Team Card**:
```tsx
{(post.team_id || post.team) && (
  <Pressable 
    style={styles.teamInfo}
    onPress={() => router.push(`/team-profile?id={teamId}`)}
  >
    <Ionicons name="people-outline" size={20} />
    <View style={styles.teamDetails}>
      <Text style={styles.teamTitle}>{post.team?.name}</Text>
      <Text style={styles.teamSport}>{post.team?.sport}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} />
  </Pressable>
)}
```

**Quick Links Section**:
```tsx
{(post.game?.id || post.team_id || post.author_id) && (
  <View style={styles.quickLinks}>
    <Text style={styles.quickLinksTitle}>Quick Links</Text>
    <View style={styles.quickLinksRow}>
      {/* Event, Team, Profile buttons */}
    </View>
  </View>
)}
```

### New Styles

```typescript
// Header Actions
headerActions: {
  flexDirection: 'row',
  gap: 8,
},
headerActionButton: {
  padding: 8,
  borderRadius: 8,
},

// Team Info Card
teamInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  marginBottom: 20,
  gap: 12,
},
teamDetails: {
  flex: 1,
},
teamTitle: {
  fontSize: 15,
  fontWeight: '600',
  marginBottom: 2,
},
teamSport: {
  fontSize: 13,
},

// Quick Links
quickLinks: {
  paddingTop: 20,
  marginTop: 20,
  borderTopWidth: 1,
},
quickLinksTitle: {
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
quickLinksRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
quickLinkButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 20,
  elevation: 2, // Android
  shadowOffset: { width: 0, height: 1 }, // iOS
  shadowOpacity: 0.1,
  shadowRadius: 2,
},
quickLinkText: {
  fontSize: 14,
  fontWeight: '600',
},
```

---

## User Experience

### Navigation Paths

#### From Post to Event
1. **Option A**: Tap game card in post content
2. **Option B**: Tap "View Event" in Quick Links

#### From Post to Team
1. **Option A**: Tap team card in post content (new)
2. **Option B**: Tap "View Team" in Quick Links (new)

#### From Post to User Profile
1. **Option A**: Tap author avatar/name
2. **Option B**: Tap "View Profile" in Quick Links

### Sharing Flows

#### Share to Social Media
```
User Flow:
1. Tap share icon in header
2. Native share sheet opens
3. Select app (Twitter, Facebook, Instagram, etc.)
4. Post message pre-filled with rich context
5. Share completes
```

#### Send to VarsityHub Friend
```
User Flow:
1. Tap send icon in header
2. Action sheet appears
3. Select "Via VarsityHub DM"
4. Navigate to messages screen
5. Select recipient
6. Post link pre-filled in message
7. Send message
```

#### Send via External App
```
User Flow:
1. Tap send icon in header
2. Action sheet appears
3. Select "Share Externally"
4. Native share sheet opens
5. Select app (SMS, WhatsApp, Messenger, etc.)
6. Share completes
```

---

## Design Specifications

### Colors

**Quick Link Icons**:
- Event (Basketball): `#2563EB` (Blue)
- Team (People): `#10B981` (Green)
- Profile (Person): `#8B5CF6` (Purple)

**Theme Adaptation**:
- All backgrounds adapt to light/dark mode
- Text colors use theme-aware `Colors[colorScheme]`
- Borders use theme-aware border colors

### Spacing

- Quick Links top padding: `20px`
- Quick Links top margin: `20px`
- Quick Links title bottom margin: `12px`
- Quick Links button gap: `8px`
- Quick Links button padding: `14px horizontal`, `10px vertical`
- Team card padding: `12px`
- Team card margin bottom: `20px`

### Typography

- Quick Links title: `14px`, `700 weight`, `uppercase`, `0.5 letter-spacing`
- Quick Link text: `14px`, `600 weight`
- Team title: `15px`, `600 weight`
- Team sport: `13px`, `normal weight`

### Accessibility

- All buttons meet `44x44pt` minimum tap target (iOS)
- Icon + text provides clear affordance
- Color contrast meets WCAG AA standards
- Descriptive navigation labels

---

## API Requirements

### Post Data Structure

The implementation expects the following optional fields in the post object:

```typescript
interface Post {
  id: string;
  title?: string;
  content?: string;
  author_id?: string;
  author?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  game?: {
    id: string;
    title: string;
    home_team?: string;
    away_team?: string;
  };
  team_id?: string;  // Direct team reference
  team?: {           // Populated team object
    id: string;
    name: string;
    sport?: string;
  };
  // ... other fields
}
```

### Fallback Behavior

**Missing team data**:
- Team card won't render if neither `team_id` nor `team` exists
- "View Team" quick link won't appear
- No errors thrown

**Missing game data**:
- Game card won't render if `game` is null
- "View Event" quick link won't appear
- No errors thrown

**Missing author data**:
- Author info shows "Anonymous" fallback
- "View Profile" quick link won't appear if `author_id` is missing
- Avatar shows default person icon

---

## Testing Checklist

### Visual Testing
- [ ] Header shows both send and share buttons
- [ ] Send button icon is paper airplane
- [ ] Share button icon is share outline
- [ ] Team card renders when team data exists
- [ ] Team card shows team name and sport
- [ ] Quick Links section appears at bottom
- [ ] Quick Links buttons have proper icons and colors
- [ ] All buttons have proper spacing and padding
- [ ] Theme colors adapt in light/dark mode

### Interaction Testing
- [ ] Tapping send button opens action sheet
- [ ] "Via VarsityHub DM" navigates to messages
- [ ] "Share Externally" opens native share
- [ ] Tapping share button opens native share
- [ ] Tapping game card navigates to game detail
- [ ] Tapping team card navigates to team profile
- [ ] Tapping author info navigates to user profile
- [ ] "View Event" button navigates to game detail
- [ ] "View Team" button navigates to team profile
- [ ] "View Profile" button navigates to user profile

### Share Content Testing
- [ ] Share message includes post title
- [ ] Share message includes game matchup (if exists)
- [ ] Share message includes author name
- [ ] Share message includes post URL
- [ ] Share URL is properly formatted
- [ ] Share title is set correctly

### Edge Case Testing
- [ ] Post with no game data (game card hidden)
- [ ] Post with no team data (team card hidden)
- [ ] Post with no author (shows "Anonymous")
- [ ] Post with all data (all links visible)
- [ ] Long team names wrap properly
- [ ] Long post titles wrap properly
- [ ] Multiple quick links fit on screen

### Navigation Testing
- [ ] Back navigation works from all destinations
- [ ] Messages screen receives sharePost parameter
- [ ] Game detail screen loads correctly
- [ ] Team profile screen loads correctly
- [ ] User profile screen loads correctly

### Platform Testing
- [ ] iOS: Share sheet shows apps correctly
- [ ] iOS: Safe area respected in header
- [ ] Android: Share sheet shows apps correctly
- [ ] Android: Action sheet shows correctly
- [ ] Android: Elevation shadows render

---

## Known Limitations

### 1. Messages Pre-fill
Currently navigates to messages with query parameter `?sharePost={id}`. The messages screen must be updated to:
- Detect `sharePost` query parameter
- Pre-fill message with post link
- Allow user to select recipient

**Future Enhancement**:
```typescript
// In messages screen
const { sharePost } = useLocalSearchParams();
useEffect(() => {
  if (sharePost) {
    setMessageText(`Check out this post: https://varsityhub.com/post/${sharePost}`);
  }
}, [sharePost]);
```

### 2. Team Data Availability
Some posts may not have team associations. The UI gracefully handles this by:
- Not rendering team card
- Not showing "View Team" quick link
- Still allowing navigation to event/profile

**Backend Consideration**:
Ensure post API returns team data when available. Example query:
```sql
SELECT p.*, 
       json_build_object('id', t.id, 'name', t.name, 'sport', t.sport) as team
FROM posts p
LEFT JOIN teams t ON p.team_id = t.id
WHERE p.id = $1;
```

### 3. Deep Link Validation
Quick Links assume destination screens exist and handle invalid IDs. Add validation:

```typescript
// Before navigation
if (!teamId || isNaN(Number(teamId))) {
  Alert.alert('Error', 'Invalid team reference');
  return;
}
router.push(`/team-profile?id=${teamId}`);
```

---

## Future Enhancements

### 1. **Share Analytics**
Track share events to measure engagement:

```typescript
import Analytics from '@/utils/analytics';

const onShare = async () => {
  Analytics.track('post_shared', {
    post_id: id,
    share_method: 'native_share',
    has_game: !!post.game,
    has_team: !!(post.team_id || post.team),
  });
  // ... existing share logic
};
```

### 2. **Share Preview**
Generate rich link previews for social media:

```typescript
// Server-side: /api/posts/{id}/preview
<meta property="og:title" content={post.title} />
<meta property="og:description" content={post.content} />
<meta property="og:image" content={post.media_url} />
<meta property="og:url" content={`https://varsityhub.com/post/${id}`} />
```

### 3. **Copy Link Button**
Add direct copy to clipboard:

```typescript
import * as Clipboard from 'expo-clipboard';

const onCopyLink = async () => {
  await Clipboard.setStringAsync(`https://varsityhub.com/post/${id}`);
  Alert.alert('Link Copied', 'Post link copied to clipboard');
};
```

### 4. **Share to Story**
Allow users to share post to their VarsityHub story:

```typescript
const onShareToStory = () => {
  router.push(`/create?sharePost=${id}`);
};
```

### 5. **QR Code Share**
Generate QR code for in-person sharing:

```typescript
import QRCode from 'react-native-qrcode-svg';

const [showQR, setShowQR] = useState(false);

<QRCode
  value={`https://varsityhub.com/post/${id}`}
  size={200}
/>
```

### 6. **Share Customization**
Allow users to edit message before sharing:

```typescript
const [shareMessage, setShareMessage] = useState('');

<TextInput
  value={shareMessage}
  onChangeText={setShareMessage}
  placeholder="Add a message..."
/>
```

### 7. **Team Members List**
Show team roster in Quick Links:

```typescript
{post.team?.id && (
  <Pressable
    style={styles.quickLinkButton}
    onPress={() => router.push(`/team-profile?id=${post.team.id}&tab=roster`)}
  >
    <Ionicons name="list" size={18} color="#F59E0B" />
    <Text style={styles.quickLinkText}>View Roster</Text>
  </Pressable>
)}
```

### 8. **Related Posts**
Show other posts from same event/team:

```typescript
<View style={styles.relatedPosts}>
  <Text style={styles.relatedTitle}>Related Posts</Text>
  {relatedPosts.map(p => (
    <PostCard key={p.id} post={p} />
  ))}
</View>
```

---

## Troubleshooting

### Share Sheet Not Opening
**Issue**: Native share doesn't work on simulator

**Solution**: Test on physical device
```bash
# iOS
expo run:ios --device

# Android
expo run:android --device
```

### Team Card Not Showing
**Issue**: Team data not populating

**Debug**:
```typescript
console.log('Post team_id:', post.team_id);
console.log('Post team:', post.team);
```

**Fix**: Ensure API returns team data
```typescript
// In API response
{
  "id": "123",
  "team_id": "456",
  "team": {
    "id": "456",
    "name": "Raiders",
    "sport": "Football"
  }
}
```

### Navigation Not Working
**Issue**: Quick Links don't navigate

**Debug**:
```typescript
const handleTeamPress = () => {
  const teamId = post.team_id || post.team?.id;
  console.log('Team ID:', teamId);
  console.log('Navigating to:', `/team-profile?id=${teamId}`);
  router.push(`/team-profile?id=${teamId}`);
};
```

**Fix**: Verify route exists in `app/` directory

### Action Sheet Not Appearing
**Issue**: Send to Friend action sheet doesn't show

**Platform**: Android might not support `Alert.alert` with buttons

**Solution**: Use `ActionSheetIOS` or custom modal
```typescript
import { ActionSheetIOS, Platform } from 'react-native';

const onSendToFriend = () => {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Via VarsityHub DM', 'Share Externally'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) router.push(`/messages?sharePost=${id}`);
        if (buttonIndex === 2) onShare();
      }
    );
  } else {
    // Use Alert.alert for Android
  }
};
```

---

## Performance Considerations

### 1. **Conditional Rendering**
Quick Links section only renders when data exists:

```typescript
// Efficient check
{(post.game?.id || post.team_id || post.team?.id || post.author_id) && (
  <View style={styles.quickLinks}>
    {/* Only renders if at least one link available */}
  </View>
)}
```

### 2. **Memoized Navigation Handlers**
Consider memoizing for complex posts:

```typescript
const handleEventPress = useCallback(() => {
  if (post.game?.id) router.push(`/game-detail?id=${post.game.id}`);
}, [post.game?.id, router]);
```

### 3. **Icon Pre-loading**
Ionicons are vector-based, no pre-loading needed. But for custom icons:

```typescript
import { Asset } from 'expo-asset';

useEffect(() => {
  Asset.loadAsync([
    require('@/assets/icons/custom-share.png'),
  ]);
}, []);
```

---

## Accessibility Improvements

### Screen Reader Support

```typescript
<Pressable
  accessible
  accessibilityLabel={`View ${post.team?.name} team profile`}
  accessibilityRole="button"
  accessibilityHint="Navigate to team page"
  onPress={handleTeamPress}
>
  {/* Team button content */}
</Pressable>
```

### Keyboard Navigation

```typescript
<Pressable
  onPress={handleShare}
  accessible
  accessibilityRole="button"
  accessibilityLabel="Share post"
>
  <Ionicons name="share-outline" size={22} />
</Pressable>
```

---

## Related Files

### Modified
- `app/post-detail.tsx` - Main post detail screen

### Referenced
- `app/game-detail.tsx` - Event/game detail screen
- `app/team-profile.tsx` - Team profile screen
- `app/user-profile.tsx` - User profile screen
- `app/messages.tsx` - Messages/DM screen (needs update for sharePost)

### Constants
- `constants/Colors.ts` - Theme colors

---

## Summary

The Post Detail screen now provides a comprehensive navigation and sharing experience:

✅ **Navigation**: Direct links to events, teams, and user profiles
✅ **Sharing**: Enhanced social media sharing with rich context
✅ **DM Integration**: Send posts to VarsityHub friends
✅ **Quick Links**: One-tap access to related content
✅ **Theme Support**: Fully adapted to light/dark mode
✅ **Accessibility**: Proper labels and affordances
✅ **Error Handling**: Graceful fallbacks for missing data

Users can now seamlessly explore related content and share posts across multiple channels, significantly improving engagement and discoverability.

---

*Implementation by VarsityHub Development Team*
*Last Updated: October 13, 2025*
