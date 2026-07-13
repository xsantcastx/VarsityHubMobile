const TOKEN_INVALID_EXPO_ERRORS = new Set(['DeviceNotRegistered', 'MismatchSenderId']);

export function shouldClearPushTokenForExpoError(errorCode?: string | null): boolean {
  if (!errorCode) return false;
  return TOKEN_INVALID_EXPO_ERRORS.has(errorCode);
}
