import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import settingsStore, { SETTINGS_KEYS } from '@/api/settings';

type Policy = 'everyone' | 'following' | 'no_one';

export default function DMRestrictionsScreen() {
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy>('everyone');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const p = await settingsStore.getString(SETTINGS_KEYS.DM_POLICY, 'everyone');
      if (!mounted) return;
      setPolicy((p as Policy) || 'everyone');
    })();
    return () => { mounted = false; };
  }, []);

  const save = async (p: Policy) => {
    setSaving(true);
    await settingsStore.setString(SETTINGS_KEYS.DM_POLICY, p);
    setSaving(false);
    router.back();
  };

  const Row = ({ k, title, desc }: { k: Policy; title: string; desc: string }) => (
    <Pressable onPress={() => save(k)} style={[styles.row, policy === k && styles.activeRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.muted}>{desc}</Text>
      </View>
      <Text style={[styles.badge, policy === k && styles.badgeActive]}>{policy === k ? (saving ? '...' : 'Selected') : 'Select'}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'DM Restrictions' }} />
      <Text style={styles.title}>Who can message you?</Text>
      <Row k="everyone" title="Everyone" desc="Anyone can send you a direct message." />
      <Row k="following" title="People you follow" desc="Only people you follow can message you." />
      <Row k="no_one" title="No one" desc="Direct messages to you are disabled." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  activeRow: { borderColor: '#111827' },
  rowTitle: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  badge: { color: '#111827', fontWeight: '700' },
  badgeActive: { color: '#16a34a' },
});
