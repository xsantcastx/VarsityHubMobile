 work # Banner Ad Example - Skateboard Shop

This directory contains example banner ad assets for testing and demonstration purposes.

## Example: Stamford Skate Shop

**Image**: `example-skateboard-shop.jpg`

### Ad Details
- **Business Name**: Stamford Skate Shop
- **Description**: Gear up & ride! Skateboards, shoes, apparel, accessories.
- **Target URL**: https://stamfordskate.com (example)
- **Category**: Sports & Recreation
- **Tagline**: "GEAR UP & RIDE!"
- **Products Featured**:
  - Skateboards (multiple designs shown)
  - Skateboard shoes
  - Apparel (hats, clothing)
  - Accessories

### Visual Style
- High-energy action shot with skateboarder
- Bold text overlays with product categories
- Product showcase at bottom
- Call-to-action button: "SHOP NOW"
- Sunset/urban background theme
- Orange/black color scheme with explosive graphics

### How to Use This Example

#### 1. In Development/Testing
Add this to your feed to test banner ad display:

\`\`\`typescript
const exampleAd = {
  id: 'example-skateboard-1',
  business_name: 'Stamford Skate Shop',
  description: 'Gear up & ride! Skateboards, shoes, apparel, accessories.',
  banner_url: require('@/assets/ads/example-skateboard-shop.jpg'),
  banner_fit_mode: 'fill',
  target_url: 'https://stamfordskate.com',
  zip_code: '06901',
  radius: 45,
  status: 'active',
};
\`\`\`

#### 2. Via Submit Ad Screen
Navigate to `/submit-ad` and fill in:
- Contact Name: Your name
- Email: your@email.com
- Business Name: Stamford Skate Shop
- ZIP Code: 06901
- Banner: Upload the skateboard image
- Website Link: https://stamfordskate.com
- Description: Gear up & ride! Skateboards, shoes, apparel, accessories.

#### 3. Direct API Call
\`\`\`typescript
import { Advertisement } from '@/api/entities';

const ad = await Advertisement.create({
  contact_name: 'Demo User',
  contact_email: 'demo@example.com',
  business_name: 'Stamford Skate Shop',
  banner_url: 'https://your-cdn.com/skateboard-shop-banner.jpg',
  banner_fit_mode: 'fill',
  target_url: 'https://stamfordskate.com',
  target_zip_code: '06901',
  radius: 45,
  description: 'Gear up & ride! Skateboards, shoes, apparel, accessories.',
});
\`\`\`

## Ad Display Components

### BannerAd Component
Located at: `components/BannerAd.tsx`

Props:
- `bannerUrl`: Image URL (required)
- `targetUrl`: Website to open on click
- `businessName`: Name displayed in placeholder
- `description`: Description text
- `fitMode`: 'letterbox' | 'fill' | 'stretch' (default: 'fill')
- `aspectRatio`: Aspect ratio (default: 16/9)

### Where Ads Appear
1. **Feed Screen** (`src/features/posts/screens/FeedScreen.tsx`)
   - Mixed with posts and events
   - Labeled as "SPONSORED"
   - Every ~10 items

2. **Admin Ads Screen** (`src/features/admin/screens/AdminAdsScreen.tsx`)
   - Manage all submitted ads
   - Approve/reject/edit

3. **My Ads Screen** (`app/my-ads.tsx`)
   - User's submitted advertisements
   - Track performance

## Best Practices for Ad Banners

### Image Specifications
- **Recommended Size**: 1024x576px (16:9 aspect ratio)
- **Minimum Size**: 800x450px
- **Format**: JPG or PNG
- **File Size**: < 500KB for optimal loading
- **Safe Zone**: Keep critical text/logos in center 80% of image

### Design Guidelines
1. **Bold, readable text** - Visible at all sizes
2. **Clear CTA** - "Shop Now", "Learn More", "Visit Us"
3. **Product showcase** - Show what you're selling
4. **Brand identity** - Logo and colors prominent
5. **High contrast** - Ensure readability on mobile

### Fit Modes Explained
- **fill**: Crops to fill container (best for most ads)
- **letterbox**: Shows entire image with bars if needed
- **stretch**: Stretches to fit (may distort, use sparingly)

## Testing Checklist

- [ ] Image loads correctly in feed
- [ ] Tap opens confirmation dialog
- [ ] Website opens in browser
- [ ] "Ad" badge visible
- [ ] "Tap to visit" indicator shows
- [ ] Looks good in light/dark mode
- [ ] Responsive on different screen sizes
- [ ] Banner fits properly based on fitMode

## Related Files
- `components/BannerAd.tsx` - Display component
- `components/BannerUpload.tsx` - Upload interface
- `app/submit-ad.tsx` - Submission form
- `src/features/posts/screens/FeedScreen.tsx` - Feed integration
- `api/entities/Advertisement.ts` - Backend API
