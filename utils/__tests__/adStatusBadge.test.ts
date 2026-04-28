import { describe, expect, it } from '@jest/globals';

import { getAdScheduleBucket, getCompositeAdBadge } from '../adStatusBadge';

const NOW = new Date('2026-04-27T12:00:00');

describe('getAdScheduleBucket', () => {
  it('returns live when one of the reserved dates is today', () => {
    expect(getAdScheduleBucket(['2026-04-27'], NOW)).toBe('live');
  });

  it('returns scheduled when all reserved dates are in the future', () => {
    expect(getAdScheduleBucket(['2026-04-28', '2026-05-01'], NOW)).toBe('scheduled');
  });

  it('returns completed when all reserved dates are in the past', () => {
    expect(getAdScheduleBucket(['2026-04-20', '2026-04-21'], NOW)).toBe('completed');
  });

  it('treats mixed past and future dates as scheduled when nothing is live today', () => {
    expect(getAdScheduleBucket(['2026-04-20', '2026-05-01'], NOW)).toBe('scheduled');
  });
});

describe('getCompositeAdBadge', () => {
  it('keeps pending ads in pending approval state', () => {
    expect(getCompositeAdBadge('pending', 'unpaid', ['2026-04-28'], NOW)).toEqual({
      label: 'Pending Approval',
      tone: 'pending',
    });
  });

  it('keeps approved unpaid ads in awaiting payment state', () => {
    expect(getCompositeAdBadge('approved', 'unpaid', ['2026-04-28'], NOW)).toEqual({
      label: 'Approved - Awaiting Payment',
      tone: 'approved',
    });
  });

  it('marks paid active ads with a live date as live', () => {
    expect(getCompositeAdBadge('active', 'paid', ['2026-04-27'], NOW)).toEqual({
      label: 'Live',
      tone: 'live',
    });
  });

  it('marks paid active ads with only future dates as scheduled', () => {
    expect(getCompositeAdBadge('active', 'paid', ['2026-04-29'], NOW)).toEqual({
      label: 'Scheduled',
      tone: 'scheduled',
    });
  });

  it('marks paid active ads with only past dates as completed', () => {
    expect(getCompositeAdBadge('active', 'paid', ['2026-04-20'], NOW)).toEqual({
      label: 'Completed',
      tone: 'completed',
    });
  });

  it('tells paid approved ads with no dates to schedule dates instead of calling them live', () => {
    expect(getCompositeAdBadge('approved', 'paid', [], NOW)).toEqual({
      label: 'Paid - Schedule Dates',
      tone: 'approved',
    });
  });
});
