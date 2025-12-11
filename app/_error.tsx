import type { ErrorBoundaryProps } from 'expo-router';
import { Button, Text, View } from 'react-native';

export default function GlobalError({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Something went wrong</Text>
      <Text selectable>{String(error?.message ?? error)}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}
