import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Motion" accessibility setting, live.
 *
 * Gate animation configs on this (apple-design §14): when it returns true,
 * replace springs/slides/parallax with a short opacity cross-fade and drop
 * overshoot — keep instant, non-vestibular feedback (press states, color).
 *
 * Extracted from the one-off implementation in GameDetailsScreen so every
 * screen can share it.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
