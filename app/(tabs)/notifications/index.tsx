import { useAuth } from '@/context/AuthProvider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { safeGoBack } from '@/utils/navigation';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Notification, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

type Notif = {
  id: string;
  type: 'FOLLOW' | 'UPVOTE' | 'COMMENT' | string;
  created_at?: string;
  read_at?: string | null;
  actor?: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
  post?: { id: string; content?: string | null; media_url?: string | null } | null;
  comment?: { id: string; content?: string | null; post_id?: string | null } | null;
  message?: { id: string; content?: string | null; conversation_id?: string | null } | null;
  event?: { id: string; title?: string | null } | null;
  meta?: { event_id?: string; event_title?: string; [key: string]: any } | null;
};

export default function NotificationsScreen() {
  const { user: _user } = useAuth();
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
      if (__DEV__) console.error('Failed to mark all notifications as read', err);
      setItems(previousItems);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleFollowRequest = async (actorId: string, action: 'accept' | 'reject', notifId: string) => {
    const previousItems = items;
    // Optimistically remove the notification
    setItems((prev) => prev.filter((n) => n.id !== notifId));
    try {
      if (action === 'accept') {
        await User.acceptFollow(actorId);
      } else {
        await User.rejectFollow(actorId);
      }
    } catch (err) {
      if (__DEV__) console.error('Failed to handle follow request', err);
      setItems(previousItems);
    }
  };

  const renderItem = ({ item }: { item: Notif }) => {
    const actorName = item.actor?.username ? `@${item.actor.username}` : (item.actor?.display_name || 'Someone');
    const title = item.type === 'FOLLOW'
      ? `${actorName} followed you`
      : item.type === 'FOLLOW_REQUEST'
      ? `${actorName} requested to follow you`
      : item.type === 'UPVOTE'
      ? `${actorName} upvoted your post`
      : item.type === 'COMMENT'
      ? `${actorName} commented on your post`
      : item.type === 'MESSAGE'
      ? `${actorName} sent you a message`
      : item.type === 'TEAM_INVITE' && item.meta?.coach_approved
      ? `${item.meta?.organization_name || 'A league'} approved your coach application`
      : item.type === 'TEAM_INVITE' && item.meta?.coach_request
      ? `${item.meta?.coach_name || actorName} wants to join ${item.meta?.organization_name || 'your league'}`
      : item.type === 'TEAM_INVITE'
      ? `${actorName} invited you to a team`
      : item.type === 'MENTION'
      ? `${actorName} mentioned you`
      : item.type === 'COMMENT_REPLY'
      ? `${actorName} replied to your comment`
      : item.type === 'SHARE'
      ? `${actorName} shared your post`
      : item.type === 'GAME_REMINDER'
      ? `Game reminder: ${(item.event?.title || item.meta?.event_title) || 'Your game'}`
      : item.type === 'AD_APPROVED'
      ? `Your ad${item.meta?.business_name ? ` for "${item.meta.business_name}"` : ''} has been approved! Tap to complete payment.`
      : item.type === 'AD_REJECTED'
      ? `Your ad${item.meta?.business_name ? ` for "${item.meta.business_name}"` : ''} needs changes.${item.meta?.reason ? ` ${item.meta.reason}` : ' Please review and resubmit.'}`
      : item.type === 'ORG_APPROVED'
      ? `Your organization${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} has been approved!`
      : item.type === 'JOIN_REQUEST_APPROVED'
      ? `Your request to join${item.meta?.organization_name ? ` "${item.meta.organization_name}"` : ''} was approved!`
      : item.type === 'EVENT_APPROVED'
      ? `Your event${item.meta?.event_title ? ` "${item.meta.event_title}"` : ''} has been approved!`
      : item.type === 'EVENT_REJECTED'
      ? `Your event${item.meta?.event_title ? ` "${item.meta.event_title}"` : ''} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`
      : item.type === 'COACH_REJECTED'
      ? `Your application to join ${item.meta?.organization_name || 'the league'} was not approved.${item.meta?.reason ? ` ${item.meta.reason}` : ''}`
      : 'Notification';
    const onPress = () => {
      if ((item.type === 'FOLLOW' || item.type === 'FOLLOW_REQUEST') && item.actor?.id) {
        router.push(`/user-profile?id=${encodeURIComponent(item.actor.id)}` as any);
      } else if ((item.type === 'UPVOTE' || item.type === 'COMMENT' || item.type === 'MENTION' || item.type === 'COMMENT_REPLY' || item.type === 'SHARE') && item.post?.id) {
        const q = (item.type === 'MENTION' || item.type === 'COMMENT_REPLY') && item.comment?.id
          ? `?id=${encodeURIComponent(item.post.id)}&commentId=${encodeURIComponent(item.comment.id)}`
          : `?id=${encodeURIComponent(item.post.id)}`;
        router.push(`/post-detail${q}` as any);
      } else if (item.type === 'MESSAGE' && item.message?.conversation_id) {
        router.push(`/message-thread?conversation_id=${encodeURIComponent(item.message.conversation_id)}` as any);
      } else if (item.type === 'TEAM_INVITE' && item.meta?.coach_request) {
        router.push('/approvals' as any);
      } else if (item.type === 'TEAM_INVITE' && item.meta?.coach_approved) {
        router.push('/(tabs)/create-team' as any);
      } else if (item.type === 'TEAM_INVITE') {
        router.push('/team-invites');
      } else if (item.type === 'GAME_REMINDER' && (item.event?.id || item.meta?.event_id)) {
        router.push(`/event-detail?id=${encodeURIComponent(item.event?.id || item.meta?.event_id || '')}` as any);
      } else if (item.type === 'AD_APPROVED' && item.meta?.ad_id) {
        router.push(`/ad-calendar?adId=${encodeURIComponent(item.meta.ad_id)}` as any);
      } else if (item.type === 'AD_REJECTED' && item.meta?.ad_id) {
        router.push(`/ad-calendar?adId=${encodeURIComponent(item.meta.ad_id)}` as any);
      } else if (item.type === 'ORG_APPROVED') {
        const oid = item.meta?.organization_id;
        router.push(oid ? { pathname: '/(tabs)/organization', params: { id: oid } } as any : '/(tabs)' as any);
      } else if (item.type === 'JOIN_REQUEST_APPROVED') {
        const oid = item.meta?.organization_id;
        router.push(oid ? { pathname: '/(tabs)/organization', params: { id: oid } } as any : '/(tabs)' as any);
      } else if ((item.type === 'EVENT_APPROVED' || item.type === 'EVENT_REJECTED') && item.meta?.event_id) {
        router.push(`/event-detail?id=${encodeURIComponent(item.meta.event_id)}` as any);
      } else if (item.type === 'COACH_REJECTED') {
        router.push('/(tabs)' as any);
      }
      // Mark read optimistically
      if (!item.read_at) {
        const previousItems = items;
        const now = new Date().toISOString();
        const updated = items.map((n) => (n.id === item.id ? { ...n, read_at: now } : n));
        setItems(updated);
        Notification.markRead(item.id).catch((err) => {
          if (__DEV__) console.error('Failed to mark notification as read', err);
          setItems(previousItems);
        });
      }
    };
    const theme = Colors[colorScheme];
    return (
      <Pressable style={[S.row, { borderBottomColor: theme.border }, !item.read_at && { backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.08)' : '#F0F5FF' }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}${!item.read_at ? ', unread' : ''}`}>
        <View style={S.avatarWrap}>
          {/* Always render fallback as base layer */}
          <View style={[S.avatar, S.avatarFallback, { backgroundColor: theme.border }]}>
            <MaterialIcons name="person" size={20} color={theme.mutedText} />
          </View>
          {/* System notifications (no sender) show VarsityHub logo */}
          {(!item.actor || ['GAME_REMINDER', 'ORG_APPROVED', 'AD_APPROVED', 'AD_REJECTED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'COACH_REJECTED', 'JOIN_REQUEST_APPROVED'].includes(item.type)) && ['GAME_REMINDER', 'ORG_APPROVED', 'AD_APPROVED', 'AD_REJECTED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'COACH_REJECTED', 'JOIN_REQUEST_APPROVED'].includes(item.type) ? (
            <Image source={{ uri: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_ai2j8k.png' }} style={[S.avatar, S.avatarOverlay]} contentFit="cover" accessibilityLabel="VarsityHub" />
          ) : item.actor?.avatar_url ? (
            <Image source={{ uri: item.actor.avatar_url }} style={[S.avatar, S.avatarOverlay]} contentFit="cover" accessibilityLabel={`${actorName} avatar`} />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.title, { color: Colors[colorScheme].text }]}>{title}</Text>
          {item.type === 'FOLLOW_REQUEST' && item.actor?.id ? (
            <View style={S.followRequestActions}>
              <Pressable style={[S.followBtn, { backgroundColor: Colors[colorScheme].tint }]} onPress={() => handleFollowRequest(item.actor!.id, 'accept', item.id)} accessibilityRole="button" accessibilityLabel="Accept follow request">
                <Text style={S.followBtnText}>Accept</Text>
              </Pressable>
              <Pressable style={[S.followBtn, { backgroundColor: theme.border }]} onPress={() => handleFollowRequest(item.actor!.id, 'reject', item.id)} accessibilityRole="button" accessibilityLabel="Decline follow request">
                <Text style={[S.followBtnText, { color: Colors[colorScheme].text }]}>Decline</Text>
              </Pressable>
            </View>
          ) : item.post?.content ? (
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
          <Pressable onPress={() => safeGoBack(router)} style={S.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialIcons name="chevron-left" size={24} color={Colors[colorScheme].text} />
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
          <Pressable style={[S.retryButton, { backgroundColor: Colors[colorScheme].tint }]} onPress={() => void load(null, false).catch(() => {})} accessibilityRole="button" accessibilityLabel="Retry loading notifications">
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
              <Pressable style={[S.markAllBtn, { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6' }]} onPress={onMarkAllRead} disabled={markingAll} accessibilityRole="button" accessibilityLabel={markingAll ? 'Marking all as read' : 'Mark all as read'}>
                <Text style={[S.markAllText, { color: Colors[colorScheme].text }]}>{markingAll ? 'Marking…' : 'Mark all as read'}</Text>
              </Pressable>
            </View>
          ) : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.6}
          onEndReached={onEndReached}
          ListEmptyComponent={
            <View style={S.emptyContainer}>
              <MaterialIcons name="notifications-none" size={56} color={Colors[colorScheme ?? 'light'].mutedText} />
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
    borderBottomWidth: 1,
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarOverlay: { position: 'absolute', top: 0, left: 0 },
  title: { fontWeight: '700', color: 'transparent' }, // Will be overridden with Colors[colorScheme].text
  subtitle: { color: 'transparent', marginTop: 2 }, // Will be overridden with Colors[colorScheme].mutedText
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB' },
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
  followRequestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  followBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
