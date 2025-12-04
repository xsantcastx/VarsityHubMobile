import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface ReachMapPreviewProps {
  zipCode: string;
  radiusKm?: number; // Default 15km (~10 miles)
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
export function ReachMapPreview({ zipCode, radiusKm = 15 }: ReachMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only geocode if we have a valid-looking ZIP code
    const trimmed = zipCode.trim();
    if (!trimmed || trimmed.length < 3) {
      setLocation(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    // Geocode ZIP code to lat/lng using Google Geocoding API
    // Note: This is a simple implementation. In production, you might want to:
    // 1. Cache results to avoid repeated API calls
    // 2. Use a backend endpoint to protect API keys
    // 3. Add rate limiting
    const geocodeZip = async () => {
      try {
        // Using Nominatim (OpenStreetMap) for free geocoding
        // Alternative: Use Google Geocoding API with your key
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(trimmed)}&countrycodes=us,ca&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'VarsityHub/1.0'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Geocoding failed');
        }

        const data = await response.json();
        
        if (!mounted) return;

        if (data && data.length > 0) {
          setLocation({
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
          });
          setError(null);
        } else {
          setLocation(null);
          setError('ZIP code not found');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Geocoding error:', err);
        setError('Unable to locate ZIP code');
        setLocation(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Debounce: wait 500ms after user stops typing
    const timer = setTimeout(geocodeZip, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
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
          <Ionicons name="location" size={20} color="#10B981" />
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
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
              Locating ZIP code...
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
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
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.5, // Adjust zoom level to show the full circle
              longitudeDelta: 0.5,
            }}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
          >
            {/* Center Marker */}
            <Marker
              coordinate={location}
              title={`ZIP ${zipCode}`}
              description="Your ad targeting center"
            >
              <View style={styles.markerContainer}>
                <Ionicons name="business" size={24} color="#10B981" />
              </View>
            </Marker>

            {/* Reach Circle */}
            <Circle
              center={location}
              radius={radiusMeters}
              strokeColor="rgba(16, 185, 129, 0.8)"
              fillColor="rgba(16, 185, 129, 0.2)"
              strokeWidth={2}
            />
          </MapView>
        )}

        {!location && !loading && !error && (
          <View style={styles.placeholderOverlay}>
            <Ionicons name="map-outline" size={48} color={Colors[colorScheme].mutedText} />
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
            <View style={[styles.legendDot, { backgroundColor: 'rgba(16, 185, 129, 0.4)' }]} />
            <Text style={[styles.legendText, { color: Colors[colorScheme].mutedText }]}>
              Ad reach area (~{radiusMiles} miles)
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
