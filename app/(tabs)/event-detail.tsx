import { BackHeader } from '@/components/ui/BackHeader';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import { useShareLink } from '@/hooks/useShareLink';
import MatchBanner from '../components/MatchBanner';
import RsvpSheet from '../components/RsvpSheet';
import { Colors } from '@/constants/Colors';

type EventItem = { id: string | number; title?: string; date?: string; location?: string; description?: string; capacity?: number; attendees?: any[] };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
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
  const [rsvpSheetVisible, setRsvpSheetVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Load event first (critical path)
      let data: any = null;
      try {
        const raw = await Event.get(String(id));
        // Guard against 304 Not-Modified stubs returned by the HTTP client
        // (they look like { _status: 304, _isNotModified: true }) — treat as miss
        if (!raw || raw._isNotModified || typeof raw.id === 'undefined') {
          throw new Error('Event not found');
        }
        data = raw;
      } catch (e: any) {
        console.error('[event-detail] Failed to load event', { id, status: e?.status, message: e?.message });
        setError(e?.status === 404 ? 'Event not found.' : 'Unable to load event. Please try again.');
        return;
      }

      setEvent(data ?? null);

      // Load user and RSVP status in parallel (best-effort, don't block render)
      try {
        const [user, status]: any = await Promise.all([
          User.me().catch(() => null),
          Event.rsvpStatus(String(id)).catch(() => ({ attending: false, count: 0 })),
        ]);
        setMe(user);
        setRsvped(!!(status?.attending ?? status?.going));
        setAttendeesCount(Number(status?.count || data?.attendees_count || data?.rsvp_count || 0));
      } catch (e: any) {
        console.warn('[event-detail] Failed to load user/RSVP status (non-critical)', e);
        setAttendeesCount(Number(data?.attendees_count || data?.rsvp_count || 0));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
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
          padding: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!id && !loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
            <Text style={[styles.error, { textAlign: 'center' }]}>No event selected.</Text>
          </View>
        )}
        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        )}
        {error && !loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 16 }}>
            <Text style={[styles.error, { textAlign: 'center' }]}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={load}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}
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

            <Text style={[styles.title, { color: theme.text }]}>{event.title || 'Event'}</Text>
            
            {/* Location with Map Pin */}
            {event.location && (
              <Pressable 
                style={[styles.locationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={openInMaps}
              >
                <View style={styles.locationIconContainer}>
                  <Ionicons name="location" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationLabel, { color: theme.mutedText }]}>Location</Text>
                  <Text style={[styles.locationText, { color: theme.text }]}>{event.location}</Text>
                  <Text style={[styles.locationHint, { color: theme.mutedText }]}>Tap to open in Maps</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            )}
            
            <Text style={[styles.meta, { color: theme.mutedText }]}>{event.date ? new Date(event.date).toLocaleString() : ''}</Text>
            {(() => {
              const capacity = (event as any)?.capacity ?? (event as any)?.max_attendees;
              const isFull = typeof capacity === 'number' && attendeesCount >= capacity;
              const capacityText = typeof capacity === 'number' 
                ? ` / ${capacity}${isFull ? ' (FULL)' : ''}`
                : '';
              return (
                <Text style={[styles.meta, { color: theme.mutedText }, isFull && { color: '#DC2626', fontWeight: '600' }]}>
                  Attending: {attendeeCount}{capacityText}
                </Text>
              );
            })()}
            {event.description ? <Text style={{ color: theme.text }}>{event.description}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable style={styles.primaryBtn} onPress={me ? toggleRsvp : handleRsvpPress}>
                <Text style={styles.primaryBtnText}>{rsvped ? 'Cancel RSVP' : 'RSVP'}</Text>
              </Pressable>
              <Pressable style={[styles.outlineBtn, { borderColor: Colors[colorScheme ?? 'light'].border }]} onPress={shareEvent}>
                <Text style={[styles.outlineBtnText, { color: Colors[colorScheme ?? 'light'].text }]}>Share</Text>
              </Pressable>
            </View>
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
});
