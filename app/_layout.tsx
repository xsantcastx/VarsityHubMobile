import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorToastContainer } from '@/components/ErrorToast';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Colors } from '@/constants/Colors';
import { AuthProvider } from '@/context/AuthProvider';
import { NavigationHistoryProvider } from '@/context/NavigationHistoryContext';
import { PostCacheProvider } from '@/context/PostCacheContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/useCustomColorScheme';
import { NotificationTapHandler } from '@/components/NotificationTapHandler';
import { handleDeepLinkAuthAware, handleInitialDeepLink, setupDeepLinkListener } from '@/utils/deepLinks';
import { initSentry } from '@/utils/sentry';
import { getConfig } from '@/config/env';
import { StripeProvider } from '@stripe/stripe-react-native';

// Conditionally import notifications only if not in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications: any = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
}

const devLog = (...args: unknown[]) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log(...args);
  }
};

// Initialize Sentry before app renders
initSentry();

// Initialize testing monitor on web (only in development)
if (Platform.OS === 'web' && __DEV__) {
  void import('@/utils/testingMonitor.web')
    .then(({ testingMonitor }) => {
      testingMonitor.start();
      devLog('Web Testing Monitor Active - Tracking all errors');
    })
    .catch(error => devLog('Testing monitor failed to start', error));
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const _router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const navState = useRootNavigationState();

  React.useEffect(() => {
    if (__DEV__) {
      const key = getConfig().stripePublishableKey;
      devLog('[Stripe] publishableKey:', key ? `${key.substring(0, 12)}...${key.slice(-4)}` : '(empty)');
    }
  }, []);

  React.useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
      'new NativeEventEmitter',
      'Require cycle:',
      'PushNotificationIOS has been extracted',
      'Invariant Violation: `new NativeEventEmitter()',
      // Reanimated warning triggered by expo-router navigation transition internals
      'animations-in-inline-styling',
      '[Reanimated] Tried to access',
    ]);
    if (Platform.OS === 'web') {
      LogBox.ignoreLogs([
        '"shadow*" style props are deprecated',
        'props.pointerEvents is deprecated. Use style.pointerEvents',
      ]);
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || isExpoGo || !Notifications) return;
    Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [250, 250],
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: '#2563EB',
    }).catch(() => {});
  }, []);

  // Handle deep links (shared post links, etc.)
  // Public routes (verify, reset-password) navigate immediately.
  // Protected routes (post, game, team, profile) are deferred until AuthProvider
  // confirms the user is authenticated — prevents bypassing onboarding/verification.
  useEffect(() => {
    handleInitialDeepLink((url) => {
      handleDeepLinkAuthAware(url);
    }).catch(() => {});
    const unsubscribe = setupDeepLinkListener((url) => {
      handleDeepLinkAuthAware(url);
    });
    return unsubscribe;
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[colorScheme ?? 'light'].background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StripeProvider
            publishableKey={getConfig().stripePublishableKey}
            merchantIdentifier="merchant.app.varsityhub"
          >
          <ThemeProvider>
            <PostCacheProvider>
              <NavigationHistoryProvider>
              <AuthProvider navReady={!!navState?.key}>
                <NotificationTapHandler />
                <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <OfflineBanner />
                  <ErrorToastContainer />
                    <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    {/* Game detail at root so back returns to previous screen (Spotify-like nav) */}
                    <Stack.Screen name="game" options={{ headerShown: false }} />
                    {/* Auth screens - lazy loaded */}
                    <Stack.Screen name="sign-in" options={{ headerShown: false }} />
                    <Stack.Screen name="sign-up" options={{ headerShown: false }} />
                    <Stack.Screen name="verify" options={{ headerShown: false }} />
                    <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
                    <Stack.Screen name="reset" options={{ headerShown: false }} />
                    <Stack.Screen name="reset-password" options={{ headerShown: false }} />
                    {/* Payment screens - lazy loaded */}
                    <Stack.Screen name="payment-success" options={{ headerShown: false }} />
                    <Stack.Screen name="payment-cancel" options={{ headerShown: false }} />
                    {/* Onboarding - lazy loaded */}
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    {/* Settings and other screens - lazy loaded */}
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                  <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                </NavigationThemeProvider>
              </AuthProvider>
              </NavigationHistoryProvider>
            </PostCacheProvider>
          </ThemeProvider>
        </StripeProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
