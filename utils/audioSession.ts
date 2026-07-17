import { Platform } from 'react-native';

/**
 * Videos must ALWAYS play with sound (owner decision 2026-07-16).
 *
 * Setting `player.muted = false` is NOT sufficient on iOS: when the hardware
 * ring/silent switch is flipped to silent, AVPlayer stays silent unless the
 * audio session category is `playback`. expo-video does not configure the
 * session itself — nothing in this app called `setAudioModeAsync`, so every
 * video was silent on a silenced phone regardless of the mute flag.
 *
 * `playsInSilentMode: true` maps to the `playback` category and is the actual
 * fix. Call this before any video starts.
 *
 * expo-audio is a native module; it is present in the current Podfile.lock but
 * the dynamic import + try/catch keeps this OTA-safe for any binary built
 * before it was linked (see CLAUDE.md "OTA Updates" / OfflineBanner pattern).
 */
let audioSessionPromise: Promise<void> | null = null;

async function configure(): Promise<void> {
  try {
    const { setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({
      // iOS: play through the ring/silent switch.
      playsInSilentMode: true,
      // Take audio focus so our sound is actually audible over other apps,
      // and so the OS pauses whatever else was playing rather than mixing.
      interruptionMode: 'duckOthers',
      // We only ever play back post media here — never record.
      allowsRecording: false,
      shouldPlayInBackground: false,
    });
  } catch (error) {
    // Non-fatal: on a binary without expo-audio linked, playback still works —
    // it just obeys the silent switch as before.
    if (__DEV__) console.warn('[audioSession] Failed to set playback audio mode:', error);
  }
}

export function ensurePlaybackAudioSession(): void {
  if (Platform.OS === 'web') return;
  if (!audioSessionPromise) {
    audioSessionPromise = configure();
  }
}
