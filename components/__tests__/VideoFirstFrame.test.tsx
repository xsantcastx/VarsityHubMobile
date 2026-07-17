import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

// expo-video-thumbnails + expo-video are native modules with no jest-expo mock
// in this repo. Mock both so the poster fallback can be unit-tested.
const thumb = { shouldFail: false };
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(async () => {
    if (thumb.shouldFail) throw new Error('cannot generate');
    return { uri: 'file:///generated-thumb.jpg', width: 120, height: 160 };
  }),
}));

const playerSetup = { muted: false as boolean, paused: false as boolean };
jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: (_source: any, configure?: (p: any) => void) => {
    const player = {
      _muted: false,
      set muted(v: boolean) {
        this._muted = v;
        playerSetup.muted = v;
      },
      get muted() {
        return this._muted;
      },
      pause: () => {
        playerSetup.paused = true;
      },
      play: () => {},
    };
    if (configure) configure(player);
    return player;
  },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('Image', props) };
});

import VideoFirstFrame from '../VideoFirstFrame';

describe('VideoFirstFrame', () => {
  beforeEach(() => {
    thumb.shouldFail = false;
    playerSetup.muted = false;
    playerSetup.paused = false;
  });

  it('generates and shows a still thumbnail image (primary path)', async () => {
    const { UNSAFE_queryByType } = render(
      <VideoFirstFrame uri="https://media.example/a.mp4" style={{ width: 120, height: 160 }} />
    );
    await waitFor(() => {
      expect(UNSAFE_queryByType('Image' as any)).toBeTruthy();
    });
  });

  it('falls back to a paused (muted) video frame when generation fails', async () => {
    thumb.shouldFail = true;
    render(
      <VideoFirstFrame uri="https://media.example/b.mp4" style={{ width: 120, height: 160 }} />
    );
    await waitFor(() => {
      expect(playerSetup.paused).toBe(true);
    });
    expect(playerSetup.muted).toBe(true);
  });

  it('renders nothing (no crash) with a null uri', () => {
    expect(() => render(<VideoFirstFrame uri={null} />)).not.toThrow();
  });
});
