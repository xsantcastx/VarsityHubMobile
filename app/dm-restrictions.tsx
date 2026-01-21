import settingsStore, { SETTINGS_KEYS } from '@/api/settings';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '@/components/ui/BackHeader';

type Policy = 'everyone' | 'following' | 'no_one';

export default function DMRestrictionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy>('everyone');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
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
      <Stack.Screen options={{ 
        title: 'DM Restrictions',
        headerShown: false, // Use custom header
      }} />
      <BackHeader 
        title="DM Restrictions"
        backgroundColor={Colors[colorScheme].background}
        textColor={Colors[colorScheme].text}
        borderColor={Colors[colorScheme].border}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Who can message you?</Text>
        <Row k="everyone" title="Everyone" desc="Anyone can send you a direct message." />
        <Row k="following" title="People you follow" desc="Only people you follow can message you." />
        <Row k="no_one" title="No one" desc="Direct messages to you are disabled." />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  muted: { fontSize: 14, lineHeight: 20 },
  badge: { fontSize: 14, fontWeight: '700' },
});
