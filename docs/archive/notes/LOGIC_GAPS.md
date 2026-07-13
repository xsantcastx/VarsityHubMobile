# Logic Gaps & Performance Issues

**Date:** November 28, 2025  
**Status:** Identified - Needs Implementation  
**Priority:** HIGH (Performance & UX Critical)

---

## 1. Create Post - Memory Overhead from Redundant File Fetching

### Issue

**File:** `app/create-post.tsx` (lines 44-52)

**Problem:**

- Downloads entire file via `fetch(uri)` and converts to `blob` just to read file size
- For large videos (100 MB highlight), file is loaded into memory **twice**:
  1. First fetch: Just to get `.size`
  2. Second fetch: Actual upload to server
- Causes UI stalls on mid-range phones
- Unnecessary network/memory overhead

**Current Code:**

```typescript
const getFileSizeFromUri = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    console.warn('Could not determine file size:', error);
    return 0;
  }
};
```

**Solution:**
Use `expo-file-system`'s `getInfoAsync()` or read `fileSize` from picker result:

```typescript
import * as FileSystem from 'expo-file-system';

const getFileSizeFromUri = async (uri: string): Promise<number> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size : 0;
  } catch (error) {
    console.warn('Could not determine file size:', error);
    return 0;
  }
};
```

**Alternative:** Use `asset.fileSize` from `ImagePicker` result if available.

**Impact:**

- ✅ Eliminates redundant network fetch
- ✅ Reduces memory usage by 50% for large files
- ✅ Faster post creation UX

---

## 2. Auto-Suggestion - Client-Side Filtering with No Limits

### Issue

**File:** `app/create-post.tsx` (lines 125-176)

**Problem:**

- Calls `Game.list('-date')` with **no limit** parameter
- Downloads **entire games catalog** to device
- Filters by date range on client side
- Calculates distance (Haversine formula) for every game on device
- `hasAutoSuggested` flag set immediately, even if location not granted
- If user grants location later, nearby games never re-queried
- Performance degrades as game catalog grows

**Current Code:**

```typescript
const games = await Game.list('-date');
const gamesArray = Array.isArray(games) ? games : games?.items || [];

// ... 50+ lines of client-side filtering and sorting
```

**Solution:**
Push filters to backend:

```typescript
// api/entities.ts - Update Game.list signature
export const Game = {
  list: (
    sort?: string,
    options?: {
      limit?: number;
      lat?: number;
      lng?: number;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (options?.limit) q.push('limit=' + String(options.limit));
    if (options?.lat !== undefined) q.push('lat=' + String(options.lat));
    if (options?.lng !== undefined) q.push('lng=' + String(options.lng));
    if (options?.dateFrom) q.push('from=' + encodeURIComponent(options.dateFrom));
    if (options?.dateTo) q.push('to=' + encodeURIComponent(options.dateTo));
    return httpGet('/games' + (q.length ? '?' + q.join('&') : ''));
  },
  // ... rest
};
```

**Backend Changes Required:**

- `server/src/routes/games.ts` - Add query param parsing for `lat`, `lng`, `from`, `to`, `limit`
- Implement distance calculation in SQL using PostGIS or haversine formula
- Return pre-sorted results by distance

**App Changes:**

```typescript
useEffect(() => {
  if (hasAutoSuggested) return;

  const fetchNearbyGames = async () => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const games = await Game.list('-date', {
      limit: 10,
      lat: lat || undefined,
      lng: lng || undefined,
      dateFrom: now.toISOString(),
      dateTo: sevenDaysLater.toISOString(),
    });

    setNearbyGames(games);
    // Only mark as suggested after successful response with location
    if (lat && lng) {
      setHasAutoSuggested(true);
    }
  };

  fetchNearbyGames();
}, [lat, lng, hasAutoSuggested]); // Re-run when location granted
```

**Impact:**

- ✅ Reduces network payload (download 10 games vs entire catalog)
- ✅ Eliminates client-side filtering/sorting overhead
- ✅ Re-queries when location granted
- ✅ Scales with growing game catalog

---

## 3. Highlights - Geographic Personalization Broken

