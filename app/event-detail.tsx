import { BackHeader } from '@/components/ui/BackHeader';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
<<<<<<< HEAD
import { Event, User } from '@/api/entities';
import { useShareLink } from '@/hooks/useShareLink';
import MatchBanner from './components/MatchBanner';
import RsvpSheet from './components/RsvpSheet';
=======
import { Event, Post, User } from '@/api/entities';
import MasonryGrid from '@/components/MasonryGrid';
import MasonryPostCard from '@/components/MasonryPostCard';
import * as WebBrowser from 'expo-web-browser';
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)

type EventItem = { id: string | number; title?: string; date?: string; location?: string; description?: string; capacity?: number; attendees?: any[] };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerBackground = isDark ? '#030712' : '#FFFFFF';
  const headerText = isDark ? '#F8FAFC' : '#0F172A';
  const headerBorder = isDark ? '#1F2937' : '#E5E7EB';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [me, setMe] = useState<any>(null);
  const [rsvped, setRsvped] = useState<boolean>(false);
  const [attendeesCount, setAttendeesCount] = useState<number>(0);
<<<<<<< HEAD
  const [rsvpSheetVisible, setRsvpSheetVisible] = useState(false);
=======
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        // Load event first (critical path)
        let data: any = null;
        try {
          data = await Event.get(String(id));
        } catch (e: any) {
          if (!mounted) return;
          console.error('Failed to load event', e);
          setError('Unable to load event. Please try again.');
          setLoading(false);
          return; // Stop here if event can't be loaded
        }

        if (!mounted) return;
        setEvent(data ?? null);
<<<<<<< HEAD

        // Load user and RSVP status in parallel (best-effort, don't block)
        try {
          const [user, status]: any = await Promise.all([
            User.me().catch(() => null),
            Event.rsvpStatus(String(id)).catch(() => ({ attending: false, count: 0 })),
          ]);
          if (!mounted) return;
          setMe(user);
          setRsvped(!!status?.attending);
          setAttendeesCount(Number(status?.count || data?.attendees_count || 0));
        } catch (e: any) {
          if (!mounted) return;
          console.warn('Failed to load user/RSVP status (continuing with event data)', e);
          // Don't set error; event is loaded and that's what matters
          setAttendeesCount(Number(data?.attendees_count || 0));
        }
