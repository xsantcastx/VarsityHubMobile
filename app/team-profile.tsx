import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function TeamProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Team Profile' }} />
      <Text style={styles.title}>Team Profile</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
      {params?.id ? <Text>Team ID: {params.id}</Text> : null}
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

