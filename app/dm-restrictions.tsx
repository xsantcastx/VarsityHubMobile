import settingsStore, { SETTINGS_KEYS } from '@/api/settings';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Policy = 'everyone' | 'following' | 'no_one';

export default function DMRestrictionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
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
    <Pressable onPress={() => save(k)} style={[styles.row, { backgroundColor: Colors[colorScheme].card, borderColor: policy === k ? Colors[colorScheme].tint : Colors[colorScheme].border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
        <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>{desc}</Text>
      </View>
      <Text style={[styles.badge, { color: policy === k ? Colors[colorScheme].tint : Colors[colorScheme].text }]}>{policy === k ? (saving ? '...' : 'Selected') : 'Select'}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'DM Restrictions' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Who can message you?</Text>
      <Row k="everyone" title="Everyone" desc="Anyone can send you a direct message." />
      <Row k="following" title="People you follow" desc="Only people you follow can message you." />
      <Row k="no_one" title="No one" desc="Direct messages to you are disabled." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontWeight: '700' },
  muted: {},
  badge: { fontWeight: '700' },
});
