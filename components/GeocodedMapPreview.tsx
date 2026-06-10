import { geocodeLocation } from '@/api/geocoding';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getMapProvider } from '@/utils/maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

type GeoLocation = {
  latitude: number;
  longitude: number;
};

type LegendItem = {
  color: string;
  label: string;
};

type GeocodedMapPreviewProps = {
  zipCode: string;
  title: string;
  subtitle: string;
  loadingText: string;
  emptyText: string;
  signInErrorText: string;
  markerTitle: string;
  headerIconName: React.ComponentProps<typeof MaterialIcons>['name'];
  headerIconColor: string;
  markerIconName: React.ComponentProps<typeof MaterialIcons>['name'];
  markerIconColor: string;
  markerDescription?: string;
  errorHint?: string;
  radiusKm?: number;
  showCircle?: boolean;
  circleStrokeColor?: string;
  circleFillColor?: string;
  latitudeDelta: number;
  longitudeDelta: number;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  legendItems?: LegendItem[];
};

export function GeocodedMapPreview({
  zipCode,
  title,
  subtitle,
  loadingText,
  emptyText,
  signInErrorText,
  markerTitle,
  headerIconName,
  headerIconColor,
  markerIconName,
  markerIconColor,
  markerDescription,
  errorHint,
  radiusKm = 15,
  showCircle = true,
  circleStrokeColor = 'rgba(14, 165, 233, 0.6)',
  circleFillColor = 'rgba(14, 165, 233, 0.12)',
  latitudeDelta,
  longitudeDelta,
  scrollEnabled = false,
  zoomEnabled = false,
  legendItems,
}: GeocodedMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const cleaned = zipCode.trim().replace(/\s+/g, '');
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
    const maxAttempts = 3;

    const geocodeZip = async (attempt: number) => {
      try {
        const result = await geocodeLocation(cleaned);
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
          setError(signInErrorText);
          setLoading(false);
          return;
        }
        if (err?.status === 404) {
          setLocation(null);
          setError('ZIP code not found');
          setLoading(false);
          return;
        }
        if (attempt + 1 < maxAttempts) {
          const retryTimer = setTimeout(
            () => geocodeZip(attempt + 1),
            Math.min(2000, (attempt + 1) * 700)
          );
          timers.push(retryTimer);
          return;
        }
        setError('Unable to locate ZIP code');
        setLocation(null);
        setLoading(false);
      }
    };

    const timer = setTimeout(() => geocodeZip(0), 500);
    timers.push(timer);
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [signInErrorText, zipCode]);

  if (!zipCode.trim()) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: Colors[colorScheme].card,
          borderColor: Colors[colorScheme].border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${headerIconColor}1A` }]}>
          <MaterialIcons name={headerIconName} size={20} color={headerIconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].mutedText }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={[styles.mapWrapper, { backgroundColor: Colors[colorScheme].surface }]}>
        {loading ? (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>
              {loadingText}
            </Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="error" size={40} color={Colors[colorScheme].destructive} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>
              {error}
            </Text>
            {errorHint ? (
              <Text style={[styles.hintText, { color: Colors[colorScheme].mutedText }]}>
                {errorHint}
              </Text>
            ) : null}
          </View>
        ) : null}

        {location && !loading ? (
          <MapView
            provider={getMapProvider()}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta,
              longitudeDelta,
            }}
            scrollEnabled={scrollEnabled}
            zoomEnabled={zoomEnabled}
            pitchEnabled={false}
            rotateEnabled={false}
            followsUserLocation={false}
          >
            <Marker coordinate={location} title={markerTitle} description={markerDescription}>
              <View style={[styles.marker, { backgroundColor: Colors[colorScheme].card }]}>
                <MaterialIcons name={markerIconName} size={22} color={markerIconColor} />
              </View>
            </Marker>

            {showCircle ? (
              <Circle
                center={location}
                radius={radiusKm * 1000}
                strokeColor={circleStrokeColor}
                fillColor={circleFillColor}
                strokeWidth={2}
              />
            ) : null}
          </MapView>
        ) : null}

        {!location && !loading && !error ? (
          <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
            <MaterialIcons name="map" size={40} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.overlayText, { color: Colors[colorScheme].mutedText }]}>
              {emptyText}
            </Text>
          </View>
        ) : null}
      </View>

      {location && !loading && legendItems?.length ? (
        <View style={[styles.legend, { borderTopColor: Colors[colorScheme].border }]}>
          {legendItems.map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendText, { color: Colors[colorScheme].mutedText }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
    height: 220,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  overlayText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  marker: {
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legend: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
