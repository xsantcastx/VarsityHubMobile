import { User } from '@/api/entities';
import settingsStore, { SETTINGS_KEYS } from '@/api/settings';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFreshAuthSnapshot } from '@/utils/authState';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

type Policy = 'everyone' | 'following' | 'no_one';

function DMRestrictionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user, checkAuth } = useAuth();
  const [policy, setPolicy] = useState<Policy>('everyone');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const authPolicy = (user?.preferences as any)?.dm_policy;
      if (authPolicy && ['everyone', 'following', 'no_one'].includes(authPolicy)) {
        if (!mounted) return;
        setPolicy(authPolicy as Policy);
        await settingsStore.setString(SETTINGS_KEYS.DM_POLICY, authPolicy);
        return;
      }
      try {
        const me = (await checkAuth().catch(() => null)) as any;
        const serverPolicy = (me?.preferences as any)?.dm_policy;
        if (!mounted) return;
        if (serverPolicy && ['everyone', 'following', 'no_one'].includes(serverPolicy)) {
          setPolicy(serverPolicy as Policy);
          // Sync local cache
          await settingsStore.setString(SETTINGS_KEYS.DM_POLICY, serverPolicy);
          return;
        }
      } catch {
        // Server unavailable — fall back to local cache
      }
      if (!mounted) return;
      const p = await settingsStore.getString(SETTINGS_KEYS.DM_POLICY, 'everyone');
      if (!mounted) return;
      setPolicy((p as Policy) || 'everyone');
    })();
    return () => { mounted = false; };
  }, [checkAuth, user]);

  const save = async (p: Policy) => {
    setSaving(true);
    setPolicy(p);
    try {
      // Persist to server so it's enforced on message send
      await User.updatePreferences({ dm_policy: p });
      await checkAuth().catch(() => {});
      // Also cache locally for fast loading
      await settingsStore.setString(SETTINGS_KEYS.DM_POLICY, p);
    } catch {
      Alert.alert('Error', 'Failed to save DM preference. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    safeGoBack(router);
  };

  const Row = ({ k, title, desc }: { k: Policy; title: string; desc: string }) => (
    <Pressable onPress={() => save(k)} disabled={saving} style={[styles.row, { backgroundColor: Colors[colorScheme].card, borderColor: policy === k ? Colors[colorScheme].tint : Colors[colorScheme].border, opacity: saving ? 0.6 : 1 }]}>
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
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color={Colors[colorScheme].tint} />
          </Pressable>
        ),
      }} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  rowTitle: { fontWeight: '700' },
  muted: {},
  badge: { fontWeight: '700' },
});

export default DMRestrictionsScreen;
