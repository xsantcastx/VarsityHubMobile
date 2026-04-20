import { APP_ROUTES } from '@/utils/appRoutes';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function BillingCompatibilityScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    router.replace(APP_ROUTES.manageSubscription as any);
  }, [router]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title: 'Billing', headerShown: false }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={Colors[colorScheme].tint} />
      </View>
    </SafeAreaView>
  );
}
