# Zip Code Radius & Alternatives Implementation

## Overview

Implements zip code-based ad targeting with 20-mile radius coverage and alternative suggestions when requested zip codes are at capacity.

## User Story

**Epic 7: Ads Hosting UX**

> As an advertiser, I want coverage within 20 miles of a zip, so that my ad hits the right audience; if full, suggest nearby zips.

**Acceptance Criteria:**
> Purchase checks capacity by zip; if booked, suggest next best zips; selection updates cart.

## Files Created

### 1. `utils/zipCodeUtils.ts`

Core utilities for zip code validation, distance calculation, and capacity checking.

**Key Functions:**

#### `isValidZipCode(zip: string): boolean`
Validates US zip code format (5-digit or 5+4).

```typescript
isValidZipCode('94102'); // true
isValidZipCode('94102-1234'); // true
isValidZipCode('9410'); // false
```

#### `calculateDistanceMiles(lat1, lon1, lat2, lon2): number`
Calculates distance between two coordinates using Haversine formula. Returns distance in miles.

```typescript
const miles = calculateDistanceMiles(37.7749, -122.4194, 37.4419, -122.1430);
// Returns: ~28.5 miles
```

#### `findNearbyZipCodes(centerZip, allZips, radiusMiles): Array`
Finds all zip codes within specified radius, sorted by distance.

```typescript
const nearby = findNearbyZipCodes(
  { zip: '94102', latitude: 37.7749, longitude: -122.4194 },
  allZipCodes,
  20 // 20-mile radius
);
// Returns: [{ zip: '94103', distance: 0.5 }, { zip: '94110', distance: 2.1 }, ...]
```

#### `checkZipCapacity(zip, dateRange): Promise<ZipCodeAvailability>`
Checks ad slot availability for a zip code on specific dates.

```typescript
const capacity = await checkZipCapacity('94102', ['2025-10-15', '2025-10-16']);
// Returns: { zip: '94102', available: true, capacity: 10, reserved: 3 }
```

#### `suggestAlternativeZips(requestedZip, zipLocation, nearbyZips, dateRange): Promise<ZipCodeSuggestion>`
Main function that checks requested zip and suggests alternatives if at capacity.

```typescript
const suggestions = await suggestAlternativeZips(
  '94102',
  zipLocation,
  nearbyZips,
  ['2025-10-15']
);
// Returns:
// {
//   original: '94102',
//   alternatives: [
//     { zip: '94103', available: true, distance: 0.5, capacity: 10, reserved: 2 },
//     { zip: '94110', available: true, distance: 2.1, capacity: 10, reserved: 5 }
//   ],
//   withinRadius: [/* all zips within 20 miles */]
// }
```

#### `formatDistance(miles: number): string`
Formats distance for user-friendly display.

```typescript
formatDistance(0.5); // "2640 ft"
formatDistance(5.3); // "5.3 mi"
```

### 2. `components/ZipAlternativesModal.tsx`

Modal component for displaying alternative zip code suggestions.

**Features:**
- Error message explaining original zip is full
- List of nearby alternatives sorted by distance
- Distance badges showing miles from original
- Availability bars showing capacity
- City/state information when available
- One-tap selection to update cart
- 20-mile radius coverage explanation

**Props:**
```typescript
interface ZipAlternativesModalProps {
  visible: boolean;
  requestedZip: string;
  alternatives: ZipCodeAvailability[];
  onSelectZip: (zip: string) => void;
  onClose: () => void;
  loading?: boolean;
}
```

**Example Usage:**
```typescript
import { ZipAlternativesModal } from '@/components/ZipAlternativesModal';
import { suggestAlternativeZips, lookupZipCode } from '@/utils/zipCodeUtils';

const [showAlternatives, setShowAlternatives] = useState(false);
const [alternatives, setAlternatives] = useState<ZipCodeAvailability[]>([]);

const handleZipSelection = async (zip: string) => {
  const zipLocation = await lookupZipCode(zip);
  if (!zipLocation) {
    Alert.alert('Invalid Zip', 'Could not find zip code location');
    return;
  }

  const suggestions = await suggestAlternativeZips(
    zip,
    zipLocation,
    nearbyZips,
    selectedDates
  );

  if (!suggestions.alternatives.length) {
    // Original zip has capacity, proceed
    setSelectedZip(zip);
  } else {
    // Show alternatives
    setAlternatives(suggestions.alternatives);
    setShowAlternatives(true);
  }
};

return (
  <ZipAlternativesModal
    visible={showAlternatives}
    requestedZip={requestedZip}
    alternatives={alternatives}
    onSelectZip={(newZip) => {
      setSelectedZip(newZip);
      updateCart(newZip);
    }}
    onClose={() => setShowAlternatives(false)}
  />
);
```

## Integration Points

### Ad Calendar Screen (`app/ad-calendar.tsx`)

Add zip code selection and capacity checking:

