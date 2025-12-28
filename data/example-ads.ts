/**
 * Example Advertisement Data
 * 
 * Use these for testing banner ad display in the app.
 * Replace with real ads from your backend in production.
 */

export type ExampleAd = {
  id: string;
  business_name: string;
  description: string;
  banner_url: string;
  banner_fit_mode: 'letterbox' | 'fill' | 'stretch';
  target_url: string;
  contact_name: string;
  contact_email: string;
  zip_code: string;
  radius: number;
  status: 'active' | 'pending' | 'rejected';
  created_at: string;
};

/**
 * Skateboard Shop - High-energy sports retail ad
 * Features bold graphics, product showcase, and clear CTA
 */
export const skateboardShopAd: ExampleAd = {
  id: 'example-skateboard-1',
  business_name: 'Stamford Skate Shop',
  description: 'Gear up & ride! Skateboards, shoes, apparel, accessories. Shop now for the latest boards and gear!',
  banner_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1766906762/Screenshot_2025-12-28_at_2.25.32_AM_ahensv.png',
  banner_fit_mode: 'fill',
  target_url: 'https://www.instagram.com/stamford_skate_shop/?hl=en',
  contact_name: 'Shop Owner',
  contact_email: 'info@stamfordskate.com',
  zip_code: '06901',
  radius: 45,
  status: 'active',
  created_at: new Date().toISOString(),
};

/**
 * All example ads for easy iteration
 */
export const exampleAds: ExampleAd[] = [
  skateboardShopAd,
  // Add more example ads here as needed
];

/**
 * Get a random example ad
 */
export function getRandomExampleAd(): ExampleAd {
  return exampleAds[Math.floor(Math.random() * exampleAds.length)];
}

/**
 * Instructions for using example ads:
 * 
 * 1. In FeedScreen or other components:
 *    import { skateboardShopAd } from '@/data/example-ads';
 * 
 * 2. Add to your feed data:
 *    const feedWithAds = [...posts, skateboardShopAd, ...morePost];
 * 
 * 3. Render with BannerAd component:
 *    <BannerAd
 *      bannerUrl={ad.banner_url}
 *      targetUrl={ad.target_url}
 *      businessName={ad.business_name}
 *      description={ad.description}
 *      fitMode={ad.banner_fit_mode}
 *    />
 */
