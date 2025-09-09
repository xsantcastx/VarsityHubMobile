import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function EditTeamScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Team' }} />
      <Text style={styles.title}>Edit Team</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
      {params?.id ? <Text>Team ID: {params.id}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280' },
});

