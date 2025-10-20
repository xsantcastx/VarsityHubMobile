# Event Map Coordinates Guide

## Overview

This guide covers two approaches for adding geographic coordinates to events and games in VarsityHub, enabling map-based discovery features.

---

## Option A: Direct Database Coordinates (✅ IMPLEMENTED)

### ✅ Status: **COMPLETE**

### What Was Done

1. **Database Schema Updates** (`server/prisma/schema.prisma`)
   - Added `latitude Float?` and `longitude Float?` to `Game` model
   - Added `latitude Float?` and `longitude Float?` to `Event` model
   - Added indexes on `[latitude, longitude]` for both models

2. **Migration Applied**
   - Migration: `20251013135644_add_event_coordinates`
   - Successfully applied to PostgreSQL database
   - Prisma client regenerated with new fields

3. **Frontend Integration** (`app/(tabs)/discover/mobile-community.tsx`)
   - Updated `GameItem` type to include `latitude` and `longitude`
   - Map now receives actual coordinate data from database
   - Falls back to undefined when coordinates are not available

### Database Structure

```prisma
model Game {
  // ... existing fields
  location   String?
  latitude   Float?
  longitude  Float?
  // ... more fields
  
  @@index([date])
  @@index([latitude, longitude])
}

model Event {
  // ... existing fields
  location   String?
  latitude   Float?
  longitude  Float?
  // ... more fields
  
  @@index([date])
  @@index([game_id])
  @@index([latitude, longitude])
}
```

### How to Use

#### Adding Coordinates When Creating Games/Events

```typescript
// Example: Creating a game with coordinates
const game = await prisma.game.create({
  data: {
    title: 'Championship Game',
    date: new Date('2025-10-20'),
    location: 'Madison Square Garden, NYC',
    latitude: 40.750504,
    longitude: -73.993439,
    // ... other fields
  }
});
```

#### Updating Existing Games/Events with Coordinates

```typescript
// Update a single game
await prisma.game.update({
  where: { id: gameId },
  data: {
    latitude: 40.750504,
    longitude: -73.993439,
  }
});

// Bulk update (you'll need to geocode each location first)
const gamesNeedingCoords = await prisma.game.findMany({
  where: {
    location: { not: null },
    latitude: null,
  },
  select: { id: true, location: true },
});

// Then geocode and update each one
for (const game of gamesNeedingCoords) {
  const coords = await geocodeLocationString(game.location);
  if (coords) {
    await prisma.game.update({
      where: { id: game.id },
      data: { latitude: coords.lat, longitude: coords.lng },
    });
  }
}
```

### Query Examples

```typescript
// Find all games with coordinates
const gamesWithCoords = await prisma.game.findMany({
  where: {
    AND: [
      { latitude: { not: null } },
      { longitude: { not: null } },
    ],
  },
});

// Find games near a location (simple bounding box)
const nearbyGames = await prisma.game.findMany({
  where: {
    latitude: { gte: minLat, lte: maxLat },
    longitude: { gte: minLng, lte: maxLng },
  },
});

// Count games without coordinates
const missingCoords = await prisma.game.count({
  where: {
    location: { not: null },
    OR: [
      { latitude: null },
      { longitude: null },
    ],
  },
});
```

### Advantages ✅
- Simple and direct
- No external API dependencies
- Fast queries (indexed)
- No rate limiting concerns
- One-time data entry

### Disadvantages ❌
- Manual coordinate entry required (use Option B to automate)
- Coordinates may become outdated if venue moves
- No validation that coordinates match location string

---

## Option B: Geocoding Service (✅ IMPLEMENTED)

### ✅ Status: **COMPLETE**

### What Was Done

1. **Geocoding Library** (`server/src/lib/geocoding.ts`)
   - `geocodeLocation(location)` - Convert address to coordinates
   - `geocodeGame(gameId)` - Geocode a specific game
   - `geocodeEvent(eventId)` - Geocode a specific event
   - `geocodeAllGames(limit)` - Batch geocode games
   - `geocodeAllEvents(limit)` - Batch geocode events
   - In-memory caching (7-day expiration)
   - Automatic rate limiting (200ms between requests)

2. **API Endpoints** (`server/src/routes/geocoding.ts`)
   - `POST /geocoding/location` - Geocode any location string
   - `POST /geocoding/game/:gameId` - Geocode specific game
   - `POST /geocoding/event/:eventId` - Geocode specific event
   - `POST /geocoding/batch/games` - Batch geocode all games
   - `POST /geocoding/batch/events` - Batch geocode all events
   - `GET /geocoding/cache/stats` - View cache statistics
   - `DELETE /geocoding/cache` - Clear geocoding cache

