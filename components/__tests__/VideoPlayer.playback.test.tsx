/**
 * Playback-intent regression tests for components/VideoPlayer.tsx.
 *
 * Pins two defects found in the Fanatics Fest audit:
 *
 *  1. `autoPlay` defaulted to `true`, so composer/preview surfaces that never
 *     opted in (create-post preview, the story/video trimmers, team-contacts)
 *     autoplayed with FORCED SOUND — `ensurePlaybackAudioSession` sets
 *     `playsInSilentMode` + `duckOthers` process-wide and there is no mute
 *     toggle. Phone on silent + pick a clip to post = full volume through the
 *     hardware silent switch. `autoPlay` is now a required prop.
 *
 *  2. The blur handler paused but nothing ever resumed: the focus callback body
 *     was empty and the play effect's deps (`paused`/`player`/`autoPlay`) don't
 *     change on refocus. Watch a video → open a profile → go back = frozen clip.
 */
import { render } from '@testing-library/react-native';
import React from 'react';

// Controllable focus harness: `useFocusEffect` is really "run on focus, run the
// returned cleanup on blur". Capture the callback so the tests can drive
// focus/blur cycles deterministically.
let focusCallback: (() => void | (() => void)) | null = null;
let focusCleanup: (() => void) | void | null = null;
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    focusCallback = cb;
  },
}));

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockReplay = jest.fn();
const fakePlayer = { play: mockPlay, pause: mockPause, replay: mockReplay, volume: 0, muted: true };

jest.mock('expo-video', () => ({
  useVideoPlayer: (source: any, setup?: (p: any) => void) => {
    setup?.(fakePlayer);
    return fakePlayer;
  },
  VideoView: () => null,
}));
jest.mock('expo', () => ({ useEventListener: jest.fn() }));
jest.mock('@/utils/audioSession', () => ({ ensurePlaybackAudioSession: jest.fn() }));

import { VideoPlayer } from '../VideoPlayer';

/** Run the captured focus effect, as react-navigation does when a screen focuses. */
const focus = () => {
  focusCleanup = focusCallback?.();
};
/** Run its cleanup, as react-navigation does when the screen blurs. */
const blur = () => {
  if (typeof focusCleanup === 'function') focusCleanup();
};

beforeEach(() => {
  jest.clearAllMocks();
  focusCallback = null;
  focusCleanup = null;
});

describe('VideoPlayer autoplay opt-in (composer surfaces must stay silent)', () => {
  it('does NOT play when a composer/preview surface passes autoPlay={false}', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay={false} />);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('plays right away on a consumption surface that opts in', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay />);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('keeps sound on when it does play — the owner rejected a mute toggle', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay />);
    expect(fakePlayer.muted).toBe(false);
    expect(fakePlayer.volume).toBe(1.0);
  });

  it('does not play a composer surface even on focus', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay={false} />);
    focus();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});

describe('VideoPlayer blur/focus lifecycle', () => {
  it('pauses on blur so audio never follows the user to the next screen', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay />);
    focus();
    blur();
    expect(mockPause).toHaveBeenCalled();
  });

  it('resumes on refocus instead of leaving the clip frozen mid-play', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay />);
    focus();
    blur();
    mockPlay.mockClear();

    focus(); // navigate back
    expect(mockPlay).toHaveBeenCalled();
  });

  it('does NOT resume a player the caller has gated off with paused', () => {
    // This is the guard that stops two videos playing at once: the post-detail
    // hero sets `paused` unless it is the active pager page with the fullscreen
    // modal closed, and stories/GVFS set it for every non-active item. A blanket
    // resume-on-focus would make every mounted neighbour blare at once.
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay paused />);
    focus();
    blur();
    mockPlay.mockClear();

    focus();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('does not resume a composer surface on refocus', () => {
    render(<VideoPlayer uri="https://example.com/clip.mp4" autoPlay={false} />);
    focus();
    blur();
    mockPlay.mockClear();

    focus();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
