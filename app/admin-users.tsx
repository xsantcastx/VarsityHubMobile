// GATED — restore when ADMIN is ready to test
export { default } from '@/components/ComingSoon';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { safeGoBack } from '@/utils/navigation';

function AdminUsersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showBanned, setShowBanned] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return; // Don't load if not admin
    
    setLoading(true); setError(null);
    try {
      const list = await User.listAll(q, 200, showBanned);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load users'));
    } finally { setLoading(false); }
  }, [q, showBanned, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const toggleBan = async (id: string, banned: boolean) => {
    try {
      if (banned) {
        await User.unban(id);
      } else {
        await User.ban(id);
      }
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Failed to ${banned ? 'unban' : 'ban'} user`);
    }
  };

  if (adminLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600' }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Admin · Users', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      <View style={styles.bar}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or email" placeholderTextColor={Colors[colorScheme].mutedText} style={[styles.search, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]} />
        <Pressable style={[styles.toggle, { borderColor: Colors[colorScheme].border }, showBanned && { backgroundColor: Colors[colorScheme].tint }]} onPress={() => setShowBanned((x) => !x)}>
          <Text style={[styles.toggleText, { color: showBanned ? '#fff' : Colors[colorScheme].text }]}>Banned</Text>
        </Pressable>
      </View>
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{item.display_name || '(no display)'}</Text>
              <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>{item.email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.email_verified ? 'VERIFIED' : 'UNVERIFIED'}</Text></View>
                {item.banned ? <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.badgeText, { color: '#991B1B' }]}>BANNED</Text></View> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={styles.btn} onPress={() => toggleBan(String(item.id), !!item.banned)}>
                  <Text style={styles.btnText}>{item.banned ? 'Unban' : 'Ban'}</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: '#374151' }]} onPress={() => void router.push(`/admin-user-detail?id=${encodeURIComponent(String(item.id))}`)}>
                  <Text style={styles.btnText}>View</Text>
                </Pressable>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MaterialIcons name="person-search" size={48} color={Colors[colorScheme].mutedText} />
              <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>No users match this filter</Text>
              <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 14, marginTop: 4 }}>Try adjusting your search or filter criteria.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bar: { flexDirection: 'row', gap: 8, padding: 12 },
  search: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 10, backgroundColor: 'white' },
  toggle: { paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#111827', borderColor: '#111827' },
  toggleText: { fontWeight: '700', color: 'transparent' }, // Will be overridden with Colors[colorScheme].text
  toggleTextOn: { color: '#FFFFFF' }, // White text for active state
  row: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB' },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6b7280' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#D1D5DB' },
  badgeText: { fontWeight: '800', fontSize: 10 },
  btn: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
});



