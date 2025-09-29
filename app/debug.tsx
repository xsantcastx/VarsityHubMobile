import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  <Button onPress={() => router.push('/(tabs)/feed')}><Text>Feed</Text></Button>
  <Button onPress={() => router.push('/(tabs)/discover')}><Text>Discover</Text></Button>
  <Button onPress={() => router.push('/profile')}><Text>Profile</Text></Button>
  <Button onPress={() => router.push('/messages')}><Text>Messages</Text></Button>
      </View>

      <Text style={styles.title}>Detail Deep Links</Text>
      <View style={styles.block}>
        <Text style={styles.label}>Event Detail id</Text>
        <Input placeholder="e.g. 123" value={eventId} onChangeText={setEventId} style={{ marginBottom: 8 }} />
  <Button onPress={() => eventId && router.push(`/event-detail?id=${eventId}`)} disabled={!eventId}><Text>Open Event</Text></Button>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Game Detail id</Text>
        <Input placeholder="e.g. 456" value={gameId} onChangeText={setGameId} style={{ marginBottom: 8 }} />
  <Button onPress={() => gameId && router.push({ pathname: '/game/[id]', params: { id: gameId } })} disabled={!gameId}><Text>Open Game</Text></Button>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Ad Calendar adId</Text>
        <Input placeholder="e.g. my-ad" value={adId} onChangeText={setAdId} style={{ marginBottom: 8 }} />
  <Button onPress={() => router.push(`/ad-calendar?adId=${encodeURIComponent(adId)}`)}><Text>Open Ad Calendar</Text></Button>
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





