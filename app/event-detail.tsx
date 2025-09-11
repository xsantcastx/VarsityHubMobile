import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert, Share } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import * as WebBrowser from 'expo-web-browser';

type EventItem = { id: string | number; title?: string; date?: string; location?: string; description?: string; capacity?: number; attendees?: any[] };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Event Detail' }} />
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
          <Text style={styles.meta}>{event.location || 'TBD'}</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800' },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c' },
  primaryBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  outlineBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: '#111827', fontWeight: '700' },
});
