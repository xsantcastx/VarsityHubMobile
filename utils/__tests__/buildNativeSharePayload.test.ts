import { describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { buildNativeSharePayload } from '@/utils/links';

/**
 * Regression: sharing an event/post used to pass BOTH a message containing the
 * URL and a separate `url` field. iMessage splits that into a text bubble plus
 * one link chip per URL occurrence — the recipient got three bubbles. iOS must
 * share the bare URL (single rich preview); Android's Share.share() ignores
 * `url`, so the URL must stay inside the message text.
 */
describe('buildNativeSharePayload', () => {
  const message =
    'Check out "Saudi Arabia vs Uruguay" on VarsityHub!\nhttps://varsityhub.app/events/e1';
  const webUrl = 'https://varsityhub.app/events/e1';
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('iOS shares the URL only — no message text that duplicates the link', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(buildNativeSharePayload(message, webUrl)).toEqual({ url: webUrl });
  });

  it('iOS falls back to the message when no URL is available', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(buildNativeSharePayload(message, null)).toEqual({ message });
  });

  it('Android keeps the URL inside the message text', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    expect(buildNativeSharePayload(message, webUrl)).toEqual({ message });
  });
});
