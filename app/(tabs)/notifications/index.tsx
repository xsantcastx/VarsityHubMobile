import { useAuth } from '@/context/AuthProvider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { safeGoBack } from '@/utils/navigation';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Notification, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  getNotificationActorLabel,
  getNotificationHref,
  getNotificationSubtitle,
  getNotificationTitle,
  isSystemNotification,
} from '@/utils/notificationPresentation';
import { clearNotificationBadge, syncNotificationBadge } from '@/utils/pushNotifications';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

const VARSITYHUB_LOGO = require('../../../assets/images/logo.png');

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

function NotificationsScreen() {
  const { user: _user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
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
    // Sync the app icon badge with server state on screen mount so the
    // count reflects reality when the user opens this tab. Best-effort;
    // failures are swallowed inside the helper.
    void syncNotificationBadge();
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
      // Clear the badge immediately — the server side is now at zero unread,
      // but /notifications/unread-count may take a moment to propagate via
      // cache, so zero-on-click gives the correct UX without round-tripping.
      void clearNotificationBadge();
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
    const actorName = getNotificationActorLabel(item);
    const title = getNotificationTitle(item);
    const subtitle = getNotificationSubtitle(item);
    const onPress = () => {
      const href = getNotificationHref(item);
      if (href) {
        router.push(href as any);
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
    return (
      <Pressable
        style={[
          S.row,
          { borderBottomColor: theme.border },
          !item.read_at && {
            backgroundColor:
              colorScheme === 'dark' ? 'rgba(96,165,250,0.12)' : 'rgba(10,126,164,0.08)',
          },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}${!item.read_at ? ', unread' : ''}`}
      >
        <View style={S.avatarWrap}>
          {/* Always render fallback as base layer */}
          <View style={[S.avatar, S.avatarFallback, { backgroundColor: theme.border }]}>
            <MaterialIcons name="person" size={20} color={theme.mutedText} />
          </View>
          {/* System notifications (no sender) show VarsityHub logo */}
          {(isSystemNotification(item) || !item.actor) ? (
            <Image source={VARSITYHUB_LOGO} style={[S.avatar, S.avatarOverlay]} contentFit="cover" accessibilityLabel="VarsityHub" />
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
          ) : subtitle ? (
            <Text numberOfLines={1} style={[S.subtitle, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[S.container, { backgroundColor: theme.background }]}>
      {/* Enhanced header with gradient and safe area */}
      <LinearGradient
        colors={colorScheme === 'dark' ? [theme.card, theme.background] : [theme.card, theme.surface]}
        style={[S.headerGradient, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}
      >
        <View style={S.headerRow}>
          <Pressable onPress={() => safeGoBack(router)} style={S.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialIcons name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <Text style={[S.topTitle, { color: theme.text }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>

      {loading && !refreshing && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator /></View>
      ) : error && items.length === 0 ? (
        <View style={S.center}>
          <Text style={{ color: theme.destructive, marginBottom: 12 }}>{error}</Text>
          <Pressable
            style={[S.retryButton, { backgroundColor: theme.tint }]}
            onPress={() => void load(null, false).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Retry loading notifications"
          >
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
              <Pressable
                style={[
                  S.markAllBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                onPress={onMarkAllRead}
                disabled={markingAll}
                accessibilityRole="button"
                accessibilityLabel={markingAll ? 'Marking all as read' : 'Mark all as read'}
              >
                <Text style={[S.markAllText, { color: theme.text }]}>
                  {markingAll ? 'Marking…' : 'Mark all as read'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.6}
          onEndReached={onEndReached}
          ListEmptyComponent={
            <View style={S.emptyContainer}>
              <MaterialIcons name="notifications-none" size={56} color={theme.mutedText} />
              <Text style={[S.emptyTitle, { color: theme.text }]}>All caught up!</Text>
              <Text style={[S.emptySubtitle, { color: theme.mutedText }]}>
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
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }),
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

export default NotificationsScreen;
