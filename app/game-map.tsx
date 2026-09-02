import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import SportFilterBar from '@/components/SportFilterBar';
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
// SafeAreaView removed — native header handles safe area
import DateTimePicker from '@react-native-community/datetimepicker';
import { httpGet } from '@/api/http';
import { buildMapDiscoveryPath, buildRecentDateButtons, toMapEvents } from '@/utils/mapDiscovery';
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
  // A picked past day fetches its own markers (past days sit outside the loaded
  // 5-day window). null = not in past-day mode.
  const [pastDayMarkers, setPastDayMarkers] = useState<EventMapData[] | null>(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => new Date());

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

  const handleCreatePostPress = useCallback(
    (event: EventMapData) => {
      const gameId = event.game_id || (event.type === 'game' ? event.id : null);
      const eventId = event.event_id || (event.type === 'event' ? event.id : null);
      if (!gameId && !eventId) return;

      router.push({
        pathname: '/create-post',
        params: {
          ...(gameId ? { gameId } : {}),
          ...(eventId ? { eventId } : {}),
          type: 'post',
        },
      });
    },
    [router]
  );

  // Sports actually present on the map right now — the filter only offers what
  // exists (no 🏒 chip when there's no hockey nearby).
  const presentSports = useMemo(
    () => Array.from(new Set(events.map(e => e.sport).filter((s): s is string => !!s))),
    [events]
  );

  const clearDate = useCallback(() => {
    setSelectedDate('');
    setPastDayMarkers(null);
  }, []);

  // Date chips are the last 7 days. Each day fetches its own map markers because
  // past days sit outside the default public map window; the server only returns
  // past event pages that carry a media post.
  const selectMapDate = useCallback(async (picked: Date) => {
    const start = new Date(
      Date.UTC(picked.getFullYear(), picked.getMonth(), picked.getDate(), 0, 0, 0, 0)
    );
    const end = new Date(
      Date.UTC(picked.getFullYear(), picked.getMonth(), picked.getDate(), 23, 59, 59, 999)
    );
    setSelectedDate(start.toISOString().split('T')[0]);
    setPastLoading(true);
    try {
      const path = `/event-discovery?surface=map&from=${encodeURIComponent(
        start.toISOString()
      )}&to=${encodeURIComponent(end.toISOString())}&limit=200`;
      const res: unknown = await httpGet(path);
      const items = validateEventCards('/event-discovery?surface=map', res);
      setPastDayMarkers(toMapEvents(items, new Date(), { includePast: true }));
    } catch (err) {
      if (__DEV__) console.error('[game-map] past-day load failed:', err);
      setPastDayMarkers([]);
    } finally {
      setPastLoading(false);
    }
  }, []);

  // Last 7 days as quick chips. Logic lives in utils/mapDiscovery.
  const recentDateButtons = useMemo(
    () => buildRecentDateButtons(calendarEvents, new Date(), 7),
    [calendarEvents]
  );

  // Markers on the map: a picked past day uses its own fetched set; a forward chip
  // filters the loaded set to that day; otherwise the full loaded set. The sport
  // filter applies on top in every case.
  const mapMarkers = useMemo(() => {
    let base: EventMapData[];
    if (pastDayMarkers !== null) {
      base = pastDayMarkers;
    } else if (selectedDate) {
      base = events.filter(
        e => e.date && new Date(e.date).toISOString().split('T')[0] === selectedDate
      );
    } else {
      base = events;
    }
    return selectedSport ? base.filter(e => e.sport === selectedSport) : base;
  }, [pastDayMarkers, selectedDate, events, selectedSport]);

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
          events={mapMarkers}
          onEventPress={handleEventPress}
          initialRegion={USA_WIDE_REGION}
          showUserLocation={true}
          dataLoaded={!loading}
          preventAutoCenterOnUser
          hideCenterOnUser
          autoFitPins={Boolean(selectedDate)}
          onCreatePostPress={handleCreatePostPress}
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
          <View style={styles.dateStripPanel} pointerEvents="box-none">
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
                    onPress={() => {
                      if (selected) {
                        clearDate();
                        return;
                      }
                      const [year, month, dayOfMonth] = day.dateString.split('-').map(Number);
                      void selectMapDate(new Date(year, month - 1, dayOfMonth));
                    }}
                    style={[
                      styles.dateChip,
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
                        styles.dateChipText,
                        { color: selected ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {day.day} {day.label}
                    </Text>
                    {day.count > 0 ? (
                      <View
                        style={[
                          styles.dateChipDot,
                          { backgroundColor: selected ? '#FFFFFF' : Colors[colorScheme].tint },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}

              {/* Trailing calendar button — pick any earlier day (past event pages
                  that carry a media post). Sits at the end of the same row. */}
              <Pressable
                onPress={() => setShowPicker(true)}
                style={[
                  styles.dateChip,
                  styles.calendarChip,
                  {
                    backgroundColor: Colors[colorScheme].background,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pick an earlier date"
              >
                <MaterialIcons name="event" size={18} color={Colors[colorScheme].tint} />
              </Pressable>

              {pastDayMarkers !== null ? (
                <Pressable
                  onPress={clearDate}
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: Colors[colorScheme].tint,
                      borderColor: Colors[colorScheme].tint,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Showing ${selectedDate}, tap to clear`}
                >
                  {pastLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={[styles.dateChipText, { color: '#FFFFFF' }]}>
                        {selectedDate}
                      </Text>
                      <MaterialIcons name="close" size={14} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        )}

        {showPicker &&
          (Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="slide">
              <View style={styles.pickerOverlay}>
                <View
                  style={[styles.pickerSheet, { backgroundColor: Colors[colorScheme].background }]}
                >
                  <View style={styles.pickerHeader}>
                    <Pressable onPress={() => setShowPicker(false)}>
                      <Text style={[styles.pickerCancel, { color: Colors[colorScheme].mutedText }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>
                      Pick a date
                    </Text>
                    <Pressable
                      onPress={() => {
                        setShowPicker(false);
                        void selectMapDate(pickerDate);
                      }}
                    >
                      <Text style={[styles.pickerDone, { color: Colors[colorScheme].tint }]}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="spinner"
                    onChange={(_, d) => d && setPickerDate(d)}
                    maximumDate={new Date()}
                    textColor={Colors[colorScheme].text}
                  />
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_, d) => {
                setShowPicker(false);
                if (d) void selectMapDate(d);
              }}
            />
          ))}

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
  // Transparent container — the date chips float directly on the map, no card behind them.
  dateStripPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 116,
  },
  dateStripContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Compact rounded chip (the earlier "dates tracker" look), single line "Tue 9/1".
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateChipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  // Trailing calendar button — square-ish chip holding just the icon.
  calendarChip: {
    paddingHorizontal: 12,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerCancel: {
    fontSize: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '700',
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
