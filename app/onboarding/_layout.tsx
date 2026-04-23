import { useAuth } from '@/context/AuthProvider';
import { OBProvider } from '@/context/OnboardingContext';
import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function OnboardingLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // CRITICAL SECURITY CHECK: Onboarding requires authentication AND a
  // verified email. Unverified users cannot proceed through onboarding —
  // the server's requireVerified middleware would 403 every step anyway.
  // AuthProvider's routing effect is the primary gate; this layout is
  // defense-in-depth for direct navigation (deep links, stale state,
  // race conditions during auth bootstrap).
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete

    if (!user) {
      if (__DEV__)
        console.warn('[OnboardingLayout] Unauthenticated user detected - redirecting to sign-in');
      router.replace('/sign-in');
      return;
    }

    if (user.email_verified !== true) {
      if (__DEV__)
        console.warn('[OnboardingLayout] Unverified user reached onboarding - redirecting to /verify');
      router.replace('/verify');
    }
  }, [user, loading, router]);

  // Show loading while auth is being checked
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect is happening - show loading. Covers both missing user and
  // unverified-email cases; the effect above has kicked off replace().
  if (!user || user.email_verified !== true) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <OBProvider>
        <Slot />
      </OBProvider>
    </SafeAreaProvider>
  );
}
