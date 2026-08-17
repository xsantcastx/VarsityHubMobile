/**
 * Thin, safe wrappers around expo-haptics.
 *
 * Rules (apple-design §13 — multimodal feedback):
 * - Fire on the *causal* moment (a snap home, a commit, a success/error), never
 *   on every move — reserved so users don't tune it out.
 * - Fire-and-forget: never `await` on an animation/gesture path, and never throw.
 *   A failed haptic must never break the interaction.
 * - No-op on web (no native haptics engine).
 *
 * Fires on iOS *and* Android (expo-haptics supports both). This is broader than
 * the older HapticTab, which was iOS-only.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type ImpactStyle = 'light' | 'medium' | 'heavy';

const IMPACT_STYLE: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

// Swallow both synchronous throws and rejected promises — haptics are never critical.
function safe(run: () => Promise<unknown> | void): void {
  if (Platform.OS === 'web') return;
  try {
    const result = run();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // ignore — a missing/unavailable haptics engine must not break the flow
  }
}

export const haptics = {
  /** Light tick for discrete selection changes (segmented controls, pickers). */
  selection(): void {
    safe(() => Haptics.selectionAsync());
  },
  /** Physical bump on a commit/snap. Defaults to Medium. */
  impact(style: ImpactStyle = 'medium'): void {
    safe(() => Haptics.impactAsync(IMPACT_STYLE[style]));
  },
  /** Success notification (booking confirmed, post published). */
  success(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** Warning notification (recoverable problem). */
  warning(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  /** Error notification (action failed / rejected). */
  error(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
