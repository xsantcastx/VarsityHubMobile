import React from 'react';
import { View, Text, Button } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

export default function GlobalError({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Something went wrong</Text>
      <Text selectable>{String(error?.message ?? error)}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}
