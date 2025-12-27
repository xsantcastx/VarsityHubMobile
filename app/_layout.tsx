import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Colors } from '@/constants/Colors';
import { AuthProvider } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/shared/hooks/useCustomColorScheme';
import { initSentry } from '@/utils/sentry';

const devLog = (...args: unknown[]) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// Initialize Sentry before app renders
initSentry();

// Initialize testing monitor on web (only in development)
if (Platform.OS === 'web' && __DEV__) {
  void import('@/utils/testingMonitor.web')
    .then(({ testingMonitor }) => {
      testingMonitor.start();
      devLog('🔍 Web Testing Monitor Active - Tracking all errors');
    })
    .catch(error => devLog('Testing monitor failed to start', error));
}

// Dev-only smoke test disabled - use Sentry dashboard to verify
// if (__DEV__) {
//   try {
//     captureBreadcrumb('Dev smoke test', 'diagnostic', { screen: 'RootLayout' });
//     setTimeout(() => {
//       captureException(new Error('Sentry smoke test: dev boot'));
//     }, 300);
//   } catch {}
// }

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const navState = useRootNavigationState();

  React.useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
      'new NativeEventEmitter',
      'Require cycle:',
      'PushNotificationIOS has been extracted',
      'Invariant Violation: `new NativeEventEmitter()',
    ]);
    if (Platform.OS === 'web') {
      LogBox.ignoreLogs([
        '"shadow*" style props are deprecated',
        'props.pointerEvents is deprecated. Use style.pointerEvents',
      ]);
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
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

  // Handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (!data || !data.type) {
        devLog('[Notifications] Received notification with no data');
        return;
      }

      devLog('[Notifications] User tapped notification:', data.type);

      // Navigate based on notification type
      try {
        switch (data.type) {
          case 'new_message':
            devLog('[Notifications] Navigating to messages');
            router.push('/messages');
            break;

          case 'post_interaction':
            if (data.post_id) {
              devLog('[Notifications] Navigating to post:', data.post_id);
              router.push({
                pathname: '/post-detail',
                params: { id: data.post_id },
              } as any);
            }
            break;

          case 'new_follower':
            if (data.follower_id) {
              devLog('[Notifications] Navigating to profile:', data.follower_id);
              router.push({
                pathname: '/user-profile',
                params: { userId: data.follower_id },
              } as any);
            }
            break;

          default:
            devLog('[Notifications] Unknown notification type:', data.type);
        }
      } catch (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('[Notifications] Navigation error:', error);
        }
      }
    });

    return () => subscription.remove();
  }, [router]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[colorScheme ?? 'light'].background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider navReady={!!navState?.key}>
            <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <OfflineBanner />
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
                <Stack.Screen name="reset" options={{ headerShown: false }} />
                <Stack.Screen name="reset-password" options={{ headerShown: false }} />
                <Stack.Screen name="payment-success" options={{ headerShown: false }} />
                <Stack.Screen name="payment-cancel" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            </NavigationThemeProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
