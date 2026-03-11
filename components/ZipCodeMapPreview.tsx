import { geocodeLocation } from '@/api/geocoding';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getMapProvider } from '@/utils/maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

interface ZipCodeMapPreviewProps {
  zipCode: string;
  /** Label shown in the header. Default: "Your Area" */
  title?: string;
  /** Subtitle template. Use {zip} as placeholder. Default: "Showing location for ZIP {zip}" */
  subtitle?: string;
  /** Radius in km to show on the circle overlay. Default: 15 */
  radiusKm?: number;
  /** Whether to show the circle overlay. Default: true */
  showCircle?: boolean;
}

interface GeoLocation {
  latitude: number;
  longitude: number;
}

export function ZipCodeMapPreview({
  zipCode,
  title = 'Your Area',
  subtitle,
  radiusKm = 15,
  showCircle = true,
}: ZipCodeMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = zipCode.trim().replace(/\s+/g, '');
    if (!trimmed || trimmed.length < 5) {
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
        const result = await geocodeLocation(trimmed);
        if (!mounted || requestId !== requestIdRef.current) return;
        if (result) {
          setLocation({ latitude: result.latitude, longitude: result.longitude });
          setError(null);
        } else {
          setLocation(null);
          setError('ZIP code not found');
        }
        setLoading(false);
      } catch (err: any) {
        if (!mounted || requestId !== requestIdRef.current) return;
        if (err?.status === 401 || err?.status === 403) {
          setLocation(null);
          setError('Sign in to preview location');
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
          const t = setTimeout(() => geocodeZip(attempt + 1), Math.min(2000, (attempt + 1) * 700));
          timers.push(t);
          return;
        }
        setError('Unable to locate ZIP code');
        setLocation(null);
        setLoading(false);
      }
    };

    const timer = setTimeout(() => geocodeZip(0), 500);
    timers.push(timer);
    return () => { mounted = false; timers.forEach(clearTimeout); };
  }, [zipCode]);

  const radiusMeters = radiusKm * 1000;
  const _radiusMiles = Math.round(radiusKm * 0.621371);

  if (!zipCode.trim()) return null;

  const displaySubtitle = subtitle
    ? subtitle.replace('{zip}', zipCode)
    : `Showing location for ZIP ${zipCode}`;

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="location-on" size={20} color="#0EA5E9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>{displaySubtitle}</Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapWrapper}>
        {loading && (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>Locating ZIP code...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="error" size={40} color={Colors[colorScheme].destructive} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>{error}</Text>
          </View>
        )}

        {location && !loading && (
          <MapView
            provider={getMapProvider()}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.35,
              longitudeDelta: 0.35,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={location} title={`ZIP ${zipCode}`}>
              <View style={[styles.marker, { backgroundColor: Colors[colorScheme].card }]}>
                <MaterialIcons name="location-on" size={22} color="#0EA5E9" />
              </View>
            </Marker>

            {showCircle && (
              <Circle
                center={location}
                radius={radiusMeters}
                strokeColor="rgba(14, 165, 233, 0.6)"
                fillColor="rgba(14, 165, 233, 0.12)"
                strokeWidth={2}
              />
            )}
          </MapView>
        )}

        {!location && !loading && !error && (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="map" size={40} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>Enter a ZIP code to preview</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  mapWrapper: {
    height: 200,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  map: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  overlayText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  marker: {
    borderRadius: 18,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
