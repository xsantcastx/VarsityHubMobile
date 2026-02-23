/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, getColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return getColors(theme)[colorName];
  }
}

const DEFAULT_ACCENT = '#3B82F6';

/**
 * Returns the user's preferred theme/accent color from preferences.
 * Use for profile accents, gradients, and brand theming.
 */
export function useUserThemeColor(): string {
  const { user } = useAuth();
  const color = (user as any)?.preferences?.theme_color;
  return typeof color === 'string' && color.trim() ? color.trim() : DEFAULT_ACCENT;
}
