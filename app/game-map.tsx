import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import { MAP_WINDOW_DAYS, shouldShowEventOnMap } from '@/utils/mapEventFilters';
import SportFilterBar from '@/components/SportFilterBar';
import { normalizeSportSlug } from '@/constants/sports';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// SafeAreaView removed — native header handles safe area
// @ts-ignore
import { Game } from '@/api/entities';
import { httpGet } from '@/api/http';

/** True when an ISO date string falls on the same calendar day as `day`. */
function isSameCalendarDay(dateStr: string | null | undefined, day: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function GameMapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  // Owner note 8: dates tracker. `selectedDate === null` is the default live/nearby
  // view (today + upcoming). A non-null value scopes the map to that single past
  // day so users can browse previous games/events (active 7-day window).
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Full-calendar picker: a chip at the end of the quick 7-day strip opens a
  // real date picker so the user can jump to ANY past day (owner: "when a user
  // is selecting recent dates and hits the end, [add] a calendar button").
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      // The map is a NATIONAL view (owner: "start wide to show events across the
      // country"). We no longer geo-filter the fetch to a radius — every
      // in-window game/event is fetched and clustered client-side by zoom. The
      // viewer's own location (blue dot + "center on me" button) is resolved
      // independently inside EventMap, so no GPS wait is needed here.

      // Dates tracker (owner note 8): when a past day is picked, scope the fetch
      // to that calendar day (dropping mapView, which is future-only server-side)
      // so previous games/events surface. Default (null) keeps the live view.
      const dayScoped = selectedDate != null;
      const dayStart = dayScoped ? new Date(selectedDate as Date) : null;
      dayStart?.setHours(0, 0, 0, 0);
      const dayEnd = dayScoped ? new Date(selectedDate as Date) : null;
      dayEnd?.setHours(23, 59, 59, 999);

      const eventsQuery = new URLSearchParams();
      eventsQuery.set('approval_status', 'approved');
      eventsQuery.set('sort', 'date');
      if (dayScoped) {
        eventsQuery.set('from', dayStart!.toISOString());
        eventsQuery.set('to', dayEnd!.toISOString());
      } else {
        // Default live view: the rolling map window (now → +14d). `map_view`
        // makes the server enforce the window and lift the event cap for the
        // national view; from/to is a belt-and-braces bound for any server that
        // predates map_view on /events. sort=date is ascending, so `from` is
        // required — otherwise the oldest events fill the cap and get dropped
        // client-side; with it, the SOONEST events win. shouldShowEventOnMap
        // re-bounds client-side as a third layer.
        const nowMs = Date.now();
        eventsQuery.set('map_view', 'true');
        eventsQuery.set('from', new Date(nowMs).toISOString());
        eventsQuery.set(
          'to',
          new Date(nowMs + MAP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
        );
        eventsQuery.set('limit', '300');
      }
      const [gamesResponse, eventsResponse] = await Promise.all([
        // National fetch: mapView restricts games to the rolling window
        // (future-only, +14d) server-side; a day-scoped view passes explicit
        // from/to so a past day resolves. No lat/lng → the whole country.
        Game.list(
          'date',
          dayScoped
            ? {
                limit: 100,
                dateFrom: dayStart!.toISOString(),
                dateTo: dayEnd!.toISOString(),
              }
            : { limit: 100, mapView: true }
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
        .filter((g: any) =>
          dayScoped ? isSameCalendarDay(g.date, selectedDate as Date) : shouldShowEventOnMap(g.date)
        )
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
        // Default view: past events drop off immediately (live map). Day-scoped
        // view: show that day's events instead. NOTE (owner note 8, rule 5): past
        // events with zero posts should be hidden here — that needs a post_count
        // on the events response (server change, staged separately) before it can
        // be enforced client-side.
        .filter((e: any) =>
          dayScoped ? isSameCalendarDay(e.date, selectedDate as Date) : shouldShowEventOnMap(e.date)
        )
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
  }, [selectedDate]);

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

  // Dates tracker options: Today (live default) + the previous 7 days (active
  // 7-day window). "Today" maps to null so it restores the default nearby view.
  const dateOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const opts: { key: string; label: string; date: Date | null }[] = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      opts.push({
        key: i === 0 ? 'today' : d.toISOString().slice(0, 10),
        label:
          i === 0
            ? 'Today'
            : i === 1
              ? 'Yesterday'
              : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        date: i === 0 ? null : d,
      });
    }
    return opts;
  }, []);

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
          startWide
          onCalendarPress={() => setShowDatePicker(v => !v)}
          calendarActive={selectedDate != null}
        />

        {/* Dates tracker (owner note 8): a compact date picker — not a full
            calendar — toggled by the map's calendar control. Picking a past day
            scopes the map to that day's games/events; "Today" restores live. */}
        {showDatePicker && (
          <View style={styles.datePickerBar} pointerEvents="box-none">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datePickerContent}
            >
              {dateOptions.map(opt => {
                const active =
                  opt.date == null
                    ? selectedDate == null
                    : selectedDate != null &&
                      isSameCalendarDay(selectedDate.toISOString(), opt.date);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setSelectedDate(opt.date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: active
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                        borderColor: active ? Colors[colorScheme].tint : Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        { color: active ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Calendar chip at the end of the strip — jump to ANY past day
                  beyond the quick 7-day chips. Shows the picked date when the
                  active selection is a custom (off-strip) day. */}
              {(() => {
                const customActive =
                  selectedDate != null &&
                  !dateOptions.some(
                    o => o.date != null && isSameCalendarDay(selectedDate.toISOString(), o.date)
                  );
                return (
                  <Pressable
                    onPress={() => {
                      setPickerDate(selectedDate ?? new Date());
                      setShowCalendar(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Pick a date from the calendar"
                    style={[
                      styles.dateChip,
                      styles.calendarChip,
                      {
                        backgroundColor: customActive
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                        borderColor: customActive
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="event"
                      size={15}
                      color={customActive ? '#FFFFFF' : Colors[colorScheme].text}
                    />
                    <Text
                      style={[
                        styles.dateChipText,
                        { color: customActive ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {customActive
                        ? selectedDate!.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Pick date'}
                    </Text>
                  </Pressable>
                );
              })()}
            </ScrollView>
          </View>
        )}

        {/* Full calendar picker, opened by the "Pick date" chip. iOS shows a
            bottom-sheet spinner (confirm on Done); Android shows the native
            dialog (commits on select). Past-only to match the recent-dates strip. */}
        {Platform.OS === 'ios' ? (
          <Modal
            visible={showCalendar}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCalendar(false)}
          >
            <Pressable style={styles.calendarBackdrop} onPress={() => setShowCalendar(false)}>
              <View
                style={[styles.calendarSheet, { backgroundColor: Colors[colorScheme].background }]}
                onStartShouldSetResponder={() => true}
              >
                <View
                  style={[styles.calendarHeader, { borderBottomColor: Colors[colorScheme].border }]}
                >
                  <Pressable onPress={() => setShowCalendar(false)}>
                    <Text style={[styles.calendarAction, { color: Colors[colorScheme].mutedText }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text style={[styles.calendarTitle, { color: Colors[colorScheme].text }]}>
                    Pick a date
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSelectedDate(
                        new Date(
                          pickerDate.getFullYear(),
                          pickerDate.getMonth(),
                          pickerDate.getDate()
                        )
                      );
                      setShowCalendar(false);
                    }}
                  >
                    <Text style={[styles.calendarAction, { color: Colors[colorScheme].tint }]}>
                      Done
                    </Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, d) => {
                    if (d) setPickerDate(d);
                  }}
                  textColor={Colors[colorScheme].text}
                />
              </View>
            </Pressable>
          </Modal>
        ) : (
          showCalendar && (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_e, d) => {
                setShowCalendar(false);
                if (d) setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
              }}
            />
          )
        )}

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
  // Dates-tracker strip — sits just below the search box / sport-filter row.
  datePickerBar: {
    position: 'absolute',
    top: 116,
    left: 0,
    right: 0,
  },
  datePickerContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  calendarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  calendarBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  calendarSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarAction: {
    fontSize: 16,
    fontWeight: '600',
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
