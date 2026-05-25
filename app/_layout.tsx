// Must be the very first import so Reactotron patches globals before anything else
if (__DEV__ && process.env.EXPO_OS !== 'web') {
  require('../ReactotronConfig');
}
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorToastContainer } from '@/components/ErrorToast';
import { NotificationTapHandler } from '@/components/NotificationTapHandler';
import { OfflineBanner } from '@/components/OfflineBanner';
import { VerificationRequiredModal } from '@/components/VerificationRequiredModal';
import { getConfig } from '@/config/env';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { AuthProvider, useAuth } from '@/context/AuthProvider';
import { NavigationHistoryProvider } from '@/context/NavigationHistoryContext';
import { PostCacheProvider } from '@/context/PostCacheContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/useCustomColorScheme';
import { useVerificationGate } from '@/hooks/useVerificationGate';
import { initAnalytics } from '@/utils/analytics';
import {
    handleDeepLinkAuthAware,
    handleInitialDeepLink,
    setupDeepLinkListener,
} from '@/utils/deepLinks';
import { initSentry } from '@/utils/sentry';
import { StripeProvider } from '@/utils/stripe';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';

// Conditionally import notifications only if not in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo && Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

const devLog = (...args: unknown[]) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    if (__DEV__) console.log(...args);
  }
};

// Initialize Sentry and PostHog before app renders
initSentry();
initAnalytics();

// Initialize testing monitor on web (only in development)
if (Platform.OS === 'web' && __DEV__) {
  void import('@/utils/testingMonitor.web')
    .then(({ testingMonitor }) => {
      testingMonitor.start();
      devLog('Web Testing Monitor Active - Tracking all errors');
    })
    .catch(error => devLog('Testing monitor failed to start', error));
}

if (Platform.OS === 'web' && __DEV__ && !(globalThis as any).__VH_WEB_WARNING_FILTER_INSTALLED__) {
  (globalThis as any).__VH_WEB_WARNING_FILTER_INSTALLED__ = true;
  const suppressedMessages = [
    'props.pointerEvents is deprecated. Use style.pointerEvents',
    'Animated: `useNativeDriver` is not supported because the native animated module is missing.',
  ];
  const filterConsole = (method: 'warn' | 'error') => {
    // eslint-disable-next-line no-console -- intentional wrapper for targeted warning suppression
    const original = console[method].bind(console);
    // eslint-disable-next-line no-console -- intentional wrapper for targeted warning suppression
    console[method] = (...args: unknown[]) => {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      if (suppressedMessages.some(message => firstArg.includes(message))) {
        return;
      }
      original(...args);
    };
  };
  filterConsole('warn');
  filterConsole('error');
}

function VerificationGateHost() {
  const { user, pendingVerificationEmail, checkAuth } = useAuth();
  const gate = useVerificationGate({
    getDefaultEmail: () => pendingVerificationEmail || user?.email || null,
    requestCode: () => User.requestVerification(),
    confirmCode: (code: string) => User.verifyEmail(code),
    onVerified: () => checkAuth(),
  });

  return (
    <VerificationRequiredModal
      visible={gate.visible}
      email={gate.email}
      code={gate.code}
      loading={gate.loading}
      error={gate.error}
      info={gate.info}
      resendCooldown={gate.resendCooldown}
      onChangeCode={gate.setCode}
      onVerify={gate.verify}
      onResend={gate.resend}
      onCancel={gate.cancel}
    />
  );
}

