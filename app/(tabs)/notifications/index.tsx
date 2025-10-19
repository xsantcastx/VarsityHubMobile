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

type Notif = {
  id: string;
  type: 'FOLLOW' | 'UPVOTE' | 'COMMENT' | string;
  created_at?: string;
  read_at?: string | null;
  actor?: { id: string; display_name?: string | null; avatar_url?: string | null } | null;
  post?: { id: string; content?: string | null; media_url?: string | null } | null;
  comment?: { id: string; content?: string | null; post_id?: string | null } | null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (cursor?: string | null, append = false) => {
    setLoading(!append && !refreshing);
    try {
      const page = await Notification.listPage(cursor, 20, false);
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => { load(null, false); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(null, false); };
  const onEndReached = () => { if (nextCursor) load(nextCursor, true); };

  const hasUnread = items.some((n) => !n.read_at);
  const onMarkAllRead = async () => {
    if (!hasUnread || markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    // Optimistic
    setItems((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: now }));
    try {
      await Notification.markAllRead();
    } catch {
      // non-fatal; keep optimistic state for now
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
      : 'Notification';
    const onPress = () => {
      if (item.type === 'FOLLOW' && item.actor?.id) {
        router.push(`/user-profile?id=${encodeURIComponent(item.actor.id)}`);
      } else if ((item.type === 'UPVOTE' || item.type === 'COMMENT') && item.post?.id) {
        router.push(`/post-detail?id=${encodeURIComponent(item.post.id)}`);
      }
      // Mark read optimistically
      if (!item.read_at) {
        setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
        Notification.markRead(item.id).catch(() => {});
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
          <Text style={S.title}>{title}</Text>
          {item.post?.content ? <Text numberOfLines={1} style={S.subtitle}>{item.post.content}</Text> : null}
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
          <Pressable onPress={() => router.back()} style={S.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[S.topTitle, { color: Colors[colorScheme].text }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>

      {loading && !refreshing && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListHeaderComponent={hasUnread ? (
            <View style={S.headerRow}>
              <Pressable style={S.markAllBtn} onPress={onMarkAllRead} disabled={markingAll}>
                <Text style={S.markAllText}>{markingAll ? 'Marking…' : 'Mark all as read'}</Text>
              </Pressable>
            </View>
          ) : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.6}
          onEndReached={onEndReached}
          ListEmptyComponent={<View style={{ padding: 24 }}><Text style={{ textAlign: 'center', color: '#6B7280' }}>No notifications</Text></View>}
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
  title: { fontWeight: '700', color: '#111827' },
  subtitle: { color: '#6B7280', marginTop: 2 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  markAllText: { color: '#111827', fontWeight: '700' },
});
