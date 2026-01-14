import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const e2eMode = String(process.env.EXPO_PUBLIC_E2E || '').trim() === '1';

  // Fallback: if AuthProvider doesn't redirect within 3 seconds, do it manually
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (e2eMode) return;

      if (!user) {
        router.replace('/sign-in');
      } else if (user.preferences?.onboarding_completed === false) {
        router.replace('/onboarding/step-1-role');
      } else {
        router.replace('/(tabs)' as any);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [user, router, e2eMode]);

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
