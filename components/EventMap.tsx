/**
 * EventMap Component
 *
 * Displays events on an interactive map with markers
 * Supports location-based filtering and current location
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { captureBreadcrumb } from '@/utils/sentry';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { getMapProvider } from '@/utils/maps';
import { clusterByCoordinate } from '@/utils/mapClustering';

import { EventMapData, EventMapProps } from './EventMap.types';

export type { EventMapData, EventMapProps } from './EventMap.types';

export default function EventMap({
  events,
  onEventPress,
  initialRegion,
  showUserLocation = true,
  dataLoaded = true,
  onRefresh,
  hideCenterOnUser = false,
  onCalendarPress,
  calendarActive = false,
}: EventMapProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const mapRef = useRef<MapView>(null);
  const lastNavigationRef = useRef<{ id: string; ts: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(true);
  // The events sharing one map point when a cluster pin is tapped (picker list).
  const [selectedCluster, setSelectedCluster] = useState<EventMapData[] | null>(null);
  const isUserInteractionRef = useRef(false);
  // Search box — filters the visible pins/clusters by title substring (case-insensitive).
  const [searchQuery, setSearchQuery] = useState('');

  // Use initialRegion if provided, otherwise default to USA-wide view
  const defaultRegion: Region = initialRegion || {
    latitude: 39.8, // Default to center of USA
    longitude: -98.5,
    latitudeDelta: 50, // Wide view to show entire USA
    longitudeDelta: 50,
  };

  // Request location permissions and get user location
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (showUserLocation) {
          captureBreadcrumb('Map requested user location', 'map.location', {
            screen: 'EventMap',
          });
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          if (status !== 'granted') {
            if (__DEV__) console.warn('Location permission not granted');
            captureBreadcrumb(
              'Map location permission denied',
              'map.location',
              {
                screen: 'EventMap',
              },
              'warning'
            );
            setLoading(false);
            return;
          }

          // GPS can hang indefinitely indoors or in a crowd (e.g. a packed
          // stadium). Race the fix against a hard timeout so the map never
          // gets stuck on "Loading map..." — on timeout we proceed WITHOUT a
          // user location and still render every pin.
          const LOCATION_TIMEOUT_MS = 6000;
          const location = await Promise.race([
            Location.getCurrentPositionAsync({}),
            new Promise<null>(resolve => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
          ]);
          if (cancelled) return;

          if (!location) {
            if (__DEV__) console.warn('Location lookup timed out');
            captureBreadcrumb(
              'Map location lookup timed out',
              'map.location',
              {
                screen: 'EventMap',
              },
              'warning'
            );
          } else {
            setUserLocation(location);

            // Auto-center on user location if no specific region was requested
            if (!initialRegion) {
              setTimeout(() => {
                mapRef.current?.animateToRegion(
                  {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.15,
                    longitudeDelta: 0.15,
                  },
                  800
                );
              }, 400);
            }
          }
        }
      } catch (error) {
        if (__DEV__) console.error('Error getting location:', error);
        captureBreadcrumb(
          'Map location lookup failed',
          'map.location',
          {
            screen: 'EventMap',
          },
          'warning'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showUserLocation, initialRegion]);

  // Search filter — applied before the coordinate filter so it also thins out
  // the cluster groups (a search match inside a cluster surfaces on its own).
  const searchFilteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter(event => (event.title || '').toLowerCase().includes(query));
  }, [events, searchQuery]);

  // Filter events that have coordinates (use != null so lat/lng of 0 are accepted).
  // MUST be memoized: this array's identity drives the auto-fit effect below.
  // An unmemoized filter creates a new array every render, which used to
  // re-fire the "fit all pins" zoom on every state change (tapping a cluster
  // pin zoomed the map OUT to the continental view).
  const eventsWithCoordinates = useMemo(
    () => searchFilteredEvents.filter(event => event.latitude != null && event.longitude != null),
    [searchFilteredEvents]
  );

  // Group markers that share (near-)identical coordinates so a multi-day event
  // at one venue doesn't stack N markers on one pixel and read as a single pin
  // (the "7 events, 1 visible pin" bug). Groups of one render as a normal
  // marker; groups of many render as one numbered cluster pin that opens a
  // picker. Pure JS (no native clustering module) → OTA-safe. Pinned by
  // __tests__/mapClustering.test.ts.
  const clusters: EventMapData[][] = useMemo(
    () => clusterByCoordinate(eventsWithCoordinates),
    [eventsWithCoordinates]
  );

  // Center map on all events
  const fitToEvents = useCallback(() => {
    if (eventsWithCoordinates.length === 0) return;
    captureBreadcrumb('Map fit to events', 'map.navigation', {
      event_count: eventsWithCoordinates.length,
    });

    const coordinates = eventsWithCoordinates.map(event => ({
      latitude: event.latitude!,
      longitude: event.longitude!,
    }));

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  }, [eventsWithCoordinates]);

  // Auto-zoom to events ONCE per data load. Latched on the (memoized) events
  // array identity: a genuine reload (new array from setEvents) re-fits, but
  // re-renders from unrelated state changes (cluster picker open/close, etc.)
  // never do — re-firing here is what made the map zoom out on every tap.
  const lastAutoFitEventsRef = useRef<EventMapData[] | null>(null);
  useEffect(() => {
    if (eventsWithCoordinates.length === 0 || !dataLoaded || loading) return;
    if (lastAutoFitEventsRef.current === eventsWithCoordinates) return;
    lastAutoFitEventsRef.current = eventsWithCoordinates;
    // Small delay to ensure map is fully mounted
    const timer = setTimeout(() => fitToEvents(), 500);
    return () => clearTimeout(timer);
  }, [eventsWithCoordinates, dataLoaded, fitToEvents, loading]);

  // Center map on user location
  const centerOnUser = () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Unable to get your current location');
      return;
    }

    captureBreadcrumb('Map centered on user', 'map.navigation', {
      has_user_location: true,
    });
    isUserInteractionRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      },
      1000
    );

    // Reset flag after animation completes
    setTimeout(() => {
      isUserInteractionRef.current = false;
    }, 1100);
  };

  // Get marker color based on event type
  const getMarkerColor = (type?: string) => {
    switch (type) {
      case 'game':
        return '#FF6B6B'; // Red for games
      case 'event':
        return '#4ECDC4'; // Teal for events
      case 'post':
        return '#95E1D3'; // Light teal for posts
      default:
        return Colors[colorScheme].tint;
    }
  };

  const openEventFromMarker = (eventId: string, eventType?: 'game' | 'event' | 'post') => {
    const now = Date.now();
    const last = lastNavigationRef.current;
    if (last && last.id === eventId && now - last.ts < 1000) return;
    lastNavigationRef.current = { id: eventId, ts: now };
    onEventPress?.(eventId, eventType);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>
          Loading map...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={getMapProvider()}
        initialRegion={defaultRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        followsUserLocation={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        onRegionChangeComplete={() => {
          // Only track region changes if needed for future features
          // Don't update state to avoid re-render loop
        }}
      >
        {clusters.map(group => {
          const lead = group[0];
          const coordinate = { latitude: lead.latitude!, longitude: lead.longitude! };

          // Multiple events at the same point → one numbered cluster pin. Tapping
          // it opens a picker so every co-located event is reachable (zooming
          // can't separate markers that share an exact coordinate).
          if (group.length > 1) {
            return (
              <Marker
                key={`cluster-${coordinate.latitude},${coordinate.longitude}`}
                coordinate={coordinate}
                onPress={() => {
                  captureBreadcrumb('Map cluster pressed', 'map.navigation', {
                    cluster_size: group.length,
                  });
                  setSelectedCluster(group);
                }}
              >
                <View style={[styles.clusterPin, { backgroundColor: Colors[colorScheme].tint }]}>
                  <Text style={styles.clusterPinText}>{group.length}</Text>
                </View>
              </Marker>
            );
          }

          return (
            <Marker
              key={lead.id}
              coordinate={coordinate}
              pinColor={getMarkerColor(lead.type)}
              // v1.0.3: single-tap takes the user straight to the detail. The previous
              // two-tap flow (callout preview → details) was rejected as "two pages."
              // Keep onCalloutPress as a belt-and-braces fallback in case the native
              // callout still surfaces on some platforms.
              onPress={() => {
                captureBreadcrumb('Map marker pressed', 'map.navigation', {
                  event_type: lead.type || 'unknown',
                });
                openEventFromMarker(lead.id, lead.type);
              }}
              onCalloutPress={() => {
                captureBreadcrumb('Map marker callout pressed', 'map.navigation', {
                  event_type: lead.type || 'unknown',
                });
                openEventFromMarker(lead.id, lead.type);
              }}
            />
          );
        })}
      </MapView>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {/* Center on Events Button */}
        {eventsWithCoordinates.length > 0 && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: Colors[colorScheme].background }]}
            onPress={fitToEvents}
          >
            <Ionicons name="locate" size={24} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
        )}

        {/* Dates-tracker Button — owner note 8: replaces the middle
            "center on user" button on the Nearby Games page. Opens the parent's
            date picker so users can view past days' games/events. */}
        {onCalendarPress && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: calendarActive
                  ? Colors[colorScheme].tint
                  : Colors[colorScheme].background,
              },
            ]}
            onPress={onCalendarPress}
            accessibilityRole="button"
            accessibilityLabel="Pick a date to view past games"
          >
            <Ionicons
              name="calendar-outline"
              size={24}
              color={calendarActive ? '#FFFFFF' : Colors[colorScheme].tint}
            />
          </TouchableOpacity>
        )}

        {/* Center on User Button */}
        {!hideCenterOnUser && showUserLocation && userLocation && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: Colors[colorScheme].background }]}
            onPress={centerOnUser}
          >
            <Ionicons name="navigate" size={24} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
        )}

        {/* Refresh Button — re-runs the parent's data load so games added mid-event show up */}
        {onRefresh && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: Colors[colorScheme].background }]}
            onPress={() => {
              captureBreadcrumb('Map refresh pressed', 'map.navigation', {});
              onRefresh();
            }}
          >
            <Ionicons name="refresh" size={24} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Box — filters visible pins/clusters by title substring */}
      <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <Ionicons name="search" size={18} color={Colors[colorScheme].mutedText} />
        <TextInput
          style={[styles.searchInput, { color: Colors[colorScheme].text }]}
          placeholder="Search games or events..."
          placeholderTextColor={Colors[colorScheme].mutedText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors[colorScheme].mutedText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Event Count */}
      {eventsWithCoordinates.length > 0 && (
        <View style={[styles.eventCount, { backgroundColor: Colors[colorScheme].background }]}>
          <Text style={[styles.eventCountText, { color: Colors[colorScheme].text }]}>
            {eventsWithCoordinates.length} event{eventsWithCoordinates.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Pin legend — explains the marker colors ("what are these dots?"). */}
      {eventsWithCoordinates.length > 0 && (
        <View style={[styles.legend, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: getMarkerColor('game') }]} />
            <Text style={[styles.legendLabel, { color: Colors[colorScheme].text }]}>Game</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: getMarkerColor('event') }]} />
            <Text style={[styles.legendLabel, { color: Colors[colorScheme].text }]}>Event</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Colors[colorScheme].tint }]} />
            <Text style={[styles.legendLabel, { color: Colors[colorScheme].text }]}>
              Multiple — tap to zoom
            </Text>
          </View>
        </View>
      )}

      {/* No Events Message — only shown once parent confirms data is loaded */}
      {eventsWithCoordinates.length === 0 && dataLoaded && showEmptyState && (
        <View style={styles.noEventsContainer}>
          <TouchableOpacity
            style={[styles.noEventsCard, { backgroundColor: Colors[colorScheme].background }]}
            onPress={() => setShowEmptyState(false)}
            activeOpacity={0.9}
          >
            <Ionicons name="map-outline" size={48} color={Colors[colorScheme].tint} />
            <Text style={[styles.noEventsTitle, { color: Colors[colorScheme].text }]}>
              No Games with Locations Yet
            </Text>
            <Text style={[styles.noEventsDescription, { color: Colors[colorScheme].mutedText }]}>
              Games will appear on the map once they have location data added. Teams can add
              locations when creating games.
            </Text>
            <View style={styles.emptyStateHints}>
              <View style={styles.hint}>
                <Ionicons name="information-circle" size={16} color={Colors[colorScheme].tint} />
                <Text style={[styles.hintText, { color: Colors[colorScheme].mutedText }]}>
                  Create games with locations to see them on the map
                </Text>
              </View>
            </View>
            <Text style={[styles.noEventsDismiss, { color: Colors[colorScheme].mutedText }]}>
              Tap to dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cluster picker — tapping a numbered cluster pin lists the co-located events */}
      <Modal
        visible={!!selectedCluster}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCluster(null)}
      >
        <TouchableOpacity
          style={styles.clusterModalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedCluster(null)}
        >
          <View
            style={[styles.clusterSheet, { backgroundColor: Colors[colorScheme].background }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.clusterSheetTitle, { color: Colors[colorScheme].text }]}>
              {selectedCluster?.length ?? 0} events at this location
            </Text>
            <ScrollView style={styles.clusterList}>
              {(selectedCluster ?? []).map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.clusterRow, { borderColor: Colors[colorScheme].border }]}
                  onPress={() => {
                    setSelectedCluster(null);
                    openEventFromMarker(item.id, item.type);
                  }}
                >
                  <View
                    style={[styles.clusterDot, { backgroundColor: getMarkerColor(item.type) }]}
                  />
                  <View style={styles.clusterRowText}>
                    <Text
                      style={[styles.clusterRowTitle, { color: Colors[colorScheme].text }]}
                      numberOfLines={1}
                    >
                      {item.title || (item.type === 'game' ? 'Game' : 'Event')}
                    </Text>
                    {!!item.date && (
                      <Text
                        style={[styles.clusterRowMeta, { color: Colors[colorScheme].mutedText }]}
                        numberOfLines={1}
                      >
                        {new Date(String(item.date)).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors[colorScheme].mutedText}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  clusterPin: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  clusterPinText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  clusterModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  clusterSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: '60%',
  },
  clusterSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  clusterList: {
    flexGrow: 0,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clusterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  clusterRowText: {
    flex: 1,
  },
  clusterRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  clusterRowMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  searchContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  controls: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    gap: 12,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  eventCount: {
    position: 'absolute',
    top: 72,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  eventCountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  calloutDate: {
    fontSize: 12,
    color: '#999',
  },
  calloutHint: {
    fontSize: 11,
    color: '#1B3A6B',
    fontWeight: '600',
    marginTop: 6,
  },
  noEventsContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noEventsCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  noEventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  noEventsDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyStateHints: {
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 13,
    flex: 1,
  },
  noEventsDismiss: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
