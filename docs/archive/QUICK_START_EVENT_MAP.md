# Quick Start: Event Map Coordinates

## ✅ What's Implemented

Both Option A (database coordinates) and Option B (geocoding service) are fully implemented and ready to use!

---

## 🚀 Quick Start (Recommended Path)

### Step 1: Set Up Google Maps API Key

1. Get API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Geocoding API**
3. Add to `server/.env`:
   ```env
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

### Step 2: Batch Geocode Existing Data

```bash
# Get admin JWT token first (login as admin@varsityhub.com)
export ADMIN_TOKEN="your_admin_jwt_token"

# Geocode all games (costs ~$0.005 per game)
curl -X POST http://localhost:4000/geocoding/batch/games \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'

# Geocode all events
curl -X POST http://localhost:4000/geocoding/batch/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'
```

### Step 3: Test the Map

1. Open mobile app → Discover tab
2. Click map icon (next to search box)
3. Grant location permission when prompted
4. Markers should appear for geocoded games!

---

## 💾 Option A: Manual Coordinates (No API Key Needed)

If you don't want to use the geocoding API, add coordinates manually:

```typescript
// Example: Add coordinates to a game
await prisma.game.update({
  where: { id: 'game_id_here' },
  data: {
    location: 'Madison Square Garden, NYC',
    latitude: 40.750504,
    longitude: -73.993439,
  }
});
```

To get coordinates:
1. Open [Google Maps](https://maps.google.com)
2. Search for location
3. Right-click → "What's here?"
4. Copy the coordinates (e.g., `40.750504, -73.993439`)

---

## 🤖 Option B: Automatic Geocoding (Recommended)

### Available API Endpoints

All endpoints require authentication. Batch operations require admin access.

#### 1. Geocode a Single Location
```bash
curl -X POST http://localhost:4000/geocoding/location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": "Stanford Stadium, Palo Alto, CA"}'

# Response:
{
  "latitude": 37.434926,
  "longitude": -122.161491,
  "formatted_address": "Stanford Stadium, 625 Nelson Rd, Stanford, CA 94305, USA"
}
```

#### 2. Geocode a Specific Game (Admin Only)
```bash
curl -X POST http://localhost:4000/geocoding/game/clxyz123 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### 3. Batch Geocode Games (Admin Only)
```bash
curl -X POST http://localhost:4000/geocoding/batch/games \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# Response:
{
  "count": 47,
  "message": "Successfully geocoded 47 games"
}
```

#### 4. Check Cache Stats (Admin Only)
```bash
curl http://localhost:4000/geocoding/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "size": 23,
  "entries": [
    {
      "location": "madison square garden, nyc",
      "coordinates": { "lat": 40.750504, "lng": -73.993439 },
      "age_ms": 3600000
    }
  ]
}
```

---

## 🔍 Database Queries

### Check How Many Items Have Coordinates

```sql
-- Games with coordinates
SELECT COUNT(*) FROM "Game" 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Games needing coordinates
SELECT COUNT(*) FROM "Game" 
WHERE location IS NOT NULL AND latitude IS NULL;

-- Events with coordinates
SELECT COUNT(*) FROM "Event" 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Find Games Near a Location

```typescript
// Example: Find games near San Francisco (bounding box)
const nearbyGames = await prisma.game.findMany({
  where: {
    latitude: { gte: 37.7, lte: 37.8 },
    longitude: { gte: -122.5, lte: -122.4 },
  },
  orderBy: { date: 'asc' },
});
```

---

## 💰 Cost Estimation (Option B)

Google Geocoding API pricing:
- **$0.005 per request** (first $200/month free = 40,000 free requests)
- In-memory caching reduces repeat requests
- Rate limited to ~300 requests/minute

Examples:
- 100 locations: $0.50
- 1,000 locations: $5.00
- 10,000 locations: $50.00

---

## 🐛 Troubleshooting

### Map Shows "No Events with Locations"

**Cause**: No games have coordinates yet.

**Solution**:
1. Run batch geocoding (see Step 2 above)
2. OR add coordinates manually (see Option A)
3. Verify with SQL query:
   ```sql
   SELECT id, title, location, latitude, longitude 
   FROM "Game" 
   WHERE latitude IS NOT NULL 
   LIMIT 5;
   ```

### Geocoding Returns 401/403 Error

**Cause**: Authentication issue.

**Solution**:
1. Make sure you're logged in
2. Get fresh JWT token
3. For batch operations, use admin account (admin@varsityhub.com)

### Geocoding Returns Null

**Cause**: Invalid API key or location not found.

**Solution**:
1. Verify API key is in `server/.env`
2. Check API key is valid:
   ```bash
   curl "https://maps.googleapis.com/maps/api/geocode/json?address=Stanford+Stadium&key=$GOOGLE_MAPS_API_KEY"
   ```
3. Make location strings more specific:
   - ❌ "Central Park"
   - ✅ "Central Park, New York, NY"

---

## 📚 Full Documentation

For complete details, see:
- **EVENT_MAP_GUIDE.md** - Map component usage and configuration
- **EVENT_MAP_COORDINATES_GUIDE.md** - Complete Option A & B documentation

---

## ✅ Production Checklist

Before deploying to production:

- [ ] Google Maps API key configured in production `.env`
- [ ] API key restricted to production IP addresses
- [ ] API key restricted to Geocoding API only
- [ ] Billing account set up with budget alerts
- [ ] Batch geocoding completed for existing data
- [ ] Mobile app configured with Google Maps API keys (in `app.json`)
- [ ] Tested on real iOS and Android devices
- [ ] Verified markers appear and are tappable

---

## 🎉 Summary

**Story #7 - Browse Events Map**: **100% COMPLETE**

- ✅ EventMap component with interactive markers
- ✅ Map/list toggle in discover screen
- ✅ Database schema updated with latitude/longitude
- ✅ Geocoding service with 7 API endpoints
- ✅ In-memory caching and rate limiting
- ✅ Comprehensive documentation

**Next Steps**:
1. Set up Google Maps API key
2. Run batch geocoding for existing data
3. Test map on mobile devices
4. Configure production API keys
5. Deploy! 🚀