3. **Server Integration** (`server/src/index.ts`)
   - Mounted geocoding router at `/geocoding`
   - Applied rate limiting and authentication
   - Admin-only endpoints for batch operations

### Setup

#### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Geocoding API**
4. Go to **APIs & Services** → **Credentials**
5. Create API Key
6. **Restrict the key**:
   - Application restrictions: IP addresses (add your server IP)
   - API restrictions: Geocoding API only

#### 2. Configure Environment Variable

Add to `server/.env`:

```env
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

⚠️ **Important**: Never commit API keys to version control!

#### 3. Verify Configuration

```bash
# Test geocoding is working
curl -X POST http://localhost:4000/geocoding/location \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": "Madison Square Garden, NYC"}'

# Expected response:
# {
#   "latitude": 40.750504,
#   "longitude": -73.993439,
#   "formatted_address": "4 Pennsylvania Plaza, New York, NY 10001, USA"
# }
```

### API Usage

#### Geocode a Location String

```typescript
// Frontend request
const response = await fetch(`${API_URL}/geocoding/location`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    location: 'Stanford Stadium, Palo Alto, CA'
  }),
});

const coords = await response.json();
// { latitude: 37.434926, longitude: -122.161491, formatted_address: "..." }
```

#### Geocode a Specific Game (Admin Only)

```bash
curl -X POST http://localhost:4000/geocoding/game/clxyz123 \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
  
# Optionally override location:
curl -X POST http://localhost:4000/geocoding/game/clxyz123 \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": "Different Stadium, City, State"}'
```

#### Batch Geocode All Games (Admin Only)

```bash
# Geocode up to 100 games missing coordinates
curl -X POST http://localhost:4000/geocoding/batch/games \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# Response:
# {
#   "count": 47,
#   "message": "Successfully geocoded 47 games"
# }
```

#### Check Cache Statistics (Admin Only)

```bash
curl http://localhost:4000/geocoding/cache/stats \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Response:
# {
#   "size": 23,
#   "entries": [
#     {
#       "location": "madison square garden, nyc",
#       "coordinates": { "lat": 40.750504, "lng": -73.993439 },
#       "age_ms": 3600000
#     },
#     ...
#   ]
# }
```

### Geocoding Library Functions

#### `geocodeLocation(location: string)`

Convert a location string to coordinates.

```typescript
import { geocodeLocation } from '../lib/geocoding.js';

const result = await geocodeLocation('Stanford Stadium, Palo Alto, CA');
if (result) {
  console.log(result.latitude);  // 37.434926
  console.log(result.longitude); // -122.161491
  console.log(result.formatted_address); // Full address
}
```

#### `geocodeGame(gameId: string, location?: string)`

Geocode a game and update database.

```typescript
import { geocodeGame } from '../lib/geocoding.js';

// Use game's existing location
await geocodeGame('clxyz123');

// Override with different location
await geocodeGame('clxyz123', 'Rose Bowl, Pasadena, CA');
```

#### `geocodeAllGames(limit?: number)`

Batch geocode games missing coordinates.

```typescript
import { geocodeAllGames } from '../lib/geocoding.js';

// Geocode up to 100 games
const count = await geocodeAllGames(100);
console.log(`Geocoded ${count} games`);
```

### Rate Limiting

Google Geocoding API has the following limits:
- **Free tier**: 0.005 USD per request (first 200 USD/month free)
- **Rate limit**: ~500 requests per minute

The geocoding service automatically:
- Waits 200ms between requests (~300/min)
- Caches results in memory for 7 days
- Only processes items that don't already have coordinates

### Cost Estimation

- **Per request**: $0.005
- **First 200 requests/month**: Free
- **100 locations**: $0.50
- **1,000 locations**: $5.00
- **10,000 locations**: $50.00

💡 **Tip**: Run batch geocoding once to populate existing data, then geocode new items individually as they're created.

### Error Handling

The geocoding service handles errors gracefully:

```typescript
const result = await geocodeLocation('Invalid Location 123xyz!@#');
// Returns null if geocoding fails

