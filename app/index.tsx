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
  useAuth();
  const colorScheme = useColorScheme() ?? 'light';

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
