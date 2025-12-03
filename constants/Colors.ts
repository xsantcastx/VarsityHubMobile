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
    text: '#FFFFFF',
    background: '#000000',
    card: '#0B0B0B',
    surface: '#1A1A1A',
    border: '#333333',
    mutedText: '#A3A3A3',
    elevated: '#0B0B0B',
    tint: tintColorDark,
    icon: '#D1D5DB',
    tabIconDefault: '#D1D5DB',
    tabIconSelected: tintColorDark,
  },
};
