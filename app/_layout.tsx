import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useNavigation, usePathname, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
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
              <Stack screenOptions={{ headerShown: true }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="create-post" options={{ headerShown: false }} />
                <Stack.Screen name="edit-profile" options={{ headerShown: true }} />
                <Stack.Screen name="post-detail" options={{ headerShown: false }} />
                <Stack.Screen name="user-profile" options={{ headerShown: false }} />
                <Stack.Screen name="team-profile" options={{ headerShown: false }} />
                <Stack.Screen name="team-hub" options={{ headerShown: true }} />
                <Stack.Screen name="team-contacts" options={{ headerShown: true }} />
                <Stack.Screen name="game-detail" options={{ headerShown: false }} />
                <Stack.Screen name="highlights" options={{ headerShown: false }} />
                <Stack.Screen name="messages" options={{ headerShown: false }} />
                <Stack.Screen name="message-thread" options={{ headerShown: false }} />
                <Stack.Screen name="followers" options={{ headerShown: true }} />
                <Stack.Screen name="following" options={{ headerShown: true }} />
                <Stack.Screen name="create-team" options={{ headerShown: false }} />
                <Stack.Screen name="edit-team" options={{ headerShown: false }} />
                <Stack.Screen name="manage-teams" options={{ headerShown: false }} />
                <Stack.Screen name="my-team" options={{ headerShown: false }} />
                <Stack.Screen name="sign-in" options={{ headerShown: true }} />
                <Stack.Screen name="sign-up" options={{ headerShown: true }} />
                <Stack.Screen name="verify-email" options={{ headerShown: true }} />
                <Stack.Screen name="forgot-password" options={{ headerShown: true }} />
                <Stack.Screen name="reset" options={{ headerShown: true }} />
                <Stack.Screen name="reset-password" options={{ headerShown: true }} />
                <Stack.Screen name="payment-success" options={{ headerShown: false }} />
                <Stack.Screen name="payment-cancel" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <GlobalBackButton
                canGoBack={navigation?.canGoBack?.() ?? false}
                pathname={pathname}
                segments={segments}
                onBack={() => router.back()}
                colorScheme={colorScheme}
              />
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            </NavigationThemeProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

type GlobalBackButtonProps = {
  canGoBack: boolean;
  pathname?: string | null;
  segments: string[];
  onBack: () => void;
  colorScheme?: 'light' | 'dark' | null;
};

function GlobalBackButton({ canGoBack, pathname, segments, onBack, colorScheme }: GlobalBackButtonProps) {
  const insets = useSafeAreaInsets();
  const scheme = colorScheme ?? 'light';
  const theme = Colors[scheme];

  const currentPath = pathname || `/${segments.join('/')}`;
  const isSignIn = currentPath.includes('sign-in');
  const isTabRoot = segments[0] === '(tabs)' && segments.length <= 2;

  const routesWithCustomBack = [
    'create-collage',
    'notifications',
    'messages',
    'dm-restrictions',
    'ad-calendar',
    'following',
    'followers',
    'submit-ad',
    'message-thread',
    'fan-pitch',
    'zip-code',
    'create-post',
    'create',
    'feedback',
    'league',
    'post-detail',
    'edit-profile',
    'story-viewer',
    'contact',
    'billing',
    'universal-search',
    'create-team',
    'admin-reports',
    'manage-users',
    'edit-username',
    'manage-teams',
    'favorites',
    'team-profile',
    'team-hub',
    'subscription-paywall',
    'team-page',
    'admin-user-detail',
    'ad-analytics',
    'edit-team',
    'request-join-organization',
    'organization-join-requests',
    'forgot-password',
    'organization',
    'user-profile',
    'verify-email',
    'reset-password',
    'reset',
    'onboarding',
    'manage-season',
    'admin-ads',
    'admin-users',
    'admin-teams',
    'admin-messages',
    'admin-create-event',
    'create-fan-event',
    'team-contacts',
    'team-viewer',
    'game-details',
    'game-detail',
    'game-map',
    'game-highlights',
    'game-photos',
    'game-reviews',
  ];

  const hasCustomBack = routesWithCustomBack.some((slug) => currentPath.includes(slug));
  const shouldShow = canGoBack && !isSignIn && !isTabRoot && !hasCustomBack;

  if (!shouldShow) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onBack}
      style={{
        position: 'absolute',
        top: Math.max(insets.top, 10) + 6,
        left: 12,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
        zIndex: 100,
      }}
    >
      <Ionicons
        name="arrow-back"
        size={22}
        color={scheme === 'dark' ? '#fff' : theme.text}
      />
    </Pressable>
  );
}
