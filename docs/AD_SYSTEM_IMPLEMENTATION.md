# Ad System Implementation Status

## Completed Features ✅

### 1. Single-Day Pricing ($1.75 weekday, $2.99 weekend)
**Status:** ✅ COMPLETE

**Changes:**
- **Frontend** (`app/ad-calendar.tsx`):
  * Updated `calculatePrice()` to charge per individual day instead of bundle pricing
  * Weekday (Mon-Thu): $1.75 per day
  * Weekend (Fri-Sun): $2.99 per day
  * Updated UI legend to show "/day" pricing
  * Updated pricing card text for clarity

- **Backend** (`server/src/routes/payments.ts`):
  * Updated `calculatePriceCents()` function
  * Weekday: 175 cents ($1.75)
  * Weekend: 299 cents ($2.99)
  * Calculates total by summing each individual day

**Example Pricing:**
- 1 weekday = $1.75
- 1 weekend day = $2.99
- 3 weekdays + 2 weekend days = $11.23 (3×$1.75 + 2×$2.99)

---

### 2. Sales Tax Calculation
**Status:** ✅ COMPLETE

**New Files:**
- **`server/src/lib/taxCalculator.ts`**: Complete tax calculator utility
  * All 50 US states + DC tax rates
  * Zip code to state mapping (first 3 digits)
  * Functions: `calculateSalesTax()`, `getStateFromZip()`, `getTaxRate()`, `getTaxInfo()`

**Changes:**
- **Backend** (`server/src/routes/payments.ts`):
  * Imports `calculateSalesTax` from tax calculator
  * Calculates tax based on `ad.target_zip_code`
  * Tax applied to subtotal (discounts applied before tax)
  * Tax included in Stripe checkout metadata
  * Transaction logger records tax amount

- **Frontend** (`app/ad-calendar.tsx`):
  * Displays estimated sales tax in checkout summary
  * Uses rough 6.5% average for client-side estimation
  * Server calculates exact tax based on zip code
  * Shows "Sales Tax (est.)" line item

**Tax Rates by State:**
- California: 7.25%
- Texas: 6.25%
- New York: 4%
- Florida: 6%
- *(Full list in taxCalculator.ts)*

**Calculation Flow:**
1. User selects dates → subtotal calculated
2. Promo code discount applied to subtotal
3. Sales tax calculated on (subtotal - discount)
4. Final total = (subtotal - discount) + tax

---

### 3. Banner Stretch Without Crop
**Status:** ✅ COMPLETE

**Changes:**
- **`components/BannerUpload.tsx`**:
  * Removed `allowsEditing: true` from ImagePicker
  * Removed `aspect: [16, 9]` constraint
  * Users can now upload full images without forced cropping
  * Fit mode (letterbox/fill/stretch) handled at display time, not upload time

- **Database Schema** (`server/prisma/schema.prisma`):
  * Added `banner_fit_mode String? @default("fill")` to Ad model
  * Supports: 'letterbox', 'fill', 'stretch'

**Fit Modes:**
- **Letterbox**: Fits entire image with padding bars (no cropping, no distortion)
- **Fill**: Fills space by cropping edges (maintains aspect ratio)
- **Stretch**: Stretches to fill entire space (may distort aspect ratio)

---

### 4. Clickable Banner Ads with Target URL
**Status:** ✅ COMPLETE

**New Files:**
- **`components/BannerAd.tsx`**: Complete clickable banner component
  * Displays banner with proper fit mode
  * Handles clicks to open target URL using `expo-linking`
  * Shows "Ad" badge and external link indicator
  * Placeholder view for ads without banner
  * Props: `bannerUrl`, `targetUrl`, `businessName`, `description`, `fitMode`, `aspectRatio`

**Database Changes:**
- **`server/prisma/schema.prisma`**:
  * Added `target_url String?` to Ad model
  * Stores URL that ad should link to when clicked

**Form Changes:**
- **`app/submit-ad.tsx`**:
  * Added `targetUrl` state
  * Added URL input field (keyboard type: "url")
  * Shows helper text: "When users click your ad, they'll be taken to this URL"
  * Sends `target_url` to backend on submit
  * Saves to local storage for offline support

**Usage Example:**
```tsx
import { BannerAd } from '@/components/BannerAd';

<BannerAd
  bannerUrl="https://example.com/banner.jpg"
  targetUrl="https://example.com/special-offer"
  businessName="Pizza Palace"
  description="Best pizza in town!"
  fitMode="fill"
  aspectRatio={16 / 9}
/>
```

**Click Behavior:**
- If `targetUrl` exists: Opens URL using `Linking.openURL()`
- If no `targetUrl`: Shows alert "This ad does not have a website link"
- Validates URL can be opened before attempting
- Error handling with user-friendly alerts

---

## Implementation Summary

### Files Created:
1. `server/src/lib/taxCalculator.ts` - Sales tax calculation utility
2. `components/BannerAd.tsx` - Clickable banner ad display component

