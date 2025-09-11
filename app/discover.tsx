import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore SDK provides JS exports
import { User, Event, Post } from '@/api/entities';
import { format, isFuture } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type RawEvent = { id: string | number; title?: string; date?: string; location?: string; event_type?: string; attendees?: any[]; capacity?: number };
type RawPost = { id: string | number; title?: string; content?: string; type?: string; media_url?: string; upvotes?: any[]; game_id?: string | number };

export default function DiscoverScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const currentUser = await User.me();
        if (!mounted) return;
        setUser(currentUser);

        const allEvents: RawEvent[] = await Event.filter({ status: 'approved' }, 'date');
        const futureEvents = (allEvents || []).filter(e => (e?.date ? isFuture(new Date(String(e.date))) : false)).slice(0, 10);
        if (!mounted) return;
        setEvents(futureEvents);

        const listPosts: RawPost[] = await Post.list('-created_date', 20);
        if (!mounted) return;
        setPosts(Array.isArray(listPosts) ? listPosts : []);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Discover load failed', e);
        setError('Failed to load discover data');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filteredEvents = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(e => (e.title || '').toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q));
  }, [events, search]);

  const filteredPosts = useMemo(() => {
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter(p => (p.content || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q));
  }, [posts, search]);

  const goEvent = (id: string | number | undefined) => {
    if (id == null) return;
    router.push(`/event-detail?id=${id}`);
  };

  const goGame = (id: string | number | undefined) => {
    if (id == null) return;
    router.push(`/game-detail?id=${id}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Discover' }} />
      <Text style={styles.title}>Discover</Text>
      <Input
        placeholder="Search events, teams, or players..."
        value={search}
        onChangeText={setSearch}
        style={{ marginBottom: 12 }}
      />

      {loading && (
        <View style={styles.center}><ActivityIndicator /></View>
      )}
      {error && !loading && <Text style={styles.error}>{error}</Text>}

      {!loading && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next Events</Text>
            <Badge>{`${filteredEvents.length} upcoming`}</Badge>
          </View>
          {filteredEvents.length === 0 ? (
            <Card style={{ marginBottom: 16 }}>
              <CardContent>
                <Text style={styles.muted}>No upcoming events</Text>
                <Text style={styles.mutedSmall}>Follow teams or check back later</Text>
              </CardContent>
            </Card>
          ) : (
            <FlatList
              data={filteredEvents}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable style={styles.eventCard} onPress={() => goEvent(item.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{item.title || 'Event'}</Text>
                    <Text style={styles.eventMeta}>{item.location || 'TBD'}</Text>
                    {item.date ? (
                      <Text style={styles.eventMeta}>{format(new Date(String(item.date)), 'MMM d, h:mm a')}</Text>
                    ) : null}
                  </View>
                  {item.capacity ? (
                    <Badge style={{ alignSelf: 'flex-start' }}>
                      {(item.attendees?.length || 0) + ' / ' + item.capacity}
                    </Badge>
                  ) : null}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          )}

          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>Following</Text>
            <Badge>{`${filteredPosts.length} posts`}</Badge>
          </View>
          {filteredPosts.length === 0 ? (
            <Card>
              <CardContent>
                <Text style={styles.muted}>No posts from people you follow</Text>
                <Text style={styles.mutedSmall}>Follow teams and players to see posts here</Text>
              </CardContent>
            </Card>
          ) : (
            <FlatList
              data={filteredPosts}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable style={styles.postCard} onPress={() => goGame(item.game_id)}>
                  {item.media_url ? (
                    <View style={{ marginBottom: 8 }}>
                      <Image
                        source={{ uri: String(item.media_url) }}
                        style={styles.postImage}
                        contentFit="cover"
                        transition={100}
                      />
                    </View>
                  ) : null}
                  {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
                  {item.content ? (
                    <Text style={styles.postContent} numberOfLines={item.media_url ? 2 : 4}>{item.content}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Badge>{(item.type || 'post').replace('_', ' ')}</Badge>
                    {item.upvotes?.length ? <Text style={styles.mutedSmall}>^ {item.upvotes.length}</Text> : null}
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  mutedSmall: { color: '#9CA3AF', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', borderRadius: 12 },
  eventTitle: { fontWeight: '700', marginBottom: 2 },
  eventMeta: { color: '#6b7280' },
  postCard: { padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB' },
  postTitle: { fontWeight: '700', marginBottom: 6 },
  postContent: { color: '#111827' },
  postImage: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#E5E7EB' },
});