### Issue

**File:** `app/highlights.tsx` (lines 324-333)

**Problem:**

- Assumes `User.me()` returns `lat`/`lng` at root level
- **Actual location:** `me.preferences.lat` and `me.preferences.lng`
- Result: `lat` and `lng` always `undefined`
- "Nearby" scoring in `Highlights.fetch()` never activates
- Users never see geographically personalized highlights

**Current Code:**

```typescript
const me: any = await User.me().catch(() => null);
const country = (me?.preferences?.country_code || 'US').toUpperCase();
const lat = me?.lat; // ❌ WRONG PATH
const lng = me?.lng; // ❌ WRONG PATH
```

**Fix:**

```typescript
const me: any = await User.me().catch(() => null);
const country = (me?.preferences?.country_code || 'US').toUpperCase();
const lat = me?.preferences?.lat; // ✅ CORRECT PATH
const lng = me?.preferences?.lng; // ✅ CORRECT PATH
```

**Impact:**

- ✅ Enables location-based highlight ranking
- ✅ Users see local teams/games prioritized
- ✅ Better content discovery

---

## 4. Global Search - Client-Side Filtering Crushes Performance

### Issue

**File:** `app/highlights.tsx` (lines 395-444)

**Problem:**

- `performGlobalSearch()` fetches **all** teams, events, organizations
- Filters client-side with `.filter()` and `.includes()`
- Re-downloads entire dataset on **every keystroke**
- Backend has search APIs that aren't used
- Ignores server-side ranking algorithms

**Current Code:**

```typescript
const [teamsRes, eventsRes, usersRes, orgsRes] = await Promise.all([
  Team.list().catch(() => ({ items: [] })), // ❌ ALL teams
  Event.filter({}).catch(() => ({ items: [] })), // ❌ ALL events
  User.listAll(query, 20).catch(() => ({ items: [] })), // ✅ Uses query
  Organization.list().catch(() => ({ items: [] })), // ❌ ALL orgs
]);

// Then filters client-side:
const teams = (Array.isArray(teamsRes) ? teamsRes : teamsRes?.items || [])
  .filter(
    (t: any) => (t.name || '').toLowerCase().includes(queryLower) // ❌ Client-side
  )
  .slice(0, 5);
```

**Solution:**
Add search endpoint or use query params:

**API Changes (Backend):**

```typescript
// server/src/routes/teams.ts
teamsRouter.get('/', async (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { school_name: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};

  const teams = await prisma.team.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
  });

  res.json(teams);
});
```

**Frontend Changes:**

```typescript
// api/entities.ts
export const Team = {
  list: (query?: string, limit?: number) => {
    const q: string[] = [];
    if (query) q.push('q=' + encodeURIComponent(query));
    if (limit) q.push('limit=' + String(limit));
    return httpGet('/teams' + (q.length ? '?' + q.join('&') : ''));
  },
  // ... rest
};

// app/highlights.tsx
const performGlobalSearch = async (query: string) => {
  const [teamsRes, eventsRes, usersRes, orgsRes] = await Promise.all([
    Team.list(query, 5),  // ✅ Server-side search
    Event.filter({ q: query }, undefined, 5), // ✅ Pass query
    User.listAll(query, 5),
    Organization.list(query, 5),  // ✅ Server-side search
  ]);

  // No client-side filtering needed
  setSearchResults({
    teams: teamsRes?.items || teamsRes || [],
    events: eventsRes?.items || eventsRes || [],
    users: usersRes?.items || usersRes || [],
    organizations: orgsRes?.items || orgsRes || [],
    posts: highlights.filter(...).slice(0, 10) // Keep for posts (already loaded)
  });
};
```

**Impact:**

- ✅ Reduces network payload by 90%+
- ✅ Eliminates keystroke lag
- ✅ Uses backend ranking/scoring
- ✅ Scales to thousands of entities

---

## 5. Highlights Sharing - Stub Implementation

### Issue

**File:** `app/highlights.tsx` (lines 268-278)

**Problem:**

