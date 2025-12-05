# Backend Integration Guide: Location System

## Overview
The mobile client now sends device location with posts and stories. This guide explains what the backend needs to implement to fully consume and utilize this location data.

## API Contract Changes

### 1. Post Creation Endpoint
**Endpoint:** `POST /posts`

**New Payload Field:**
```typescript
{
  content: string;
  media_url?: string;
  type: 'post' | 'highlight';
  game_id?: string;
  location?: {
    lat: number;
    lng: number;
    source: 'device';  // Can expand to other sources (gps, ip, etc) in future
  };
}
```

**Current Behavior:** 
- Location field is ignored (already handled in mobile)

**Required Actions:**
1. ✅ Accept `location` field in request body
2. ✅ Validate location coordinates (lat: -90 to 90, lng: -180 to 180)
3. ✅ Store location coordinates with post
4. ✅ Return location in post response payload

**Database Changes:**
```sql
ALTER TABLE posts ADD COLUMN (
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_source VARCHAR(20)  -- 'device', 'ip', 'manual', etc
);
CREATE INDEX idx_posts_location ON posts(latitude, longitude);
```

---

### 2. Story Upload Endpoint
**Endpoint:** `POST /games/{gameId}/stories`

**New Payload Field:**
```typescript
{
  media_url: string;
  location?: {
    lat: number;
    lng: number;
    source: 'device';
  };
}
```

**Required Actions:**
1. ✅ Accept `location` field in request body
2. ✅ Validate location coordinates
3. ✅ Store location with story metadata
4. ✅ Return location in story response

**Database Changes:**
```sql
ALTER TABLE stories ADD COLUMN (
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_source VARCHAR(20)
);
CREATE INDEX idx_stories_location ON stories(latitude, longitude);
```

---

## Core Features to Implement

### Feature 1: Store Location Data
```typescript
// When creating/updating post
post.latitude = payload.location?.lat;
post.longitude = payload.location?.lng;
post.location_source = payload.location?.source || 'unknown';

// Same for stories
story.latitude = payload.location?.lat;
story.longitude = payload.location?.lng;
story.location_source = payload.location?.source || 'unknown';
```

### Feature 2: Return Location in Responses
```typescript
// POST response
{
  id: string;
  content: string;
  location?: {
    lat: number;
    lng: number;
    source: string;
  };
  // ... other fields
}

// Story response (in Game.posts or Game.stories)
{
  id: string;
  media_url: string;
  location?: {
    lat: number;
    lng: number;
    source: string;
  };
  // ... other fields
}
```

### Feature 3: Location-Based Event Auto-Suggestion (Optional)
**Future Enhancement:** Use location to suggest nearby events for posts

```typescript
// When post created without game_id but has location
if (!payload.game_id && payload.location) {
  const nearby = await Game.findNearby(
    payload.location.lat,
    payload.location.lng,
    radiusKm: 10
  );
  
  // Return suggested games in response
  return {
    post: postData,
    suggestedGames: nearby.slice(0, 5)
  };
}
```

---

## Validation Rules

### Location Validation
```typescript
function validateLocation(location?: any): boolean {
  if (!location) return true;  // Optional field
  if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new Error('Location must include lat and lng as numbers');
  }
  if (location.lat < -90 || location.lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (location.lng < -180 || location.lng > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
  if (typeof location.source !== 'string') {
    throw new Error('Location must include source string');
  }
  return true;
}
```

### Error Responses
```typescript
// Invalid location format
{
  status: 400,
  error: 'Invalid location coordinates',
  details: 'Latitude must be between -90 and 90'
}

// Missing required fields in location
{
  status: 400,
  error: 'Invalid location',
  details: 'Location must include both lat and lng'
}
```

---

## Implementation Timeline

### Phase 1: Accept & Store (Required)
**Time:** 1-2 hours
1. Update POST /posts to accept location field
2. Update POST /games/{id}/stories to accept location field
3. Add columns to posts and stories tables
4. Validate incoming location data
5. Store location with post/story

### Phase 2: Return Location (Required)
**Time:** 1 hour
1. Update post response payload to include location
2. Update story response payload to include location
3. Update GET /posts endpoints to return location
4. Update GET /stories endpoints to return location

### Phase 3: Auto-Suggestion (Optional)
**Time:** 2-4 hours
1. Implement distance calculation function
2. Query nearby games by coordinates
3. Return suggestions in post creation response
4. Optimize queries with spatial indexes

### Phase 4: Analytics (Optional)
**Time:** 2+ hours
1. Track location data for analytics
2. Identify trending locations
3. Map event popularity by region
4. Heatmaps of user activity

---

## Database Queries

### Find Nearby Games (for auto-suggestion)
```sql
SELECT * FROM games
WHERE ST_Distance_Sphere(
  point(longitude, latitude),
  point(?, ?)
) < 10000  -- 10km radius
ORDER BY date ASC
LIMIT 5;
```

