/**
 * useGameMap - Fetches games and events for map display
 * Encapsulates API calls for game-map.tsx
 */

import { Game } from '@/api/entities';
import { httpGet } from '@/api/http';
import { showLocationDeniedAlert } from '@/utils/locationAlerts';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type EventMapData = {
  id: string;
  title: string;
  date: string;
  location?: string;
  latitude: number;
  longitude: number;
  type: 'game' | 'event';
};

export interface UseGameMapParams {
  initialLat?: number | null;
  initialLng?: number | null;
}

export interface UseGameMapResult {
  events: EventMapData[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

const hasValidCoords = (item: any): boolean => {
  return (
    item.latitude != null &&
    item.longitude != null &&
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    !isNaN(item.latitude) &&
    !isNaN(item.longitude) &&
    item.latitude >= -90 &&
    item.latitude <= 90 &&
    item.longitude >= -180 &&
    item.longitude <= 180
  );
};

export function useGameMap(params: UseGameMapParams = {}): UseGameMapResult {
  const { initialLat, initialLng } = params;
  const [events, setEvents] = useState<EventMapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let lat = initialLat ?? null;
      let lng = initialLng ?? null;

      if (!lat || !lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        } else {
          showLocationDeniedAlert('map');
        }
      }

      const [gamesResult, eventsResponse] = await Promise.all([
        Game.list('-date', {}).catch((e) => {
          console.error('[useGameMap] Failed to fetch games:', e);
          return [];
        }),
        httpGet('/events?approval_status=approved&include_past=1').catch((e) => {
          console.error('[useGameMap] Failed to fetch events:', e);
          return [];
        }),
      ]);

      const gamesList = Array.isArray(gamesResult) ? gamesResult : gamesResult?.items ?? [];
      const eventsList = Array.isArray(eventsResponse) ? eventsResponse : eventsResponse?.items ?? [];

      const gameMarkers: EventMapData[] = gamesList.filter(hasValidCoords).map((game: any) => ({
        id: game.id,
        title: game.title || 'Game',
        date: game.date || new Date().toISOString(),
        location: game.location,
        latitude: game.latitude,
        longitude: game.longitude,
        type: 'game' as const,
      }));

      const eventMarkers: EventMapData[] = eventsList.filter(hasValidCoords).map((event: any) => ({
        id: event.id,
        title: event.title || 'Event',
        date: event.date || new Date().toISOString(),
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        type: 'event' as const,
      }));

      setEvents([...gameMarkers, ...eventMarkers]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load map data');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [initialLat, initialLng]);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, load };
}
