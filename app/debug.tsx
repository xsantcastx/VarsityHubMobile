import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DebugScreen() {
  const router = useRouter();
  const [eventId, setEventId] = useState('');
  const [gameId, setGameId] = useState('');
  const [adId, setAdId] = useState('test');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Debug' }} />
      <Text style={styles.title}>Quick Nav</Text>
      <View style={styles.row}>
        <Button onPress={() => router.push('/feed')}>Feed</Button>
        <Button onPress={() => router.push('/(tabs)/explore')}>Discover</Button>
        <Button onPress={() => router.push('/profile')}>Profile</Button>
        <Button onPress={() => router.push('/messages')}>Messages</Button>
      </View>

      <Text style={styles.title}>Detail Deep Links</Text>
      <View style={styles.block}>
        <Text style={styles.label}>Event Detail id</Text>
        <Input placeholder="e.g. 123" value={eventId} onChangeText={setEventId} style={{ marginBottom: 8 }} />
        <Button onPress={() => eventId && router.push(`/event-detail?id=${eventId}`)} disabled={!eventId}>Open Event</Button>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Game Detail id</Text>
        <Input placeholder="e.g. 456" value={gameId} onChangeText={setGameId} style={{ marginBottom: 8 }} />
        <Button onPress={() => gameId && router.push(`/game-detail?id=${gameId}`)} disabled={!gameId}>Open Game</Button>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Ad Calendar adId</Text>
        <Input placeholder="e.g. my-ad" value={adId} onChangeText={setAdId} style={{ marginBottom: 8 }} />
        <Button onPress={() => router.push(`/ad-calendar?adId=${encodeURIComponent(adId)}`)}>Open Ad Calendar</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { marginTop: 12 },
  label: { fontWeight: '700', marginBottom: 6 },
});
