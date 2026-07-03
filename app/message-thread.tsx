import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Message as MessageApi, User } from '@/api/entities';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useConversationSocket } from '@/hooks/useConversationSocket';
import { getAuthSnapshot } from '@/utils/authState';
import { checkDMRestriction } from '@/utils/dmRestrictions';
import { safeGoBack } from '@/utils/navigation';
import { getCoachAccessState } from '@/utils/roleChecks';
import { formatUserLabel } from '@/utils/userDisplay';

type MiniUser = {
  id: string;
  email?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
};
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

function MessageThreadScreen() {
  const {
    conversation_id,
    with: withParam,
    prefill,
    fallback,
  } = useLocalSearchParams<{
    conversation_id?: string;
    with?: string;
    prefill?: string;
    fallback?: string;
  }>();
  const router = useRouter();
  const { user, checkAuth } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const explicitFallback =
    typeof fallback === 'string' && fallback.trim().startsWith('/') ? fallback.trim() : '/messages';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(prefill || '');
  const flatRef = useRef<FlatList<Msg>>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [sending, setSending] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  // Coach-access state for the "Request Coach Verification" button in the
  // restriction modal. Using the shared helper keeps us consistent with
  // every other coach gate in the app.
  const coachAccess = useMemo(() => getCoachAccessState(me), [me]);

  // Clear the prefill param once we've used it
  useEffect(() => {
    if (prefill) {
      router.setParams({ prefill: '' });
    }
  }, [prefill, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = (await getAuthSnapshot(checkAuth, user)) as any;
      setMe(currentUser);
      let list: Msg[] = [];
      if (conversation_id)
        list = await MessageApi.threadByConversation(String(conversation_id), 100);
      else if (withParam) list = await MessageApi.threadWith(String(withParam), 100);
      // Show oldest first in chat view
      list = Array.isArray(list) ? list.slice().reverse() : [];
      setMsgs(list);
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 404) {
        setError('This conversation is no longer available.');
      } else {
        setError('Unable to load conversation. You may need to sign in.');
      }
    } finally {
      setLoading(false);
    }
  }, [checkAuth, conversation_id, user, withParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      setAppState(nextState);
    });
    return () => subscription.remove();
  }, []);

  // Mark as read on open
  useEffect(() => {
    void (async () => {
      try {
        if (conversation_id) await MessageApi.markReadByConversation(String(conversation_id));
        else if (withParam) await MessageApi.markReadWith(String(withParam));
      } catch (error: any) {
        if (__DEV__) {
          if (__DEV__)
            console.warn('[MessageThread] Failed to mark as read:', error?.message || error);
        }
        // Non-critical - continue without marking read
      }
    })();
  }, [conversation_id, withParam]);

  useEffect(() => {
    if (prefill && !prefillApplied) {
      setText(String(prefill));
      setPrefillApplied(true);
      // Remove the param so returning to this screen doesn't keep reapplying
      router.setParams({ prefill: undefined });
    }
  }, [prefill, prefillApplied, router]);

  // Poll only while focused and foregrounded to avoid background churn.
  useEffect(() => {
    if (!isFocused || appState !== 'active') return;
    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted) return;
      try {
        let list: Msg[] = [];
        if (conversation_id)
          list = await MessageApi.threadByConversation(String(conversation_id), 100);
        else if (withParam) list = await MessageApi.threadWith(String(withParam), 100);
        list = Array.isArray(list) ? list.slice().reverse() : [];
        if (mounted) {
          setMsgs(list);
        }
      } catch {
        // Silently fail - don't disrupt conversation
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [appState, conversation_id, isFocused, withParam]);

  // Realtime: receive new messages instantly instead of waiting up to 60s for
  // the poll above. The poll stays as a fallback. Stable string id => the
  // socket effect only re-joins when the conversation actually changes.
  const effectiveConvId = useMemo(
    () =>
      conversation_id
        ? String(conversation_id)
        : (msgs.find(m => m.conversation_id)?.conversation_id ?? null),
    [conversation_id, msgs]
  );
  const handleRealtimeMessage = useCallback(
    (incoming: any) => {
      if (!incoming?.id) return;
      // Own messages are handled by the optimistic send() path; skip the echo.
      if (me?.id && String(incoming.sender_id) === String(me.id)) return;
      setMsgs(prev => (prev.some(m => m.id === incoming.id) ? prev : prev.concat(incoming)));
    },
    [me?.id]
  );
  useConversationSocket(effectiveConvId, handleRealtimeMessage);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    if (flatRef.current && msgs.length > 0) {
      scrollTimer = setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [msgs.length]);

  // Scroll list to bottom immediately when keyboard appears so there's no gap
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      flatRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const send = async () => {
    if (sending) return;
    const content = text.trim();
    if (!content) return;
    setSending(true);

    // Block messaging organization accounts
    if (otherParticipant && (otherParticipant as any).account_type === 'organization') {
      Alert.alert('Cannot Message', 'Organization accounts cannot receive direct messages.');
      setSending(false);
      return;
    }

    // Check DM restrictions before sending
    if (me && otherParticipant) {
      const restriction = checkDMRestriction(me, otherParticipant);
      if (!restriction.allowed && restriction.showWarning) {
        setRestrictionModal({
          show: true,
          message: restriction.warningMessage || 'Cannot send message',
        });
        setSending(false);
        return;
      }
    }

    // Optimistic UI: add message immediately with temp id
    const optimisticMsg: Msg = {
      id: `opt-${Date.now()}`,
      content,
      sender_id: me?.id,
      sender: me ? { id: me.id, display_name: me.display_name, avatar_url: me.avatar_url } : null,
      recipient_id: otherParticipant?.id,
      recipient: otherParticipant || null,
      created_at: new Date().toISOString(),
    };
    setMsgs(arr => arr.concat(optimisticMsg));

    try {
      // Determine recipient. If `with` was an email, send by email; if it was an id, send by id.
      let payload: any = { content };
      if (conversation_id) {
        payload.conversation_id = String(conversation_id);
        // Try to infer the other participant id from loaded messages
        const otherId = (() => {
          if (!me) return null;
          const sample =
            msgs.find(m => m.sender_id || m.recipient_id || m.sender || m.recipient) || null;
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
        if (w.includes('@')) payload.recipient_email = w;
        else payload.recipient_id = w;
      }

      const created = await MessageApi.send(payload);
      // Replace optimistic message with real one; clear input only on success
      setMsgs(arr => arr.filter(m => m.id !== optimisticMsg.id).concat(created));
      setText('');
    } catch (err: any) {
      // Remove optimistic message on failure; preserve text so user can retry
      setMsgs(arr => arr.filter(m => m.id !== optimisticMsg.id));
      const code = err?.data?.code as string | undefined;
      const msg =
        code === 'MESSAGE_BLOCKED'
          ? "You can't message this person."
          : code === 'DM_RESTRICTED'
            ? 'This user has restricted their messages.'
            : code === 'USER_BANNED'
              ? 'This account is currently unavailable.'
              : code === 'ORG_ACCOUNT'
                ? "You can't directly message organization accounts."
                : code === 'AGE_POLICY_BLOCKED'
                  ? 'This conversation is not available due to age policy.'
                  : 'Your message could not be sent. Please try again.';
      Alert.alert('Send Failed', msg);
    } finally {
      setSending(false);
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
      return formatUserLabel(otherParticipant, 'User');
    }
    if (withParam) {
      const w = String(withParam);
      if (w.includes('@')) return w;
    }
    return 'Conversation';
  }, [otherParticipant, withParam]);

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const mine = me?.id && String(item.sender_id || item.sender?.id || '') === String(me.id);
    const sender = mine ? me : otherParticipant;

    // Check if we should show avatar (show for first message in a sequence from same sender)
    const prevMsg = index > 0 ? msgs[index - 1] : null;
    const prevMine =
      prevMsg && me?.id && String(prevMsg.sender_id || prevMsg.sender?.id || '') === String(me.id);
    const showAvatar = !mine && (prevMine === true || !prevMsg);

    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        {!mine && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              sender?.avatar_url ? (
                <Image source={{ uri: sender.avatar_url }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: Colors[colorScheme].border },
                  ]}
                >
                  <MaterialIcons name="person" size={16} color={Colors[colorScheme].mutedText} />
                </View>
              )
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
        )}
        <View
          style={[
            styles.bubble,
            mine
              ? styles.bubbleMine
              : [
                  styles.bubbleTheirs,
                  {
                    backgroundColor: Colors[colorScheme].card,
                    borderColor: Colors[colorScheme].border,
                  },
                ],
          ]}
        >
          <Text style={[styles.bubbleText, { color: mine ? '#FFFFFF' : Colors[colorScheme].text }]}>
            {item.content || ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SwipeBackContainer>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
        edges={['bottom']}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <Stack.Screen
              options={{
                headerShown: false,
              }}
            />

            {/* Custom WhatsApp-style header with safe area */}
            <View
              style={[
                styles.customHeader,
                {
                  paddingTop: insets.top + 8,
                  backgroundColor: Colors[colorScheme].card,
                  borderBottomColor: Colors[colorScheme].border,
                },
              ]}
            >
              <Pressable
                onPress={() => safeGoBack(router, explicitFallback)}
                style={styles.backButton}
              >
                <MaterialIcons name="chevron-left" size={28} color={Colors[colorScheme].text} />
              </Pressable>

              <Pressable
                style={styles.headerProfile}
                onPress={() => {
                  if (otherParticipant?.id) {
                    void router.push(`/user-profile?id=${encodeURIComponent(otherParticipant.id)}`);
                  }
                }}
              >
                {otherParticipant?.avatar_url ? (
                  <Image
                    source={{ uri: otherParticipant.avatar_url }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.headerAvatarPlaceholder,
                      { backgroundColor: Colors[colorScheme].border },
                    ]}
                  >
                    <MaterialIcons name="person" size={20} color={Colors[colorScheme].mutedText} />
                  </View>
                )}
                <View style={styles.headerInfo}>
                  <Text
                    style={[styles.headerTitle, { color: Colors[colorScheme].text }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>
                    Tap to view profile
                  </Text>
                </View>
              </Pressable>

              <Pressable onPress={() => setSafetyOpen(true)} style={styles.menuButton}>
                <MaterialIcons name="more-vert" size={22} color={Colors[colorScheme].text} />
              </Pressable>
            </View>

            {/* Chat content */}
            <View style={styles.chatContent}>
              {loading && (
                <View style={styles.center}>
                  <ActivityIndicator color={Colors[colorScheme].tint} />
                </View>
              )}
              {error && !loading && (
                <View style={styles.emptyState}>
                  <MaterialIcons
                    name={error.includes('no longer') ? 'chat-bubble-outline' : 'error-outline'}
                    size={48}
                    color={Colors[colorScheme].mutedText}
                  />
                  <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
                    {error}
                  </Text>
                  <Pressable
                    onPress={() => safeGoBack(router, explicitFallback)}
                    style={{
                      marginTop: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      backgroundColor: Colors[colorScheme].surface,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600' }}
                    >
                      Go Back
                    </Text>
                  </Pressable>
                </View>
              )}
              {!loading && !error && msgs.length === 0 && (
                <View style={styles.emptyState}>
                  <MaterialIcons
                    name="chat-bubble-outline"
                    size={48}
                    color={Colors[colorScheme].mutedText}
                  />
                  <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
                    Start the conversation
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
                    Send a message below to get started
                  </Text>
                </View>
              )}
              {!loading && msgs.length > 0 && (
                <FlatList
                  ref={flatRef}
                  data={msgs}
                  keyExtractor={m => String(m.id)}
                  renderItem={renderItem}
                  contentContainerStyle={styles.messagesList}
                />
              )}
            </View>

            {/* Composer */}
            <View
              style={[
                styles.composer,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderTopColor: Colors[colorScheme].border,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor:
                      colorScheme === 'dark' ? Colors[colorScheme].surface : '#F3F4F6',
                    color: Colors[colorScheme].text,
                  },
                ]}
                placeholder="Message"
                placeholderTextColor={Colors[colorScheme].mutedText}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
              />
              <Pressable
                onPress={send}
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                disabled={!text.trim() || sending}
              >
                <MaterialIcons name="send" size={18} color="white" />
              </Pressable>
            </View>

            {/* Safety menu modal */}
            <Modal
              visible={safetyOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setSafetyOpen(false)}
            >
              <Pressable style={styles.sheetBackdrop} onPress={() => setSafetyOpen(false)}>
                <Pressable
                  style={[styles.sheet, { backgroundColor: Colors[colorScheme].card }]}
                  onPress={() => {}}
                >
                  <Text style={[styles.sheetTitle, { color: Colors[colorScheme].text }]}>
                    Safety & Settings
                  </Text>
                  <Pressable
                    style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]}
                    onPress={() => {
                      setSafetyOpen(false);
                      if (otherParticipant?.id) {
                        void router.push(
                          `/report-abuse?userId=${otherParticipant.id}&userName=${encodeURIComponent(otherParticipant.username ? `@${otherParticipant.username}` : otherParticipant.display_name || otherParticipant.email || 'User')}`
                        );
                      } else {
                        router.push('/report-abuse');
                      }
                    }}
                  >
                    <MaterialIcons name="flag" size={20} color={Colors[colorScheme].text} />
                    <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>
                      Report user
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]}
                    onPress={async () => {
                      setSafetyOpen(false);
                      if (!otherParticipant?.id) return;

                      Alert.alert(
                        'Block User',
                        `Are you sure you want to block ${otherParticipant.username ? `@${otherParticipant.username}` : otherParticipant.display_name || otherParticipant.email || 'this user'}? They will no longer be able to message you.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Block',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                // Call block API
                                await User.block(otherParticipant.id);
                                Alert.alert(
                                  'User Blocked',
                                  'This user can no longer send you messages.'
                                );
                                safeGoBack(router, explicitFallback);
                              } catch (error: any) {
                                Alert.alert('Error', error.message || 'Failed to block user');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <MaterialIcons name="person-remove" size={20} color="#EF4444" />
                    <Text style={[styles.sheetText, { color: '#EF4444' }]}>Block user</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sheetRow, { backgroundColor: Colors[colorScheme].surface }]}
                    onPress={() => {
                      setSafetyOpen(false);
                      void router.push('/dm-restrictions');
                    }}
                  >
                    <MaterialIcons name="tune" size={20} color={Colors[colorScheme].text} />
                    <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>
                      Message restrictions
                    </Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>

            {/* DM Restriction Warning Modal */}
            <Modal
              visible={restrictionModal.show}
              transparent
              animationType="fade"
              onRequestClose={() => setRestrictionModal({ show: false, message: '' })}
            >
              <Pressable
                style={styles.modalBackdrop}
                onPress={() => setRestrictionModal({ show: false, message: '' })}
              >
                <Pressable
                  style={[styles.modalContent, { backgroundColor: Colors[colorScheme].card }]}
                  onPress={() => {}}
                >
                  <View style={styles.modalHeader}>
                    <MaterialIcons name="verified-user" size={48} color="#DC2626" />
                    <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
                      Safe Zone Policy
                    </Text>
                  </View>

                  <Text style={[styles.modalMessage, { color: Colors[colorScheme].mutedText }]}>
                    {restrictionModal.message}
                  </Text>

                  <Pressable
                    style={[styles.modalButton, { backgroundColor: Colors[colorScheme].tint }]}
                    onPress={() => setRestrictionModal({ show: false, message: '' })}
                  >
                    <Text style={styles.modalButtonText}>I Understand</Text>
                  </Pressable>

                  <Pressable
                    style={styles.modalLinkButton}
                    onPress={() => {
                      setRestrictionModal({ show: false, message: '' });
                      router.push('/core-values');
                    }}
                  >
                    <Text style={[styles.modalLinkText, { color: Colors[colorScheme].tint }]}>
                      Learn More About Our Safety Policy
                    </Text>
                  </Pressable>

                  {coachAccess.isCoach && !coachAccess.isApprovedCoach && (
                    <Pressable
                      style={[styles.modalVerifyButton, { borderColor: Colors[colorScheme].tint }]}
                      onPress={() => {
                        setRestrictionModal({ show: false, message: '' });
                        router.push('/help');
                      }}
                    >
                      <MaterialIcons
                        name="verified-user"
                        size={20}
                        color={Colors[colorScheme].tint}
                      />
                      <Text style={[styles.modalVerifyText, { color: Colors[colorScheme].tint }]}>
                        Request Coach Verification
                      </Text>
                    </Pressable>
                  )}
                </Pressable>
              </Pressable>
            </Modal>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
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
    borderWidth: 1,
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
    borderTopWidth: 1,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }),
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalLinkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 8,
  },
  modalVerifyText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default MessageThreadScreen;
