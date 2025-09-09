import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  // Dev-only warning filter for RN Web deprecations
  if (process.env.NODE_ENV !== 'production' && Platform.OS === 'web') {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = String(args?.[0] ?? '');
      if (
        msg.includes('"shadow*" style props are deprecated') ||
        msg.includes('props.pointerEvents is deprecated. Use style.pointerEvents')
      ) {
        return; // suppress noisy RN Web deprecation warnings in dev
      }
      originalWarn(...args);
    };
  }
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
