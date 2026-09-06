import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import VideoTrimmer from '../VideoTrimmer';
import { captureException } from '@/utils/sentry';
const mockTrim = jest.fn();
jest.mock('react-native-video-trim', () => ({ trim: (...args: unknown[]) => mockTrim(...args) }));
let mockListener: (event: { status: string }) => void;
const mockPlayer = { duration: 3, generateThumbnailsAsync: jest.fn() };
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: any) => children,
  Gesture: {
    Pan: () => {
      const chain: any = {};
      for (const method of ['activeOffsetX', 'onStart', 'onUpdate', 'onEnd', 'onFinalize'])
        chain[method] = () => chain;
      return chain;
    },
  },
}));
jest.mock('expo-video', () => ({ useVideoPlayer: () => mockPlayer }));
jest.mock('expo', () => ({
  useEventListener: (_: unknown, __: unknown, listener: typeof mockListener) => {
    mockListener = listener;
  },
}));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  copyAsync: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('video preview lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPlayer.generateThumbnailsAsync.mockReset();
    jest.mocked(captureException).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('surfaces a player error instead of leaving a spinner', () => {
    const screen = render(
      <VideoTrimmer uri="file:///a.mp4" onTrimComplete={jest.fn()} onTrimReset={jest.fn()} />
    );
    act(() => mockListener({ status: 'error' }));
    expect(screen.getByText('Video preview could not load. Choose the video again.')).toBeTruthy();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
  it('bounds a never-ready player and reports once', () => {
    const screen = render(
      <VideoTrimmer uri="file:///a.mp4" onTrimComplete={jest.fn()} onTrimReset={jest.fn()} />
    );
    act(() => jest.advanceTimersByTime(30000));
    expect(screen.getByText('Video preview could not load. Choose the video again.')).toBeTruthy();
    act(() => mockListener({ status: 'error' }));
    expect(captureException).toHaveBeenCalledTimes(1);
  });
  it('starts thumbnails once and ignores completion after unmount', async () => {
    let complete!: (value: any[]) => void;
    mockPlayer.generateThumbnailsAsync.mockReturnValue(
      new Promise(resolve => {
        complete = resolve;
      })
    );
    const screen = render(
      <VideoTrimmer uri="file:///a.mp4" onTrimComplete={jest.fn()} onTrimReset={jest.fn()} />
    );
    act(() => {
      mockListener({ status: 'readyToPlay' });
      mockListener({ status: 'readyToPlay' });
    });
    expect(mockPlayer.generateThumbnailsAsync).toHaveBeenCalledTimes(1);
    screen.unmount();
    await act(async () => complete([]));
    act(() => jest.advanceTimersByTime(30000));
    expect(captureException).not.toHaveBeenCalled();
  });
  it('reports a hung trim, prevents overlapping work, and ignores its late result', async () => {
    let finish!: (value: unknown) => void;
    mockTrim.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    mockPlayer.generateThumbnailsAsync.mockResolvedValue([]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const complete = jest.fn();
    const screen = render(
      <VideoTrimmer
        uri="file:///trim.mp4"
        maxDurationS={1}
        onTrimComplete={complete}
        onTrimReset={jest.fn()}
      />
    );
    await act(async () => mockListener({ status: 'readyToPlay' }));
    await act(async () => {
      fireEvent.press(screen.getByText('✂ Apply Trim'));
    });
    await act(async () => jest.advanceTimersByTime(120000));
    expect(alert).toHaveBeenCalledWith('Trim Failed', expect.stringContaining('timed out'));
    fireEvent.press(screen.getByText('✂ Apply Trim'));
    expect(mockTrim).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Video Still Processing', expect.any(String));
    await act(async () => finish({ success: true, outputPath: 'file:///late.mp4' }));
    expect(complete).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
