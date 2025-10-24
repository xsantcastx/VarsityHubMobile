import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

export default function MyTeamScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Team' }} />
      <Text style={styles.title}>My Team</Text>
      <Text style={styles.subtitle}>Manage your team roster and staff from the VarsityHub web dashboard.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280' },
});
