import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Notification } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

type Notif = {
  id: string;
  type: 'FOLLOW' | 'UPVOTE' | 'COMMENT' | string;
  created_at?: string;
  read_at?: string | null;
  actor?: { id: string; display_name?: string | null; avatar_url?: string | null } | null;
  post?: { id: string; content?: string | null; media_url?: string | null } | null;
  comment?: { id: string; content?: string | null; post_id?: string | null } | null;
  message?: { id: string; content?: string | null; conversation_id?: string | null } | null;
  event?: { id: string; title?: string | null } | null;
  meta?: { event_id?: string; event_title?: string } | null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (cursor?: string | null, append = false) => {
    setLoading(!append && !refreshing);
    setError(null);
    try {
      const page = await retryWithBackoff(
        () => Notification.listPage(cursor, 20, false),
        { maxRetries: 2 }
      );
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
      if (__DEV__) console.error('Notifications load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    void load(null, false).catch(() => {});
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load(null, false).catch(() => {});
  };
  const onEndReached = () => {
    if (nextCursor) {
      void load(nextCursor, true).catch(() => {});
    }
  };

  const hasUnread = items.some((n) => !n.read_at);
  const onMarkAllRead = async () => {
    if (!hasUnread || markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    const previousItems = items;
    const updatedItems = items.map((n) => (n.read_at ? n : { ...n, read_at: now }));
    setItems(updatedItems);
    try {
      await Notification.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
      setItems(previousItems);
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = ({ item }: { item: Notif }) => {
    const title = item.type === 'FOLLOW'
      ? `${item.actor?.display_name || 'Someone'} followed you`
      : item.type === 'UPVOTE'
      ? `${item.actor?.display_name || 'Someone'} upvoted your post`
      : item.type === 'COMMENT'
      ? `${item.actor?.display_name || 'Someone'} commented on your post`
      : item.type === 'MESSAGE'
      ? `${item.actor?.display_name || 'Someone'} sent you a message`
      : item.type === 'TEAM_INVITE'
      ? `${item.actor?.display_name || 'Someone'} invited you to a team`
      : item.type === 'MENTION'
      ? `${item.actor?.display_name || 'Someone'} mentioned you`
      : item.type === 'COMMENT_REPLY'
      ? `${item.actor?.display_name || 'Someone'} replied to your comment`
      : item.type === 'SHARE'
      ? `${item.actor?.display_name || 'Someone'} shared your post`
      : item.type === 'GAME_REMINDER'
      ? `Game reminder: ${(item.event?.title || item.meta?.event_title) || 'Your game'}`
      : 'Notification';
    const onPress = () => {
      if (item.type === 'FOLLOW' && item.actor?.id) {
        router.push(`/user-profile?id=${encodeURIComponent(item.actor.id)}`);
      } else if ((item.type === 'UPVOTE' || item.type === 'COMMENT' || item.type === 'MENTION' || item.type === 'COMMENT_REPLY' || item.type === 'SHARE') && item.post?.id) {
        const q = (item.type === 'MENTION' || item.type === 'COMMENT_REPLY') && item.comment?.id
          ? `?id=${encodeURIComponent(item.post.id)}&commentId=${encodeURIComponent(item.comment.id)}`
          : `?id=${encodeURIComponent(item.post.id)}`;
        router.push(`/post-detail${q}` as any);
      } else if (item.type === 'MESSAGE' && item.message?.conversation_id) {
        router.push(`/message-thread?conversation_id=${encodeURIComponent(item.message.conversation_id)}`);
      } else if (item.type === 'TEAM_INVITE') {
        router.push('/team-invites');
      } else if (item.type === 'GAME_REMINDER' && (item.event?.id || item.meta?.event_id)) {
        router.push(`/event-detail?id=${encodeURIComponent(item.event?.id || item.meta?.event_id || '')}`);
      }
      // Mark read optimistically
      if (!item.read_at) {
        const previousItems = items;
        const now = new Date().toISOString();
        const updated = items.map((n) => (n.id === item.id ? { ...n, read_at: now } : n));
        setItems(updated);
        Notification.markRead(item.id).catch((err) => {
          console.error('Failed to mark notification as read', err);
          setItems(previousItems);
        });
      }
    };
    return (
      <Pressable style={[S.row, !item.read_at && S.rowUnread]} onPress={onPress}>
        <View style={S.avatarWrap}>
          {item.actor?.avatar_url ? (
            <Image source={{ uri: item.actor.avatar_url }} style={S.avatar} />
          ) : (
            <View style={[S.avatar, { backgroundColor: '#E5E7EB' }]} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.title, { color: Colors[colorScheme].text }]}>{title}</Text>
          {item.post?.content ? (
            <Text numberOfLines={1} style={[S.subtitle, { color: Colors[colorScheme].mutedText }]}>{item.post.content}</Text>
          ) : item.message?.content ? (
            <Text numberOfLines={1} style={[S.subtitle, { color: Colors[colorScheme].mutedText }]}>{item.message.content}</Text>
          ) : item.type === 'GAME_REMINDER' && (item.event?.title || item.meta?.event_title) ? (
            <Text numberOfLines={1} style={[S.subtitle, { color: Colors[colorScheme].mutedText }]}>{item.event?.title || item.meta?.event_title}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[S.container, { backgroundColor: Colors[colorScheme].background }]}>
      {/* Enhanced header with gradient and safe area */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
        style={[S.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={S.headerRow}>
          <Pressable onPress={() => void router.back()} style={S.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[S.topTitle, { color: Colors[colorScheme].text }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>

      {loading && !refreshing && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator /></View>
      ) : error && items.length === 0 ? (
        <View style={S.center}>
          <Text style={{ color: Colors[colorScheme].destructive, marginBottom: 12 }}>{error}</Text>
          <Pressable style={[S.retryButton, { backgroundColor: Colors[colorScheme].tint }]} onPress={() => void load(null, false).catch(() => {})}>
            <Text style={S.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListHeaderComponent={hasUnread ? (
            <View style={S.headerRow}>
              <Pressable style={S.markAllBtn} onPress={onMarkAllRead} disabled={markingAll}>
                <Text style={[S.markAllText, { color: Colors[colorScheme].text }]}>{markingAll ? 'Marking…' : 'Mark all as read'}</Text>
              </Pressable>
            </View>
          ) : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.6}
          onEndReached={onEndReached}
          ListEmptyComponent={
            <View style={S.emptyContainer}>
              <Ionicons name="notifications-outline" size={56} color={Colors[colorScheme ?? 'light'].mutedText} />
              <Text style={[S.emptyTitle, { color: Colors[colorScheme ?? 'light'].text }]}>All caught up!</Text>
              <Text style={[S.emptySubtitle, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                You'll see notifications for follows, upvotes, and comments here.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  topTitle: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rowUnread: { backgroundColor: '#F9FAFB' },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  title: { fontWeight: '700', color: 'transparent' }, // Will be overridden with Colors[colorScheme].text
  subtitle: { color: 'transparent', marginTop: 2 }, // Will be overridden with Colors[colorScheme].mutedText
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  markAllText: { color: 'transparent', fontWeight: '700' }, // Will be overridden with Colors[colorScheme].text
  retryButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#3B82F6' },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
