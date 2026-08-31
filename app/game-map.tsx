import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import { shouldShowEventOnMap } from '@/utils/mapEventFilters';
import SportFilterBar from '@/components/SportFilterBar';
import { normalizeSportSlug } from '@/constants/sports';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
// SafeAreaView removed — native header handles safe area
// @ts-ignore
import { Game } from '@/api/entities';
import { httpGet } from '@/api/http';

const MAP_NCAA_LEAGUES = ['ncaaf', 'ncaamb', 'ncaawb', 'ncaabaseball', 'ncaamhockey'] as const;
const MAP_EVENT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MAP_EVENT_LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000;

function dedupeMapEvents(items: EventMapData[]): EventMapData[] {
  const seen = new Set<string>();
  const deduped: EventMapData[] = [];
  items.forEach(item => {
    const key = `${item.type || 'event'}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped;
}

function GameMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const colorScheme = useColorScheme() ?? 'light';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventMapData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      // Get user location from params or current location
      let lat = params.lat ? parseFloat(params.lat) : null;
      let lng = params.lng ? parseFloat(params.lng) : null;

      if (!lat || !lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // GPS can hang indefinitely indoors or in a crowd — race it against
          // a hard timeout so this fetch (and the "Loading nearby games..."
          // overlay it drives) never gets stuck. On timeout we just fetch
          // without a location filter instead of blocking the whole screen.
          const location = await Promise.race([
            Location.getCurrentPositionAsync({}),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 6000)),
          ]);
          if (location) {
            lat = location.coords.latitude;
            lng = location.coords.longitude;
          }
        }
      }

      const nowMs = Date.now();
      const dateFrom = new Date(nowMs - MAP_EVENT_LOOKBACK_MS).toISOString();
      const dateTo = new Date(nowMs + MAP_EVENT_LOOKAHEAD_MS).toISOString();

      const buildEventsQuery = (league?: string) => {
        const query = new URLSearchParams();
        query.set('approval_status', 'approved');
        query.set('event_type', 'game');
        query.set('pro_only', 'true');
        query.set('event_only', 'true');
        query.set('from', dateFrom);
        query.set('to', dateTo);
        query.set('sort', 'date');
        query.set('limit', '100');
        if (league) query.set('pro_league', league);
        if (!league && lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          query.set('lat', String(lat));
          query.set('lng', String(lng));
          query.set('radius', '50');
        }
        return query;
      };

      // Fetch games and event-only fixtures. NCAA gets dedicated queries so
      // dense MLB/NFL slates cannot push college games out of the map/calendar.
      const [gamesResponse, eventsResponse, ...ncaaEventResponses] = await Promise.all([
        // v1.0.2: mapView restricts to games this week — past games drop off the map in real time.
        Game.list(
          'date',
          lat != null && lng != null
            ? { lat, lng, limit: 100, dateFrom, dateTo }
            : { limit: 100, dateFrom, dateTo }
        ).catch((error: any) => {
          if (__DEV__) console.error('[game-map] Failed to fetch games:', error);
          return { items: [] };
        }),
        httpGet('/events?' + buildEventsQuery().toString()).catch(error => {
          if (__DEV__) console.error('[game-map] Failed to fetch events:', error);
          return [];
        }),
        ...MAP_NCAA_LEAGUES.map(league =>
          httpGet('/events?' + buildEventsQuery(league).toString()).catch(error => {
            if (__DEV__) console.error(`[game-map] Failed to fetch ${league} events:`, error);
            return [];
          })
        ),
      ]);

      const gamesList = Array.isArray(gamesResponse)
        ? gamesResponse
        : gamesResponse?.games || gamesResponse?.items || [];
      const eventsList = [eventsResponse, ...ncaaEventResponses].flatMap(response =>
        Array.isArray(response) ? response : response?.items || []
      );

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
      const gameItems: EventMapData[] = gamesList.map((game: any) => {
        const coords = resolveCoords(game);
        return {
          id: game.id,
          title: game.title || 'Game',
          date: game.date || new Date().toISOString(),
          location: game.location || game.venue_address,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          type: 'game' as const,
          sport: normalizeSportSlug(game.sport),
        };
      });

      const gameMarkers = gameItems.filter(
        (g: any) => hasValidCoords(g) && shouldShowEventOnMap(g.date)
      );

      const eventItems: EventMapData[] = eventsList
        .filter((e: any) => e.status !== 'cancelled')
        .map((event: any) => {
          const coords = resolveCoords(event);
          return {
            id: event.id,
            title: event.title || 'Event',
            date: event.date || new Date().toISOString(),
            location: event.location,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            type: 'event' as const,
            sport: normalizeSportSlug(event.sport),
          };
        });

      // Transform events to EventMapData format (never show cancelled events on map)
      const gameMarkerIds = new Set(gameMarkers.map(g => String(g.id)));
      const eventMarkers: EventMapData[] = eventItems
        // A game-linked event duplicates its game's pin — show the fixture once.
        .filter((e: any) => !e.game_id || !gameMarkerIds.has(String(e.game_id)))
        // Feed/list views intentionally keep recent past events visible for recap.
        // The map should not: past events should drop off immediately.
        .filter((e: any) => shouldShowEventOnMap(e.date))
        .filter(hasValidCoords);

      // Combine games and events
      const allMarkers = dedupeMapEvents([...gameMarkers, ...eventMarkers]);
      setEvents(allMarkers);
      setCalendarEvents(dedupeMapEvents([...gameItems, ...eventItems]));

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

  // Sports actually present on the map right now — the filter only offers what
  // exists (no 🏒 chip when there's no hockey nearby).
  const presentSports = useMemo(
    () => Array.from(new Set(events.map(e => e.sport).filter((s): s is string => !!s))),
    [events]
  );

  // Client-side filter — no refetch. A stale selection (sport no longer present)
  // simply yields an empty map until cleared, which is self-explanatory.
  const visibleEvents = useMemo(
    () => (selectedSport ? events.filter(e => e.sport === selectedSport) : events),
    [events, selectedSport]
  );

  const calendarMarkedDates = useMemo(() => {
    const marked: Record<string, any> = {};
    calendarEvents.forEach(event => {
      if (!event.date) return;
      const d = new Date(event.date);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().split('T')[0];
      marked[key] = { marked: true, dotColor: Colors[colorScheme].tint };
    });
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: Colors[colorScheme].tint,
      };
    }
    return marked;
  }, [calendarEvents, selectedDate, colorScheme]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return calendarEvents.filter(event => {
      if (!event.date) return false;
      const d = new Date(event.date);
      return !isNaN(d.getTime()) && d.toISOString().split('T')[0] === selectedDate;
    });
  }, [calendarEvents, selectedDate]);

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

      {/*
        The map stays mounted at the same position across loading/error/success
        states — previously this ternary swapped between a <View> wrapper and a
        bare <EventMap>, which are different element types at the same tree
        position. React unmounts/remounts the whole subtree on that kind of
        swap, so EventMap reset to loading=true and re-requested location
        permission on every fetch (the "double-load" / re-flash bug). Now
        EventMap is always the same element; only the overlay on top changes.
      */}
      <View style={styles.container}>
        <EventMap
          events={visibleEvents}
          onEventPress={handleEventPress}
          showUserLocation={true}
          dataLoaded={!loading}
          onRefresh={!loading && !error ? loadGames : undefined}
        />

        {/* Discreet sport filter — sits on the count-badge row, right of it. */}
        {!loading && !error && presentSports.length > 1 && (
          <View style={styles.sportFilter} pointerEvents="box-none">
            <SportFilterBar
              sports={presentSports}
              selected={selectedSport}
              onSelect={setSelectedSport}
            />
          </View>
        )}

        {!loading && !error && (
          <View style={[styles.calendarPanel, { backgroundColor: Colors[colorScheme].card }]}>
            <Pressable
              onPress={() => setCalendarOpen(open => !open)}
              style={styles.calendarToggle}
              accessibilityRole="button"
              accessibilityLabel={calendarOpen ? 'Hide map calendar' : 'Show map calendar'}
            >
              <MaterialIcons name="calendar-month" size={22} color={Colors[colorScheme].tint} />
              <Text style={[styles.calendarToggleText, { color: Colors[colorScheme].text }]}>
                Calendar
              </Text>
              <MaterialIcons
                name={calendarOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={Colors[colorScheme].mutedText}
              />
            </Pressable>
            {calendarOpen ? (
              <>
                <Calendar
                  key={`map-calendar-${colorScheme}`}
                  onDayPress={day => setSelectedDate(day.dateString)}
                  markedDates={calendarMarkedDates}
                  style={styles.calendar}
                  theme={{
                    calendarBackground: Colors[colorScheme].card,
                    textSectionTitleColor: Colors[colorScheme].mutedText,
                    selectedDayBackgroundColor: Colors[colorScheme].tint,
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: Colors[colorScheme].tint,
                    dayTextColor: Colors[colorScheme].text,
                    textDisabledColor: Colors[colorScheme].mutedText,
                    arrowColor: Colors[colorScheme].tint,
                    monthTextColor: Colors[colorScheme].text,
                    textDayFontWeight: '500',
                    textMonthFontWeight: '800',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 14,
                  }}
                />
                {selectedDate ? (
                  <ScrollView style={styles.selectedDateList}>
                    {selectedDateEvents.slice(0, 16).map(event => (
                      <Pressable
                        key={`${event.type}-${event.id}`}
                        onPress={() => handleEventPress(event.id, event.type)}
                        style={[
                          styles.selectedDateRow,
                          { borderTopColor: Colors[colorScheme].border },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${event.title}`}
                      >
                        <Text
                          style={[styles.selectedDateTitle, { color: Colors[colorScheme].text }]}
                          numberOfLines={1}
                        >
                          {event.title}
                        </Text>
                        <Text
                          style={[
                            styles.selectedDateMeta,
                            { color: Colors[colorScheme].mutedText },
                          ]}
                          numberOfLines={1}
                        >
                          {[
                            event.date
                              ? new Date(event.date).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : null,
                            event.location,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
              Loading nearby games...
            </Text>
          </View>
        )}

        {!loading && error && (
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
        )}
      </View>
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
  // Shares the row with EventMap's "N events" count pill (top: 72, left: 16),
  // starting to its right so the two don't overlap.
  sportFilter: {
    position: 'absolute',
    top: 72,
    left: 120,
    right: 12,
    height: 34,
    justifyContent: 'center',
  },
  calendarPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    maxHeight: '58%',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  calendarToggle: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  calendar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.35)',
  },
  selectedDateList: {
    maxHeight: 150,
  },
  selectedDateRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectedDateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedDateMeta: {
    marginTop: 2,
    fontSize: 12,
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
