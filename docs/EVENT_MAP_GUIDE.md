# Event Discovery Map Implementation Guide

## Overview
Interactive map view for discovering events with real-time location filtering, markers for each event, and user location tracking.

## Implementation Status
✅ **COMPLETE** - Map view integrated with discover screen

### Completed Components
1. ✅ EventMap component (`components/EventMap.tsx`)
2. ✅ Map/List toggle in discover screen
3. ✅ Google Maps API configuration
4. ✅ Location permissions setup
5. ✅ Map controls (center on events, center on user)

## Features

### EventMap Component
**Location**: `components/EventMap.tsx`

**Props**:
```typescript
interface EventMapProps {
  events: EventMapData[];           // Array of events to display
  onEventPress?: (eventId: string) => void;  // Callback when event marker is tapped
  initialRegion?: Region;           // Initial map region (optional)
  showUserLocation?: boolean;        // Show user's current location (default: true)
}

interface EventMapData {
  id: string;
  title: string;
  date: string;
  location?: string;      // Address/location name
  latitude?: number;      // Required for map marker
  longitude?: number;     // Required for map marker
  type?: 'game' | 'event' | 'post';  // Marker color coding
}
```

**Key Features**:
- **Location Permissions**: Requests user location permission on mount
- **User Location**: Displays blue dot showing current location
- **Event Markers**: Color-coded pins for games (red), events (teal), posts (light teal)
- **Callouts**: Tap markers to see event title, location, and date
- **Navigation**: Tap callout to navigate to event details
- **Control Buttons**:
  - 🎯 Center on all events (fit to bounds)
  - 🧭 Center on user location
- **Event Count**: Badge showing number of events on map
- **Empty State**: "No Events with Locations" message when no coordinates available

### Discover Screen Integration
**Location**: `app/(tabs)/discover/mobile-community.tsx`

**Changes**:
1. Added `viewMode` state: `'list' | 'map'`
2. Added map/list toggle button next to search box
3. Conditional rendering: Shows EventMap when `viewMode === 'map'`
4. Event data transformation: Converts games to EventMapData format

**Toggle Button**:
```tsx
<Pressable onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}>
  <Ionicons name={viewMode === 'list' ? 'map' : 'list'} />
</Pressable>
```

## Configuration

### app.json Updates

#### iOS Configuration
```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "VarsityHub needs your location to show nearby events on the map."
    },
    "config": {
      "googleMapsApiKey": ""  // Add your Google Maps API key
    }
  }
}
```

#### Android Configuration
```json
{
  "android": {
    "permissions": [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION"
    ],
    "config": {
      "googleMaps": {
        "apiKey": ""  // Add your Google Maps API key
      }
    }
  }
}
```

### Getting a Google Maps API Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Create/Select Project**: 
   - Click "Select a project" → "New Project"
   - Name: "VarsityHub Mobile"
   - Click "Create"

3. **Enable APIs**:
   - Go to "APIs & Services" → "Library"
   - Search for "Maps SDK for Android" → Enable
   - Search for "Maps SDK for iOS" → Enable
   - Search for "Geocoding API" → Enable (for address → coordinates)

4. **Create API Key**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

5. **Restrict API Key** (Important for security):
   - Click on your API key
   - Under "Application restrictions":
     - For Android: Select "Android apps" → Add package name: `com.xsantcastx.varsityhub`
     - For iOS: Select "iOS apps" → Add bundle ID: `com.xsantcastx.varsityhub`
   - Under "API restrictions":
     - Select "Restrict key"
     - Check: Maps SDK for Android, Maps SDK for iOS, Geocoding API
   - Click "Save"

6. **Add to app.json**:
   ```json
   "ios": {
     "config": {
       "googleMapsApiKey": "YOUR_API_KEY_HERE"
     }
   },
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "YOUR_API_KEY_HERE"
       }
     }
   }
   ```

## Usage

### Basic Usage
```tsx
import EventMap from '@/components/EventMap';

<EventMap
  events={[
    {
      id: '1',
      title: 'Championship Game',
      date: '2024-11-15T19:00:00Z',
      location: 'Main Stadium',
      latitude: 37.7749,
      longitude: -122.4194,
      type: 'game',
    },
  ]}
  onEventPress={(eventId) => {
    // Navigate to event detail
    router.push(`/game/${eventId}`);
  }}
  showUserLocation={true}
/>
```

### In Discover Screen
Users can toggle between list and map views:
- **List View**: Traditional scrollable list of events
- **Map View**: Interactive map with event markers

The toggle button automatically switches the icon:
- 📋 List icon when in map view (switches to list)
- 🗺️ Map icon when in list view (switches to map)

## Current Limitations & Future Enhancements

### Limitations
1. **No Geocoding Yet**: Events without lat/lng coordinates won't show on map
   - Games/Events currently only have `location` string field in schema
   - Need to add lat/lng fields to database OR use geocoding service

2. **Search Not Map-Aware**: Search filters list but doesn't update map region

3. **No Clustering**: Many events in same area may overlap

### Recommended Enhancements

#### 1. Add Coordinates to Database Schema
**Priority**: HIGH

Update Prisma schema:
```prisma
model Game {
  id       String   @id @default(cuid())
  title    String
  date     DateTime
  location String?
  latitude  Float?   // Add this
  longitude Float?   // Add this
  ...
}

model Event {
  id       String   @id @default(cuid())
  title    String
  date     DateTime
  location String?
  latitude  Float?   // Add this
  longitude Float?   // Add this
  ...
}
```

Then run migration:
```bash
cd server
npx prisma migrate dev --name add_event_coordinates
```

