import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function PublicEventScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Public Event' }} />
      <Text style={styles.title}>Public Event</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
      {params?.id ? <Text>Event ID: {params.id}</Text> : null}
      <Text style={styles.params}>{JSON.stringify(params, null, 2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  params: { fontFamily: 'monospace', color: '#111827' },
});

