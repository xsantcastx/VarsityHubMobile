import { describe, expect, it } from '@jest/globals';
import { shouldClearPushTokenForExpoError } from '../lib/pushReceiptPolicy.js';

describe('shouldClearPushTokenForExpoError', () => {
  it('clears tokens for permanent token-invalid Expo errors', () => {
    expect(shouldClearPushTokenForExpoError('DeviceNotRegistered')).toBe(true);
    expect(shouldClearPushTokenForExpoError('MismatchSenderId')).toBe(true);
  });

  it('keeps tokens for payload, rate-limit, and unknown Expo errors', () => {
    expect(shouldClearPushTokenForExpoError('MessageTooBig')).toBe(false);
    expect(shouldClearPushTokenForExpoError('MessageRateExceeded')).toBe(false);
    expect(shouldClearPushTokenForExpoError('InvalidCredentials')).toBe(false);
    expect(shouldClearPushTokenForExpoError('SomeNewExpoError')).toBe(false);
    expect(shouldClearPushTokenForExpoError(undefined)).toBe(false);
  });
});