// Check logs for details:
// "Geocoding failed for 'Invalid Location 123xyz!@#': ZERO_RESULTS"
```

Common error codes:
- `ZERO_RESULTS` - No coordinates found for location
- `OVER_QUERY_LIMIT` - Rate limit exceeded (wait and retry)
- `REQUEST_DENIED` - Invalid API key or restrictions
- `INVALID_REQUEST` - Missing or malformed location

### Advantages ✅
- Automatic coordinate generation
- Consistent formatting
- Validation that location exists
- Returns standardized addresses
- Easy bulk processing

### Disadvantages ❌
- Requires Google Maps API key
- Costs money after free tier ($0.005 per request)
- Rate limited (500 requests/minute)
- Depends on external service
- May not find obscure locations

---

## Recommended Workflow

### For New Installations

1. **Start with Option B (Geocoding)**:
   ```bash
   # Set up API key
   echo "GOOGLE_MAPS_API_KEY=your_key" >> server/.env
   
   # Batch geocode all existing games
   curl -X POST http://localhost:4000/geocoding/batch/games \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{"limit": 1000}'
   
   # Batch geocode all existing events
   curl -X POST http://localhost:4000/geocoding/batch/events \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{"limit": 1000}'
   ```

2. **Geocode New Items Automatically**:
   ```typescript
   // Add to game creation route (server/src/routes/games.ts)
   import { geocodeGame } from '../lib/geocoding.js';
   
   const game = await prisma.game.create({
     data: { title, date, location, /* ... */ }
   });
   
   // Geocode in background (don't await)
   if (game.location) {
     geocodeGame(game.id).catch(err => 
       console.error('Geocoding failed:', err)
     );
   }
   ```

### For Existing Data

1. **Check how many items need geocoding**:
   ```typescript
   const gamesNeedingCoords = await prisma.game.count({
     where: {
       location: { not: null },
       OR: [
         { latitude: null },
         { longitude: null },
       ],
     },
   });
   console.log(`${gamesNeedingCoords} games need coordinates`);
   ```

2. **Run batch geocoding** (costs ~$0.005 per item):
   ```bash
   curl -X POST http://localhost:4000/geocoding/batch/games \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -d '{"limit": 1000}'
   ```

3. **Verify results**:
   ```typescript
   const gamesWithCoords = await prisma.game.count({
     where: {
       AND: [
         { latitude: { not: null } },
         { longitude: { not: null } },
       ],
     },
   });
   console.log(`${gamesWithCoords} games have coordinates`);
   ```

### For Manual Entry (Option A Only)

Use when you have precise coordinates or want to avoid API costs:

```typescript
// Get coordinates from Google Maps
// 1. Search for location on maps.google.com
// 2. Right-click location → "What's here?"
// 3. Copy coordinates (e.g., 40.750504, -73.993439)

await prisma.game.update({
  where: { id: 'clxyz123' },
  data: {
    latitude: 40.750504,
    longitude: -73.993439,
  }
});
```

---

## Testing

### Test Map Display

1. Create a test game with coordinates:
   ```typescript
   const game = await prisma.game.create({
     data: {
       title: 'Test Championship',
       date: new Date('2025-10-20'),
       location: 'Madison Square Garden, NYC',
       latitude: 40.750504,
       longitude: -73.993439,
     }
   });
   ```

2. Open mobile app → Discover tab
3. Click map icon next to search box
4. Verify marker appears on map
5. Tap marker → Verify callout shows game info
6. Tap callout → Verify navigates to game detail

### Test Geocoding Service

```bash
# Test single location geocoding
curl -X POST http://localhost:4000/geocoding/location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": "Stanford Stadium"}'

