/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

export type ColorSchemeKey = 'light' | 'dark';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#60a5fa';

const lightPalette = {
  text: '#11181C',
  background: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F3F4F6',
  border: '#E5E7EB',
  mutedText: '#6B7280',
  elevated: '#FFFFFF',
  tint: tintColorLight,
  icon: '#687076',
  tabIconDefault: '#687076',
  tabIconSelected: tintColorLight,
  destructive: '#DC2626',
};

const darkPalette = {
  text: '#F5F5F5',
  background: '#0f172a',
  card: '#1e293b',
  surface: '#1e293b',
  border: '#334155',
  mutedText: '#94a3b8',
  elevated: '#1e293b',
  tint: tintColorDark,
  icon: '#cbd5e1',
  tabIconDefault: '#94a3b8',
  tabIconSelected: tintColorDark,
  destructive: '#EF4444',
};

export type ColorPalette = typeof lightPalette;

/** Color palettes by scheme. Index with 'light' | 'dark' (or use getColors for null-safe access). */
export const Colors: Record<ColorSchemeKey, ColorPalette> & { [k: string]: ColorPalette } = {
  light: lightPalette,
  dark: darkPalette,
};

/** Safely get color palette for a scheme (handles null/undefined). */
export function getColors(scheme: ColorSchemeKey | null | undefined): ColorPalette {
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
