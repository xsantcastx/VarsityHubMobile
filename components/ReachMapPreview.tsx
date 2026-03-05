import { geocodeLocation } from '@/api/geocoding';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { getMapProvider } from '@/utils/maps';

interface ReachMapPreviewProps {
  zipCode: string;
  radiusKm?: number; // Default 45km (~28 miles) matching ad targeting radius
}

interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Component that shows a Google Maps preview of the ad reach area
 * based on the advertiser's ZIP code. Displays a circle overlay
 * showing the radius of ad visibility.
 * 
 * Purpose: Build trust and transparency by showing advertisers
 * exactly where their ad will appear.
 */
export function ReachMapPreview({ zipCode, radiusKm = 45 }: ReachMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Only geocode if we have a valid-looking ZIP code
    const trimmed = zipCode.trim();
    const cleaned = trimmed.replace(/\s+/g, '');
    if (!cleaned || cleaned.length < 5) {
      setLocation(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const MAX_ATTEMPTS = 3;

    const geocodeZip = async (attempt: number) => {
      try {
        const result = await geocodeLocation(cleaned);

        if (!mounted || requestId !== requestIdRef.current) return;

        if (result) {
          setLocation({
            latitude: result.latitude,
            longitude: result.longitude,
          });
          setError(null);
        } else {
          setLocation(null);
          setError('ZIP code not found');
        }
        setLoading(false);
      } catch (err: any) {
        if (!mounted || requestId !== requestIdRef.current) return;
        console.error('Geocoding error:', err);

        if (err?.status === 401 || err?.status === 403) {
          setLocation(null);
          setError('Sign in to preview reach area');
          setLoading(false);
          return;
        }

        if (err?.status === 404) {
          setLocation(null);
          setError('ZIP code not found');
          setLoading(false);
          return;
        }

        if (attempt + 1 < MAX_ATTEMPTS) {
          const retryDelay = Math.min(2000, (attempt + 1) * 700);
          const retryTimer = setTimeout(() => geocodeZip(attempt + 1), retryDelay);
          timers.push(retryTimer);
          return;
        }

        setError('Unable to locate ZIP code');
        setLocation(null);
        setLoading(false);
      }
    };

    // Debounce: wait 500ms after user stops typing
    const timer = setTimeout(() => geocodeZip(0), 500);
    timers.push(timer);

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [zipCode]);

  // Calculate radius in meters for map
  const radiusMeters = radiusKm * 1000;

  // Calculate miles for display
  const radiusMiles = Math.round(radiusKm * 0.621371);

  if (!zipCode.trim()) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="location-on" size={20} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>
            Ad Reach Area
          </Text>
          <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Your ad will be shown to users within {radiusMiles} miles ({radiusKm}km) of ZIP {zipCode}
          </Text>
        </View>
      </View>

      {/* Map Container */}
      <View style={styles.mapWrapper}>
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: Colors[colorScheme].background }]}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
              Locating ZIP code...
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={[styles.errorOverlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="error" size={48} color={Colors[colorScheme].destructive} />
            <Text style={[styles.errorText, { color: Colors[colorScheme].mutedText }]}>
              {error}
            </Text>
            <Text style={[styles.errorHint, { color: Colors[colorScheme].mutedText }]}>
              Please enter a valid US or Canadian ZIP code
            </Text>
          </View>
        )}

        {location && !loading && (
          <MapView
            provider={getMapProvider()}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 1.8, // Sized to show full 45km radius circle
              longitudeDelta: 1.8,
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
            followsUserLocation={false}
          >
            {/* Center Marker */}
            <Marker
              coordinate={location}
              title={`ZIP ${zipCode}`}
              description="Your ad targeting center"
            >
              <View style={[styles.markerContainer, { backgroundColor: Colors[colorScheme].card }]}>
                <MaterialIcons name="business" size={24} color={Colors[colorScheme].tint} />
              </View>
            </Marker>

            {/* Reach Circle */}
            <Circle
              center={location}
              radius={radiusMeters}
              strokeColor="rgba(59, 130, 246, 0.6)"
              fillColor="rgba(59, 130, 246, 0.15)"
              strokeWidth={2}
            />
          </MapView>
        )}

        {!location && !loading && !error && (
          <View style={[styles.placeholderOverlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="map" size={48} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.placeholderText, { color: Colors[colorScheme].mutedText }]}>
              Enter a ZIP code to preview reach area
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      {location && !loading && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: Colors[colorScheme].mutedText }]}>
              Your targeting center
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(59, 130, 246, 0.4)' }]} />
            <Text style={[styles.legendText, { color: Colors[colorScheme].mutedText }]}>
              Ad reach area (~28 miles)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  mapWrapper: {
    height: 280,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 24,
    gap: 12,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 200,
  },
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legend: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
  },
});
