import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/useCustomColorScheme';
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
    const publicRoutes = new Set(['sign-in', 'sign-up', 'verify-email', 'forgot-password', 'reset-password']);
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
        
        // Role-aware login landing - only redirect if on public routes
        if (isPublic && me) {
          // Everyone lands on feed
          const landingRoute = '/(tabs)/feed';
          
          if (lastRedirectRef.current !== landingRoute) {
            lastRedirectRef.current = landingRoute;
            router.replace(landingRoute as any);
          }
        }
      } catch (err: any) {
        const status = err?.status;
        if (!isPublic && (status === 401 || status === 403) && lastRedirectRef.current !== '/sign-in') {
          lastRedirectRef.current = '/sign-in';
          router.replace('/sign-in');
        }
        // Don't redirect on other errors - let user stay where they are
      }
    })();
  }, [navState?.key, Array.isArray(segments) ? segments.join('/') : '']);

  if (!loaded || !navState?.key) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#0B1120' : 'white' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="create-post" options={{ headerShown: false }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
            <Stack.Screen name="post-detail" options={{ headerShown: false }} />
            <Stack.Screen name="user-profile" options={{ headerShown: false }} />
            <Stack.Screen name="team-profile" options={{ headerShown: false }} />
            <Stack.Screen name="team-hub" options={{ headerShown: false }} />
            <Stack.Screen name="team-contacts" options={{ headerShown: false }} />
            <Stack.Screen name="game-detail" options={{ headerShown: false }} />
            <Stack.Screen name="highlights" options={{ headerShown: false }} />
            <Stack.Screen name="messages" options={{ headerShown: false }} />
            <Stack.Screen name="message-thread" options={{ headerShown: false }} />
            <Stack.Screen name="followers" options={{ headerShown: false }} />
            <Stack.Screen name="following" options={{ headerShown: false }} />
            <Stack.Screen name="create-team" options={{ headerShown: false }} />
            <Stack.Screen name="edit-team" options={{ headerShown: false }} />
            <Stack.Screen name="manage-teams" options={{ headerShown: false }} />
            <Stack.Screen name="my-team" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ headerShown: false }} />
            <Stack.Screen name="verify-email" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="payment-success" options={{ headerShown: false }} />
            <Stack.Screen name="payment-cancel" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </NavigationThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
