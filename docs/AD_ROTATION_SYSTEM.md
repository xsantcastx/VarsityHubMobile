# Ad Rotation System

## Overview
The ad rotation system displays up to 2 banner ads that automatically rotate every 60 seconds. If no ads are available, it displays a "Reserve Ad Space" call-to-action button.

## Features
- ✅ **Rotating Display**: Cycles through up to 2 active ads every minute
- ✅ **Smooth Transitions**: Fade in/out animations between ads
- ✅ **Fallback CTA**: Shows "Reserve Ad Space" button when no ads are booked
- ✅ **Visual Indicators**: Dots and counter showing which ad is currently displayed
- ✅ **Backend Persistence**: Ads are stored in database with reservation dates
- ✅ **Automatic Loading**: Fetches ads for today's date on feed load

## Components

### RotatingAd Component
**Location**: `components/RotatingAd.tsx`

**Props**:
- `ads`: Array of ad data objects (up to 2 will be shown)
- `rotationInterval`: Milliseconds between rotations (default: 60000 = 1 minute)
- `aspectRatio`: Aspect ratio for the ad container (default: 16/9)
- `onReserveAdSpace`: Optional callback when "Reserve Ad Space" is clicked

**Behavior**:
- Shows rotating banner if 1-2 ads with banners are provided
- Shows "Reserve Ad Space" fallback if no ads
- Auto-rotates with fade transitions
- Displays rotation indicators (dots) and ad counter

### Example Usage

```typescript
import { RotatingAd } from '@/components/RotatingAd';

<RotatingAd
  ads={sponsoredAds}
  rotationInterval={60000}
  aspectRatio={3.5}
  onReserveAdSpace={() => router.push('/submit-ad')}
/>
```

## Backend Integration

### Database Schema
Ads are stored in the `Ad` table with:
- `id`: Unique identifier
- `business_name`: Business name
- `banner_url`: URL to banner image
- `banner_fit_mode`: 'fill', 'letterbox', or 'stretch'
- `target_url`: Website URL to open on click
- `description`: Optional description
- `status`: 'draft', 'pending', 'approved', 'rejected'
- `payment_status`: 'unpaid', 'paid'

Ad reservations are in `AdReservation` table:
- `ad_id`: Foreign key to Ad
- `date`: Date the ad is reserved for

### API Endpoints

#### GET /ads/for-feed
Returns ads with reservations for a specific date.

**Query Parameters**:
- `date`: Date in yyyy-MM-dd format (default: today)
- `zip`: Optional ZIP code filter
- `limit`: Number of ads to return (default: 2, max: 5)

**Response**:
```json
{
  "date": "2025-12-28",
  "ads": [
    {
      "id": "example-skateboard-shop-1",
      "business_name": "Stamford Skate Shop",
      "banner_url": "https://cdn.example.com/skateboard-banner.jpg",
      "banner_fit_mode": "fill",
      "target_url": "https://stamfordskate.com",
      "description": "Gear up & ride!",
      "status": "approved",
      "payment_status": "paid"
    }
  ]
}
```

**Filtering Logic**:
- Only returns ads with `payment_status: 'paid'`
- Only returns ads with `status: 'approved'`
- Only returns ads with a reservation for the requested date
- Respects ZIP code filter if provided
- Orders by `created_at` desc
- Limits to requested number (default 2)

## Seeding Example Ads

### Using the Seed Script

1. **Update the banner URL** in `server/src/scripts/seedExampleAds.ts`:
   ```typescript
   banner_url: 'https://your-cdn.com/skateboard-shop-banner.jpg',
   ```

2. **Run the seed script**:
   ```bash
   cd server
   npx ts-node src/scripts/seedExampleAds.ts
   ```

3. **Verify in database**:
   - Ad should exist with id `example-skateboard-shop-1`
   - Ad should have status `approved` and payment_status `paid`
   - Reservation should exist for today's date

### Manual Creation via API

```typescript
import { Advertisement } from '@/api/entities';

// 1. Create the ad
const ad = await Advertisement.create({
  contact_name: 'Shop Manager',
  contact_email: 'info@stamfordskate.com',
  business_name: 'Stamford Skate Shop',
  banner_url: 'https://cdn.example.com/skateboard-banner.jpg',
  banner_fit_mode: 'fill',
  target_url: 'https://stamfordskate.com',
  target_zip_code: '06901',
  radius: 45,
  description: 'Gear up & ride! Skateboards, shoes, apparel, accessories.',
  status: 'approved',
  payment_status: 'paid',
});

// 2. Create reservation for today
const today = new Date().toISOString().slice(0, 10);
await Advertisement.reserve(ad.id, [today]);
```

## Rotation Behavior

### With 0 Ads
- Shows "Reserve Ad Space" button
- Megaphone icon
- "Book Now" CTA
- Clicking navigates to `/submit-ad`

### With 1 Ad
- Shows the single ad
- No rotation (stays static)
- No indicators shown

### With 2 Ads
- Shows first ad initially
- Fades out after 60 seconds
- Switches to second ad
- Fades in
- Shows rotation dots (2 dots, one highlighted)
- Shows counter "1 / 2" → "2 / 2"
- Loops back to first ad after 60 more seconds

