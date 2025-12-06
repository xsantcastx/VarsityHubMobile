/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#60a5fa';

export const Colors = {
  light: {
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
  },
  dark: {
    text: '#F5F5F5',
    background: '#0f172a',  // Dark navy blue (slate-900)
    card: '#1e293b',        // Slightly lighter navy (slate-800)
    surface: '#1e293b',
    border: '#334155',      // Slate-700 for better contrast
    mutedText: '#94a3b8',   // Slate-400
    elevated: '#1e293b',
    tint: tintColorDark,
    icon: '#cbd5e1',        // Slate-300
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
  },
};
