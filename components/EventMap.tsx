/**
 * EventMap Component
 * 
 * Displays events on an interactive map with markers
 * Supports location-based filtering and current location
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { getMapProvider } from '@/utils/maps';

import { EventMapProps } from './EventMap.types';

export type { EventMapData, EventMapProps } from './EventMap.types';

export default function EventMap({
  events,
  onEventPress,
  initialRegion,
  showUserLocation = true,
  dataLoaded = true,
}: EventMapProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(true);
  const isUserInteractionRef = useRef(false);
  
  // Use initialRegion if provided, otherwise default to USA-wide view
  const defaultRegion: Region = initialRegion || {
    latitude: 39.8, // Default to center of USA
    longitude: -98.5,
    latitudeDelta: 50, // Wide view to show entire USA
    longitudeDelta: 50,
  };

  // Request location permissions and get user location
  useEffect(() => {
    void (async () => {
      try {
        if (showUserLocation) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            if (__DEV__) console.warn('Location permission not granted');
            setLoading(false);
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);

          // Auto-center on user location if no specific region was requested
          if (!initialRegion) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
              }, 800);
            }, 400);
          }
        }
      } catch (error) {
        if (__DEV__) console.error('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [showUserLocation, initialRegion]);

  // Filter events that have coordinates (use != null so lat/lng of 0 are accepted)
  const eventsWithCoordinates = events.filter(
    (event) => event.latitude != null && event.longitude != null
  );

  // Center map on all events
  const fitToEvents = () => {
    if (eventsWithCoordinates.length === 0) return;

    const coordinates = eventsWithCoordinates.map((event) => ({
      latitude: event.latitude!,
      longitude: event.longitude!,
    }));

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  // Auto-zoom to events when they first load
  useEffect(() => {
    if (eventsWithCoordinates.length > 0 && dataLoaded && !loading) {
      // Small delay to ensure map is fully mounted
      const timer = setTimeout(() => fitToEvents(), 500);
      return () => clearTimeout(timer);
    }
  }, [eventsWithCoordinates.length, dataLoaded, loading]);

  // Center map on user location
  const centerOnUser = () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Unable to get your current location');
      return;
    }

    isUserInteractionRef.current = true;
    mapRef.current?.animateToRegion({
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }, 1000);
    
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
        {eventsWithCoordinates.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude!,
              longitude: event.longitude!,
            }}
            pinColor={getMarkerColor(event.type)}
            // v1.0.2 fix: first tap shows the callout preview (default Marker behavior).
            // Navigation happens only on second tap (onCalloutPress below).
            // Previously onPress fired navigation immediately, skipping the preview.
            onCalloutPress={() => onEventPress?.(event.id, event.type)}
          >
            <Callout onPress={() => onEventPress?.(event.id, event.type)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{event.title}</Text>
                {event.location && (
                  <Text style={styles.calloutLocation}>{event.location}</Text>
                )}
                <Text style={styles.calloutDate}>
                  {new Date(event.date).toLocaleDateString()}
                </Text>
                <Text style={styles.calloutHint}>Tap for details</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {/* Center on Events Button */}
        {eventsWithCoordinates.length > 0 && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: Colors[colorScheme].background },
            ]}
            onPress={fitToEvents}
          >
            <Ionicons
              name="locate"
              size={24}
              color={Colors[colorScheme].tint}
            />
          </TouchableOpacity>
        )}

        {/* Center on User Button */}
        {showUserLocation && userLocation && (
          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: Colors[colorScheme].background },
            ]}
            onPress={centerOnUser}
          >
            <Ionicons
              name="navigate"
              size={24}
              color={Colors[colorScheme].tint}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Event Count */}
      {eventsWithCoordinates.length > 0 && (
        <View
          style={[
            styles.eventCount,
            { backgroundColor: Colors[colorScheme].background },
          ]}
        >
          <Text style={[styles.eventCountText, { color: Colors[colorScheme].text }]}>
            {eventsWithCoordinates.length} event{eventsWithCoordinates.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* No Events Message — only shown once parent confirms data is loaded */}
      {eventsWithCoordinates.length === 0 && dataLoaded && showEmptyState && (
        <View style={styles.noEventsContainer}>
          <TouchableOpacity
            style={[
              styles.noEventsCard,
              { backgroundColor: Colors[colorScheme].background },
            ]}
            onPress={() => setShowEmptyState(false)}
            activeOpacity={0.9}
          >
            <Ionicons
              name="map-outline"
              size={48}
              color={Colors[colorScheme].tint}
            />
            <Text style={[styles.noEventsTitle, { color: Colors[colorScheme].text }]}>
              No Games with Locations Yet
            </Text>
            <Text
              style={[styles.noEventsDescription, { color: Colors[colorScheme].mutedText }]}
            >
              Games will appear on the map once they have location data added. Teams can add locations when creating games.
            </Text>
            <View style={styles.emptyStateHints}>
              <View style={styles.hint}>
                <Ionicons name="information-circle" size={16} color={Colors[colorScheme].tint} />
                <Text style={[styles.hintText, { color: Colors[colorScheme].mutedText }]}>Create games with locations to see them on the map</Text>
              </View>
            </View>
            <Text
              style={[styles.noEventsDismiss, { color: Colors[colorScheme].mutedText }]}
            >
              Tap to dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    top: 16,
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