- Share button just shows `Alert.alert('Share', 'Share this highlight!')`
- No actual share functionality
- Doesn't open OS share sheet
- Doesn't copy link to clipboard
- Feature appears broken to users

**Current Code:**

```typescript
<Pressable
  style={styles.actionButton}
  onPress={(e) => {
    e.stopPropagation();
    Alert.alert('Share', 'Share this highlight!'); // ❌ Stub
  }}
>
  <Ionicons name="share-outline" size={16} color="#10B981" />
  <Text style={[styles.statText, { fontWeight: '600' }]}>Share</Text>
</Pressable>
```

**Solution:**

```typescript
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

const handleShare = async (item: HighlightItem) => {
  try {
    const shareUrl = `https://varsityhub.com/highlights/${item.id}`;
    const message = item.caption
      ? `${item.caption}\n\n${shareUrl}`
      : shareUrl;

    await Share.share({
      message,
      url: shareUrl,
      title: item.title || 'VarsityHub Highlight',
    });
  } catch (error) {
    console.error('Share failed:', error);
    // Fallback: Copy to clipboard
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Link Copied', 'Share link copied to clipboard!');
  }
};

// Usage:
<Pressable
  style={styles.actionButton}
  onPress={(e) => {
    e.stopPropagation();
    handleShare(item);
  }}
>
```

**Impact:**

- ✅ Working share functionality
- ✅ OS-native share sheet
- ✅ Clipboard fallback
- ✅ Better user experience

---

## 6. External Links - Inconsistent URL Scheme (404 Risk)

### Issue

**Files:**

- `app/post-detail.tsx` (lines 286-293): Uses `https://varsityhub.com/post/{id}`
- `app/game-details/GameVerticalFeedScreen.tsx` (lines 840-844): Uses `https://varsityhub.app/posts/{id}`

**Problem:**

- Two different URL patterns for same resource
- Recipients land on 404s depending on which screen generated link
- No canonical route
- Inconsistent branding (`varsityhub.com` vs `varsityhub.app`)

**Current Code:**

```typescript
// post-detail.tsx
const shareUrl = `https://varsityhub.com/post/${currentPostId}`;

// GameVerticalFeedScreen.tsx
const deepLink = `${process.env.EXPO_PUBLIC_APP_BASE_URL || 'https://varsityhub.app'}/posts/${post.id}`;
```

**Solution:**
Centralize URL generation:

```typescript
// utils/links.ts (NEW FILE)
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.appBaseUrl || 'https://varsityhub.com';

export const AppLinks = {
  post: (id: string) => `${BASE_URL}/posts/${id}`,
  highlight: (id: string) => `${BASE_URL}/highlights/${id}`,
  game: (id: string) => `${BASE_URL}/games/${id}`,
  team: (id: string) => `${BASE_URL}/teams/${id}`,
  user: (id: string) => `${BASE_URL}/users/${id}`,
  event: (id: string) => `${BASE_URL}/events/${id}`,
};
```

**Usage:**

```typescript
// app/post-detail.tsx
import { AppLinks } from '@/utils/links';

const shareUrl = AppLinks.post(currentPostId);

// app/game-details/GameVerticalFeedScreen.tsx
import { AppLinks } from '@/utils/links';

const deepLink = AppLinks.post(post.id);
```

**Impact:**

- ✅ Single source of truth for URLs
- ✅ No more 404s from inconsistent links
- ✅ Easy to update base URL in one place
- ✅ Consistent branding

---

## 7. Internal Sharing - "Send to Friend" Not Wired

### Issue

**Files:**

- `app/post-detail.tsx` (lines 299-318): Pushes `/messages?sharePost={id}`
- `app/messages.tsx`: Never reads `sharePost` query param

**Problem:**

- Tapping "Send to Friend" → "Via VarsityHub DM" navigates to messages
- Compose view opens **empty** (no pre-filled link)
- User has to manually type/paste post link
- Feature appears broken
- Documented as TODO in `docs/archive/POST_DETAIL_NAVIGATION_SHARING.md` (lines 445-475)

**Current Code:**

```typescript
// post-detail.tsx
{
  text: 'Via VarsityHub DM',
  onPress: () => {
    router.push(`/messages?sharePost=${currentPostId}`); // ✅ Sets param
  }
}

