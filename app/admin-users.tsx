import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showBanned, setShowBanned] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await User.listAll(q, 200, showBanned);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load users'));
    } finally { setLoading(false); }
  }, [q, showBanned]);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (id: string, banned: boolean) => {
    try {
      if (banned) await User.unban(id); else await User.ban(id);
      await load();
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin · Users' }} />
      <View style={styles.bar}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or email" style={styles.search} />
        <Pressable style={[styles.toggle, showBanned && styles.toggleOn]} onPress={() => setShowBanned((x) => !x)}>
          <Text style={[styles.toggleText, showBanned && styles.toggleTextOn]}>Banned</Text>
        </Pressable>
      </View>
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{item.display_name || '(no display)'}</Text>
              <Text style={styles.meta}>{item.email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.email_verified ? 'VERIFIED' : 'UNVERIFIED'}</Text></View>
                {item.banned ? <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.badgeText, { color: '#991B1B' }]}>BANNED</Text></View> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={styles.btn} onPress={() => toggleBan(String(item.id), !!item.banned)}>
                  <Text style={styles.btnText}>{item.banned ? 'Unban' : 'Ban'}</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: '#374151' }]} onPress={() => router.push(`/admin-user-detail?id=${encodeURIComponent(String(item.id))}`)}>
                  <Text style={styles.btnText}>View</Text>
                </Pressable>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  bar: { flexDirection: 'row', gap: 8, padding: 12 },
  search: { flex: 1, height: 44, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', paddingHorizontal: 10, backgroundColor: 'white' },
  toggle: { paddingHorizontal: 10, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#111827', borderColor: '#111827' },
  toggleText: { fontWeight: '700', color: '#374151' },
  toggleTextOn: { color: 'white' },
  row: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6b7280' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', backgroundColor: '#E5E7EB' },
  badgeText: { fontWeight: '800', fontSize: 10 },
  btn: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
});





