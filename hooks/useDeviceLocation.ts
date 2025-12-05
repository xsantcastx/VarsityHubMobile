import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface UseDeviceLocationResult {
  location: DeviceLocation | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean | null;
  accuracyMeters: number | null;
  isPrecise: boolean;
  needsPreciseAccuracy: boolean;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage device location with permission handling and caching.
 * Caches the location for 10 minutes to avoid excessive GPS requests.
 * Handles permission denial gracefully.
 */
export function useDeviceLocation(): UseDeviceLocationResult {
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  const PRECISION_THRESHOLD = 200; // meters; >200 == approximate on Android

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setPermissionGranted(granted);

      if (!granted) {
        setError('Location permission denied');
        setLoading(false);
        setAccuracyMeters(null);
        return false;
      }

      setError(null);
      setAccuracyMeters(null);
      await fetchLocation();
      return true;
    } catch (e: any) {
      const errMsg = e?.message || 'Failed to request location permission';
      setError(errMsg);
      setPermissionGranted(false);
      setLoading(false);
      setAccuracyMeters(null);
      return false;
    }
  };

  const assignLocation = (coords: Location.LocationObjectCoords, timestamp?: number) => {
    const loc: DeviceLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? undefined,
      timestamp,
    };
    setLocation(loc);
    setAccuracyMeters(typeof coords.accuracy === 'number' ? coords.accuracy : null);
  };

  const fetchLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const now = Date.now();
      if (location && now - lastFetchTime < CACHE_DURATION_MS) {
        setLoading(false);
        return;
      }

      // Try last known position first (faster, may be stale)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords && (now - (lastKnown.timestamp || 0)) < 30 * 60 * 1000) {
        // Last known is less than 30 minutes old
        assignLocation(lastKnown.coords, lastKnown.timestamp);
        setLastFetchTime(now);
        setLoading(false);
        return;
      }

      // Get fresh position with balanced accuracy
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (fresh?.coords) {
        assignLocation(fresh.coords, fresh.timestamp);
        setLastFetchTime(now);
        setError(null);
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Failed to fetch location';
      console.warn('[location] Fetch failed:', errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Check permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const granted = status === 'granted';
        setPermissionGranted(granted);

        if (granted) {
          setAccuracyMeters(null);
          void fetchLocation();
        } else {
          setLoading(false);
        }
      } catch {
        setError('Failed to check location permissions');
        setLoading(false);
      }
    })();
  }, [fetchLocation]);

  const openSettings = async () => {
    if (typeof Linking.openSettings !== 'function') return;
    try {
      await Linking.openSettings();
    } catch (err) {
      if (__DEV__) console.warn('[location] Unable to open settings', err);
    }
  };

  const refresh = async () => {
    setLastFetchTime(0); // Clear cache
    await fetchLocation();
  };

  const isPrecise = accuracyMeters == null ? true : accuracyMeters <= PRECISION_THRESHOLD;
  const needsPreciseAccuracy = Platform.OS === 'android' && permissionGranted === true && !isPrecise;

  return {
    location,
    loading,
    error,
    permissionGranted,
    accuracyMeters,
    isPrecise,
    needsPreciseAccuracy,
    requestPermission,
    openSettings,
    refresh,
  };
}

export default useDeviceLocation;
