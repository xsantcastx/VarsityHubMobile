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
import MapDateControl from '@/components/MapDateControl';
import { normalizeSportSlug } from '@/constants/sports';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  // Map scope. 'all' (default) shows games/events nationwide — parity with the
  // feed, which is never distance-filtered; 'nearby' restricts to a ~50mi
  // radius around the viewer. The reported map/feed split-brain ("games on the
  // feed missing from the map") was the map's hard radius filter — All removes
  // it via the server's show_all flag.
  const [scope, setScope] = useState<'all' | 'nearby'>('all');
  // Date lens. null = the live map (today/upcoming), the default. A selected
  // local-midnight Date browses that single day's events/games — the way back
  // to a past event a user attended so they can still post a recap inside its
  // server-enforced 7-day upload window. The map otherwise drops past pins.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Set true when the user actively picks a day, so loadGames fires ONE
  // map_date_selected (with the day's results_count) for that pick — not on the
  // reloads that scope changes also trigger.
  const pendingDateTrack = useRef(false);

  // Wraps setSelectedDate to emit the funnel's first step. Selection fires from
  // loadGames (needs results_count); clearing fires here (nothing to count).
  const handleDateChange = useCallback((date: Date | null) => {
    if (date) {
      pendingDateTrack.current = true;
    } else {
      analytics.track(ANALYTICS_EVENTS.MAP_DATE_CLEARED);
    }
    setSelectedDate(date);
  }, []);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      // When a day is selected, query that whole local day [00:00, next 00:00)
      // and let past pins through; otherwise stay on the live (from=now) map.
      const dayWindow = selectedDate
        ? {
            startIso: selectedDate.toISOString(),
            endIso: new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              selectedDate.getDate() + 1
            ).toISOString(),
          }
        : null;
      // A day-scoped query already bounds results to that day server-side, so
      // the client "upcoming-only" gate must not re-drop them for being past.
      const passesDateGate = (dateValue: string | null | undefined) =>
        dayWindow ? true : shouldShowEventOnMap(dateValue);
      // Nearby mode needs the viewer's coordinates; All mode never filters by
      // location, so it skips the (up-to-6s) GPS wait entirely.
      let lat = params.lat ? parseFloat(params.lat) : null;
      let lng = params.lng ? parseFloat(params.lng) : null;

      if (scope === 'nearby' && (lat == null || lng == null)) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // GPS can hang indefinitely indoors or in a crowd — race it against
          // a hard timeout so this fetch (and the "Loading games..." overlay it
          // drives) never gets stuck. On timeout we fall back to the nationwide
          // set instead of blocking the whole screen.
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

      const useNearby =
        scope === 'nearby' && lat != null && lng != null && !isNaN(lat) && !isNaN(lng);

      // Events: Nearby → server bounding-box + 50mi radius; All → show_all=true
      // disables location filtering so far-away fixtures (e.g. a marquee event
      // in another state) surface too, matching the feed. Both bounded by limit.
      const eventsQuery = new URLSearchParams();
      eventsQuery.set('approval_status', 'approved');
      eventsQuery.set('limit', '100');
      // The map renders only upcoming/live events (shouldShowEventOnMap drops
      // date < now). Ask the server for the SOONEST upcoming events from now,
      // else passing approval_status skips the default date window and the
      // created_at-desc default could return 100 arbitrary/old rows that the
      // client then filters away — starving All mode of pins.
      eventsQuery.set('sort', 'date');
      if (dayWindow) {
        // Explicit from/to makes the events route return that day's rows,
        // bypassing its default "hide anything older than 3 days" archive cutoff.
        eventsQuery.set('from', dayWindow.startIso);
        eventsQuery.set('to', dayWindow.endIso);
      } else {
        eventsQuery.set('from', new Date().toISOString());
        // Live map: apply the map horizon — pro fixtures capped to 14 days,
        // team/org events uncapped (full season). Omitted in date-lens mode so a
        // picked past day shows everything on it.
        eventsQuery.set('map_view', 'true');
      }
      if (useNearby) {
        eventsQuery.set('lat', String(lat));
        eventsQuery.set('lng', String(lng));
        eventsQuery.set('radius', '50');
      } else {
        eventsQuery.set('show_all', 'true');
      }

      const [gamesResponse, eventsResponse] = await Promise.all([
        // v1.0.2: mapView restricts to games this week — past games drop off the map in real time.
        Game.list('date', {
          // useNearby guarantees lat/lng are non-null finite numbers (checked above).
          ...(useNearby ? { lat: lat!, lng: lng!, limit: 50 } : { limit: 100 }),
          // A selected day scopes games to that day (past days included); the
          // live map keeps mapView's "this week only" behavior.
          ...(dayWindow
            ? { dateFrom: dayWindow.startIso, dateTo: dayWindow.endIso }
            : { mapView: true }),
        }).catch((error: any) => {
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
        .filter((g: any) => passesDateGate(g.date))
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
            sport: normalizeSportSlug(game.sport),
          };
        });

      // Transform events to EventMapData format (never show cancelled events on map)
      const gameMarkerIds = new Set(gameMarkers.map(g => String(g.id)));
      const eventMarkers: EventMapData[] = eventsList
        .filter((e: any) => e.status !== 'cancelled')
        // A game-linked event duplicates its game's pin — show the fixture once.
        .filter((e: any) => !e.game_id || !gameMarkerIds.has(String(e.game_id)))
        // Feed/list views intentionally keep recent past events visible for recap.
        // The live map should not — but a selected day deliberately shows its
        // past events (passesDateGate lets them through only in date mode).
        .filter((e: any) => passesDateGate(e.date))
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
            sport: normalizeSportSlug(event.sport),
          };
        });

      // Combine games and events
      const allMarkers = [...gameMarkers, ...eventMarkers];
      setEvents(allMarkers);

      // Funnel step 1 — fire once per deliberate day pick, now that we know how
      // many pins that day yielded. results_count === 0 is the key signal: a
      // day people wanted but that has no content (a supply gap).
      if (pendingDateTrack.current && selectedDate) {
        pendingDateTrack.current = false;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const daysAgo = Math.round(
          (startOfToday.getTime() - selectedDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        analytics.track(ANALYTICS_EVENTS.MAP_DATE_SELECTED, {
          days_ago: daysAgo,
          is_past: daysAgo > 0,
          within_upload_window: daysAgo >= 0 && daysAgo <= 7,
          weekday: selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
          scope,
          results_count: allMarkers.length,
        });
      }

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
  }, [params.lat, params.lng, scope, selectedDate]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const handleEventPress = (eventId: string, eventType?: 'game' | 'event' | 'post') => {
    // Funnel step 2 tag — only when opened from a browsed PAST day, so the
    // event-page view (and any recap that follows) is attributable to the date
    // lens. Live-map opens stay untagged. buildRouteParams doesn't gate in-app
    // pushes, so this rides through as a plain param.
    const fromDateLens = selectedDate ? { from: 'map_date' } : {};
    if (eventType === 'event') {
      const route = buildEventDetailRoute(eventId);
      if (selectedDate && typeof route === 'object') {
        (route as any).params = { ...(route as any).params, ...fromDateLens };
      }
      router.push(route);
    } else {
      // Navigate to game detail page for games (or posts)
      router.push({
        pathname: '/game/[id]',
        params: { id: String(eventId), ...fromDateLens },
      });
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

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen
        options={{
          title: 'Games Map',
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

        {/* All / Nearby scope toggle — centered under the search box. Default
            All (nationwide) so the map matches the feed; Nearby re-applies the
            ~50mi radius around the viewer. */}
        {!error && (
          <View style={styles.scopeToggle} pointerEvents="box-none">
            <View
              style={[styles.scopeToggleTrack, { backgroundColor: Colors[colorScheme].background }]}
            >
              {(['all', 'nearby'] as const).map(option => {
                const active = scope === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setScope(option)}
                    style={[
                      styles.scopeToggleOption,
                      active && { backgroundColor: Colors[colorScheme].tint },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.scopeToggleLabel,
                        { color: active ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {option === 'all' ? 'All' : 'Nearby'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Date lens — top-right, on the scope-toggle row. Browse a past day to
            find an event you attended and post a recap inside its 7-day window. */}
        {!error && (
          <View style={styles.dateControl} pointerEvents="box-none">
            <MapDateControl value={selectedDate} onChange={handleDateChange} />
          </View>
        )}

        {/* Discreet sport filter — sits just below the count-badge row. */}
        {!loading && !error && presentSports.length > 1 && (
          <View style={styles.sportFilter} pointerEvents="box-none">
            <SportFilterBar
              sports={presentSports}
              selected={selectedSport}
              onSelect={setSelectedSport}
            />
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
              {scope === 'nearby' ? 'Loading nearby games...' : 'Loading games...'}
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
  // Centered scope toggle, sitting on EventMap's "N events" count-pill row
  // (top: 72) — the pill is left-aligned so the centered toggle clears it.
  scopeToggle: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Top-right, same row as the centered scope toggle and left count pill.
  dateControl: {
    position: 'absolute',
    top: 68,
    right: 12,
    alignItems: 'flex-end',
  },
  scopeToggleTrack: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  scopeToggleOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 15,
  },
  scopeToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Sits one row below the scope toggle + count pill so the three don't overlap.
  sportFilter: {
    position: 'absolute',
    top: 116,
    left: 16,
    right: 12,
    height: 34,
    justifyContent: 'center',
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
