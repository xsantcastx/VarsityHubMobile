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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const [data, user]: any = await Promise.all([
          (Event.get ? Event.get(id as string) : Event.filter({ id }).then((r: any[]) => r?.[0])),
          User.me().catch(() => null),
        ]);
        if (!mounted) return;
        setEvent(data ?? null);
        setMe(user);
        if (data && user && Array.isArray((data as any).attendees)) {
          // naive check based on email if available
          const found = (data as any).attendees.some((a: any) => a === user.email || a?.email === user.email);
          setRsvped(!!found);
        }
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

  const attendeeCount = useMemo(() => event?.attendees?.length || 0, [event]);

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
      // TODO: integrate with backend RSVP endpoint. For now, simulate success.
      setRsvped(prev => !prev);
      Alert.alert('Success', rsvped ? 'RSVP canceled.' : 'RSVP confirmed.');
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
