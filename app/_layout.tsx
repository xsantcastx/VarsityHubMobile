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
import { PostCacheProvider } from '@/context/PostCacheContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/useCustomColorScheme';
import { handleInitialDeepLink, setupDeepLinkListener } from '@/utils/deepLinks';
import { initSentry } from '@/utils/sentry';

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
  useEffect(() => {
    handleInitialDeepLink().catch(() => {});
    const unsubscribe = setupDeepLinkListener();
    return unsubscribe;
  }, []);

  // Handle notification taps
  useEffect(() => {
    if (isExpoGo || !Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
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

          case 'mention':
          case 'comment_reply':
            if (data.post_id) {
              const q = data.comment_id ? `?id=${data.post_id}&commentId=${data.comment_id}` : `?id=${data.post_id}`;
              devLog('[Notifications] Navigating to post/comment:', data.post_id, data.comment_id);
              router.push(`/post-detail${q}` as any);
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

          case 'follow_request':
            if (data.follower_id || data.user_id_param) {
              const userId = String(data.follower_id || data.user_id_param);
              devLog('[Notifications] Navigating to follow requester profile:', userId);
              router.push({
                pathname: '/user-profile',
                params: { userId },
              } as any);
            }
            break;

          case 'follow_request_approved':
            if (data.user_id_param) {
              devLog('[Notifications] Navigating to approved follow profile:', data.user_id_param);
              router.push({
                pathname: '/user-profile',
                params: { userId: data.user_id_param },
              } as any);
            }
            break;

          case 'team_invite':
            devLog('[Notifications] Navigating to team invites');
            router.push('/team-invites');
            break;

          case 'event_approved':
          case 'event_rejected':
          case 'game_reminder':
            if (data.event_id || data.event_id_param) {
              const eventId = String(data.event_id || data.event_id_param);
              devLog('[Notifications] Navigating to event:', eventId);
              router.push({
                pathname: '/event-detail',
                params: { id: eventId },
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
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <PostCacheProvider>
              <AuthProvider navReady={!!navState?.key}>
                <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <OfflineBanner />
                  <ErrorToastContainer />
                    <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            </PostCacheProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
