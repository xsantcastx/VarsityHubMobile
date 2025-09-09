import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function CreateFanEventScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Fan Event' }} />
      <Text style={styles.title}>Create Fan Event</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280' },
});

