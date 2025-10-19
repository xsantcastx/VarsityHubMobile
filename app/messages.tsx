import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Message, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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
  created_at: string;
  sender?: MiniUser | null;
  recipient?: MiniUser | null;
  read?: boolean;
};

type Conversation = {
  id: string;
  other: MiniUser;
  lastMessage: UIMsg;
  unreadCount: number;
  messages: UIMsg[];
};

export default function MessagesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MiniUser | null>(null);
  const [messages, setMessages] = useState<UIMsg[]>([]);
  const [query, setQuery] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MiniUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const u = await User.me();
        setMe(u);
      } catch {}

      const result: UIMsg[] | { _isNotModified: boolean } = await (Message.list
        ? Message.list('-created_at', 50)
        : Message.filter({}, '-created_at'));

      if (result && !('_isNotModified' in result)) {
        setMessages(Array.isArray(result) ? result : []);
      }
    } catch (e: any) {
      console.error('Failed to load messages', e);
      setError('Unable to load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload when screen comes into focus (after returning from a thread)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Group messages into conversations
  const conversations = useMemo((): Conversation[] => {
    if (!me) return [];
    
    const convMap = new Map<string, Conversation>();
    
    messages.forEach(msg => {
      const mine = msg.sender_id === me.id;
      const other = mine ? msg.recipient : msg.sender;
      
      if (!other || !other.id) return;
      
      // Use conversation_id or create key from other user's id
      const convKey = msg.conversation_id || `user-${other.id}`;
      
      if (!convMap.has(convKey)) {
        convMap.set(convKey, {
          id: convKey,
          other,
          lastMessage: msg,
          unreadCount: (!mine && !msg.read) ? 1 : 0,
          messages: [msg],
        });
      } else {
        const conv = convMap.get(convKey)!;
        conv.messages.push(msg);
        if (!mine && !msg.read) {
          conv.unreadCount++;
        }
        // Update last message if this one is newer
        if (new Date(msg.created_at) > new Date(conv.lastMessage.created_at)) {
          conv.lastMessage = msg;
        }
      }
    });
    
    // Sort by last message date
    return Array.from(convMap.values()).sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, me]);

  // Filter conversations by search query
  const filtered = useMemo(() => {
    if (!query) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(conv => {
      const text = (conv.lastMessage.content ?? '').toLowerCase();
      const name = (conv.other.display_name ?? '').toLowerCase();
      const email = (conv.other.email ?? '').toLowerCase();
      return text.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [conversations, query]);

  // Search users for compose
  useEffect(() => {
    if (!searchUserQuery || searchUserQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    let mounted = true;
    const search = async () => {
      setSearchingUsers(true);
      try {
        const users = await User.listAll(searchUserQuery, 20);
        if (mounted && Array.isArray(users)) {
          // Filter out current user
          setSearchResults(users.filter((u: MiniUser) => u.id !== me?.id));
        }
      } catch (e) {
        console.error('User search failed', e);
      } finally {
        if (mounted) setSearchingUsers(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchUserQuery, me]);

  const openThread = (conv: Conversation) => {
    if (conv.lastMessage.conversation_id) {
      router.push(`/message-thread?conversation_id=${encodeURIComponent(String(conv.lastMessage.conversation_id))}`);
    } else {
      router.push(`/message-thread?with=${encodeURIComponent(conv.other.id)}`);
    }
  };

  const startConversation = (user: MiniUser) => {
    setComposeOpen(false);
    setSearchUserQuery('');
    setSearchResults([]);
    router.push(`/message-thread?with=${encodeURIComponent(user.id)}`);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const name = item.other.display_name || item.other.email || 'Unknown User';
    const avatar = item.other.avatar_url;
    const hasUnread = item.unreadCount > 0;

    return (
      <Pressable 
        style={[
          styles.conversationRow, 
          hasUnread && styles.conversationUnread,
          { borderBottomColor: Colors[colorScheme].border }
        ]} 
        onPress={() => openThread(item)}
      >
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme].tint }]}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.conversationName, 
                { color: Colors[colorScheme].text },
                hasUnread && styles.conversationNameBold
              ]} 
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={[styles.conversationTime, { color: Colors[colorScheme].tabIconDefault }]}>
              {formatTime(item.lastMessage.created_at)}
            </Text>
          </View>
          
          <View style={styles.messagePreviewRow}>
            <Text 
              style={[
                styles.messagePreview, 
                { color: Colors[colorScheme].tabIconDefault },
                hasUnread && styles.messagePreviewBold
              ]} 
              numberOfLines={2}
            >
              {item.lastMessage.content || 'No message content'}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderUserSearchItem = ({ item }: { item: MiniUser }) => {
    const name = item.display_name || item.email || 'Unknown User';
    const avatar = item.avatar_url;

    return (
      <Pressable 
        style={[styles.userSearchRow, { borderBottomColor: Colors[colorScheme].border }]} 
        onPress={() => startConversation(item)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.userSearchName, { color: Colors[colorScheme].text }]}>{name}</Text>
          {item.email && (
            <Text style={[styles.userSearchEmail, { color: Colors[colorScheme].tabIconDefault }]}>
              {item.email}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].tabIconDefault} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Enhanced header with gradient and safe area */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
        style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Messages</Text>
          <Pressable onPress={() => setSafetyOpen(true)} style={styles.iconButton} accessibilityLabel="Safety">
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors[colorScheme].text} />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name="search" size={20} color={Colors[colorScheme].tabIconDefault} />
          <TextInput
            placeholder="Search conversations..."
            placeholderTextColor={Colors[colorScheme].tabIconDefault}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: Colors[colorScheme].text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors[colorScheme].tabIconDefault} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>
        {loading && <View style={styles.center}><ActivityIndicator /></View>}
        {error && !loading && <Text style={styles.error}>{error}</Text>}
        
        {!loading && filtered.length === 0 && !error && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors[colorScheme].tabIconDefault} />
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
              {query ? 'No conversations found' : 'No messages yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
              {query ? 'Try a different search term' : 'Start a conversation to get connected'}
            </Text>
            {!query && (
              <Pressable 
                style={[styles.emptyButton, { backgroundColor: Colors[colorScheme].tint }]} 
                onPress={() => setComposeOpen(true)}
              >
                <Text style={styles.emptyButtonText}>Start Messaging</Text>
              </Pressable>
            )}
          </View>
        )}

        {!loading && filtered.length > 0 && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            contentContainerStyle={{ paddingBottom: 80 }}
          />
        )}
      </View>

      {/* Floating compose button */}
      {!loading && (
        <Pressable 
          style={[styles.fab, { backgroundColor: Colors[colorScheme].tint, bottom: insets.bottom + 16 }]} 
          onPress={() => setComposeOpen(true)}
        >
          <Ionicons name="create-outline" size={24} color="white" />
        </Pressable>
      )}

      {/* Compose Modal */}
      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.composeModal, { backgroundColor: Colors[colorScheme].background, paddingTop: insets.top + 16 }]}>
            <View style={styles.composeHeader}>
              <Pressable onPress={() => setComposeOpen(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
              </Pressable>
              <Text style={[styles.composeTitle, { color: Colors[colorScheme].text }]}>New Message</Text>
              <View style={{ width: 28 }} />
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', marginHorizontal: 16, marginBottom: 8 }]}>
              <Ionicons name="search" size={20} color={Colors[colorScheme].tabIconDefault} />
              <TextInput
                placeholder="Search users by name or email..."
                placeholderTextColor={Colors[colorScheme].tabIconDefault}
                value={searchUserQuery}
                onChangeText={setSearchUserQuery}
                style={[styles.searchInput, { color: Colors[colorScheme].text }]}
                autoFocus
              />
              {searchUserQuery.length > 0 && (
                <Pressable onPress={() => setSearchUserQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Colors[colorScheme].tabIconDefault} />
                </Pressable>
              )}
            </View>

            {searchingUsers && (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            )}

            {!searchingUsers && searchUserQuery.length >= 2 && searchResults.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors[colorScheme].tabIconDefault} />
                <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text, fontSize: 16 }]}>
                  No users found
                </Text>
              </View>
            )}

            {!searchingUsers && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderUserSearchItem}
              />
            )}

            {searchUserQuery.length < 2 && (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={48} color={Colors[colorScheme].tabIconDefault} />
                <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text, fontSize: 16 }]}>
                  Search for someone
                </Text>
                <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
                  Type a name or email to find users
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Safety sheet */}
      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSafetyOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: Colors[colorScheme].background }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: Colors[colorScheme].text }]}>Safety</Text>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/report-abuse'); }}>
              <Ionicons name="flag-outline" size={18} color={Colors[colorScheme].text} />
              <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Report a message</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/blocked-users'); }}>
              <Ionicons name="person-remove-outline" size={18} color={Colors[colorScheme].text} />
              <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Blocked users</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/dm-restrictions'); }}>
              <Ionicons name="options-outline" size={18} color={Colors[colorScheme].text} />
              <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>DM restrictions</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={() => { setSafetyOpen(false); router.push('/settings'); }}>
              <Ionicons name="settings-outline" size={18} color={Colors[colorScheme].text} />
              <Text style={[styles.sheetText, { color: Colors[colorScheme].text }]}>Privacy & settings</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  contentContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  center: { paddingVertical: 32, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8, paddingHorizontal: 16 },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conversationUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: 'white',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conversationNameBold: {
    fontWeight: '700',
  },
  conversationTime: {
    fontSize: 13,
    marginLeft: 8,
  },
  messagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messagePreview: {
    fontSize: 14,
    flex: 1,
  },
  messagePreviewBold: {
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  composeModal: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 50,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  userSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userSearchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userSearchEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sheetText: { fontWeight: '700' },
});
