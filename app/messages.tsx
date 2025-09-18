import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { Message, User } from '@/api/entities';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type MiniUser = {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
};

type UIMsg = {
  id: string;
  conversation_id?: string | null;
  sender_id: string;
  recipient_id: string;
  content?: string | null;
  created_at: string; // ISO
  // related users (server should include these)
  sender?: MiniUser | null;
  recipient?: MiniUser | null;
  // keep optional legacy field for now so old caches don’t break UI
  read?: boolean;
};

export default function MessagesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MiniUser | null>(null);
  const [messages, setMessages] = useState<UIMsg[]>([]);
  const [query, setQuery] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        try {
          const u = await User.me(); // must return { id, email, display_name, ... }
          if (mounted) setMe(u);
        } catch {}

        // IMPORTANT: sort by -created_at now (not -created_date)
        const result: UIMsg[] | { _isNotModified: boolean } = await (Message.list
          ? Message.list('-created_at', 50)
          : Message.filter({}, '-created_at'));

        if (!mounted) return;
        if (result && !('_isNotModified' in result)) {
          setMessages(Array.isArray(result) ? result : []);
        }
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
    return messages.filter(m => {
      const text = (m.content ?? '').toLowerCase();
      const sName = (m.sender?.display_name ?? '').toLowerCase();
      const sEmail = (m.sender?.email ?? '').toLowerCase();
      const rName = (m.recipient?.display_name ?? '').toLowerCase();
      const rEmail = (m.recipient?.email ?? '').toLowerCase();
      return text.includes(q) || sName.includes(q) || sEmail.includes(q) || rName.includes(q) || rEmail.includes(q);
    });
  }, [messages, query]);

  const renderItem = ({ item }: { item: UIMsg }) => {
    const mine = me && item.sender_id === me.id;
    const other = mine ? item.recipient : item.sender;

    const goThread = () => {
      if (item.conversation_id) {
        router.push(`/message-thread?conversation_id=${encodeURIComponent(String(item.conversation_id))}`);
      } else if (other?.id) {
        // switch from email → user id
        router.push(`/message-thread?with=${encodeURIComponent(other.id)}`);
      }
    };

    const fromLabel = item.sender?.display_name || item.sender?.email || 'unknown';
    const toLabel = item.recipient?.display_name || item.recipient?.email || 'unknown';

    return (
      <Pressable style={[styles.msgRow, mine ? styles.msgMine : styles.msgTheirs]} onPress={goThread}>
        <View style={{ flex: 1 }}>
          <Text style={styles.msgContent} numberOfLines={2}>{item.content || ''}</Text>
          <Text style={styles.msgMeta}>{fromLabel + ' → ' + toLabel}</Text>
        </View>
        {/* TODO: replace with real unread logic; keeping legacy flag if server sends it */}
  {item.read ? null : <Badge><Text>new</Text></Badge>}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerRight: () => (
            <Pressable onPress={() => setSafetyOpen(true)} style={{ paddingHorizontal: 8, paddingVertical: 6 }} accessibilityLabel="Safety">
              <Ionicons name="shield-checkmark-outline" size={20} color="#111827" />
            </Pressable>
          ),
        }}
      />
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
      {/* Safety sheet */}
      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSafetyOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Safety</Text>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/report-abuse'); }}>
              <Ionicons name="flag-outline" size={18} color="#111827" />
              <Text style={styles.sheetText}>Report a message</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/blocked-users'); }}>
              <Ionicons name="person-remove-outline" size={18} color="#111827" />
              <Text style={styles.sheetText}>Blocked users</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/dm-restrictions'); }}>
              <Ionicons name="options-outline" size={18} color="#111827" />
              <Text style={styles.sheetText}>DM restrictions</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/settings'); }}>
              <Ionicons name="settings-outline" size={18} color="#111827" />
              <Text style={styles.sheetText}>Privacy & settings</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sheetText: { fontWeight: '700', color: '#111827' },
});