function AppShell() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider>
      <NotificationTapHandler />
      <VerificationGateHost />
      <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <OfflineBanner />
        <ErrorToastContainer />
        <View
          style={{
            flex: 1,
            backgroundColor: Colors[colorScheme ?? 'light'].background,
          }}
        >
          <View
            style={{
              flex: 1,
              maxWidth: MAX_CONTENT_WIDTH,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* Game detail at root so back returns to previous screen (Spotify-like nav) */}
              <Stack.Screen name="game/index" options={{ headerShown: false }} />
              <Stack.Screen name="game/[id]" options={{ headerShown: false }} />
              {/* Auth screens - lazy loaded */}
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
              <Stack.Screen name="sign-up" options={{ headerShown: false }} />
              <Stack.Screen name="verify" options={{ headerShown: false }} />
              <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
              {/* Payment screens - lazy loaded */}
              <Stack.Screen name="payment-success" options={{ headerShown: false }} />
              <Stack.Screen name="payment-cancel" options={{ headerShown: false }} />
              {/* Onboarding - lazy loaded */}
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              {/* Organization & league detail pages */}
              <Stack.Screen name="organizations/index" options={{ headerShown: false }} />
              <Stack.Screen name="organizations/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="league" options={{ headerShown: false }} />
              {/* Settings */}
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              {/* Profile */}
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              {/* Admin screens */}
              <Stack.Screen name="admin-dashboard" options={{ headerShown: false }} />
              <Stack.Screen name="admin-users" options={{ headerShown: false }} />
              <Stack.Screen name="admin-user-detail" options={{ headerShown: false }} />
              <Stack.Screen name="admin-teams" options={{ headerShown: false }} />
              <Stack.Screen name="admin-ads" options={{ headerShown: false }} />
              <Stack.Screen name="admin-reports" options={{ headerShown: false }} />
              <Stack.Screen name="admin-messages" options={{ headerShown: false }} />
              <Stack.Screen name="admin-activity-log" options={{ headerShown: false }} />
              <Stack.Screen name="admin-create-event" options={{ headerShown: false }} />
              <Stack.Screen name="admin-transactions" options={{ headerShown: false }} />
              <Stack.Screen name="admin-metrics" options={{ headerShown: false }} />
              {/* Payment & billing */}
              <Stack.Screen name="billing" options={{ headerShown: false }} />
              <Stack.Screen name="subscription-paywall" options={{ headerShown: false }} />
              {/* Ad management */}
              <Stack.Screen name="submit-ad" options={{ headerShown: false }} />
              <Stack.Screen name="ad-calendar" options={{ headerShown: false }} />
              <Stack.Screen name="ad-confirmation" options={{ headerShown: false }} />
              <Stack.Screen name="edit-ad" options={{ headerShown: false }} />
              <Stack.Screen name="my-ads" options={{ headerShown: false }} />
              {/* Team & season management */}
              <Stack.Screen name="manage-season" options={{ headerShown: false }} />
              <Stack.Screen name="manage-users" options={{ headerShown: false }} />
              <Stack.Screen name="team-invites" options={{ headerShown: false }} />
              <Stack.Screen name="team-join-requests" options={{ headerShown: false }} />
              <Stack.Screen name="organization-invites" options={{ headerShown: false }} />
              <Stack.Screen name="team-viewer" options={{ headerShown: false }} />
              <Stack.Screen name="season-stats" options={{ headerShown: false }} />
              {/* Organization join flow */}
              <Stack.Screen name="request-join-organization" options={{ headerShown: false }} />
              <Stack.Screen name="organization-join-requests" options={{ headerShown: false }} />
              {/* Safety & moderation */}
              <Stack.Screen name="report-abuse" options={{ headerShown: false }} />
              <Stack.Screen name="dm-restrictions" options={{ headerShown: false }} />
              <Stack.Screen name="blocked-users" options={{ headerShown: false }} />
              {/* Content & discovery */}
              <Stack.Screen name="favorites" options={{ headerShown: false }} />
              <Stack.Screen name="messages" options={{ headerShown: false }} />
              <Stack.Screen name="game-map" options={{ headerShown: false }} />
              <Stack.Screen name="game-detail" options={{ headerShown: false }} />
              <Stack.Screen name="game-highlights" options={{ headerShown: false }} />
              <Stack.Screen name="game-photos" options={{ headerShown: false }} />
              <Stack.Screen name="game-reviews" options={{ headerShown: false }} />
              <Stack.Screen name="public-event" options={{ headerShown: false }} />
              <Stack.Screen name="rsvp-history" options={{ headerShown: false }} />
              {/* Help & info */}
              <Stack.Screen name="help" options={{ headerShown: false }} />
              <Stack.Screen name="core-values" options={{ headerShown: false }} />
              <Stack.Screen name="verify-identity" options={{ headerShown: false }} />
              {/* Sub-screens (root Stack for proper back navigation) */}
              <Stack.Screen name="post-detail" options={{ headerShown: false }} />
              <Stack.Screen name="create-post" options={{ headerShown: false }} />
              <Stack.Screen name="team-page" options={{ headerShown: false }} />
              <Stack.Screen name="team-profile" options={{ headerShown: false }} />
              <Stack.Screen name="team-hub" options={{ headerShown: false }} />
              <Stack.Screen name="team-contacts" options={{ headerShown: false }} />
              <Stack.Screen name="user-profile" options={{ headerShown: false }} />
              <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
              <Stack.Screen name="edit-team" options={{ headerShown: false }} />
              <Stack.Screen name="create-team" options={{ headerShown: false }} />
              <Stack.Screen name="manage-teams" options={{ headerShown: false }} />
              <Stack.Screen name="my-team" options={{ headerShown: false }} />
              <Stack.Screen name="team-admin" options={{ headerShown: false }} />
              <Stack.Screen name="organization" options={{ headerShown: false }} />
              <Stack.Screen name="edit-organization" options={{ headerShown: false }} />
              <Stack.Screen name="event-detail" options={{ headerShown: false }} />
              <Stack.Screen name="edit-event" options={{ headerShown: false }} />
              <Stack.Screen name="event-approvals" options={{ headerShown: false }} />
              <Stack.Screen name="approvals" options={{ headerShown: false }} />
              <Stack.Screen name="create-fan-event" options={{ headerShown: false }} />
              <Stack.Screen name="message-thread" options={{ headerShown: false }} />
              <Stack.Screen name="followers" options={{ headerShown: false }} />
              <Stack.Screen name="following" options={{ headerShown: false }} />
              <Stack.Screen name="follow-requests" options={{ headerShown: false }} />
              <Stack.Screen name="verify-email" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </View>
        </View>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}

