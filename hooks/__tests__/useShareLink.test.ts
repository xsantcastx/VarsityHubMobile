import { act, renderHook } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useShareLink } from '../useShareLink';
import { captureException } from '@/utils/sentry';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));

describe('share failure recovery', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('reports a rejected share and offers a truthful clipboard fallback', async () => {
    const error = new Error('Share unavailable');
    jest.spyOn(Share, 'share').mockRejectedValue(error);
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert');
    const { result } = renderHook(() => useShareLink({ kind: 'game', id: 'game-1' }));
    await act(() => result.current.share());
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { context: 'share_sheet', kind: 'game' },
    });
    expect(alert).toHaveBeenCalledWith('Share unavailable', expect.stringContaining('Link copied'));
  });

  it('never announces a copied link when both native operations fail', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share unavailable'));
    jest.mocked(Clipboard.setStringAsync).mockRejectedValue(new Error('Clipboard unavailable'));
    const alert = jest.spyOn(Alert, 'alert');
    const { result } = renderHook(() => useShareLink({ kind: 'post', id: 'post-1' }));
    await act(() => result.current.share());
    expect(alert).toHaveBeenCalledWith(
      'Share unavailable',
      'Unable to share or copy the link. Please try again.'
    );
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('does not report user dismissal as an error or copy without request', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    const { result } = renderHook(() => useShareLink({ kind: 'post', id: 'post-1' }));
    await act(() => result.current.share());
    expect(captureException).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it.each(['synchronous', 'asynchronous'])(
    'reports %s tracking failures without undoing a successful share',
    async failureMode => {
      const error = new Error('Share tracking unavailable');
      jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
      const alert = jest.spyOn(Alert, 'alert');
      const onShareSuccess = jest.fn(() => {
        if (failureMode === 'asynchronous') return Promise.reject(error);
        throw error;
      });
      const { result } = renderHook(() =>
        useShareLink({ kind: 'post', id: 'post-1', onShareSuccess })
      );
      await act(() => result.current.share());
      expect(onShareSuccess).toHaveBeenCalledWith('post-1');
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(error, {
        tags: { context: 'share_tracking', kind: 'post' },
      });
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
      expect(alert).not.toHaveBeenCalled();
    }
  );

  it('treats a resolved false clipboard result as failure on web', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert');
    const { result } = renderHook(() => useShareLink({ kind: 'post', id: 'post-1' }));
    await act(async () => {
      expect(await result.current.copyLink()).toBe(false);
    });
    expect(alert).toHaveBeenCalledWith('Copy failed', 'Unable to copy the link right now.');
  });
});
