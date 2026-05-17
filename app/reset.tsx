import { Colors } from '@/constants/Colors';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    let legacyCode = typeof params.code === 'string' ? params.code : '';
    if (!legacyCode && typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/\/reset\/([a-zA-Z0-9]+)/);
      if (match?.[1]) {
        legacyCode = match[1];
      }
    }
    router.replace({
      pathname: '/reset-password',
      params: legacyCode ? { code: legacyCode } : undefined,
    });
  }, [params.code, router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Reset Password', headerShown: false }} />
      <View style={styles.content}>
        <ActivityIndicator color={palette.tint} />
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>
          Redirecting to password reset...
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
