import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GUEST_HOME_ROUTE } from '@/utils/publicRoutes';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

/**
 * Passive splash screen - navigation is handled centrally by _layout.tsx
 * This eliminates race conditions where both index and _layout try to navigate.
 *
 * The _layout effect will:
 * 1. Check auth status via the centralized auth provider
 * 2. Route guests to the public feed
 * 3. Route to onboarding (needs onboarding)
 * 4. Route to tabs (authenticated)
 */
export default function Index() {
  useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  // FAILSAFE: if the centralized routing never moves us off the splash (e.g. a
  // dropped replace() during a slow cold start strands the redirect logic),
  // escape to the feed rather than spinning forever. AuthProvider keeps
  // running and will correct the destination (verify/onboarding/etc.) once the
  // router has actually moved. Timer clears on unmount, so a normal redirect
  // never triggers this.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const failsafe = setTimeout(() => {
      router.replace(GUEST_HOME_ROUTE); // nav-safe: splash failsafe escape after stalled startup routing
    }, 8000);
    return () => clearTimeout(failsafe);
  }, [router]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors[colorScheme].background,
        gap: 24,
      }}
    >
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
