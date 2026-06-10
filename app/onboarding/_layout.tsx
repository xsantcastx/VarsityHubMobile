import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { OBProvider } from '@/context/OnboardingContext';
import { Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { user, loading } = useAuth();

  // Show loading while auth is being checked
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.tint} />
      </View>
    );
  }

  // Redirect is happening - show loading. Covers both missing user and
  // unverified-email cases; AuthProvider is the single redirect authority.
  if (!user || user.email_verified !== true) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.tint} />
      </View>
    );
  }

  // Key OBProvider on user.id so React drops the entire onboarding state tree
  // (provider state, reducer state, every screen's refs) the moment the auth
  // identity changes. Belt-and-suspenders with the AsyncStorage clear in
  // AuthProvider — even if the storage clear is missed for any reason, the
  // in-memory state cannot bleed across accounts.
  return (
    <SafeAreaProvider>
      <OBProvider key={user.id}>
        <Slot />
      </OBProvider>
    </SafeAreaProvider>
  );
}
