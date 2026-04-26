import { describe, expect, it } from '@jest/globals';
import { getCompositeAdBadge } from '@/utils/adStatusBadge';

describe('getCompositeAdBadge', () => {
  it('maps the primary user-facing tuples to one badge', () => {
    expect(getCompositeAdBadge('draft', 'unpaid')).toEqual({ label: 'Draft', tone: 'draft' });
    expect(getCompositeAdBadge('pending', 'unpaid')).toEqual({
      label: 'Pending Approval',
      tone: 'pending',
    });
    expect(getCompositeAdBadge('pending', 'paid')).toEqual({
      label: 'Pending Approval',
      tone: 'pending',
    });
    expect(getCompositeAdBadge('approved', 'unpaid')).toEqual({
      label: 'Approved - Awaiting Payment',
      tone: 'approved',
    });
    expect(getCompositeAdBadge('approved', 'paid')).toEqual({ label: 'Live', tone: 'live' });
    expect(getCompositeAdBadge('rejected', 'paid')).toEqual({
      label: 'Rejected',
      tone: 'rejected',
    });
    expect(getCompositeAdBadge('archived', 'paid')).toEqual({
      label: 'Archived',
      tone: 'archived',
    });
  });

  it('covers the backend tuples that do not appear in the PDF shorthand', () => {
    expect(getCompositeAdBadge('approved', 'pending_approval')).toEqual({
      label: 'Approved - Awaiting Payment',
      tone: 'approved',
    });
    expect(getCompositeAdBadge('approved', 'hold')).toEqual({
      label: 'Approved - Awaiting Payment',
      tone: 'approved',
    });
    expect(getCompositeAdBadge('active', 'paid')).toEqual({ label: 'Live', tone: 'live' });
    expect(getCompositeAdBadge('active', 'hold')).toEqual({
      label: 'Approved - Awaiting Payment',
      tone: 'approved',
    });
    expect(getCompositeAdBadge('draft', 'refund_pending')).toEqual({
      label: 'Draft',
      tone: 'draft',
    });
    expect(getCompositeAdBadge('draft', 'refunded')).toEqual({
      label: 'Draft',
      tone: 'draft',
    });
  });
});
