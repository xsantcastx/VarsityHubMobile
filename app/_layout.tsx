import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import React from 'react';

export default function RootLayout() {
  // Dev-only filters for noisy warnings
  if (process.env.NODE_ENV !== 'production') {
    // Suppress specific RN Web deprecations on web
    if (Platform.OS === 'web') {
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const msg = String(args?.[0] ?? '');
        if (
          msg.includes('"shadow*" style props are deprecated') ||
          msg.includes('props.pointerEvents is deprecated. Use style.pointerEvents')
        ) {
          return;
        }
        originalWarn(...args);
      };
    }
    // Suppress dev overlay's raw-text warning which can originate from tooling
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const msg = String(args?.[0] ?? '');
      if (msg.includes('Text strings must be rendered within a <Text>')) {
        return;
      }
      originalError(...args);
    };
  }
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const lastRedirectRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Wait until navigation is mounted
    if (!navState?.key) return;
    const first = Array.isArray(segments) && segments.length ? String(segments[0]) : '';
    const publicRoutes = new Set(['sign-in', 'sign-up', 'verify-email']);
    const isPublic = publicRoutes.has(first);
    (async () => {
      try {
        const me: any = await User.me();
        const needsOnboarding = me?.preferences && (me.preferences.onboarding_completed === false);
        if (!isPublic && needsOnboarding && first !== 'onboarding' && lastRedirectRef.current !== '/onboarding/step-2-basic') {
          lastRedirectRef.current = '/onboarding/step-2-basic';
          router.replace('/onboarding/step-2-basic');
          return;
        }
        if (isPublic && lastRedirectRef.current !== '/(tabs)') {
          lastRedirectRef.current = '/(tabs)';
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        const status = err?.status;
        // Only redirect to sign-in for auth errors
        if (!isPublic && (status === 401 || status === 403) && lastRedirectRef.current !== '/sign-in') {
          lastRedirectRef.current = '/sign-in';
          router.replace('/sign-in');
        }
      }
    })();
  }, [navState?.key, Array.isArray(segments) ? segments.join('/') : '']);

  // Simple inline loader to avoid flicker while checking auth/fonts
  if (!loaded || !navState?.key) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator />
      </View>
    );
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
