import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const lastRedirectRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
    ]);
    if (Platform.OS === 'web') {
      LogBox.ignoreLogs([
        '"shadow*" style props are deprecated',
        'props.pointerEvents is deprecated. Use style.pointerEvents',
      ]);
    }
  }, []);

  React.useEffect(() => {
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
        if (isPublic && lastRedirectRef.current !== '/(tabs)/feed') {
          lastRedirectRef.current = '/(tabs)/feed';
          router.replace('/(tabs)/feed');
        }
      } catch (err: any) {
        const status = err?.status;
        if (!isPublic && (status === 401 || status === 403) && lastRedirectRef.current !== '/sign-in') {
          lastRedirectRef.current = '/sign-in';
          router.replace('/sign-in');
        }
      }
    })();
  }, [navState?.key, Array.isArray(segments) ? segments.join('/') : '']);

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
