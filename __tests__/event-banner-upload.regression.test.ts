import { readFileSync } from 'fs';
import { join } from 'path';

const createFanEventSrc = readFileSync(
  join(process.cwd(), 'app', 'create-fan-event.tsx'),
  'utf8'
);

const quickAddGameModalSrc = readFileSync(
  join(process.cwd(), 'components', 'QuickAddGameModal.tsx'),
  'utf8'
);

describe('PDF regression — standalone event creator persists banner images', () => {
  it('uploads or generates a banner before submit and sends it in both event payload branches', () => {
    expect(createFanEventSrc).toMatch(/captureGeneratedBanner/);
    expect(createFanEventSrc).toMatch(/let finalBannerUrl = bannerUrl;/);
    expect(createFanEventSrc).toMatch(/banner_url:\s*finalBannerUrl/);
    expect(createFanEventSrc).toMatch(/cover_image_url:\s*finalBannerUrl/);
  });

  it('keeps the custom-photo affordance visible on create-fan-event', () => {
    expect(createFanEventSrc).toMatch(/Upload Custom Photo/);
    expect(createFanEventSrc).toMatch(/Generated fallback style/);
  });
});

describe('PDF regression — team trip creator still supports custom banners', () => {
  it('retains the shared quick-add custom banner flow used by team trips', () => {
    expect(quickAddGameModalSrc).toMatch(/eventType === 'team_trip'/);
    expect(quickAddGameModalSrc).toMatch(/Upload Custom/);
    expect(quickAddGameModalSrc).toMatch(/finalData\.banner_url = bannerUrl/);
  });
});
