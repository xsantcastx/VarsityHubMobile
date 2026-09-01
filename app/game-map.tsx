import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import SportFilterBar from '@/components/SportFilterBar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// SafeAreaView removed — native header handles safe area
import { httpGet } from '@/api/http';
import { buildMapDiscoveryPath, buildUpcomingDateButtons, toMapEvents } from '@/utils/mapDiscovery';
import { validateEventCards } from '@/api/schemas/eventCard';

const USA_WIDE_REGION = {
  latitude: 39.8,
  longitude: -98.5,
  latitudeDelta: 50,
  longitudeDelta: 50,
};

function GameMapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventMapData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The feed map shows ALL public VarsityHub event pages nationwide — not a
      // nearby/pro-only slice. The single `/event-discovery?surface=map`
      // endpoint already returns every approved, non-private game AND standalone
      // event page in the server's map window, privacy-filtered and with NO
      // location gate. Query shape + mapping live in utils/mapDiscovery so the
      // "no data gates" rule is pinned in one place. Location is NOT requested
      // here — EventMap requests it only to draw the user dot.
      const res: unknown = await httpGet(buildMapDiscoveryPath());
      const items = validateEventCards('/event-discovery?surface=map', res);
      const now = new Date();

      // Map pins need coordinates; the calendar summarizes every upcoming event
      // page in the dataset, including ones without a location.
      const markers = toMapEvents(items, now);
      setEvents(markers);
      setCalendarEvents(toMapEvents(items, now, { requireCoords: false }));

      if (__DEV__) {
        console.warn(
          `[game-map] Loaded ${items.length} discovery items (${markers.length} with map pins)`
        );
      }
    } catch (err) {
      if (__DEV__) console.error('Error loading events:', err);
      setError('Unable to load events. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Upcoming days (today forward) — the feed map shows what's still to come, so
  // its date picker looks forward, not back. Logic lives in utils/mapDiscovery.
  const recentDateButtons = useMemo(
    () => buildUpcomingDateButtons(calendarEvents, new Date(), 7),
    [calendarEvents]
  );

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
          title: 'Events Map',
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
          initialRegion={USA_WIDE_REGION}
          showUserLocation={true}
          dataLoaded={!loading}
          preventAutoCenterOnUser
          hideCenterOnUser
          autoFitPins={false}
          onCalendarPress={() => setCalendarOpen(open => !open)}
          calendarActive={calendarOpen || Boolean(selectedDate)}
          onRefresh={!loading && !error ? loadGames : undefined}
        />

        {/* Discreet sport filter — sits on the count-badge row, right of it. */}
        {!loading && !error && presentSports.length > 1 && (
          <View style={[styles.sportFilter, { pointerEvents: 'box-none' }]}>
            <SportFilterBar
              sports={presentSports}
              selected={selectedSport}
              onSelect={setSelectedSport}
            />
          </View>
        )}

        {!loading && !error && calendarOpen && (
          <View style={[styles.dateStripPanel, { backgroundColor: Colors[colorScheme].card }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStripContent}
            >
              {recentDateButtons.map(day => {
                const selected = selectedDate === day.dateString;
                return (
                  <Pressable
                    key={day.dateString}
                    onPress={() => setSelectedDate(selected ? '' : day.dateString)}
                    style={[
                      styles.datePill,
                      {
                        backgroundColor: selected
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                        borderColor: selected
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.day} ${day.label}, ${day.count} events`}
                  >
                    <Text
                      style={[
                        styles.datePillDay,
                        { color: selected ? '#FFFFFF' : Colors[colorScheme].mutedText },
                      ]}
                    >
                      {day.day}
                    </Text>
                    <Text
                      style={[
                        styles.datePillDate,
                        { color: selected ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {day.label}
                    </Text>
                    {day.count > 0 ? (
                      <View
                        style={[
                          styles.datePillDot,
                          { backgroundColor: selected ? '#FFFFFF' : Colors[colorScheme].tint },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {calendarOpen ? (
              selectedDate ? (
                <ScrollView style={styles.selectedDateList}>
                  {selectedDateEvents.slice(0, 10).map(event => (
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
                        style={[styles.selectedDateMeta, { color: Colors[colorScheme].mutedText }]}
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
              ) : null
            ) : null}
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
              Loading events...
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
  dateStripPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 116,
    maxHeight: 230,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dateStripContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  datePill: {
    width: 58,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillDay: {
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  datePillDate: {
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  datePillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
  selectedDateList: {
    maxHeight: 140,
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
