import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

      // Fetch games from API
      const gamesResponse = await Game.list().catch(() => ({ items: [] }));
      const gamesList = Array.isArray(gamesResponse) ? gamesResponse : (gamesResponse?.items || []);

      // Transform games to EventMapData format
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
    } catch {
      console.error('Error loading games:', error);
      Alert.alert('Error', 'Unable to load games. Please try again.');
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading nearby games...</Text>
        </View>
      ) : events.length > 0 ? (
        <EventMap events={events} onEventPress={handleEventPress} showUserLocation={true} />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="map" size={40} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No mapped games yet</Text>
          <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>Try Discover or follow teams near you.</Text>
          <Pressable onPress={() => void router.push('/(tabs)/discover')} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors[colorScheme].tint }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Open Discover</Text>
          </Pressable>
        </View>
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
