/**
 * EventMap Component
 * 
 * Displays events on an interactive map with markers
 * Supports location-based filtering and current location
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface EventMapData {
  id: string;
  title: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  type?: 'game' | 'event' | 'post';
}

interface EventMapProps {
  events: EventMapData[];
  onEventPress?: (eventId: string) => void;
  initialRegion?: Region;
  showUserLocation?: boolean;
}

export default function EventMap({
  events,
  onEventPress,
  initialRegion,
  showUserLocation = true,
}: EventMapProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>(
    initialRegion || {
      latitude: 37.78825, // Default to San Francisco
      longitude: -122.4324,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    }
  );

  // Request location permissions and get user location
  useEffect(() => {
    (async () => {
      try {
        if (showUserLocation) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.warn('Location permission not granted');
            setLoading(false);
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);

          // Center map on user location if no initial region
          if (!initialRegion) {
            setRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            });
          }
        }
      } catch (error) {
        console.error('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [showUserLocation, initialRegion]);

  // Filter events that have coordinates
  const eventsWithCoordinates = events.filter(
    (event) => event.latitude && event.longitude
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

  // Center map on user location
  const centerOnUser = () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Unable to get your current location');
      return;
    }

    setRegion({
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    });
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
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {eventsWithCoordinates.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude!,
              longitude: event.longitude!,
            }}
            pinColor={getMarkerColor(event.type)}
            onPress={() => onEventPress?.(event.id)}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{event.title}</Text>
                {event.location && (
                  <Text style={styles.calloutLocation}>{event.location}</Text>
                )}
                <Text style={styles.calloutDate}>
                  {new Date(event.date).toLocaleDateString()}
                </Text>
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

      {/* No Events Message */}
      {eventsWithCoordinates.length === 0 && (
        <View style={styles.noEventsContainer}>
          <View
            style={[
              styles.noEventsCard,
              { backgroundColor: Colors[colorScheme].background },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={Colors[colorScheme].icon}
            />
            <Text style={[styles.noEventsTitle, { color: Colors[colorScheme].text }]}>
              No Events with Locations
            </Text>
            <Text
              style={[styles.noEventsDescription, { color: Colors[colorScheme].icon }]}
            >
              Events will appear here once they have location data
            </Text>
          </View>
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
    marginBottom: 8,
  },
  noEventsDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});
