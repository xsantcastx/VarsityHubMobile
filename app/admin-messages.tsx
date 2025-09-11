import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
// @ts-ignore
import { Message as MsgApi, User } from '@/api/entities';

export default function AdminMessagesScreen() {
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
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin · All Messages' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.msg} numberOfLines={2}>{item.content || ''}</Text>
              <Text style={styles.meta}>{(item.sender_email || 'unknown') + ' → ' + (item.recipient_email || 'unknown')}</Text>
              <Text style={styles.meta}>{new Date(item.created_date || item.created_at || Date.now()).toLocaleString()}</Text>
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
  row: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  msg: { fontWeight: '600' },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c', padding: 12 },
});