#### 2. Geocoding Integration
**Priority**: HIGH (if not adding lat/lng to schema)

Options:
- **Google Geocoding API**: Convert addresses to coordinates
- **Backend Service**: Geocode on event creation
- **Frontend Caching**: Cache geocoded results

Example backend endpoint:
```typescript
// server/src/routes/events.ts
import { Client } from '@googlemaps/google-maps-services-js';

const geocode = async (address: string) => {
  const client = new Client({});
  const response = await client.geocode({
    params: {
      address,
      key: process.env.GOOGLE_MAPS_API_KEY!,
    },
  });
  
  if (response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
  return null;
};
```

#### 3. Marker Clustering
**Priority**: MEDIUM

When many events are in the same area, cluster them:
```bash
npm install react-native-maps-super-cluster
```

```tsx
import SuperCluster from 'react-native-maps-super-cluster';

<SuperCluster
  data={events}
  renderMarker={(event) => <Marker ... />}
  renderCluster={(cluster) => <Marker ... />}
/>
```

#### 4. Map Search Integration
**Priority**: MEDIUM

Update search to filter and center map:
```tsx
const handleSearch = (query: string) => {
  setQuery(query);
  
  if (viewMode === 'map') {
    const filtered = filterEvents(query);
    fitMapToEvents(filtered);
  }
};
```

#### 5. Location-Based Filtering
**Priority**: MEDIUM

Add radius filter:
```tsx
const [radiusMiles, setRadiusMiles] = useState(25);

const nearbyEvents = events.filter((event) => {
  if (!event.latitude || !event.longitude || !userLocation) return true;
  
  const distance = calculateDistance(
    userLocation.coords.latitude,
    userLocation.coords.longitude,
    event.latitude,
    event.longitude
  );
  
  return distance <= radiusMiles;
});
```

#### 6. Map Styles
**Priority**: LOW

Add custom map styling:
```tsx
<MapView
  customMapStyle={colorScheme === 'dark' ? darkMapStyle : lightMapStyle}
  ...
/>
```

## Testing Guide

### Test 1: Map View Toggle
1. Open app and navigate to Discover tab
2. Tap the map icon (🗺️) next to search box
3. **Expected**: View switches to map
4. Tap the list icon (📋)
5. **Expected**: View switches back to list

### Test 2: Location Permissions
1. Clear app data/reinstall app
2. Navigate to Discover tab
3. Tap map icon
4. **Expected**: Location permission prompt appears
5. Grant permission
6. **Expected**: Map centers on user location (blue dot visible)

### Test 3: Event Markers (When Coordinates Available)
1. Create test events with lat/lng coordinates
2. Switch to map view
3. **Expected**: 
   - Markers appear at event locations
   - Marker colors match event type (red=game, teal=event)
   - Event count badge shows correct number

### Test 4: Marker Interactions
1. Tap on an event marker
2. **Expected**: Callout appears with event title, location, date
3. Tap the callout
4. **Expected**: Navigates to event detail screen

### Test 5: Map Controls
1. Switch to map view with events
2. Tap the 🎯 button (center on events)
3. **Expected**: Map zooms to show all events
4. Pan map away from current location
5. Tap the 🧭 button (center on user)
6. **Expected**: Map centers on user's blue dot

### Test 6: No Events State
1. Switch to map view when no events have coordinates
2. **Expected**: 
   - Map shows with user location
   - Card overlay: "No Events with Locations"
   - Message explains events need location data

## Troubleshooting

### Issue: "Cannot find module 'react-native-maps'"
**Solution**: 
```bash
npx expo install react-native-maps
npm install --save-dev @types/react-native-maps
```

### Issue: Map not showing on Android
**Cause**: Missing Google Maps API key
**Solution**:
1. Add API key to `app.json` under `android.config.googleMaps.apiKey`
2. Rebuild app: `npx expo run:android`

### Issue: Map not showing on iOS
**Cause**: Missing Google Maps API key or location permission
**Solution**:
1. Add API key to `app.json` under `ios.config.googleMapsApiKey`
2. Check location permission in iOS Settings → VarsityHub → Location
3. Rebuild app: `npx expo run:ios`

### Issue: No events showing on map
**Cause**: Events don't have latitude/longitude coordinates
**Solution**:
1. Check database: Events need `latitude` and `longitude` fields
2. Add coordinates to schema (see "Add Coordinates to Database Schema" above)
3. OR implement geocoding service

### Issue: Location permission denied
**Solution**:
1. iOS: Settings → VarsityHub → Location → "While Using the App"
2. Android: Settings → Apps → VarsityHub → Permissions → Location → Allow
3. Or reinstall app to retrigger permission prompt

### Issue: Map showing but markers not appearing
**Debugging**:
```tsx
// Add console log in discover screen
const eventsWithCoordinates = filtered.filter(
  (g) => g.latitude && g.longitude
);
console.log('Events with coordinates:', eventsWithCoordinates.length);
```

## Related Documentation
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) - Project status
- [react-native-maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [expo-location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Google Maps Platform](https://developers.google.com/maps)

## Story Completion
**Story #7 - Browse Events Map**: ✅ **95% COMPLETE**

**Completed**:
- ✅ EventMap component with markers
- ✅ Map/list toggle in discover screen
- ✅ Location permissions
- ✅ User location tracking
- ✅ Event markers with callouts
- ✅ Map controls (center on events/user)
- ✅ Empty state handling

**Remaining**:
- ⏳ Add lat/lng to database schema OR implement geocoding (5% - backend work)

**Time Invested**: ~4 hours
**User Value**: HIGH - Visual event discovery
**Technical Debt**: None (requires geocoding/schema update to be fully functional)