```typescript
import { ZipAlternativesModal } from '@/components/ZipAlternativesModal';
import { 
  suggestAlternativeZips, 
  lookupZipCode, 
  MOCK_ZIP_DATABASE 
} from '@/utils/zipCodeUtils';

export default function AdCalendarScreen() {
  const [selectedZip, setSelectedZip] = useState('');
  const [showZipAlternatives, setShowZipAlternatives] = useState(false);
  const [zipAlternatives, setZipAlternatives] = useState<ZipCodeAvailability[]>([]);

  const handleProceedToCheckout = async () => {
    if (!selectedZip || !selectedDates.length) {
      Alert.alert('Missing Info', 'Please select zip code and dates');
      return;
    }

    // Lookup zip location
    const zipLocation = await lookupZipCode(selectedZip);
    if (!zipLocation) {
      Alert.alert('Invalid Zip', 'Could not find this zip code');
      return;
    }

    // Check capacity and get suggestions
    const suggestions = await suggestAlternativeZips(
      selectedZip,
      zipLocation,
      MOCK_ZIP_DATABASE,
      selectedDates,
      5 // max 5 suggestions
    );

    if (suggestions.alternatives.length > 0) {
      // Original zip is full, show alternatives
      setZipAlternatives(suggestions.alternatives);
      setShowZipAlternatives(true);
    } else {
      // Has capacity, proceed to checkout
      proceedToPayment();
    }
  };

  return (
    <>
      {/* Existing UI */}
      
      <ZipAlternativesModal
        visible={showZipAlternatives}
        requestedZip={selectedZip}
        alternatives={zipAlternatives}
        onSelectZip={(newZip) => {
          setSelectedZip(newZip);
          setShowZipAlternatives(false);
          proceedToPayment();
        }}
        onClose={() => setShowZipAlternatives(false)}
      />
    </>
  );
}
```

## Backend API Requirements

The frontend requires these backend endpoints:

### 1. Check Zip Capacity
```
GET /api/advertisements/capacity?zip={zip}&dates={date1,date2}

Response:
{
  "zip": "94102",
  "available": true,
  "capacity": 10,
  "reserved": 3,
  "dates": ["2025-10-15", "2025-10-16"]
}
```

### 2. Get Nearby Zips (Optional - can use client-side geocoding)
```
GET /api/geo/nearby-zips?zip={zip}&radius={miles}

Response:
{
  "center": { "zip": "94102", "latitude": 37.7749, "longitude": -122.4194 },
  "nearby": [
    { "zip": "94103", "distance": 0.5, "city": "San Francisco", "state": "CA" },
    { "zip": "94110", "distance": 2.1, "city": "San Francisco", "state": "CA" }
  ]
}
```

## Algorithm Details

### Coverage Radius
- **Default:** 20 miles from selected zip code
- **Calculation:** Haversine formula for great-circle distance
- **Earth radius:** 3,959 miles (mean radius)

### Capacity Model
- **Per-zip inventory:** 10 slots per day (configurable)
- **Booking window:** 8 weeks ahead (already implemented)
- **Pricing tiers:** Weekday/weekend bundles

### Alternative Selection
1. Check original zip capacity
2. If at capacity, find all zips within 20-mile radius
3. Check capacity for each nearby zip
4. Sort by distance (closest first)
5. Return top 5 available zips
6. Show distance, availability, location info

## Testing Scenarios

### Scenario 1: Original Zip Has Capacity
```typescript
const suggestions = await suggestAlternativeZips('94102', zipLoc, nearby, dates);
// Result: alternatives = [], user proceeds with original zip
```

### Scenario 2: Original Zip Full, Alternatives Available
```typescript
const suggestions = await suggestAlternativeZips('94102', zipLoc, nearby, dates);
// Result:
// alternatives = [
//   { zip: '94103', distance: 0.5, available: true },
//   { zip: '94110', distance: 2.1, available: true }
// ]
// Modal shows alternatives, user selects new zip
```

### Scenario 3: No Alternatives Available
```typescript
const suggestions = await suggestAlternativeZips('94102', zipLoc, nearby, dates);
// Result: alternatives = []
// Show message: "No nearby zips available, try different dates"
```

## Acceptance Criteria Verification

✅ **Purchase checks capacity by zip**
- `checkZipCapacity()` queries backend for slot availability
- Checks before proceeding to payment
- Returns capacity, reserved count, available status

✅ **If booked, suggest next best zips**
- `suggestAlternativeZips()` finds nearby options within 20 miles
- Sorts by distance (closest first)
- Shows up to 5 alternatives
- Displays distance, availability, city/state

✅ **Selection updates cart**
- `onSelectZip` callback updates selected zip
- Cart recalculates with new zip
- Coverage description updates to reflect new radius
- Proceeds to checkout automatically

## Future Enhancements

1. **Dynamic Radius**
   - Allow advertisers to adjust radius (10/20/30 miles)
   - Pricing adjustments for larger coverage

2. **Heat Map**
   - Visual map showing available/full zip codes
   - Color-coded by availability
   - Interactive zip selection

3. **Smart Suggestions**
   - Machine learning based on campaign performance
   - Demographic matching
   - Conversion rate optimization

4. **Bulk Selection**
   - Select multiple nearby zips
   - Combined coverage area
   - Volume discounts

---

**Status:** ✅ Frontend complete. Requires backend capacity API.

**Implemented By:** GitHub Copilot (User Story #31/35)

**Epic:** 7) Ads Hosting UX - Zip Code Radius & Alternatives

**Date:** October 10, 2025
