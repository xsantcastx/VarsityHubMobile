import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore JS exports
import { Message as MessageApi, User } from '@/api/entities';

type MiniUser = { id: string; email?: string; display_name?: string };
type Msg = {
  id: string | number;
  conversation_id?: string | null;
  sender_id?: string;
  recipient_id?: string;
  content?: string;
  created_at?: string;
  sender?: MiniUser | null;
  recipient?: MiniUser | null;
};

export default function MessageThreadScreen() {
  const { conversation_id, with: withParam } = useLocalSearchParams<{ conversation_id?: string; with?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const flatRef = useRef<FlatList<Msg>>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await User.me();
      setMe(user);
      let list: Msg[] = [];
      if (conversation_id) list = await MessageApi.threadByConversation(String(conversation_id), 100);
      else if (withParam) list = await MessageApi.threadWith(String(withParam), 100);
      // Show oldest first in chat view
      list = Array.isArray(list) ? list.slice().reverse() : [];
      setMsgs(list);
    } catch (e: any) {
      setError('Unable to load conversation. You may need to sign in.');
    } finally {
      setLoading(false);
    }
  }, [conversation_id, withParam]);

  useEffect(() => { load(); }, [load]);

  // Mark as read on open
  useEffect(() => {
    (async () => {
      try {
        if (conversation_id) await MessageApi.markReadByConversation(String(conversation_id));
        else if (withParam) await MessageApi.markReadWith(String(withParam));
      } catch {}
    })();
  }, [conversation_id, withParam]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (flatRef.current) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [msgs.length]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      // Determine recipient. If `with` was an email, send by email; if it was an id, send by id.
      let payload: any = { content };
      if (conversation_id) {
        payload.conversation_id = String(conversation_id);
        // Try to infer the other participant id from loaded messages
        const otherId = (() => {
          if (!me) return null;
          const sample = msgs.find(m => m.sender_id || m.recipient_id || m.sender || m.recipient) || null;
          if (!sample) return null;
          const sId = sample.sender_id || sample.sender?.id;
          const rId = sample.recipient_id || sample.recipient?.id;
          if (sId && String(sId) !== String(me.id)) return String(sId);
          if (rId && String(rId) !== String(me.id)) return String(rId);
          return null;
        })();
        if (otherId) payload.recipient_id = otherId;
      } else if (withParam) {
        const w = String(withParam);
        if (w.includes('@')) payload.recipient_email = w; else payload.recipient_id = w;
      }

      const created = await MessageApi.send(payload);
      setMsgs((arr) => arr.concat(created));
    } catch (e) {
      setError('Failed to send message');
    }
  };

  const title = useMemo(() => {
    // Determine the other participant from loaded messages
    if (!me) {
      // Before me is loaded, use fallback
      if (withParam) return String(withParam);
      return 'Conversation';
    }

    // Find the other participant (not me)
    const otherParticipant = (() => {
      for (const msg of msgs) {
        const sender = msg.sender || (msg.sender_id ? { id: msg.sender_id } : null);
        const recipient = msg.recipient || (msg.recipient_id ? { id: msg.recipient_id } : null);

        if (sender && String(sender.id) !== String(me.id)) {
          return sender;
        }
        if (recipient && String(recipient.id) !== String(me.id)) {
          return recipient;
        }
      }
      return null;
    })();

    // Use display_name or email from the other participant
    if (otherParticipant) {
      return otherParticipant.display_name || otherParticipant.email || 'Conversation';
    }

    // Fallback: if withParam looks like an email, use it; otherwise use generic label
    if (withParam) {
      const w = String(withParam);
      if (w.includes('@')) return w; // It's an email
      // It's a user ID - wait for messages to load
      return 'Conversation';
    }

    return 'Conversation';
  }, [me, msgs, withParam, conversation_id]);

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = me?.id && (String(item.sender_id || item.sender?.id || '') === String(me.id));
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={styles.bubbleText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title,
            headerRight: () => (
              <Pressable onPress={() => setSafetyOpen(true)} style={{ paddingHorizontal: 8, paddingVertical: 6 }} accessibilityLabel="Safety">
                <Ionicons name="shield-checkmark-outline" size={20} color="#111827" />
              </Pressable>
            ),
          }}
        />
        {loading && (
          <View style={styles.center}><ActivityIndicator /></View>
        )}
        {error && !loading && <Text style={styles.error}>{error}</Text>}
        {!loading && (
          <FlatList
            ref={flatRef}
            data={msgs}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
          />
        )}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable onPress={send} style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} disabled={!text.trim()}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>

        {/* Safety sheet */}
        <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSafetyOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Safety</Text>
              <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/report-abuse'); }}>
                <Ionicons name="flag-outline" size={18} color="#111827" />
                <Text style={styles.sheetText}>Report conversation</Text>
              </Pressable>
              <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/blocked-users'); }}>
                <Ionicons name="person-remove-outline" size={18} color="#111827" />
                <Text style={styles.sheetText}>Block or manage blocked</Text>
              </Pressable>
              <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/dm-restrictions'); }}>
                <Ionicons name="options-outline" size={18} color="#111827" />
                <Text style={styles.sheetText}>DM restrictions</Text>
              </Pressable>
              <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/settings/index' as any); }}>
                <Ionicons name="settings-outline" size={18} color="#111827" />
                <Text style={styles.sheetText}>Privacy & settings</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', padding: 16 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginHorizontal: 12, marginVertical: 4 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#111827' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#E5E7EB' },
  bubbleText: { color: 'white' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  sendBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: 'white', fontWeight: '700' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sheetText: { fontWeight: '700', color: '#111827' },
});
