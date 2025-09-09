import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
// @ts-ignore JS exports
import { Message, User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type RawMessage = {
  id: string | number;
  conversation_id?: string;
  sender_email?: string;
  recipient_email?: string;
  content?: string;
  created_date?: string;
  read?: boolean;
  [key: string]: any;
};

export default function MessagesScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        try { const u = await User.me(); if (mounted) setMe(u); } catch {}
        const list: RawMessage[] = await (Message.list ? Message.list('-created_date', 50) : Message.filter({}, '-created_date'));
        if (!mounted) return;
        setMessages(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load messages', e);
        setError('Unable to load messages.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return messages;
    const q = query.toLowerCase();
    return messages.filter(m => (m.content || '').toLowerCase().includes(q) || (m.sender_email || '').toLowerCase().includes(q) || (m.recipient_email || '').toLowerCase().includes(q));
  }, [messages, query]);

  const renderItem = ({ item }: { item: RawMessage }) => {
    const mine = me && item.sender_email && me.email && item.sender_email === me.email;
    return (
      <View style={[styles.msgRow, mine ? styles.msgMine : styles.msgTheirs]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.msgContent} numberOfLines={2}>{item.content || ''}</Text>
          <Text style={styles.msgMeta}>
            {(item.sender_email || 'unknown') + ' -> ' + (item.recipient_email || 'unknown')}
          </Text>
        </View>
        {item.read ? null : <Badge>new</Badge>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Messages' }} />
      <Text style={styles.title}>Messages</Text>
      <Input placeholder="Search messages..." value={query} onChangeText={setQuery} style={{ marginBottom: 12 }} />
      {loading && <View style={styles.center}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  msgRow: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgMine: { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' },
  msgTheirs: {},
  msgContent: { fontWeight: '600' },
  msgMeta: { color: '#6b7280', marginTop: 4 },
});

