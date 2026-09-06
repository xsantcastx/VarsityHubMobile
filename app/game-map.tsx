import EventMap, { EventMapData } from '@/components/EventMap';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { buildEventDetailRoute } from '@/utils/eventRoutes';
import { safeGoBack } from '@/utils/navigation';
import SportFilterBar from '@/components/SportFilterBar';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthProvider';
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
import { fetchDiscoveryItems } from '@/api/eventDiscovery';
import { SPORT_OPTIONS } from '@/constants/sports';
import { matchesDiscoveryLevel } from '@/shared/runtime/discoveryPolicy.js';
import { buildRecentDateButtons, toMapEvents } from '@/utils/mapDiscovery';

const USA_WIDE_REGION = {
  latitude: 39.8,
  longitude: -98.5,
  latitudeDelta: 50,
  longitudeDelta: 50,
};

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function GameMapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const { user } = useAuth();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => new Date());

  const defaultQuery = useQuery({
    queryKey: ['game-map', user?.id ?? null, 'default', selectedSport, selectedLevel],
    enabled: !selectedDate,
    queryFn: ({ signal }) =>
      fetchDiscoveryItems({ surface: 'map', sport: selectedSport, level: selectedLevel }, signal),
  });
  const selectedDayQuery = useQuery({
    queryKey: ['game-map', user?.id ?? null, 'date', selectedDate, selectedSport, selectedLevel],
    enabled: Boolean(selectedDate),
    queryFn: async ({ signal }) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const items = await fetchDiscoveryItems(
        {
          surface: 'map',
          from: start.toISOString(),
          to: end.toISOString(),
          sport: selectedSport,
          level: selectedLevel,
        },
        signal
      );
      return toMapEvents(items, new Date(), { includePast: true });
    },
  });
  // Each request writes only its own query key. Late responses cannot change
  // the selected day. Calendar counts use their own historical query below.
  const activeQuery = selectedDate ? selectedDayQuery : defaultQuery;
  const loading = activeQuery.isPending;
  const error = activeQuery.isError ? 'Unable to load events. Please check your connection.' : null;
  const events = useMemo(
    () => toMapEvents(defaultQuery.data, new Date(), { includePast: true }),
    [defaultQuery.data]
  );
  const historyWindow = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 6);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const historyQuery = useQuery({
    queryKey: ['game-map', user?.id ?? null, 'history', historyWindow],
    enabled: calendarOpen,
    queryFn: ({ signal }) => fetchDiscoveryItems({ surface: 'map', ...historyWindow }, signal),
  });
  const calendarEvents = useMemo(
    () =>
      toMapEvents(historyQuery.data, new Date(), { includePast: true }).filter(
        event =>
          matchesDiscoveryLevel(event.league_level, selectedLevel) &&
          (!selectedSport || event.sport === selectedSport)
      ),
    [historyQuery.data, selectedLevel, selectedSport]
  );
  const levelMarkers = useMemo(() => {
    const dateMarkers = selectedDate ? (selectedDayQuery.data ?? []) : events;
    return selectedLevel
      ? dateMarkers.filter(event => matchesDiscoveryLevel(event.league_level, selectedLevel))
      : dateMarkers;
  }, [selectedDate, selectedDayQuery.data, events, selectedLevel]);
  const loadGames = () => {
    void activeQuery.refetch();
  };

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

  const presentSports = SPORT_OPTIONS.map(sport => sport.slug);
  const clearDate = useCallback(() => {
    setSelectedDate('');
    setSelectedSport(null);
  }, []);
  const selectMapDate = useCallback((picked: Date) => {
    const start = new Date(picked);
    start.setHours(0, 0, 0, 0);
    setSelectedDate(toLocalDateKey(start));
    setSelectedSport(null);
  }, []);

  // Last 7 days as quick chips. Logic lives in utils/mapDiscovery.
  const recentDateButtons = useMemo(
    () => buildRecentDateButtons(calendarEvents, new Date(), 7),
    [calendarEvents]
  );

  const mapMarkers = useMemo(
    () =>
      selectedSport ? levelMarkers.filter(event => event.sport === selectedSport) : levelMarkers,
    [levelMarkers, selectedSport]
  );

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
          onRefresh={!loading ? loadGames : undefined}
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

        {!loading && !error && (
          <View style={styles.levelStripPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStripContent}
            >
              {[
                { label: 'All', value: null },
                { label: 'Major', value: 'major' },
                { label: 'Minor', value: 'minor' },
                { label: 'NCAA', value: 'college' },
                { label: 'Other', value: 'other' },
              ].map(level => (
                <Pressable
                  key={level.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${level.label} leagues`}
                  accessibilityState={{ selected: selectedLevel === level.value }}
                  onPress={() => {
                    setSelectedLevel(level.value);
                    setSelectedSport(null);
                  }}
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor:
                        selectedLevel === level.value
                          ? Colors[colorScheme].tint
                          : Colors[colorScheme].background,
                      borderColor: Colors[colorScheme].border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      {
                        color: selectedLevel === level.value ? '#FFFFFF' : Colors[colorScheme].text,
                      },
                    ]}
                  >
                    {level.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {calendarOpen && (
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
                    accessibilityLabel={`${day.day} ${day.label}${historyQuery.isSuccess ? `, ${day.count} events` : ', count unavailable'}`}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        { color: selected ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {day.day} {day.label}
                    </Text>
                    {historyQuery.isSuccess && day.count > 0 ? (
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

              {/* Trailing calendar button — pick any earlier day. Sits at the end
                  of the same row. */}
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

              {selectedDate ? (
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
                  {loading ? (
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
          <View style={styles.loadingOverlay} pointerEvents="box-none">
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
              Loading events...
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.loadingOverlay} pointerEvents="box-none">
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
                loadGames();
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
  levelStripPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 116,
  },
  dateStripPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 160,
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
