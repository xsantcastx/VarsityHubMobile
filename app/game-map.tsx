import EventMap from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useGameMap } from '@/hooks/useGameMap';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GameMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const colorScheme = useColorScheme() ?? 'light';

  const initialLat = params.lat ? parseFloat(params.lat) : undefined;
  const initialLng = params.lng ? parseFloat(params.lng) : undefined;
  const { events, loading, error, load } = useGameMap({
    initialLat: isNaN(initialLat as number) ? undefined : initialLat,
    initialLng: isNaN(initialLng as number) ? undefined : initialLng,
  });

  const handleEventPress = (eventId: string, eventType?: string) => {
    if (eventType === 'event') {
      // Navigate to event detail page for events (using query param format)
      router.push(`/event-detail?id=${String(eventId)}`);
    } else {
      // Navigate to game detail page for games (or posts)
      router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(eventId) } });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Nearby Games',
          headerShown: true,
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
          headerLeft: () => (
            <Pressable onPress={() => void router.back()} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.container}>
          <EventMap events={[]} onEventPress={handleEventPress} showUserLocation={true} />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading nearby games...</Text>
          </View>
        </View>
      ) : error ? (
        <View style={[styles.container, styles.emptyContainer]}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>{error}</Text>
          <Pressable
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors[colorScheme].tint }}
            onPress={() => void load()}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <EventMap events={events} onEventPress={handleEventPress} showUserLocation={true} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
