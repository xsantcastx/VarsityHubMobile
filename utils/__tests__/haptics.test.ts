import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';
import { haptics } from '@/utils/haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

describe('haptics wrappers (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOS('ios');
  });

  it('selection() fires a selection tick', () => {
    haptics.selection();
    expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('impact() defaults to Medium', () => {
    haptics.impact();
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('impact("heavy") maps to the Heavy style', () => {
    haptics.impact('heavy');
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith('heavy');
  });

  it('success() fires a Success notification', () => {
    haptics.success();
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('error() fires an Error notification', () => {
    haptics.error();
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith('error');
  });
});

describe('haptics wrappers (safety)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no-ops on web (no native haptics call)', () => {
    setOS('web');
    haptics.selection();
    haptics.impact('light');
    haptics.success();
    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    setOS('ios');
  });

  it('never throws when the native module fails', () => {
    setOS('ios');
    (ExpoHaptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native haptics unavailable');
    });
    expect(() => haptics.impact('medium')).not.toThrow();
  });
});
