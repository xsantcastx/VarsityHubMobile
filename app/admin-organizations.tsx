import { httpGet, httpPatch } from '@/api/http';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type OrgItem = {
  id: string;
  name: string;
  status: string;
  location?: string | null;
  org_type?: string | null;
  _count?: { teams?: number; memberships?: number; joinRequests?: number };
};

export default function AdminOrganizationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [items, setItems] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await httpGet(`/admin/organizations?status=${encodeURIComponent(filter)}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewOrg = async (id: string, status: 'active' | 'rejected' | 'pending') => {
    setSubmittingId(id);
    try {
      await httpPatch(`/admin/organizations/${encodeURIComponent(id)}/status`, { status, note });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update organization');
    } finally {
      setSubmittingId(null);
    }
  };

  if (adminLoading) {
    return <SafeAreaView style={[styles.center, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}><ActivityIndicator /></SafeAreaView>;
  }

  if (!isAdmin) {
    return <SafeAreaView style={[styles.center, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}><Text style={{ color: Colors[colorScheme].text, fontWeight: '600' }}>Admin access required</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Admin · Organizations' }} />
      <View style={styles.header}>
        {(['all', 'pending', 'active', 'rejected'] as const).map((status) => (
          <Pressable key={status} style={[styles.tab, { backgroundColor: filter === status ? Colors[colorScheme].tint : Colors[colorScheme].card }]} onPress={() => setFilter(status)}>
            <Text style={{ color: filter === status ? '#fff' : Colors[colorScheme].text, fontWeight: '700' }}>{status}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.noteWrap}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional review note"
          placeholderTextColor={Colors[colorScheme].mutedText}
          style={[styles.noteInput, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
        />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {loading ? <ActivityIndicator /> : null}
        {!loading && items.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{item.name}</Text>
              <Text style={{ color: Colors[colorScheme].mutedText }}>{item.status}</Text>
            </View>
            <Text style={{ color: Colors[colorScheme].mutedText }}>{item.org_type || 'organization'}{item.location ? ` · ${item.location}` : ''}</Text>
            <Text style={{ color: Colors[colorScheme].mutedText }}>
              Teams: {item._count?.teams || 0} · Members: {item._count?.memberships || 0} · Join Requests: {item._count?.joinRequests || 0}
            </Text>
            <View style={styles.actions}>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => void reviewOrg(item.id, 'active')} disabled={submittingId === item.id}>
                <Text style={styles.actionText}>{submittingId === item.id ? '...' : 'Approve'}</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => void reviewOrg(item.id, 'pending')} disabled={submittingId === item.id}>
                <Text style={styles.actionText}>Pend</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#DC2626' }]} onPress={() => void reviewOrg(item.id, 'rejected')} disabled={submittingId === item.id}>
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
              <Pressable style={[styles.iconBtn, { borderColor: Colors[colorScheme].border }]} onPress={() => void router.push(`/organization?id=${encodeURIComponent(item.id)}`)}>
                <Ionicons name="open-outline" size={18} color={Colors[colorScheme].text} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', gap: 8, padding: 16, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  noteWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  noteInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 16, fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: '#fff', fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