=======
        setMe(user);
        setRsvped(!!status?.attending);
        setAttendeesCount(Number(status?.count || data?.attendees_count || 0));
        
        // Load event posts
        loadEventPosts();
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load event detail', e);
        setError('Unable to load event.');
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [id]);

  const loadEventPosts = async () => {
    if (!id) return;
    setLoadingPosts(true);
    try {
      // Try to fetch event-specific posts
      const eventPosts = await Post.getByEvent?.(String(id)).catch(() => null);
      if (eventPosts && Array.isArray(eventPosts)) {
        // Add sample polls to some posts for demonstration
        const postsWithPolls = eventPosts.map((post: any, index: number) => {
          // Add a poll to every 4th post for variety
          if (index % 4 === 0) {
            return {
              ...post,
              poll: generateSamplePoll(post.id || index),
            };
          }
          return post;
        });
        setPosts(postsWithPolls);
      } else {
        // Generate sample posts if no API available
        setPosts(generateSamplePosts());
      }
    } catch (error) {
      console.error('Failed to load event posts', error);
      // Fallback to sample posts
      setPosts(generateSamplePosts());
    } finally {
      setLoadingPosts(false);
    }
  };

  const generateSamplePosts = () => {
    const samplePosts = [];
    const mediaUrls = [
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
      'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400',
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400',
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400',
      'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400',
    ];
    
    for (let i = 0; i < 12; i++) {
      const hasMedia = i % 3 !== 0; // 2 out of 3 have media
      const hasPoll = i % 5 === 0; // Every 5th post has a poll
      
      samplePosts.push({
        id: `sample-${i}`,
        content: hasMedia 
          ? `Amazing moment from the game! #${i + 1}` 
          : `Great team spirit and energy today. This is what sports is all about! Let's keep the momentum going. #TeamWork #Victory #${i + 1}`,
        caption: hasMedia ? `Game highlight #${i + 1}` : null,
        media_url: hasMedia ? mediaUrls[i % mediaUrls.length] : null,
        upvotes_count: Math.floor(Math.random() * 100),
        comments_count: Math.floor(Math.random() * 50),
        bookmarks_count: Math.floor(Math.random() * 30),
        has_bookmarked: false,
        author: {
          id: `author-${i}`,
          display_name: ['Alex Johnson', 'Sam Smith', 'Jordan Lee', 'Taylor Brown'][i % 4],
          avatar_url: `https://i.pravatar.cc/150?img=${i + 1}`,
        },
        poll: hasPoll ? generateSamplePoll(i) : null,
      });
    }
    
    return samplePosts;
  };

  const generateSamplePoll = (id: number | string) => {
    const pollQuestions = [
      { question: "Who was the MVP of the game?", options: ["Player #10", "Player #23", "Player #7", "Player #15"] },
      { question: "Best play of the night?", options: ["The amazing dunk", "The 3-pointer", "The steal", "The assist"] },
      { question: "What should we improve?", options: ["Defense", "Offense", "Team chemistry", "Conditioning"] },
      { question: "Next game prediction?", options: ["Easy win", "Close game", "Tough battle", "Upset victory"] },
      { question: "Favorite moment?", options: ["Opening play", "Halftime show", "Final minutes", "Post-game celebration"] },
    ];
    
    const poll = pollQuestions[Number(id) % pollQuestions.length];
    
    return {
      id: `poll-${id}`,
      question: poll.question,
      options: poll.options.map((text, idx) => ({
        id: `option-${id}-${idx}`,
        text,
        votes: Math.floor(Math.random() * 50),
      })),
      totalVotes: Math.floor(Math.random() * 200),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      userVote: null,
    };
  };

  const attendeeCount = useMemo(() => attendeesCount, [attendeesCount]);

  const router = useRouter();

  const eventShareContext = useMemo(() => {
    if (!event) return [];
    const lines: string[] = [];
    if (event.location) lines.push(`Location: ${event.location}`);
    if (event.date) lines.push(`When: ${new Date(event.date).toLocaleString()}`);
    return lines;
  }, [event]);

  const { share: shareEvent } = useShareLink({
    kind: 'event',
    id: event?.id,
    title: event?.title || 'VarsityHub Event',
    contextLines: eventShareContext,
  });

  const toggleRsvp = async () => {
    if (!event) return;
    if (!me) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP to events.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => void router.push('/sign-in') }
      ]);
      return;
    }
    try {
      const res = await Event.rsvp(String(event.id), !rsvped);
      setRsvped(!!res?.attending);
      setAttendeesCount(Number(res?.count || 0));
      Alert.alert('Success', res?.attending ? 'RSVP confirmed.' : 'RSVP canceled.');
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.message?.includes('Unauthorized')) {
        Alert.alert('Session Expired', 'Please sign in again to RSVP.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => void router.push('/sign-in') }
        ]);
      } else {
        Alert.alert('Error', 'Unable to update RSVP. Please try again.');
      }
    }
  };

  const handleRsvpPress = () => {
    if (!me) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP to events.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => void router.push('/sign-in') }
      ]);
      return;
    }
    setRsvpSheetVisible(true);
  };

  const openInMaps = async () => {
    if (!event?.location) {
      Alert.alert('No Location', 'This event does not have a location set.');
      return;
    }

    // Prefer API coordinates if available, fallback to geocoding
    const lat = (event as any).latitude || (event as any).lat;
    const lng = (event as any).longitude || (event as any).lng;
    const address = encodeURIComponent(event.location);
    let url = '';

    if (lat && lng) {
      // Use precise coordinates from API
      if (Platform.OS === 'ios') {
        url = `maps://?ll=${lat},${lng}&q=${address}`;
      } else {
        url = `geo:${lat},${lng}?q=${address}`;
      }
    } else {
      // Fallback to address-based search
      if (Platform.OS === 'ios') {
        url = `maps://?q=${address}`;
      } else {
        url = `geo:0,0?q=${address}`;
      }
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
      }
    } catch (error: any) {
      console.warn('Failed to open maps:', error);
      // Show address as last resort
      Alert.alert(
        'Unable to Open Maps',
        `Location: ${event.location}\n\nTry searching this address in your maps app.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Event Detail', headerShown: false }} />
      <BackHeader 
        title={event?.title || 'Event Detail'}
        backgroundColor={headerBackground}
        textColor={headerText}
        borderColor={headerBorder}
      />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        showsVerticalScrollIndicator={false}
      >
<<<<<<< HEAD
        {!id && <Text style={styles.error}>Missing event id.</Text>}
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        )}
        {error && !loading && <Text style={styles.error}>{error}</Text>}
        {event && !loading && (
          <View style={{ gap: 8 }}>
            {/* Match banner with persistent RSVP badge */}
            <MatchBanner
              leftImage={(event as any)?.homeLogo ?? null}
              rightImage={(event as any)?.awayLogo ?? null}
              leftName={(event as any)?.homeName ?? ''}
              rightName={(event as any)?.awayName ?? ''}
              height={220}
              appearance="classic"
              hero={false}
              goingCount={attendeeCount}
              onGoingPress={() => setRsvpSheetVisible(true)}
            />

            <Text style={styles.title}>{event.title || 'Event'}</Text>
            
            {/* Location with Map Pin */}
            {event.location && (
              <Pressable 
                style={styles.locationCard}
                onPress={openInMaps}
              >
                <View style={styles.locationIconContainer}>
                  <Ionicons name="location" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>Location</Text>
                  <Text style={styles.locationText}>{event.location}</Text>
                  <Text style={styles.locationHint}>Tap to open in Maps</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            )}
            
            <Text style={styles.meta}>{event.date ? new Date(event.date).toLocaleString() : ''}</Text>
            <Text style={styles.meta}>Attending: {attendeeCount}{typeof event.capacity === 'number' ? ` / ${event.capacity}` : ''}</Text>
            {event.description ? <Text>{event.description}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable style={styles.primaryBtn} onPress={me ? toggleRsvp : handleRsvpPress}>
                <Text style={styles.primaryBtnText}>{rsvped ? 'Cancel RSVP' : 'RSVP'}</Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={shareEvent}>
                <Text style={styles.outlineBtnText}>Share</Text>
              </Pressable>
=======
        <View style={{ padding: 16, paddingBottom: 8 }}>
          {!id && <Text style={styles.error}>Missing event id.</Text>}
          {loading && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator />
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
            </View>
          )}
          {error && !loading && <Text style={styles.error}>{error}</Text>}
          {event && !loading && (
            <View style={{ gap: 8 }}>
              <Text style={styles.title}>{event.title || 'Event'}</Text>
              
              {/* Location with Map Pin */}
              {event.location && (
                <Pressable 
                  style={styles.locationCard}
                  onPress={openInMaps}
                >
                  <View style={styles.locationIconContainer}>
                    <Ionicons name="location" size={24} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationLabel}>Location</Text>
                    <Text style={styles.locationText}>{event.location}</Text>
                    <Text style={styles.locationHint}>Tap to open in Maps</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </Pressable>
              )}
              
              <Text style={styles.meta}>{event.date ? new Date(event.date).toLocaleString() : ''}</Text>
              <Text style={styles.meta}>Attending: {attendeeCount}{typeof event.capacity === 'number' ? ` / ${event.capacity}` : ''}</Text>
              {event.description ? <Text>{event.description}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable style={styles.primaryBtn} onPress={toggleRsvp}>
                  <Text style={styles.primaryBtnText}>{rsvped ? 'Cancel RSVP' : 'RSVP'}</Text>
                </Pressable>
                <Pressable style={styles.outlineBtn} onPress={onShare}>
                  <Text style={styles.outlineBtnText}>Share</Text>
                </Pressable>
                {(event as any)?.slug ? (
                  <Pressable style={styles.outlineBtn} onPress={openPublic}>
                    <Text style={styles.outlineBtnText}>Open Public</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* Event Posts in Masonry Layout */}
        {!loading && event && (
          <View style={styles.postsSection}>
            <Text style={styles.sectionTitle}>Event Feed</Text>
            {loadingPosts ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
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
                      // Navigate to post detail if available
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
              <Text style={styles.emptyText}>No posts yet for this event</Text>
            )}
          </View>
        )}
      </ScrollView>
      
      {me && (
        <RsvpSheet
          visible={rsvpSheetVisible}
          onClose={() => setRsvpSheetVisible(false)}
          goingCount={attendeeCount}
          capacity={(event as any)?.capacity ?? null}
          isGoing={rsvped}
          onToggleRsvp={toggleRsvp}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800' },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c' },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    marginVertical: 8,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  locationHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  primaryBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  outlineBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: '#111827', fontWeight: '700' },
  postsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 32,
  },
});
