/**
 * Payment Utility Tests
 *
 * Covers pricing and tax calculations used in checkout flows.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateAdPriceCents } from '../utils/adPricing.js';
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
      expect(result.totalCents).toBe(1300);
    });

    it('counts weekday blocks across multiple weeks', () => {
      const result = calculateAdPriceCents(['2025-01-06', '2025-01-13']); // Two Mondays
      expect(result.weekdayBlocks).toBe(2);
      expect(result.weekendBlocks).toBe(0);
      expect(result.totalCents).toBe(1000);
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
});
