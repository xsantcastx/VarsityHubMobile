import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Game } from '@/api/entities';

export default function GameMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      // Get user location from params or current location
      let lat = params.lat ? parseFloat(params.lat) : null;
      let lng = params.lng ? parseFloat(params.lng) : null;

      if (!lat || !lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }
      }

      if (lat && lng) {
        setUserLocation({ latitude: lat, longitude: lng });
      }

      // Fetch ALL games worldwide - no location filter
      const gamesResponse = await Game.list('-date', {}).catch(() => ({ items: [] }));
      const gamesList = Array.isArray(gamesResponse) ? gamesResponse : (gamesResponse?.items || []);

      // Transform games to EventMapData format
      // Note: Include all games, not just those with coordinates
      // The map will show those with coordinates, empty state will encourage users to add locations
      const mappedEvents: EventMapData[] = gamesList
        .filter((game: any) => game.latitude && game.longitude)
        .map((game: any) => ({
          id: game.id,
          title: game.title || 'Game',
          date: game.date || new Date().toISOString(),
          location: game.location,
          latitude: game.latitude,
          longitude: game.longitude,
          type: 'game' as const,
        }));

      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error loading games:', error);
      // Don't show alert - just load empty map
    } finally {
      setLoading(false);
    }
  }, [params.lat, params.lng]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(eventId) } });
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
        // Show map with loading indicator while fetching games
        <View style={styles.container}>
          <EventMap events={[]} onEventPress={handleEventPress} showUserLocation={true} />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading nearby games...</Text>
          </View>
        </View>
      ) : (
        // Always show map, whether games exist or not
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