// app/messages.tsx - NO HANDLING
export default function MessagesScreen() {
  const router = useRouter();
  // ❌ Never reads useLocalSearchParams()
```

**Solution:**

**Step 1:** Read query param in `app/messages.tsx`:

```typescript
import { useLocalSearchParams } from 'expo-router';

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sharePost?: string }>();
  const sharePostId = params?.sharePost;

  const [composeOpen, setComposeOpen] = useState(false);
  const [sharedContent, setSharedContent] = useState<string | null>(null);

  useEffect(() => {
    if (sharePostId) {
      const shareUrl = AppLinks.post(sharePostId);
      setSharedContent(`Check out this post: ${shareUrl}`);
      setComposeOpen(true);
    }
  }, [sharePostId]);
```

**Step 2:** Pre-fill compose modal:

```typescript
// Inside compose modal
<TextInput
  value={newMessage || sharedContent || ''}
  onChangeText={(text) => {
    setNewMessage(text);
    setSharedContent(null); // Clear prefill after first edit
  }}
  placeholder="Type a message..."
  multiline
/>
```

**Step 3:** Clear param after send:

```typescript
const handleSendNewMessage = async () => {
  // ... send logic

  // Clear shared content and query param
  setSharedContent(null);
  router.setParams({ sharePost: undefined });
};
```

**Impact:**

- ✅ Working in-app share functionality
- ✅ Pre-filled message with post link
- ✅ Better UX for sharing with friends
- ✅ Completes TODO from documentation

---

## Priority & Implementation Order

### P0 - Critical (Performance Impact)

1. ✅ **Create Post File Size** - Easy fix, big impact
2. ✅ **Highlights Geographic Fix** - One-line change
3. ✅ **External Links Consistency** - Create utility file

### P1 - High (UX Broken)

4. ✅ **Highlights Share Button** - Implement OS share sheet
5. ✅ **Internal "Send to Friend"** - Wire up sharePost param

### P2 - Medium (Performance Optimization)

6. ⚠️ **Auto-Suggestion Backend Filters** - Requires backend changes
7. ⚠️ **Global Search Server-Side** - Requires backend changes

---

## Backend Changes Required

### Games Endpoint Enhancement

**File:** `server/src/routes/games.ts`

Add query params: `lat`, `lng`, `from`, `to`, `limit`

```typescript
gamesRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const limit = parseInt(req.query.limit as string) || undefined;
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const dateFrom = req.query.from as string;
  const dateTo = req.query.to as string;

  let whereClause: any = {};

  // Date range filtering
  if (dateFrom || dateTo) {
    whereClause.date = {};
    if (dateFrom) whereClause.date.gte = new Date(dateFrom);
    if (dateTo) whereClause.date.lte = new Date(dateTo);
  }

  const games = await prisma.game.findMany({
    where: whereClause,
    orderBy: { date: 'desc' },
    take: limit,
    // ... rest of query
  });

  // If lat/lng provided, calculate distances and sort
  if (!isNaN(lat) && !isNaN(lng)) {
    games.forEach((game: any) => {
      if (game.latitude && game.longitude) {
        game.distance = calculateDistance(lat, lng, game.latitude, game.longitude);
      }
    });
    games.sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity));
  }

  res.json(games);
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### Teams/Events/Organizations Search

Add `q` (query) parameter to existing list endpoints for server-side filtering.

---

## Testing Checklist

- [ ] Create post with large video (>50 MB) - verify no double-fetch
- [ ] Highlights screen shows nearby content when location granted
- [ ] Share button in highlights opens OS share sheet
- [ ] External links consistent across all screens
- [ ] "Send to Friend" pre-fills message with post link
- [ ] Auto-suggestion queries backend with location/date filters
- [ ] Global search returns results without client-side filtering

---

**Estimated Implementation Time:**

- P0 fixes: **2-3 hours**
- P1 fixes: **3-4 hours**
- P2 fixes (with backend): **6-8 hours**

**Total:** ~12-15 hours for complete resolution
