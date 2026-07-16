import { render } from '@testing-library/react-native';
import React from 'react';

// expo-video is a native module (no jest-expo mock in this repo). Mock the two
// APIs the component uses so the poster fallback can be unit-tested; capture the
// player so we can assert it's configured muted + paused (a still first frame).
const setup = { muted: false as boolean, paused: false as boolean };
jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: (_source: any, configure?: (p: any) => void) => {
    const player = {
      _muted: false,
      set muted(v: boolean) {
        this._muted = v;
        setup.muted = v;
      },
      get muted() {
        return this._muted;
      },
      pause: () => {
        setup.paused = true;
      },
      play: () => {},
    };
    if (configure) configure(player);
    return player;
  },
}));

import VideoFirstFrame from '../VideoFirstFrame';

describe('VideoFirstFrame', () => {
  beforeEach(() => {
    setup.muted = false;
    setup.paused = false;
  });

  it('mounts a video uri and configures the player muted + paused (still frame)', () => {
    expect(() =>
      render(
        <VideoFirstFrame uri="https://media.example/clip.mp4" style={{ width: 120, height: 160 }} />
      )
    ).not.toThrow();
    expect(setup.muted).toBe(true);
    expect(setup.paused).toBe(true);
  });

  it('mounts with a null uri without crashing (missing media)', () => {
    expect(() => render(<VideoFirstFrame uri={null} />)).not.toThrow();
  });
});
