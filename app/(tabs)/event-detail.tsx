import { useAuth } from '@/context/AuthProvider';
import { getAuthSnapshot } from '@/utils/authState';
import { BackHeader } from '@/components/ui/BackHeader';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event } from '@/api/entities';
import { useShareLink } from '@/hooks/useShareLink';
import { getAuthSnapshot } from '@/utils/authState';
import MatchBanner from '../components/MatchBanner';
import RsvpSheet from '../components/RsvpSheet';
import { Image } from 'expo-image';
import { Colors } from '@/constants/Colors';

type EventItem = {
  id: string | number;
  title?: string;
  date?: string;
  location?: string;
  description?: string;
  capacity?: number;
  attendees?: any[];
  status?: string;
  can_cancel?: boolean;
};

export default function EventDetailScreen() {
  const { user, checkAuth } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const headerBackground = isDark ? '#030712' : '#FFFFFF';
  const headerText = isDark ? '#F8FAFC' : '#0F172A';
  const headerBorder = isDark ? '#1F2937' : '#D1D5DB';
  const locationIconBackground = isDark ? '#3F1D1D' : '#FEE2E2';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [me, setMe] = useState<any>(null);
  const [rsvped, setRsvped] = useState<boolean>(false);
  const [attendeesCount, setAttendeesCount] = useState<number>(0);
  const [rsvpSheetVisible, setRsvpSheetVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rsvping, setRsvping] = useState(false);
  const routeToSignIn = useCallback(() => {
    router.replace('/sign-in');
  }, [router]);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
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
        if (__DEV__)
          console.error('[event-detail] Failed to load event', {
            id,
            status: e?.status,
            message: e?.message,
          });
        setError(
          e?.status === 404 ? 'Event not found.' : 'Unable to load event. Please try again.'
        );
        return;
      }

      setEvent(data ?? null);

      // Load user and RSVP status in parallel (best-effort, don't block render)
      try {
        const [currentUser, status]: any = await Promise.all([
          getAuthSnapshot(checkAuth, user).catch(() => null),

          Event.rsvpStatus(String(id)).catch(() => ({ attending: false, count: 0 })),
        ]);
        setMe(currentUser);
        setRsvped(!!(status?.attending ?? status?.going));
        setAttendeesCount(Number(status?.count || data?.attendees_count || data?.rsvp_count || 0));
      } catch (e: any) {
        if (__DEV__)
          console.warn('[event-detail] Failed to load user/RSVP status (non-critical)', e);
        setAttendeesCount(Number(data?.attendees_count || data?.rsvp_count || 0));
      }
    } finally {
      setLoading(false);
    }
  }, [checkAuth, id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const attendeeCount = useMemo(() => attendeesCount, [attendeesCount]);
  const eventHasPassed = useMemo(() => {
    const iso = event?.date;
    if (!iso) return false;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  }, [event?.date]);

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

  const ensureRsvpAllowed = () => {
    if (eventHasPassed) {
      Alert.alert('RSVP closed', 'You cannot RSVP to events that have already occurred.');
      return false;
    }
    if (!me) {
      Alert.alert('Sign In Required', 'Please sign in to RSVP to events.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: routeToSignIn },
      ]);
      return false;
    }
    return true;
  };

  const toggleRsvp = async () => {
    if (!event || rsvping) return;
    if (!ensureRsvpAllowed()) return;
    setRsvping(true);
    try {
      const res = await Event.rsvp(String(event.id), !rsvped);
      const isGoing = !!(res?.going ?? res?.attending);
      setRsvped(isGoing);
      setAttendeesCount(Number(res?.count ?? res?.attendees_count ?? 0));
      Alert.alert('Success', isGoing ? 'RSVP confirmed.' : 'RSVP canceled.');
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      const message = String(e?.message || e?.data?.error || '');
      if (status === 400 && /event has passed/i.test(message)) {
        Alert.alert('RSVP closed', 'You cannot RSVP to events that have already occurred.');
      } else if (status === 403 && /at capacity|is full/i.test(message)) {
        Alert.alert(
          'Event Full',
          'This event is at capacity. Please check back later for cancellations.'
        );
      } else if (status === 401 || message.includes('Unauthorized')) {
        Alert.alert('Session Expired', 'Please sign in again to RSVP.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: routeToSignIn },
        ]);
      } else {
        Alert.alert('Error', 'Unable to update RSVP. Please try again.');
      }
    } finally {
      setRsvping(false);
    }
  };

  const handleRsvpPress = () => {
    if (!ensureRsvpAllowed()) return;
    setRsvpSheetVisible(true);
  };

  const handleCancelEvent = async () => {
    if (!event?.id || !me) return;
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event? All RSVPed attendees will be notified.',
      [
        { text: 'Keep Event', style: 'cancel' },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await Event.cancel(String(event.id));
              setEvent(prev => (prev ? { ...prev, status: 'cancelled' } : null));
              Alert.alert(
                'Event Cancelled',
                'The event has been cancelled. Attendees have been notified.'
              );
            } catch (e: any) {
              const msg = e?.data?.error || e?.message || 'Unable to cancel event.';
              Alert.alert('Error', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
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
      if (__DEV__) console.warn('Failed to open maps:', error);
      // Show address as last resort
      Alert.alert(
        'Unable to Open Maps',
        `Location: ${event.location}\n\nTry searching this address in your maps app.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
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
            <ActivityIndicator size="large" color={theme.tint} />
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
        {event && !loading && eventHasPassed && (
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.border,
              marginBottom: 8,
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="event-busy" size={18} color={theme.mutedText} />
            <Text style={[styles.meta, { color: theme.mutedText, textAlign: 'center' }]}>
              Event ended • RSVP closed
            </Text>
          </View>
        )}
        {event && !loading && (
          <View style={{ gap: 8 }}>
            {/* Use the event's uploaded/generated banner if present; fall back to
                the team-logo MatchBanner for legacy events without a stored image. */}
            {(event as any).banner_url || (event as any).cover_image_url ? (
              <Image
                source={{
                  uri: (event as any).banner_url || (event as any).cover_image_url,
                }}
                style={{ width: '100%', height: 220, borderRadius: 12 }}
                contentFit="cover"
                accessibilityLabel={`Banner for ${event.title || 'event'}`}
              />
            ) : (
              <MatchBanner
                leftImage={(event as any)?.homeLogo ?? null}
                rightImage={(event as any)?.awayLogo ?? null}
                leftName={(event as any)?.homeName ?? ''}
                rightName={(event as any)?.awayName ?? ''}
                leftScore={(event as any)?.game?.home_score ?? null}
                rightScore={(event as any)?.game?.away_score ?? null}
                height={220}
                appearance="classic"
                hero={false}
                goingCount={attendeeCount}
                onGoingPress={eventHasPassed ? undefined : () => setRsvpSheetVisible(true)}
              />
            )}

            <Text style={[styles.title, { color: theme.text }]}>{event.title || 'Event'}</Text>

            {/* Location with Map Pin */}
            {event.location && (
              <Pressable
                style={[
                  styles.locationCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={openInMaps}
              >
                <View
                  style={[
                    styles.locationIconContainer,
                    { backgroundColor: locationIconBackground },
                  ]}
                >
                  <MaterialIcons name="location-on" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationLabel, { color: theme.mutedText }]}>Location</Text>
                  <Text style={[styles.locationText, { color: theme.text }]}>{event.location}</Text>
                  <Text style={[styles.locationHint, { color: theme.mutedText }]}>
                    Tap to open in Maps
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.mutedText} />
              </Pressable>
            )}

            <Text style={[styles.meta, { color: theme.mutedText }]}>
              {event.date ? new Date(event.date).toLocaleString() : ''}
            </Text>
            {(() => {
              const capacity = (event as any)?.capacity ?? (event as any)?.max_attendees;
              const isFull = typeof capacity === 'number' && attendeesCount >= capacity;
              const capacityText =
                typeof capacity === 'number' ? ` / ${capacity}${isFull ? ' (FULL)' : ''}` : '';
              return (
                <Text
                  style={[
                    styles.meta,
                    { color: theme.mutedText },
                    isFull && { color: '#DC2626', fontWeight: '600' },
                  ]}
                >
                  Attending: {attendeeCount}
                  {capacityText}
                </Text>
              );
            })()}
            {event.description ? (
              <Text style={{ color: theme.text }}>{event.description}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {(event as EventItem).status !== 'cancelled' && (
                <Pressable
                  style={[
                    styles.primaryBtn,
                    eventHasPassed || rsvping ? styles.primaryBtnDisabled : null,
                  ]}
                  disabled={eventHasPassed || rsvping}
                  onPress={me ? toggleRsvp : handleRsvpPress}
                >
                  <Text style={styles.primaryBtnText}>
                    {eventHasPassed
                      ? 'Event Ended'
                      : rsvping
                        ? '...'
                        : rsvped
                          ? 'Cancel RSVP'
                          : 'RSVP'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.outlineBtn, { borderColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={shareEvent}
              >
                <Text
                  style={[styles.outlineBtnText, { color: Colors[colorScheme ?? 'light'].text }]}
                >
                  Share
                </Text>
              </Pressable>
              {(event as any).can_cancel &&
                (event as EventItem).status !== 'cancelled' &&
                !eventHasPassed && (
                  <Pressable
                    style={[
                      styles.outlineBtn,
                      { borderColor: Colors[colorScheme ?? 'light'].border },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/edit-event',
                        params: {
                          id: String(event.id),
                          fallback: `/event-detail?id=${encodeURIComponent(String(event.id))}`,
                        },
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.outlineBtnText,
                        { color: Colors[colorScheme ?? 'light'].text },
                      ]}
                    >
                      Edit
                    </Text>
                  </Pressable>
                )}
              {(event as EventItem).can_cancel && (event as EventItem).status !== 'cancelled' && (
                <Pressable
                  style={[styles.cancelEventBtn, { borderColor: '#DC2626' }]}
                  disabled={cancelling}
                  onPress={handleCancelEvent}
                >
                  <Text style={styles.cancelEventBtnText}>
                    {cancelling ? 'Cancelling…' : 'Cancel Event'}
                  </Text>
                </Pressable>
              )}
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
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  meta: {},
  error: { color: '#b91c1c' },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationHint: {
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  outlineBtnText: { fontWeight: '700' },
  cancelledBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelledBadgeText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
  cancelEventBtn: {
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelEventBtnText: { color: '#DC2626', fontWeight: '700' },
});