### Visual Feedback
- **Fade Animation**: 300ms fade out → switch → 300ms fade in
- **Rotation Dots**: Small circles at bottom center
  - Active dot: Full opacity, tint color
  - Inactive dot: 40% opacity, muted color
- **Counter Badge**: Top-right corner shows "X / Y"
- **Ad Badge**: Top-left "Ad" badge (from BannerAd component)
- **Tap Indicator**: Bottom-right "Tap to visit" (from BannerAd component)

## Feed Integration

### FeedScreen Implementation
**Location**: `src/features/posts/screens/FeedScreen.tsx`

```typescript
// Import rotating ad component
import { RotatingAd } from '@/components/RotatingAd';

// In render, replace static BannerAd with RotatingAd
<RotatingAd
  ads={sponsoredAds}
  rotationInterval={60000}
  aspectRatio={3.5}
  onReserveAdSpace={() => router.push('/submit-ad')}
/>
```

### Data Flow
1. Feed loads and calls `Advertisement.forFeed()` (requests 2 ads for today)
2. Backend returns up to 2 approved, paid ads with today's reservation
3. Feed stores ads in `sponsoredAds` state
4. RotatingAd component receives `sponsoredAds` array
5. Component filters to ads with banners (up to 2)
6. Rotation timer starts if multiple ads
7. User sees rotating ads every 60 seconds

## Testing

### Test Scenario 1: No Ads
1. Ensure no ads have reservations for today
2. Load feed
3. ✅ Should show "Reserve Ad Space" button
4. ✅ Click should navigate to `/submit-ad`

### Test Scenario 2: One Ad
1. Seed one ad with today's reservation
2. Load feed
3. ✅ Should show the single ad
4. ✅ No rotation indicators
5. ✅ Ad stays static
6. ✅ Click opens confirmation dialog

### Test Scenario 3: Two Ads
1. Seed two ads with today's reservations
2. Load feed
3. ✅ Should show first ad initially
4. ✅ Rotation dots visible (2 dots)
5. ✅ Counter shows "1 / 2"
6. Wait 60 seconds
7. ✅ Fade out animation plays
8. ✅ Second ad appears
9. ✅ Counter shows "2 / 2"
10. Wait 60 seconds
11. ✅ Loops back to first ad

### Test Scenario 4: Multiple Banner Images
1. Create two ads with different banner images
2. Verify each banner loads correctly
3. Verify fit mode respects each ad's setting
4. Verify smooth transitions between different images

## Configuration

### Rotation Timing
Change rotation interval by updating `rotationInterval` prop:
```typescript
<RotatingAd
  ads={ads}
  rotationInterval={30000} // 30 seconds
/>
```

### Aspect Ratio
Adjust aspect ratio to fit your design:
```typescript
<RotatingAd
  ads={ads}
  aspectRatio={2} // 2:1 ratio (wider)
/>
```

### Max Ads
Backend limits to 5 ads max per request, but `RotatingAd` component only displays first 2:
```typescript
// In RotatingAd.tsx
const validAds = ads.filter(ad => ad.banner_url).slice(0, 2);
```

Change `slice(0, 2)` to `slice(0, 3)` for 3 ads, etc.

## Performance Considerations

- **Memory**: Rotation timer is cleaned up on component unmount
- **Animation**: Uses `useNativeDriver` for better performance
- **Loading**: Ads are fetched once on feed load, not on each rotation
- **Caching**: Backend API responses can be cached (currently no-store for freshness)

## Future Enhancements

1. **Click Tracking**: Log ad impressions and clicks for analytics
2. **Geographic Targeting**: Use user's location for ZIP-based filtering
3. **A/B Testing**: Randomly show different ad variations
4. **Priority Weighting**: Allow paying more for more frequent display
5. **Time-Based Slots**: Different ads for morning/afternoon/evening
6. **Swipe Gestures**: Allow manual swiping between ads
7. **Video Ads**: Support video banners in addition to static images
8. **Expanded Fallbacks**: Show multiple "Reserve Ad Space" slots if no bookings

## Troubleshooting

### Ads Not Rotating
- Check `sponsoredAds` array has 2+ ads with `banner_url`
- Verify `rotationInterval` is set (default 60000)
- Check browser console for timer errors

### "Reserve Ad Space" Always Showing
- Verify ads exist in database with `status: 'approved'` and `payment_status: 'paid'`
- Verify ad reservations exist for today's date
- Check backend `/ads/for-feed` endpoint returns ads
- Verify ads have non-empty `banner_url`

### Rotation Timer Not Cleaning Up
- Ensure component is properly unmounting
- Check `useEffect` cleanup function is running
- Verify `rotationTimerRef.current` is being cleared

### Animation Performance Issues
- Verify `useNativeDriver: true` is set on Animated.timing
- Check for excessive re-renders causing timer resets
- Consider increasing transition duration if animations feel choppy

## Related Files
- `components/RotatingAd.tsx` - Main rotation component
- `components/BannerAd.tsx` - Individual banner display
- `server/src/routes/ads.ts` - Backend API endpoints
- `server/src/scripts/seedExampleAds.ts` - Example data seeding
- `src/features/posts/screens/FeedScreen.tsx` - Feed integration
- `data/example-ads.ts` - Example ad data structures
