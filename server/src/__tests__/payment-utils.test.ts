/**
 * Payment Utility Tests
 *
 * Covers pricing and tax calculations used in checkout flows.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateAdPriceCents } from '../utils/adPricing.js';
import { getDatesPastBookingHorizon, getMaxBookableDateIso } from '../utils/bookingHorizon.js';
import { calculateSalesTax, getStateFromZip } from '../lib/taxCalculator.js';

describe('Payment Utilities', () => {
  describe('Ad pricing', () => {
    it('returns zero for empty date list', () => {
      const result = calculateAdPriceCents([]);
      expect(result.totalCents).toBe(0);
      expect(result.weekdayBlocks).toBe(0);
      expect(result.weekendBlocks).toBe(0);
    });

    it('groups weekday and weekend dates within the same week', () => {
      const result = calculateAdPriceCents(['2025-01-06', '2025-01-11']); // Mon + Sat
      expect(result.weekdayBlocks).toBe(1);
      expect(result.weekendBlocks).toBe(1);
      expect(result.totalCents).toBe(499 + 799); // weekday $4.99 + weekend $7.99
    });

    it('counts weekday blocks across multiple weeks', () => {
      const result = calculateAdPriceCents(['2025-01-06', '2025-01-13']); // Two Mondays
      expect(result.weekdayBlocks).toBe(2);
      expect(result.weekendBlocks).toBe(0);
      expect(result.totalCents).toBe(499 * 2); // 2 × $4.99 weekday blocks
    });
  });

  describe('Tax calculations', () => {
    it('returns state from zip prefix', () => {
      expect(getStateFromZip('90210')).toBe('CA');
      expect(getStateFromZip('00000')).toBeNull();
    });

    it('calculates sales tax using state rate', () => {
      const tax = calculateSalesTax(10000, '90210'); // $100.00
      expect(tax).toBe(725);
    });
  });

  describe('Booking horizon', () => {
    it('treats the max bookable day as an inclusive UTC date boundary', () => {
      const now = new Date('2026-04-21T23:45:00.000-07:00');
      expect(getMaxBookableDateIso(now, 56)).toBe('2026-06-17');
      expect(getDatesPastBookingHorizon(['2026-06-17'], now, 56)).toEqual([]);
    });

    it('rejects dates beyond the inclusive max bookable UTC day', () => {
      const now = new Date('2026-04-21T23:45:00.000-07:00');
      expect(getDatesPastBookingHorizon(['2026-06-18'], now, 56)).toEqual(['2026-06-18']);
    });
  });
});
