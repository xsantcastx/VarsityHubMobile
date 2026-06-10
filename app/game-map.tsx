import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import { shouldShowEventOnMap } from '@/utils/mapEventFilters';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
// SafeAreaView removed — native header handles safe area
// @ts-ignore
import { Game } from '@/api/entities';
import { httpGet } from '@/api/http';

function GameMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const colorScheme = useColorScheme() ?? 'light';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [error, setError] = useState<string | null>(null);

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

      // Fetch games and events; when user has location, filter to nearby (radius 50mi)
      const eventsQuery = new URLSearchParams();
      eventsQuery.set('approval_status', 'approved');
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        eventsQuery.set('lat', String(lat));
        eventsQuery.set('lng', String(lng));
        eventsQuery.set('radius', '50');
      }
      const [gamesResponse, eventsResponse] = await Promise.all([
        // v1.0.2: mapView restricts to games this week — past games drop off the map in real time.
        Game.list(
          'date',
          lat != null && lng != null
            ? { lat, lng, limit: 50, mapView: true }
            : { limit: 50, mapView: true }
        ).catch((error: any) => {
          if (__DEV__) console.error('[game-map] Failed to fetch games:', error);
          return { items: [] };
        }),
        httpGet('/events?' + eventsQuery.toString()).catch(error => {
          if (__DEV__) console.error('[game-map] Failed to fetch events:', error);
          return [];
        }),
      ]);

      const gamesList = Array.isArray(gamesResponse)
        ? gamesResponse
        : gamesResponse?.games || gamesResponse?.items || [];
      const eventsList = Array.isArray(eventsResponse)
        ? eventsResponse
        : eventsResponse?.items || [];

      // Helper: resolve the best available lat/lng for a game or event.
      // Games can store coordinates in multiple fields depending on how
      // they were created, so we fall back in order of preference.
      const resolveCoords = (item: any): { latitude: number; longitude: number } | null => {
        // Prefer explicit game-level coordinates, then venue coordinates
        const lat = item.latitude ?? item.venue_lat ?? item.watch_location_lat ?? null;
        const lng = item.longitude ?? item.venue_lng ?? item.watch_location_lng ?? null;
        if (
          lat != null &&
          lng != null &&
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          return { latitude: lat, longitude: lng };
        }
        return null;
      };

      const hasValidCoords = (item: any): boolean => resolveCoords(item) !== null;

      // Transform games to EventMapData format.
      // v1.0.3: past games must drop off the map immediately, same as events.
      // Previously only events were date-filtered, so a past game remained as
      // a tappable pin that routed to the dead-end "This event has ended" page.
      const gameMarkers: EventMapData[] = gamesList
        .filter(hasValidCoords)
        .filter((g: any) => shouldShowEventOnMap(g.date))
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
        // Feed/list views intentionally keep recent past events visible for recap.
        // The map should not: past events should drop off immediately.
        .filter((e: any) => shouldShowEventOnMap(e.date))
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
        if (__DEV__)
          console.warn(
            `[game-map] Loaded ${gamesList.length} games and ${eventsList.length} events, but none have valid coordinates`
          );
      } else {
        if (__DEV__)
          console.warn(
            `[game-map] Loaded ${gameMarkers.length} games and ${eventMarkers.length} events with locations (${allMarkers.length} total pins)`
          );
      }
    } catch (err) {
      if (__DEV__) console.error('Error loading games:', err);
      setError('Unable to load nearby games. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [params.lat, params.lng]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const handleEventPress = (eventId: string, eventType?: 'game' | 'event' | 'post') => {
    if (eventType === 'event') {
      router.push(buildEventDetailRoute(eventId));
    } else {
      // Navigate to game detail page for games (or posts)
      router.push({ pathname: '/game/[id]', params: { id: String(eventId) } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen
        options={{
          title: 'Nearby Games',
          headerShown: true,
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => safeGoBack(router)} style={styles.headerButton}>
              <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        // Show map with loading indicator while fetching games
        <View style={styles.container}>
          <EventMap
            events={[]}
            onEventPress={handleEventPress}
            showUserLocation={true}
            dataLoaded={false}
          />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
              Loading nearby games...
            </Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.container}>
          <EventMap
            events={[]}
            onEventPress={handleEventPress}
            showUserLocation={true}
            dataLoaded={false}
          />
          <View style={styles.loadingOverlay}>
            <MaterialIcons name="cloud-off" size={40} color={Colors[colorScheme].mutedText} />
            <Text
              style={[
                styles.loadingText,
                { color: Colors[colorScheme].text, textAlign: 'center', marginTop: 8 },
              ]}
            >
              {error}
            </Text>
            <Pressable
              onPress={() => {
                setError(null);
                void loadGames();
              }}
              style={{
                marginTop: 12,
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: Colors[colorScheme].tint,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        // Always show map, whether games exist or not
        <EventMap
          events={events}
          onEventPress={handleEventPress}
          showUserLocation={true}
          dataLoaded={true}
        />
      )}
    </View>
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

export default GameMapScreen;
