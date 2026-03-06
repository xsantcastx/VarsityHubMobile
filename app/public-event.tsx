import MasonryGrid from '@/components/MasonryGrid';
import MasonryPostCard from '@/components/MasonryPostCard';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Event, Post } from '@/api/entities';
import settings from '@/api/settings';

export default function PublicEventScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<any>(null);

  const loadEventData = useCallback(async () => {
    setLoading(true);
    try {
      const eventId = params.id!;
      const isSampleEvent = /^sample-/i.test(eventId);
      if (__DEV__) console.warn('[public-event] loadEventData called | eventId:', eventId, '| isSampleEvent:', isSampleEvent);

      // For sample events, try to load posts by game_id (since sample events don't exist in DB)
      // For real events, try both event_id and game_id
      let eventPosts: any[] | null = null;

      if (isSampleEvent) {
        // Sample events: fetch posts by game_id (which matches the event ID for samples)
        // NOTE: Server should store sample event game_id and query it correctly
        let serverPostsLoaded = false;
        try {
          if (__DEV__) console.warn('[public-event] Fetching sample event posts with game_id:', eventId);
          const gamePosts = await Post.feedForGame(eventId, { limit: 50, sort: 'trending' }).catch((err: any) => {
            if (__DEV__) console.warn('[public-event] feedForGame error:', err?.message);
            return null;
          });
          if (__DEV__) console.warn('[public-event] feedForGame response: items=', Array.isArray(gamePosts?.items) ? gamePosts.items.length : 'n/a');
          if (gamePosts && Array.isArray(gamePosts.items)) {
            eventPosts = gamePosts.items;
            serverPostsLoaded = true;
            if (__DEV__) console.warn('[public-event] Got', eventPosts.length, 'posts from gamePosts.items');
          } else if (Array.isArray(gamePosts)) {
            eventPosts = gamePosts;
            serverPostsLoaded = true;
            if (__DEV__) console.warn('[public-event] Got', eventPosts.length, 'posts from gamePosts array');
          } else {
            if (__DEV__) console.warn('[public-event] No posts found in response');
          }
        } catch (err: any) {
          if (__DEV__) console.warn('[public-event] Failed to load sample event posts (timeout or error):', err?.message);
        }
        try {
          const cached = await settings.getJson<Record<string, any[]>>(settings.SETTINGS_KEYS.SAMPLE_EVENT_POSTS, {} as any);
          const localPosts = Array.isArray(cached[eventId]) ? cached[eventId] : [];
          const seen = new Set<string>();
          const merged: any[] = [];
          const priority = serverPostsLoaded ? [...(eventPosts || []), ...localPosts] : [...localPosts, ...(eventPosts || [])];
          for (const post of priority) {
            const key = String(post?.id ?? post?.media_url ?? post?.created_at ?? '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(post);
          }
          eventPosts = merged.length > 0 ? merged : (eventPosts || []);
        } catch (err: any) {
          if (__DEV__) console.warn('[public-event] sample cache merge failed:', err?.message);
        }
      } else {
        // Real events: try event_id first, then game_id as fallback
        eventPosts = await Post.getByEvent?.(eventId).catch(() => null);
        if (!eventPosts || !Array.isArray(eventPosts) || eventPosts.length === 0) {
          // If no posts by event_id, try by game_id if event has one
          const eventData = await Event.get?.(eventId).catch(() => null);
          if (eventData?.game_id) {
            const gamePosts = await Post.feedForGame(eventData.game_id, { limit: 50, sort: 'trending' }).catch(() => null);
            if (gamePosts && Array.isArray(gamePosts.items)) {
              eventPosts = gamePosts.items;
            } else if (Array.isArray(gamePosts)) {
              eventPosts = gamePosts;
            }
          }
        }
      }
      
      const eventData = await Event.get?.(eventId).catch(() => null);
      setEvent(eventData);
      
      if (eventPosts && Array.isArray(eventPosts) && eventPosts.length > 0) {
        setPosts(eventPosts);
      } else if (isSampleEvent) {
        // For sample events, show empty state instead of fake posts if no real posts exist
        setPosts([]);
      } else {
        // For real events with no posts, show empty state
        setPosts([]);
      }
    } catch (error) {
      console.error('Failed to load event', error);
      const isSampleEvent = params.id && /^sample-/i.test(String(params.id));
      setPosts(isSampleEvent ? [] : generateSamplePosts());
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    if (params?.id) {
      void loadEventData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  // Reload posts when screen comes back into focus (after creating a post)
  useFocusEffect(
    useCallback(() => {
      if (params?.id) {
        void loadEventData();
      }
    }, [params?.id, loadEventData])
  );

  const generateSamplePosts = () => {
    const mediaUrls = [
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
      'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400',
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400',
    ];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `public-sample-${i}`,
      content: i % 3 === 0 
        ? `Check out this amazing moment from our public event! Share the excitement with everyone. #PublicEvent #${i + 1}` 
        : `Great time at the event! #${i + 1}`,
      media_url: i % 2 === 0 ? mediaUrls[i % mediaUrls.length] : null,
      upvotes_count: Math.floor(Math.random() * 80),
      comments_count: Math.floor(Math.random() * 40),
      has_bookmarked: false,
      author: {
        id: `author-${i}`,
        display_name: ['Chris Taylor', 'Morgan Davis', 'Casey Wilson'][i % 3],
        avatar_url: `https://i.pravatar.cc/150?img=${i + 10}`,
      },
      poll: i % 6 === 0 ? {
        id: `poll-${i}`,
        question: "What was the best part?",
        options: [
          { id: `opt-${i}-1`, text: "The atmosphere", votes: 45 },
          { id: `opt-${i}-2`, text: "The performance", votes: 67 },
          { id: `opt-${i}-3`, text: "Meeting fans", votes: 38 },
        ],
        totalVotes: 150,
        endsAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        userVote: null,
      } : null,
    }));
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Public Event', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            {event?.title || 'Public Event'}
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            Public event pages are hosted on the VarsityHub event hub (varsityhub.app/events). 
            Share that link to give fans the full schedule and RSVP options.
          </Text>
          {params?.id && (
            <Text style={[styles.eventId, { color: Colors[colorScheme].mutedText }]}>
              Event ID: {params.id}
            </Text>
          )}
        </View>

        <View style={styles.postsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              Event Feed
            </Text>
            <Pressable
              style={[styles.createPostButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => {
                // For sample events, use the event's game_id if it exists, otherwise use event ID
                // The create-post screen accepts gameId and will handle sample events appropriately
                const targetGameId = event?.game_id || params?.id || '';
                if (__DEV__) console.warn('[PublicEvent] Navigating to create-post with gameId:', targetGameId, '| params.id:', params?.id, '| event?.game_id:', event?.game_id);
                router.push({
                  pathname: '/(tabs)/create-post',
                  params: { gameId: targetGameId },
                });
              }}
            >
              <MaterialIcons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.createPostButtonText}>
                {params?.id && /^sample-/i.test(String(params.id)) ? 'Add Sample Post' : 'Create Post'}
              </Text>
            </Pressable>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator />
            </View>
          ) : posts.length > 0 ? (
            <MasonryGrid
              data={posts}
              numColumns={2}
              gap={12}
              renderItem={(post) => (
                <MasonryPostCard
                  post={post}
                  onPress={() => {
                    router.push({ pathname: '/post-detail', params: { id: post.id } });
                  }}
                  onDeleted={(postId) => {
                    setPosts(prev => prev.filter(p => p.id !== postId));
                  }}
                  onUpdated={(updatedPost) => {
                    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                  }}
                />
              )}
            />
          ) : (
            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
              No posts yet for this event
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { 
    padding: 16,
    paddingBottom: 8,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 8,
  },
  subtitle: { 
    marginBottom: 12,
    lineHeight: 20,
  },
  eventId: {
    fontSize: 13,
    marginTop: 4,
  },
  postsSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 32,
  },
});

