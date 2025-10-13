import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      try {
        const me: any = await User.me();
        
        if (me) {
          // User is logged in
          const needsOnboarding = me?.preferences && (me.preferences.onboarding_completed === false);
          
          if (needsOnboarding) {
            router.replace('/onboarding/step-2-basic');
          } else {
            // Everyone lands on feed
            router.replace('/(tabs)/feed' as any);
          }
        } else {
          // No user, go to sign in
          router.replace('/sign-in');
        }
      } catch (err: any) {
        // Error getting user, go to sign in
        router.replace('/sign-in');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
