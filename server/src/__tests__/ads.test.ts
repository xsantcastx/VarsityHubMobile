import { describe, expect, it } from '@jest/globals';
import {
  canReviewAd,
  getAdStatusAfterApproval,
  getAdStatusAfterSuccessfulPayment,
  getAdStatusForCheckoutSubmission,
  normalizeAdStatus,
} from '../lib/adLifecycle.js';

describe('Ad lifecycle', () => {
  it('submitting checkout moves drafts into pending review', () => {
    expect(getAdStatusForCheckoutSubmission('draft')).toBe('pending');
    expect(getAdStatusForCheckoutSubmission('pending')).toBe('pending');
    expect(getAdStatusForCheckoutSubmission('approved')).toBe('approved');
  });

  it('admin approval keeps unpaid ads approved and activates paid ads', () => {
    expect(getAdStatusAfterApproval('unpaid')).toBe('approved');
    expect(getAdStatusAfterApproval('paid')).toBe('active');
  });

  it('successful payment only activates already-approved ads', () => {
    expect(getAdStatusAfterSuccessfulPayment('approved')).toBe('active');
    expect(getAdStatusAfterSuccessfulPayment('pending')).toBe('pending');
    expect(getAdStatusAfterSuccessfulPayment('draft')).toBe('pending');
  });

  it('only pending or approved ads are reviewable', () => {
    expect(canReviewAd('pending')).toBe(true);
    expect(canReviewAd('approved')).toBe(true);
    expect(canReviewAd('draft')).toBe(false);
    expect(canReviewAd('active')).toBe(false);
    expect(canReviewAd('rejected')).toBe(false);
  });

  it('normalizes unknown statuses back to draft', () => {
    expect(normalizeAdStatus(undefined)).toBe('draft');
    expect(normalizeAdStatus('something-else')).toBe('draft');
  });
});
