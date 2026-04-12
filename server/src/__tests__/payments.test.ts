import { describe, expect, it } from '@jest/globals';
import {
  getAdStatusAfterApproval,
  getAdStatusAfterSuccessfulPayment,
  getAdStatusForCheckoutSubmission,
} from '../lib/adLifecycle.js';

describe('Payment-driven ad lifecycle invariants', () => {
  it('checkout submission enters moderation before payment finalization', () => {
    const submittedStatus = getAdStatusForCheckoutSubmission('draft');
    expect(submittedStatus).toBe('pending');
  });

  it('payment does not auto-activate unapproved ads', () => {
    expect(getAdStatusAfterSuccessfulPayment('pending')).toBe('pending');
    expect(getAdStatusAfterSuccessfulPayment('draft')).toBe('pending');
  });

  it('approval plus payment leads to active ads', () => {
    const approvedStatus = getAdStatusAfterApproval('unpaid');
    expect(approvedStatus).toBe('approved');
    expect(getAdStatusAfterSuccessfulPayment(approvedStatus)).toBe('active');
  });

  it('already-paid approved ads go live immediately when reviewed', () => {
    expect(getAdStatusAfterApproval('paid')).toBe('active');
  });
});
