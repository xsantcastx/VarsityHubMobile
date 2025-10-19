import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Message as MessageApi, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type MiniUser = { id: string; email?: string; display_name?: string; avatar_url?: string };
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
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
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

  // ✨ INSTANT MESSAGING: Poll every 3 seconds while in conversation
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      try {
        const user = await User.me();
        let list: Msg[] = [];
        if (conversation_id) list = await MessageApi.threadByConversation(String(conversation_id), 100);
        else if (withParam) list = await MessageApi.threadWith(String(withParam), 100);
        list = Array.isArray(list) ? list.slice().reverse() : [];
        if (mounted) {
          setMsgs(list);
          setMe(user);
        }
      } catch (e) {
        // Silently fail - don't disrupt conversation
      }
    }, 3000); // Check for new messages every 3 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [conversation_id, withParam]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (flatRef.current && msgs.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
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

  // Determine the other participant from loaded messages
  const otherParticipant = useMemo((): MiniUser | null => {
    if (!me) return null;
    
    for (const msg of msgs) {
      const sender = msg.sender || (msg.sender_id ? { id: msg.sender_id } : null);
      const recipient = msg.recipient || (msg.recipient_id ? { id: msg.recipient_id } : null);

      if (sender && String(sender.id) !== String(me.id)) {
        return sender as MiniUser;
      }
      if (recipient && String(recipient.id) !== String(me.id)) {
        return recipient as MiniUser;
      }
    }
    return null;
  }, [me, msgs]);

  const title = useMemo(() => {
    if (otherParticipant) {
      return otherParticipant.display_name || otherParticipant.email || 'User';
    }
    if (withParam) {
      const w = String(withParam);
      if (w.includes('@')) return w;
    }
    return 'Conversation';
  }, [otherParticipant, withParam]);

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const mine = me?.id && (String(item.sender_id || item.sender?.id || '') === String(me.id));
    const sender = mine ? me : otherParticipant;
    
    // Check if we should show avatar (show for first message in a sequence from same sender)
    const prevMsg = index > 0 ? msgs[index - 1] : null;
    const prevMine = prevMsg && me?.id && (String(prevMsg.sender_id || prevMsg.sender?.id || '') === String(me.id));
    const showAvatar = !mine && (prevMine === true || !prevMsg);
    
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        {!mine && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              sender?.avatar_url ? (
                <Image source={{ uri: sender.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme].border }]}>
                  <Ionicons name="person" size={16} color={Colors[colorScheme].mutedText} />
                </View>
              )
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
        )}
        <View style={[
          styles.bubble, 
          mine ? styles.bubbleMine : [styles.bubbleTheirs, { 
            backgroundColor: Colors[colorScheme].card,
            borderColor: Colors[colorScheme].border,
          }]
        ]}>
          <Text style={[
            styles.bubbleText, 
            { color: mine ? '#FFFFFF' : Colors[colorScheme].text }
          ]}>{item.content}</Text>
        </View>
        {mine && <View style={styles.avatarSpacer} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
        <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
          <Stack.Screen
            options={{
              headerShown: false,
            }}
          />
        
        {/* Custom WhatsApp-style header with safe area */}
        <View style={[styles.customHeader, { 
          paddingTop: insets.top + 8, 
          backgroundColor: Colors[colorScheme].card,
          borderBottomColor: Colors[colorScheme].border,
        }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={Colors[colorScheme].text} />
          </Pressable>
          
          <Pressable 
            style={styles.headerProfile}
            onPress={() => {
              if (otherParticipant?.id) {
                router.push(`/user-profile?id=${encodeURIComponent(otherParticipant.id)}`);
              }
            }}
          >
            {otherParticipant?.avatar_url ? (
              <Image source={{ uri: otherParticipant.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: Colors[colorScheme].border }]}>
                <Ionicons name="person" size={20} color={Colors[colorScheme].mutedText} />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]} numberOfLines={1}>{title}</Text>
              <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>Tap to view profile</Text>
            </View>
          </Pressable>

          <Pressable onPress={() => setSafetyOpen(true)} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={22} color={Colors[colorScheme].text} />
          </Pressable>
        </View>

        {/* Chat content */}
        <View style={styles.chatContent}>
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
              contentContainerStyle={styles.messagesList}
            />
          )}
        </View>

        {/* Composer */}
        <View style={[styles.composer, { 
          backgroundColor: Colors[colorScheme].card,
          borderTopColor: Colors[colorScheme].border,
        }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colorScheme === 'dark' ? Colors[colorScheme].surface : '#F3F4F6',
              color: Colors[colorScheme].text,
            }]}
            placeholder="Message"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <Pressable 
            onPress={send} 
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} 
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color="white" />
          </Pressable>
        </View>

        {/* Safety menu modal */}
        <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSafetyOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: Colors[colorScheme].card }]} onPress={() => {}}>
              <Text style={[styles.sheetTitle, { color: Colors[colorScheme].text }]}>Safety & Settings</Text>
              <Pressable style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]} onPress={() => { setSafetyOpen(false); router.push('/report-abuse'); }}>
                <Ionicons name="flag-outline" size={20} color={Colors[colorScheme].text} />
                <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Report conversation</Text>
              </Pressable>
              <Pressable style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]} onPress={() => { setSafetyOpen(false); router.push('/blocked-users'); }}>
                <Ionicons name="person-remove-outline" size={20} color={Colors[colorScheme].text} />
                <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Block user</Text>
              </Pressable>
              <Pressable style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]} onPress={() => { setSafetyOpen(false); router.push('/dm-restrictions'); }}>
                <Ionicons name="options-outline" size={20} color={Colors[colorScheme].text} />
                <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Message restrictions</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  chatContent: {
    flex: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#EF4444', padding: 16, textAlign: 'center' },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 32,
    marginRight: 8,
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpacer: {
    width: 32,
  },
  bubble: {
    maxWidth: '70%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 2,
  },
  bubbleMine: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sheetText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
