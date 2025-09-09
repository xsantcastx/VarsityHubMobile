import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function SubmitAdScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Submit Ad' }} />
      <Text style={styles.title}>Submit Ad</Text>
      <Text style={styles.subtitle}>Mobile implementation coming soon.</Text>
      <Pressable style={styles.linkBtn} onPress={() => router.push('/ad-calendar')}>
        <Text style={styles.linkText}>Open Ad Calendar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#111827', alignSelf: 'flex-start' },
  linkText: { color: 'white', fontWeight: '600' },
});

