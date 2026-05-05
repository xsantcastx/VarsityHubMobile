import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image } from 'expo-image';
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
  const router = useRouter();
  const { user, pendingVerificationEmail, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  // Root-screen failsafe: if the centralized AuthProvider redirect misses during
  // a cold start, do not let users sit on the spinner forever.
  useEffect(() => {
    if (loading) return;

    if (pendingVerificationEmail) {
      router.replace('/verify' as any);
      return;
    }

    if (!user) {
      router.replace('/sign-in' as any);
      return;
    }

    const decision = getPostAuthRouteDecision(user, {
      pendingVerification: false,
    });
    router.replace(decision.route as any);
  }, [loading, pendingVerificationEmail, router, user]);

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].background,
      gap: 24,
    }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 4 }}>
        <Image
          source={require('../assets/images/logo.svg')}
          style={{ width: 80, height: 80, borderRadius: 12 }}
        />
      </View>
      <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
    </View>
  );
}
