import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Message as MsgApi, User } from '@/api/entities';

export default function AdminMessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await User.me();
      const list = await MsgApi.listAll(200);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load messages'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Admin · All Messages' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={[styles.error, { color: Colors[colorScheme].mutedText }]}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.msg, { color: Colors[colorScheme].text }]} numberOfLines={2}>{item.content || ''}</Text>
              <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>{(item.sender_email || 'unknown') + ' → ' + (item.recipient_email || 'unknown')}</Text>
              <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>{new Date(item.created_date || item.created_at || Date.now()).toLocaleString()}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  msg: { fontWeight: '600' },
  meta: {},
  error: { padding: 12 },
});

