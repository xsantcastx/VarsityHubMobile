import type { ErrorBoundaryProps } from 'expo-router';
import { Button, Text, View } from 'react-native';
import { captureException } from '@/utils/sentry';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function GlobalError({ error, retry }: ErrorBoundaryProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Capture global errors to Sentry
  if (error) {
    captureException(error, {
      tags: { component: 'GlobalError', errorBoundary: 'root' },
      extra: { errorType: typeof error, hasMessage: !!error?.message },
    });
  }

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12, backgroundColor: colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Something went wrong</Text>
      <Text selectable style={{ color: colors.mutedText }}>{String(error?.message ?? error)}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}
