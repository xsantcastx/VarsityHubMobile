# Testing Banner Ads with Skateboard Shop Example

This guide shows how to test banner ad functionality using the Stamford Skate Shop example.

## Quick Start

### Method 1: Add Example Ad to Feed (Development)

1. Open `src/features/posts/screens/FeedScreen.tsx`
2. Find the comment near line 340 that says "For testing: uncomment to add example skateboard shop ad"
3. Uncomment these lines:
```typescript
import { skateboardShopAd } from '@/data/example-ads';
list.push(skateboardShopAd);
```
4. Reload the app - you'll see the skateboard ad in your feed

### Method 2: Submit Through UI

1. Open the app and navigate to "Submit Ad" (or `/submit-ad`)
2. Fill in the form:
   - **Contact Name**: Your Name
   - **Email**: your@email.com
   - **Business Name**: Stamford Skate Shop
   - **ZIP Code**: 06901
   - **Banner**: Upload the skateboard image from `assets/ads/example-skateboard-shop.jpg`
   - **Website Link**: https://stamfordskate.com
   - **Description**: Gear up & ride! Skateboards, shoes, apparel, accessories.
   - **Fit Mode**: Fill (recommended)
3. Submit and view in your feed

### Method 3: Use Admin Panel

1. Navigate to Admin → Ads (`/admin-ads`)
2. Click "Submit Ad" button
3. Follow the same process as Method 2
4. Approve the ad immediately (since you're admin)
5. View in feed

## What You'll See

### In the Feed
- Banner ad appears between posts/events
- "SPONSORED" label at the top
- Full-width banner image with skateboard shop design
- Business name: "Stamford Skate Shop"
- Description below banner
- "Ad" badge in top-left corner
- "Tap to visit" indicator in bottom-right
- "Promote your program" CTA at bottom

### On Click
1. Confirmation dialog appears
2. Shows: "Do you want to visit Stamford Skate Shop? https://stamfordskate.com"
3. Options: "Cancel" or "Open"
4. "Open" launches external browser

## Testing Checklist

### Visual Testing
- [ ] Banner image loads and displays correctly
- [ ] Aspect ratio looks good (not stretched/squished)
- [ ] "Ad" badge visible in top-left
- [ ] "Tap to visit" indicator shows in bottom-right
- [ ] "SPONSORED" label appears above banner
- [ ] Business name renders correctly
- [ ] Description text is readable
- [ ] Works in both light and dark mode
- [ ] Looks good on different screen sizes

### Interactive Testing
- [ ] Tapping banner shows confirmation dialog
- [ ] Dialog shows correct business name and URL
- [ ] "Cancel" closes dialog without action
- [ ] "Open" launches browser successfully
- [ ] Browser opens to correct URL
- [ ] Back button returns to app

### Fit Mode Testing
Change `banner_fit_mode` in the example data to test:

**Fill** (default - recommended):
- Fills entire container
- May crop edges
- Best for most ads

**Letterbox**:
- Shows entire image
- May show bars on sides
- Good for logos/text-heavy

**Stretch**:
- Stretches to fill
- May distort image
- Use with caution

### Edge Cases
- [ ] Works without description (optional field)
- [ ] Handles long business names (truncates)
- [ ] Handles long descriptions (2 lines max)
- [ ] Works with various image sizes
- [ ] Handles slow network (loading state)
- [ ] Graceful fallback if image fails to load

## Customizing the Example

Edit `data/example-ads.ts` to customize:

```typescript
export const skateboardShopAd: ExampleAd = {
  business_name: 'Your Business',
  description: 'Your description here',
  banner_url: 'your-image-url',
  target_url: 'https://yourdomain.com',
  // ... other fields
};
```

## Creating Your Own Example Ads

1. Add images to `assets/ads/`
2. Create new ad object in `data/example-ads.ts`:

```typescript
export const yourAdName: ExampleAd = {
  id: 'example-yourad-1',
  business_name: 'Your Business',
  description: 'Your compelling description',
  banner_url: require('@/assets/ads/your-image.jpg'),
  banner_fit_mode: 'fill',
  target_url: 'https://yourbusiness.com',
  contact_name: 'Contact Name',
  contact_email: 'contact@business.com',
  zip_code: '12345',
  radius: 45,
  status: 'active',
  created_at: new Date().toISOString(),
};
```

3. Add to `exampleAds` array
4. Import and use in your components

## Ad Performance Testing

### Tracking (Future Enhancement)
Consider adding analytics:
- Impressions (how many times ad is viewed)
- Clicks (tap to visit)
- Click-through rate (CTR)
- Geographic reach
- Time of day performance

### A/B Testing
Test different variations:
- Different banner designs
- Different CTAs
- Different fit modes
- With/without descriptions

## Production Considerations

### Before Going Live
1. **Remove example ads** from production builds
2. **Replace placeholder URLs** with real CDN links
3. **Set up proper ad management** backend
4. **Implement ad approval workflow**
5. **Add reporting/analytics**
6. **Test payment integration** (if monetizing)
7. **Review legal requirements** (disclosures, privacy)

### Security
- Validate all URLs before opening
- Sanitize user input
- Rate limit ad submissions
- Implement content moderation
- Monitor for malicious links

## Troubleshooting

### Image Not Loading
- Check URL is accessible
- Verify image format (JPG/PNG)
- Check file size (< 500KB recommended)
- Test on different network conditions

### Click Not Working
- Verify `target_url` is properly formatted
- Check URL starts with http:// or https://
- Test with different URLs
- Check for JavaScript errors in console

### Layout Issues
- Verify `aspectRatio` prop
- Check `fitMode` setting
- Test with different image dimensions
- Check responsive behavior

## Related Documentation
- [Banner Ad README](../assets/ads/README.md)
- [BannerAd Component](../components/BannerAd.tsx)
- [Submit Ad Screen](../app/submit-ad.tsx)
- [API Documentation](../api/entities/Advertisement.ts)

## Need Help?
- Check console logs for errors
- Review component props in React DevTools
- Test with simplified example first
- Verify backend API is responding
