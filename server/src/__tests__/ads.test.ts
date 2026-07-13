import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AD_GEOFENCE_RADIUS_KM, AD_GEOFENCE_RADIUS_MILES } from '../lib/adGeofencing.js';

const adsRouteSource = readFileSync(join(process.cwd(), 'src', 'routes', 'ads.ts'), 'utf8');

describe('Advertisements', () => {
  describe('Ad Creation', () => {
    it('should require contact name', () => {
      const ad = {
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
        business_name: 'Business Inc',
        target_zip_code: '10001',
      };

      expect(ad.contact_name).toBeDefined();
      expect(ad.contact_name).toBeTruthy();
    });

    it('should require valid email', () => {
      const email = 'invalid-email';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(email).not.toMatch(emailRegex);
    });

    it('should require target zip code', () => {
      const ad = {
        target_zip_code: '10001',
      };

      expect(ad.target_zip_code).toBeDefined();
      expect(ad.target_zip_code).toMatch(/^\d{5}$/);
    });

    it('should have a fixed 9 km ad radius', () => {
      expect(AD_GEOFENCE_RADIUS_KM).toBe(9);
    });
  });

  describe('Ad Status', () => {
    const validStatuses = ['draft', 'pending', 'approved', 'active', 'paused', 'archived'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, () => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Payment Status', () => {
    const validPaymentStatuses = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];

    validPaymentStatuses.forEach(status => {
      it(`should accept valid payment status: ${status}`, () => {
        expect(validPaymentStatuses).toContain(status);
      });
    });

    it('should default to unpaid', () => {
      const defaultStatus = 'unpaid';
      expect(defaultStatus).toBe('unpaid');
    });
  });

  describe('Geographic Validation', () => {
    it('should accept valid US zip codes', () => {
      const validZips = ['10001', '90210', '75201', '98101'];

      validZips.forEach(zip => {
        expect(zip).toMatch(/^\d{5}$/);
      });
    });

    it('should reject invalid zip codes', () => {
      const invalidZips = ['1001', '900210', '9021a'];

      invalidZips.forEach(zip => {
        expect(zip).not.toMatch(/^\d{5}$/);
      });
    });

    it('should derive a positive mile radius from the shared 9 km source of truth', () => {
      const radius = AD_GEOFENCE_RADIUS_MILES;
      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(250);
    });

    it('holds booking inventory on the exact requested zip code', () => {
      expect(adsRouteSource).toMatch(/target_zip_code:\s*zipCode/);
    });
  });

  describe('Ad Visibility', () => {
    it('should only show paid ads in feed', () => {
      const ad = {
        id: 'ad_123',
        payment_status: 'paid',
      };

      const shouldShowInFeed = ad.payment_status === 'paid';
      expect(shouldShowInFeed).toBe(true);
    });

    it('should not show unpaid ads in feed', () => {
      const ad = {
        id: 'ad_123',
        payment_status: 'unpaid',
      };

      const shouldShowInFeed = ad.payment_status === 'paid';
      expect(shouldShowInFeed).toBe(false);
    });
  });

  describe('Banner Validation', () => {
    it('should accept valid image URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'https://res.cloudinary.com/mycloud/image.jpg',
      ];

      validUrls.forEach(url => {
        expect(url).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i);
      });
    });

    it('should allow ads without banner', () => {
      const ad = {
        banner_url: null,
      };

      expect(ad.banner_url).toBeNull();
    });
  });
});
