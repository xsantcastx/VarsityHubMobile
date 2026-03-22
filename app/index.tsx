import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image } from 'expo-image';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Passive splash screen - navigation is handled centrally by _layout.tsx
 * This eliminates race conditions where both index and _layout try to navigate.
 *
 * The _layout effect will:
 * 1. Check auth status via User.me()
 * 2. Route to sign-in (unauthenticated)
 * 3. Route to onboarding (needs onboarding)
 * 4. Route to tabs (authenticated)
 */
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme() ?? 'light';

  // Fallback: if AuthProvider doesn't redirect within 3 seconds, do it manually
  // BUT: Only navigate if we're still on the index route (AuthProvider hasn't navigated yet)
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Check if we're still on index route - if not, AuthProvider already navigated
      // When on index route, segments array is empty or first segment is empty string
      const firstSegment = Array.isArray(segments) && segments.length ? String(segments[0]) : '';
      const isStillOnIndex = firstSegment === '' || firstSegment === 'index';

      // Only navigate if still on index and AuthProvider is done loading
      // If AuthProvider is still loading, wait for it to complete
      // If we've already navigated away from index, don't navigate again
      if (!isStillOnIndex || loading) {
        return;
      }

      if (!user) {
        router.replace('/sign-in');
      } else if (user.email_verified !== true) {
        router.replace('/verify');
      } else if (user.preferences?.onboarding_completed !== true) {
        router.replace('/onboarding/step-1-role');
      } else {
        router.replace('/(tabs)' as any);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [user, router, segments, loading]);

  // AuthProvider handles all routing logic
  // This screen shows loading state while AuthProvider determines where to navigate
  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].background,
      gap: 24,
    }}>
      <Image
        source={require('../assets/images/logo.svg')}
        style={{ width: 80, height: 80, borderRadius: 16 }}
      />
      <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
    </View>
  );
}
