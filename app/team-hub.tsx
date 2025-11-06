import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/ui/PrimaryButton';
import { Color, Radius, Type } from '@/ui/tokens';
// @ts-ignore api exports
import { Event } from '@/api/entities';

const PLACEHOLDER = ['#0f172a', '#1e3a8a'] as const;

const formatEventDate = (iso?: string) => {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return format(d, 'EEE, MMM d � h:mm a');
};

const computeGoing = (count?: number | null, capacity?: number | null) => {
  if (typeof count !== 'number') return null;
  if (typeof capacity === 'number' && capacity >= 0) return Math.min(count, capacity);
  return count;
};

const pickBanner = (event: any) => event?.game?.cover_image_url || event?.banner_url || null;

export default function TeamHubScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'team' | 'create' | 'approvals'>('team');
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const list: any = await Event.filter({ status: 'approved' }, 'date');
        if (!mounted) return;
        const items = Array.isArray(list) ? list : list?.items || [];
        setEvents(items);
      } catch (err) {
        console.error('Failed to load events', err);
        if (mounted) setEventsError('Unable to load events right now.');
      } finally {
        if (mounted) setEventsLoading(false);
      }
    };
    loadEvents();
    return () => { mounted = false; };
  }, []);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((evt) => {
        const di = evt?.date ? new Date(evt.date).getTime() : null;
        return di ? di >= now - 6 * 3600 * 1000 : true;
      })
      .slice(0, 10);
  }, [events]);

  // Calculate countdown to next game
  const nextGame = useMemo(() => upcomingEvents[0] || null, [upcomingEvents]);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    if (!nextGame?.date) return;
    
    const updateCountdown = () => {
      const now = Date.now();
      const gameTime = new Date(nextGame.date).getTime();
      const diff = Math.max(0, gameTime - now);
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdown({ days, hours, minutes, seconds });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextGame]);

  const handleEventPress = (evt: any) => {
    if (!evt) return;
    if (evt.game_id || evt.game?.id) {
      const targetId = String(evt.game_id || evt.game.id);
      router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: targetId } });
      return;
    }
  router.push({ pathname: '/(tabs)/feed/game' as any, params: { eventId: String(evt.id) } } as any);
  };

  return (
    <SafeAreaView style={S.page} edges={['top']}>
      <Stack.Screen options={{ title: 'Team Hub' }} />
      <Text style={[Type.h0 as any, { color: Color.text, marginHorizontal: 16, marginTop: 8, marginBottom: 12 }]}>Team Hub</Text>

      {/* Search */}
      <View style={S.searchWrap}>
        <Ionicons name="search" size={18} color={Color.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for teams, players, or events."
          placeholderTextColor={Color.placeholder}
          style={S.searchInput}
        />
      </View>

      {/* Tabs removed - only showing Team Hub content */}

      {/* Team Management Card */}
      <View style={S.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={S.iconTile}><Ionicons name="shield-checkmark" size={24} color={Color.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h1 as any, { color: Color.text }]}>Team Management</Text>
            <Text style={[Type.sub as any]}>Create new teams and manage existing ones.</Text>
          </View>
        </View>

        <View style={S.dashedBox}>
          <Text style={{ fontWeight: '800', color: Color.text, marginBottom: 4 }}>You are not managing any teams yet.</Text>
          <Text style={[Type.sub as any, { textAlign: 'center', marginBottom: 12 }]}>Create a team to get started.</Text>
          <PrimaryButton label="Create New Team" onPress={() => router.push('/onboarding/step-5-league')} />
        </View>
      </View>

      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <Ionicons name="calendar" size={18} color={Color.primary} />
        <Text style={[Type.h2 as any, { color: Color.text }]}>Next Events</Text>
      </View>

      {/* Countdown to Next Game */}
      {nextGame && (
        <View style={S.countdownCard}>
          <LinearGradient 
            colors={['#2563EB', '#1E40AF']} 
            style={S.countdownGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={S.countdownHeader}>
              <Ionicons name="timer-outline" size={24} color="#fff" />
              <Text style={S.countdownLabel}>Next Game</Text>
            </View>
            <Text style={S.countdownGameTitle} numberOfLines={1}>{nextGame.title || 'Upcoming Game'}</Text>
            <View style={S.countdownTimer}>
              <View style={S.countdownUnit}>
                <Text style={S.countdownNumber}>{countdown.days}</Text>
                <Text style={S.countdownText}>DAYS</Text>
              </View>
              <Text style={S.countdownSeparator}>:</Text>
              <View style={S.countdownUnit}>
                <Text style={S.countdownNumber}>{String(countdown.hours).padStart(2, '0')}</Text>
                <Text style={S.countdownText}>HRS</Text>
              </View>
              <Text style={S.countdownSeparator}>:</Text>
              <View style={S.countdownUnit}>
                <Text style={S.countdownNumber}>{String(countdown.minutes).padStart(2, '0')}</Text>
                <Text style={S.countdownText}>MIN</Text>
              </View>
              <Text style={S.countdownSeparator}>:</Text>
              <View style={S.countdownUnit}>
                <Text style={S.countdownNumber}>{String(countdown.seconds).padStart(2, '0')}</Text>
                <Text style={S.countdownText}>SEC</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      <View style={S.eventsWrap}>
        {eventsLoading ? (
          <ActivityIndicator color={Color.primary} />
        ) : eventsError ? (
          <Text style={[Type.sub as any, { color: '#b91c1c' }]}>{eventsError}</Text>
        ) : upcomingEvents.length === 0 ? (
          <Text style={S.eventsEmpty}>No upcoming events yet.</Text>
        ) : (
          upcomingEvents.map((evt) => {
            const banner = pickBanner(evt);
            const going = computeGoing(evt.attendees_count ?? evt.rsvp_count, evt.capacity);
            return (
              <Pressable key={String(evt.id)} style={S.eventCard} onPress={() => handleEventPress(evt)}>
                <View style={S.eventMedia}>
                  {banner ? (
                    <Image source={{ uri: banner }} style={S.eventMedia} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={PLACEHOLDER} style={S.eventMedia} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  )}
                  <View style={S.eventShade}>
                    <Text style={S.eventDate}>{formatEventDate(evt.date)}</Text>
                    <Text style={S.eventTitle} numberOfLines={2}>{evt.title || 'Event'}</Text>
                  </View>
                </View>
                <View style={S.eventInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="location" size={14} color={Color.primary} />
                    <Text style={S.eventLocation} numberOfLines={1}>{evt.location || 'TBD'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={S.eventChip}>
                      <Ionicons name="people" size={14} color={Color.primary} />
                      <Text style={S.eventChipText}>
                        {going != null ? `${going} going` : 'RSVP open'}
                      </Text>
                    </View>
                    {typeof evt.capacity === 'number' ? (
                      <View style={S.eventChipMuted}>
                        <Ionicons name="alert-circle" size={14} color={Color.placeholder} />
                        <Text style={S.eventChipMutedText}>{evt.capacity} capacity</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: Color.pageBg },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, marginHorizontal: 16, borderRadius: Radius.md,
    backgroundColor: Color.surface, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Color.border,
  },
  searchInput: { flex: 1, color: Color.text },
  tabsWrap: {
    flexDirection: 'row', backgroundColor: Color.tabBg, borderRadius: Radius.md,
    marginHorizontal: 16, marginTop: 12, padding: 6, gap: 6, height: 40,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  tabOn: { backgroundColor: Color.surface, borderWidth: 1, borderColor: Color.border },
  tabLabel: { fontWeight: '700', color: '#374151' },
  tabLabelOn: { color: Color.text },
  card: {
    margin: 16, padding: 16, borderRadius: Radius.lg, backgroundColor: Color.surface,
    borderWidth: 1, borderColor: Color.border, gap: 12,
  },
  iconTile: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Color.infoTile },
  dashedBox: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: Color.borderMuted, borderRadius: Radius.md,
    padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 180, marginTop: 8,
  },
  // Countdown
  countdownCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  countdownGradient: {
    padding: 20,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  countdownLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  countdownGameTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  countdownTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  countdownUnit: {
    alignItems: 'center',
    minWidth: 60,
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  countdownText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  countdownSeparator: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    opacity: 0.6,
  },
  eventsWrap: { marginHorizontal: 16, gap: 12, marginBottom: 24 },
  eventsEmpty: { color: Color.placeholder, fontStyle: 'italic' },
  eventCard: {
    borderRadius: Radius.lg,
    backgroundColor: Color.surface,
    borderWidth: 1,
    borderColor: Color.border,
    overflow: 'hidden',
  },
  eventMedia: { width: '100%', height: 140 },
  eventShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  eventDate: { color: '#BFDBFE', fontWeight: '700', fontSize: 12 },
  eventTitle: { color: 'white', fontWeight: '800', fontSize: 16, marginTop: 4 },
  eventInfo: { padding: 14, gap: 8 },
  eventLocation: { color: Color.text, fontWeight: '600', flex: 1 },
  eventChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  eventChipText: { color: '#1e3a8a', fontWeight: '700' },
  eventChipMuted: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  eventChipMutedText: { color: '#475569', fontWeight: '600' },
});
