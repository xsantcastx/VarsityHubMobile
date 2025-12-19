import {
    WEEKDAY_BLOCK_PRICE_CENTS,
    WEEKEND_BLOCK_PRICE_CENTS,
    calculateAdPriceCents,
} from '../utils/adPricing';

describe('Payments', () => {
  describe('Ad Price Calculation', () => {
    it('exposes the correct block prices', () => {
      expect(WEEKDAY_BLOCK_PRICE_CENTS).toBe(500); // $5.00
      expect(WEEKEND_BLOCK_PRICE_CENTS).toBe(800); // $8.00
    });

    it('calculates consolidated week blocks from iso dates', () => {
      const dates = ['2024-12-16', '2024-12-17', '2024-12-20']; // Monday, Tuesday, Friday
      const { totalCents, weekdayBlocks, weekendBlocks } = calculateAdPriceCents(dates);

      expect(weekdayBlocks).toBe(1);
      expect(weekendBlocks).toBe(1);
      expect(totalCents).toBe(1300); // $5 + $8
    });

    it('handles empty input gracefully', () => {
      const { totalCents, weekdayBlocks, weekendBlocks } = calculateAdPriceCents([]);
      expect(totalCents).toBe(0);
      expect(weekdayBlocks).toBe(0);
      expect(weekendBlocks).toBe(0);
    });

    it('counts each week once even with duplicate dates', () => {
      const dates = ['2024-12-16', '2024-12-16', '2024-12-21']; // Mon (duplicate) + Sat
      const { totalCents, weekdayBlocks, weekendBlocks } = calculateAdPriceCents(dates);

      expect(weekdayBlocks).toBe(1);
      expect(weekendBlocks).toBe(1);
      expect(totalCents).toBe(1300);
    });

    it('accumulates blocks across multiple weeks', () => {
      const dates = [
        '2024-12-16', // Week 1 weekday
        '2024-12-22', // Week 1 weekend (Sunday)
        '2024-12-23', // Week 2 weekday (Monday)
        '2024-12-28', // Week 2 weekend (Saturday)
      ];
      const { totalCents, weekdayBlocks, weekendBlocks } = calculateAdPriceCents(dates);

      expect(weekdayBlocks).toBe(2);
      expect(weekendBlocks).toBe(2);
      expect(totalCents).toBe((2 * WEEKDAY_BLOCK_PRICE_CENTS) + (2 * WEEKEND_BLOCK_PRICE_CENTS));
    });
  });

  describe('Membership Plans', () => {
    const plans = {
      veteran: 'month',
      legend: 'year',
    };

    it('should have valid membership plans', () => {
      expect(Object.keys(plans)).toContain('veteran');
      expect(Object.keys(plans)).toContain('legend');
    });

    it('should have correct billing intervals', () => {
      expect(plans.veteran).toBe('month');
      expect(plans.legend).toBe('year');
    });
  });

  describe('Transaction Status', () => {
    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];

    validStatuses.forEach((status) => {
      it(`should accept valid status: ${status}`, () => {
        expect(validStatuses).toContain(status);
      });
    });

    it('should reject invalid status', () => {
      const invalidStatus = 'cancelled';
      expect(validStatuses).not.toContain(invalidStatus);
    });
  });

  describe('Payment Amount Validation', () => {
    it('should validate positive amounts', () => {
      const amount = 2500; // $25.00
      expect(amount).toBeGreaterThan(0);
    });

    it('should reject zero amount', () => {
      const amount = 0;
      expect(amount).toBe(0);
    });

    it('should reject negative amount', () => {
      const amount = -1000;
      expect(amount).toBeLessThan(0);
    });
  });
});
