import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import * as WebBrowser from 'expo-web-browser';

type EventItem = { id: string | number; title?: string; date?: string; location?: string; description?: string; capacity?: number; attendees?: any[] };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [me, setMe] = useState<any>(null);
  const [rsvped, setRsvped] = useState<boolean>(false);
  const [attendeesCount, setAttendeesCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const [data, user, status]: any = await Promise.all([
          Event.get(String(id)).catch(() => null),
          User.me().catch(() => null),
          Event.rsvpStatus(String(id)).catch(() => ({ attending: false, count: 0 })),
        ]);
        if (!mounted) return;
        setEvent(data ?? null);
        setMe(user);
        setRsvped(!!status?.attending);
        setAttendeesCount(Number(status?.count || data?.attendees_count || 0));
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load event detail', e);
        setError('Unable to load event.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  const attendeeCount = useMemo(() => attendeesCount, [attendeesCount]);

  const onShare = async () => {
    if (!event) return;
    try {
      await Share.share({ message: `${event.title || 'Event'}${event.location ? ' @ ' + event.location : ''}` });
    } catch {}
  };

  const openPublic = async () => {
    const slug = (event as any)?.slug;
    if (!slug) return;
    await WebBrowser.openBrowserAsync(`https://example.com/event/${slug}`);
  };

  const toggleRsvp = async () => {
    if (!event) return;
    try {
      const res = await Event.rsvp(String(event.id), !rsvped);
      setRsvped(!!res?.attending);
      setAttendeesCount(Number(res?.count || 0));
      Alert.alert('Success', res?.attending ? 'RSVP confirmed.' : 'RSVP canceled.');
    } catch (e) {
      Alert.alert('Error', 'Unable to update RSVP.');
    }
  };

  const openInMaps = async () => {
    if (!event?.location) {
      Alert.alert('No Location', 'This event does not have a location set.');
      return;
    }

    const address = encodeURIComponent(event.location);
    let url = '';

    if (Platform.OS === 'ios') {
      // iOS uses Apple Maps
      url = `maps://?q=${address}`;
    } else {
      // Android uses Google Maps
      url = `geo:0,0?q=${address}`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open maps.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Event Detail', headerShown: false }} />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: Math.max(insets.bottom, 16),
          padding: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!id && <Text style={styles.error}>Missing event id.</Text>}
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator />
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
      </ScrollView>
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