function RootLayout() {
  const fallbackColorScheme = useColorScheme();
  const _router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // Explicitly load icon fonts so iOS doesn't render `?` glyphs for
    // arrow-upward / chat-bubble-outline at small sizes (PostCard StatPill).
    ...MaterialIcons.font,
    ...Ionicons.font,
  });
  const navState = useRootNavigationState();
  const navReady = Boolean(navState?.key);

  React.useEffect(() => {
    if (__DEV__) {
      const key = getConfig().stripePublishableKey;
      devLog(
        '[Stripe] publishableKey:',
        key ? `${key.substring(0, 12)}...${key.slice(-4)}` : '(empty)'
      );
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
      'animations-in-inline-styling',
      '[Reanimated] Tried to access',
    ]);
    if (Platform.OS === 'web') {
      LogBox.ignoreLogs([
        '"shadow*" style props are deprecated',
        '"textShadow*" style props are deprecated',
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
    handleInitialDeepLink(url => {
      handleDeepLinkAuthAware(url);
    }).catch(() => {});
    const unsubscribe = setupDeepLinkListener(url => {
      handleDeepLinkAuthAware(url);
    });
    return unsubscribe;
  }, []);

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors[fallbackColorScheme ?? 'light'].background,
        }}
      >
        <ActivityIndicator color={Colors[fallbackColorScheme ?? 'light'].tint} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StripeProvider publishableKey={getConfig().stripePublishableKey}>
            <PostCacheProvider>
              <NavigationHistoryProvider>
                <AuthProvider navReady={navReady}>
                  <AppShell />
                </AuthProvider>
              </NavigationHistoryProvider>
            </PostCacheProvider>
          </StripeProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default RootLayout;
