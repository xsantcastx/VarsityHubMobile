import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';

export default function CreateScreen() {
  const router = useRouter();
  const go = (path: string) => router.push(path);

  return (
    <View style={styles.overlay}>
      <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Create</Text>
        <Pressable style={styles.item} onPress={() => go('/create-post')}>
          <Text style={styles.itemText}>Create Post</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/create-team')}>
          <Text style={styles.itemText}>Create Team</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/submit-ad')}>
          <Text style={styles.itemText}>Submit Ad</Text>
        </Pressable>
        <Pressable style={[styles.item, styles.cancel]} onPress={() => router.back()}>
          <Text style={[styles.itemText, { color: '#111827' }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  item: {
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancel: { backgroundColor: '#F3F4F6' },
  itemText: { fontWeight: '700' },
});

