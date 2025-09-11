import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';

export default function CreateScreen() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const verified = !!me?.email_verified;
  useEffect(() => { (async () => { try { const u = await User.me(); setMe(u); } catch {} })(); }, []);
  const go = (path: string) => {
    if (!verified) return router.push('/verify-email');
    router.push(path);
  };

  return (
    <View style={styles.overlay}>
      <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Create</Text>
        {!verified ? (
          <Text style={{ color: '#92400E', backgroundColor: '#FEF9C3', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A', padding: 8, borderRadius: 8, marginBottom: 4 }}>Verify your email to enable actions below.</Text>
        ) : null}
        <Pressable style={styles.item} onPress={() => go('/create-post')}>
          <Text style={styles.itemText}>Create Post</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/create-fan-event')}>
          <Text style={styles.itemText}>Create Fan Event</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/create-team')}>
          <Text style={styles.itemText}>Create Team</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/submit-ad')}>
          <Text style={styles.itemText}>Submit Ad</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={() => go('/(tabs)/my-ads')}>
          <Text style={styles.itemText}>My Ads</Text>
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