### Files Modified:
1. `app/ad-calendar.tsx` - Per-day pricing, tax display
2. `app/submit-ad.tsx` - Target URL input field
3. `components/BannerUpload.tsx` - Removed forced cropping
4. `server/src/routes/payments.ts` - Per-day pricing, tax calculation
5. `server/prisma/schema.prisma` - Added banner_fit_mode and target_url fields

### Database Migration Needed:
```bash
cd server
npx prisma migrate dev --name add_banner_fields
npx prisma generate
```

---

## Still Missing (From Original Requirements)

### ❌ Email Confirmation Page
- **Current**: Shows "OK" alert after sign up
- **Required**: Redirect to `/verify-email` page instead of alert
- **Difficulty**: Easy (1 hour)

### ❌ Mandatory Photo/Media Upload
- **Current**: Banner upload is optional
- **Required**: Make `required={true}` in submit-ad form
- **Difficulty**: Easy (5 minutes)

### ❌ Mandatory Description
- **Current**: Description is optional
- **Required**: Validation check before submit
- **Difficulty**: Easy (5 minutes)

### ❌ 20-Mile Radius Messaging
- **Current**: No visible indication of ad radius
- **Required**: Display "Your ad will reach 20 miles around [zip]"
- **Difficulty**: Easy (15 minutes)

### ⚠️ Zip Code Fallback (Show Next Available)
- **Current**: No alternative zip suggestions
- **Required**: If zip booked, show next available zips within radius
- **Difficulty**: Hard (8-12 hours - requires geo-radius search)

### ❌ Promo Code Usage Limits (8 at a time)
- **Current**: Promo codes work but no usage cap
- **Required**: Limit to first 8 users per code
- **Difficulty**: Medium (3-4 hours - add usage counter to PromoCode model)

---

## Testing Checklist

### Single-Day Pricing:
- [ ] Select 1 weekday → should show $1.75
- [ ] Select 1 weekend day → should show $2.99
- [ ] Select 3 weekdays + 2 weekend days → should show $11.23
- [ ] Backend calculates same amount in payment checkout

### Sales Tax:
- [ ] Create ad with California zip (e.g., 90210) → should calculate 7.25% tax
- [ ] Create ad with Texas zip (e.g., 78701) → should calculate 6.25% tax
- [ ] Create ad with Montana zip (e.g., 59101) → should calculate 0% tax
- [ ] Tax shows in checkout summary
- [ ] Transaction log records correct tax amount

### Banner Upload:
- [ ] Upload portrait image → should not be cropped
- [ ] Upload landscape image → should not be cropped
- [ ] Change fit mode to "letterbox" → should show full image with bars
- [ ] Change fit mode to "stretch" → should stretch to fill space
- [ ] Change fit mode to "fill" → should crop edges to fill

### Clickable Ads:
- [ ] Create ad with target URL → URL saved in database
- [ ] Display ad with URL → shows external link icon
- [ ] Click ad with URL → opens URL in browser
- [ ] Click ad without URL → shows "No Link" alert
- [ ] Invalid URL → shows "Unable to open this link" alert

---

## Performance Considerations

### Tax Calculation:
- **Client-side**: Uses rough 6.5% estimate for preview
- **Server-side**: Calculates exact tax based on state
- **Future Enhancement**: Could integrate TaxJar or Avalara API for county/city taxes

### Image Upload:
- **Max Size**: 5MB limit enforced
- **Format**: All image formats supported
- **Future Enhancement**: Server-side image optimization/compression

### Geo Search (Future):
- Will need PostGIS or similar for efficient radius queries
- Consider caching popular zip code searches

---

## Revenue Impact

### Old Bundle Pricing:
- Mon-Thu bundle: $10.00
- Fri-Sun bundle: $17.50
- Example: 7-day week = $27.50

### New Per-Day Pricing:
- Mon-Thu (4 days): 4 × $1.75 = $7.00
- Fri-Sun (3 days): 3 × $2.99 = $8.97
- Example: 7-day week = $15.97

**Revenue Change**: ~42% reduction for full-week bookings
**Benefit**: More flexible pricing, encourages single-day testing

---

## Next Steps

1. **Run database migration** to add new fields
2. **Test all 4 features** with real data
3. **Deploy to staging** for user acceptance testing
4. **Implement easy wins** (mandatory fields, 20-mile messaging)
5. **Plan geo-radius search** for zip code fallback
6. **Consider promo code usage limits** for launch

---

## API Documentation

### Tax Calculator Functions:

```typescript
// Calculate sales tax in cents
calculateSalesTax(amountCents: number, zipCode: string): number

// Get state code from zip
getStateFromZip(zipCode: string): string | null

// Get tax rate as decimal
getTaxRate(zipCode: string): number

// Get detailed tax info
getTaxInfo(zipCode: string): {
  state: string | null;
  rate: number;
  ratePercent: string;
}
```

### BannerAd Component Props:

```typescript
interface BannerAdProps {
  bannerUrl?: string | null;
  targetUrl?: string | null;
  businessName?: string;
  description?: string;
  fitMode?: 'letterbox' | 'fill' | 'stretch';
  aspectRatio?: number;
  onPress?: () => void; // Optional override
}
```

---

**Last Updated:** October 13, 2025
**Commit:** cd219f4
