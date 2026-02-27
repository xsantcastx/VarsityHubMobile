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
import { httpGet } from '@/api/http';

export default function GameMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);

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

      // Fetch ALL games and events worldwide - no location filter
      const [gamesResponse, eventsResponse] = await Promise.all([
        Game.list('-date', {}).catch((error) => {
          console.error('[game-map] Failed to fetch games:', error);
          return { items: [] };
        }),
        // Fetch approved events (including past events for map display)
        httpGet('/events?approval_status=approved&include_past=1').catch((error) => {
          console.error('[game-map] Failed to fetch events:', error);
          return [];
        }),
      ]);

      const gamesList = Array.isArray(gamesResponse) ? gamesResponse : (gamesResponse?.items || []);
      const eventsList = Array.isArray(eventsResponse) ? eventsResponse : (eventsResponse?.items || []);

      // Helper: resolve the best available lat/lng for a game or event.
      // Games can store coordinates in multiple fields depending on how
      // they were created, so we fall back in order of preference.
      const resolveCoords = (item: any): { latitude: number; longitude: number } | null => {
        // Prefer explicit game-level coordinates, then venue coordinates
        const lat = item.latitude ?? item.venue_lat ?? item.watch_location_lat ?? null;
        const lng = item.longitude ?? item.venue_lng ?? item.watch_location_lng ?? null;
        if (
          lat != null && lng != null &&
          typeof lat === 'number' && typeof lng === 'number' &&
          !isNaN(lat) && !isNaN(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180
        ) {
          return { latitude: lat, longitude: lng };
        }
        return null;
      };

      const hasValidCoords = (item: any): boolean => resolveCoords(item) !== null;

      // Transform games to EventMapData format
      const gameMarkers: EventMapData[] = gamesList
        .filter(hasValidCoords)
        .map((game: any) => {
          const coords = resolveCoords(game)!;
          return {
            id: game.id,
            title: game.title || 'Game',
            date: game.date || new Date().toISOString(),
            location: game.location || game.venue_address,
            latitude: coords.latitude,
            longitude: coords.longitude,
            type: 'game' as const,
          };
        });

      // Transform events to EventMapData format (never show cancelled events on map)
      const eventMarkers: EventMapData[] = eventsList
        .filter((e: any) => e.status !== 'cancelled')
        .filter(hasValidCoords)
        .map((event: any) => {
          const coords = resolveCoords(event)!;
          return {
            id: event.id,
            title: event.title || 'Event',
            date: event.date || new Date().toISOString(),
            location: event.location,
            latitude: coords.latitude,
            longitude: coords.longitude,
            type: 'event' as const,
          };
        });

      // Combine games and events
      const allMarkers = [...gameMarkers, ...eventMarkers];
      setEvents(allMarkers);
      
      // Log for debugging
      const totalItems = gamesList.length + eventsList.length;
      if (allMarkers.length === 0 && totalItems > 0) {
        if (__DEV__) console.warn(`[game-map] Loaded ${gamesList.length} games and ${eventsList.length} events, but none have valid coordinates`);
      } else {
        if (__DEV__) console.warn(`[game-map] Loaded ${gameMarkers.length} games and ${eventMarkers.length} events with locations (${allMarkers.length} total pins)`);
      }
    } catch (error) {
      console.error('Error loading games:', error);
      // Don't show alert - just load empty map
    } finally {
      setLoading(false);
    }
  }, [params.lat, params.lng]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const handleEventPress = (eventId: string, eventType?: 'game' | 'event' | 'post') => {
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
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)} style={styles.headerButton}>
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