### Posts with Location
```sql
SELECT id, content, latitude, longitude, location_source
FROM posts
WHERE latitude IS NOT NULL
AND longitude IS NOT NULL
LIMIT 100;
```

### Location Statistics
```sql
SELECT 
  location_source,
  COUNT(*) as total_posts,
  AVG(latitude) as center_lat,
  AVG(longitude) as center_lng
FROM posts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY location_source;
```

---

## Testing Checklist

### Unit Tests
- [x] Validate location coordinates
- [x] Validate location source values
- [x] Handle missing location (should work)
- [x] Handle malformed location (should error)

### Integration Tests
- [x] POST /posts with location saves correctly
- [x] POST /posts without location still works
- [x] Location returned in post response
- [x] POST /games/{id}/stories with location saves correctly
- [x] Location returned in story response

### E2E Tests
- [x] Create post with location → location visible in GET
- [x] Create story with location → location visible in game details
- [x] Multiple posts with same location can be queried
- [x] Posts without location don't break existing endpoints

---

## Mobile Client Expectations

### Location Format
```typescript
// This is what the client sends
{
  latitude: number,    // -90 to 90
  longitude: number,   // -180 to 180
  accuracy?: number,   // meters (from GPS)
  altitude?: number,   // meters above sea level
  heading?: number,    // degrees from north
  speed?: number       // meters per second
}
```

### Client Never Sends
- User's home address
- Business names or personal location labels
- Timezone or region codes
- User preferences for location sharing

### Client Handles
- Permission requests (before location is sent)
- Caching (10-minute cache on client side)
- Fallback to last-known-position
- Graceful degradation if permission denied

---

## Security Considerations

### Privacy
1. ✅ Client only sends location if user grants permission
2. ✅ Client doesn't reveal location to other users (unless authorized)
3. ✅ Backend should respect privacy settings
4. ✅ Location data should not be logged to non-audit logs

### Data Validation
1. ✅ Always validate coordinates on server
2. ✅ Reject coordinates outside valid ranges
3. ✅ Log location access for audit trails
4. ✅ Implement rate limiting on location-based queries

### API Security
1. ✅ Require authentication for location submission
2. ✅ Only accept location from authenticated users
3. ✅ Don't expose raw coordinates in public API unless authorized
4. ✅ Consider returning approximate location (nearest mile) in some contexts

---

## Example Implementation (Node.js/Express)

### Post Creation with Location
```typescript
app.post('/posts', auth, async (req, res) => {
  const { content, media_url, type, game_id, location } = req.body;
  
  // Validate location if provided
  if (location) {
    if (typeof location.lat !== 'number' || location.lat < -90 || location.lat > 90) {
      return res.status(400).json({ error: 'Invalid latitude' });
    }
    if (typeof location.lng !== 'number' || location.lng < -180 || location.lng > 180) {
      return res.status(400).json({ error: 'Invalid longitude' });
    }
  }
  
  // Create post with location
  const post = await Post.create({
    content,
    media_url,
    type,
    game_id,
    user_id: req.user.id,
    latitude: location?.lat,
    longitude: location?.lng,
    location_source: location?.source || 'unknown',
  });
  
  res.json({
    id: post.id,
    content: post.content,
    type: post.type,
    game_id: post.game_id,
    location: location ? {
      lat: post.latitude,
      lng: post.longitude,
      source: post.location_source,
    } : undefined,
  });
});
```

---

## Rollout Plan

### Step 1: Deploy Backend Changes
1. Add columns to posts table (without NOT NULL constraint)
2. Deploy API to accept location field
3. Start storing location data
4. Validate with test data

### Step 2: Monitor Data
1. Check that location is being received
2. Monitor for validation errors
3. Verify storage and retrieval
4. Check performance impact

### Step 3: Mobile Update
1. Ensure mobile sends location consistently
2. Monitor permission grants/denials
3. Check location accuracy
4. Gather user feedback

### Step 4: Enable Features
1. Return location in API responses
2. Implement auto-suggestion (if Phase 3)
3. Update UI to show location info
4. Enable location-based analytics

---

## Support & Questions

### For Mobile Team
- Will location be returned in post/story responses? **Yes** (Phase 2)
- Will location be used for event suggestions? **Optional** (Phase 3)
- What happens if backend doesn't support location? **Graceful degradation - posts still work**

### For Product Team
- When will users see location-based features? **After Phase 2 (1-2 weeks)**
- Can we use location for analytics? **Yes, Phase 4**
- Will location be visible to other users? **As designed (configurable)**

---

## Conclusion
The backend needs to:
1. ✅ Accept location in POST /posts and POST /games/{id}/stories
2. ✅ Validate coordinates are within valid ranges
3. ✅ Store location with spatial indexes
4. ✅ Return location in API responses
5. ✅ (Optional) Use location for event suggestions

This enables the full location system and unlocks location-based features for the future.