# Test game geocoding
curl -X POST http://localhost:4000/geocoding/game/$GAME_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test batch geocoding (limit 5 for testing)
curl -X POST http://localhost:4000/geocoding/batch/games \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"limit": 5}'
```

---

## Troubleshooting

### Map Shows "No Events with Locations"

**Possible causes**:
1. No games have coordinates in database
2. Games have coordinates but date filter excludes them
3. Search query filtered out all results

**Solution**:
```sql
-- Check if any games have coordinates
SELECT COUNT(*) FROM "Game" 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- If 0, run batch geocoding or add coordinates manually
```

### Geocoding Returns Null

**Possible causes**:
1. Invalid API key
2. Location string too vague
3. Rate limit exceeded
4. API not enabled in Google Cloud

**Solution**:
1. Verify API key in `.env`: `echo $GOOGLE_MAPS_API_KEY`
2. Test API key directly:
   ```bash
   curl "https://maps.googleapis.com/maps/api/geocode/json?address=Stanford+Stadium&key=$GOOGLE_MAPS_API_KEY"
   ```
3. Check Google Cloud Console:
   - Geocoding API enabled?
   - Billing account linked?
   - API key restrictions correct?

### Batch Geocoding Fails Partway Through

**Possible causes**:
1. Rate limit hit
2. Invalid locations in database
3. API quota exceeded

**Solution**:
1. Check logs for specific errors
2. Run again with smaller limit
3. Clear invalid locations:
   ```sql
   -- Find games with invalid locations
   SELECT id, location FROM "Game" 
   WHERE latitude IS NULL AND location IS NOT NULL;
   ```

### Coordinates Don't Match Location

**Possible causes**:
1. Location string ambiguous (e.g., "Central Park")
2. Geocoding returned wrong match
3. Manual entry error

**Solution**:
1. Make location strings more specific:
   - ❌ "Central Park"
   - ✅ "Central Park, New York, NY"
2. Verify on Google Maps
3. Update with correct coordinates:
   ```typescript
   await prisma.game.update({
     where: { id: gameId },
     data: { latitude: correctLat, longitude: correctLng }
   });
   ```

---

## Production Checklist

### Before Deployment

- [ ] Google Maps API key configured in production `.env`
- [ ] API key restricted to production IP addresses
- [ ] API key restricted to Geocoding API only
- [ ] Billing account set up in Google Cloud
- [ ] Budget alerts configured (recommended: $50/month)
- [ ] Batch geocoding completed for existing data
- [ ] Frontend app.json configured with Google Maps API keys (see EVENT_MAP_GUIDE.md)
- [ ] Tested map on both iOS and Android devices
- [ ] Verified markers appear and are clickable
- [ ] Confirmed navigation to game details works

### Monitoring

1. **Track geocoding usage**:
   ```typescript
   // Add logging to geocoding functions
   console.log(`Geocoded ${count} items this batch`);
   ```

2. **Monitor Google Cloud costs**:
   - Check billing dashboard weekly
   - Set budget alerts at $25, $50, $100

3. **Cache hit rate**:
   ```bash
   curl http://localhost:4000/geocoding/cache/stats \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

4. **Database statistics**:
   ```sql
   -- Games with coordinates
   SELECT COUNT(*) FROM "Game" WHERE latitude IS NOT NULL;
   
   -- Games needing coordinates
   SELECT COUNT(*) FROM "Game" 
   WHERE location IS NOT NULL AND latitude IS NULL;
   ```

---

## Next Steps

### Enhancements

1. **Automatic geocoding on creation**:
   - Add geocoding to POST /games and POST /events endpoints
   - Geocode in background to avoid blocking response

2. **Geocoding validation**:
   - Verify coordinates are within expected region
   - Flag suspicious results for manual review

3. **Reverse geocoding**:
   - Convert coordinates to formatted address
   - Update location strings to be consistent

4. **Map clustering**:
   - Group nearby markers when zoomed out
   - Show cluster count badge

5. **Location-based search**:
   - "Games near me" feature
   - Radius filter (5mi, 10mi, 25mi)

### Cost Optimization

1. **Cache optimization**:
   - Store cached results in database (persistent cache)
   - Share cache across server instances

2. **Batch processing**:
   - Geocode during off-peak hours
   - Process in larger batches (rate limit permitting)

3. **Deduplication**:
   - Before geocoding, check if identical location exists
   - Reuse coordinates from duplicate locations

---

## Summary

| Feature | Option A | Option B |
|---------|----------|----------|
| **Implementation** | ✅ Complete | ✅ Complete |
| **Database Fields** | ✅ Added | ✅ Added |
| **Manual Entry** | ✅ Supported | ✅ Supported |
| **Automatic Geocoding** | ❌ Not available | ✅ Available |
| **External Dependency** | ❌ None | ✅ Google Maps API |
| **Cost** | ⚡ Free | 💰 $0.005/request |
| **Setup Time** | ⚡ Immediate | ⏱️ 15 minutes |
| **Recommended For** | Small datasets, precise control | Large datasets, automation |

**Best Practice**: Use Option B (geocoding) to populate data initially, then rely on Option A's database fields for fast queries. Geocode new items automatically on creation.

**Story #7 Status**: 🎉 **100% COMPLETE** - Both options fully implemented and documented!
