import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

describe('useReducedMotion', () => {
  let remove: jest.Mock;
  let listener: ((v: boolean) => void) | undefined;

  beforeEach(() => {
    remove = jest.fn();
    listener = undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event: any, cb: any) => {
      listener = cb;
      return { remove } as any;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reflects the OS reduce-motion setting on mount', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const { result } = renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('updates live when the setting changes', async () => {
    const { result } = renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
    act(() => listener?.(true));
    expect(result.current).toBe(true);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useReducedMotion());
    await act(async () => {});
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
