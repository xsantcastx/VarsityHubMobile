import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Notification } from '@/api/entities';

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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={S.topBar}>
        <Pressable onPress={() => router.back()} style={S.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={S.backBtnText}>Back</Text>
        </Pressable>
        <Text style={S.topTitle}>Alerts</Text>
        <View style={{ width: 60 }} />
      </View>

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
  );
}

const S = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rowUnread: { backgroundColor: '#F9FAFB' },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  title: { fontWeight: '700', color: '#111827' },
  subtitle: { color: '#6B7280', marginTop: 2 },
  headerRow: { paddingHorizontal: 16, paddingBottom: 6, alignItems: 'flex-end' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  markAllText: { color: '#111827', fontWeight: '700' },
  topBar: { height: 50, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  topTitle: { fontWeight: '800', fontSize: 16, color: '#111827' },
  backBtn: { width: 60, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  backBtnText: { color: '#111827', fontWeight: '700' },
});
