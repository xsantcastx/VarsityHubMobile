import { useAuth } from '@/context/AuthProvider';
import { OBProvider } from '@/context/OnboardingContext';
import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function OnboardingLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // CRITICAL SECURITY CHECK: Onboarding requires authentication
  useEffect(() => {
    if (loading) return; // Wait for auth check to complete
    
    if (!user) {
      console.warn('[OnboardingLayout] Unauthenticated user detected - redirecting to sign-in');
      router.replace('/sign-in');
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

  // Redirect is happening - show loading
  if (!user) {
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
