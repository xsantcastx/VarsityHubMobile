import { describe, expect, it } from '@jest/globals';
import { getAdPaymentStatusLabel } from '@/utils/adPaymentStatusLabel';

describe('getAdPaymentStatusLabel', () => {
  it('distinguishes approval review from approved-but-unpaid ads', () => {
    expect(getAdPaymentStatusLabel('pending', 'pending_approval')).toBe('Pending Approval');
    expect(getAdPaymentStatusLabel('approved', 'pending_approval')).toBe('Awaiting Payment');
    expect(getAdPaymentStatusLabel('active', 'pending_approval')).toBe('Awaiting Payment');
  });

  it('covers the remaining ad payment states with user-facing copy', () => {
    expect(getAdPaymentStatusLabel('draft', 'unpaid')).toBe('Unpaid');
    expect(getAdPaymentStatusLabel('approved', 'hold')).toBe('Checkout In Progress');
    expect(getAdPaymentStatusLabel('active', 'paid')).toBe('Paid');
    expect(getAdPaymentStatusLabel('draft', 'refund_pending')).toBe('Refund Pending');
    expect(getAdPaymentStatusLabel('draft', 'refunded')).toBe('Refunded');
  });
});
