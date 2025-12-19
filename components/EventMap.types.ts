import type { Region } from 'react-native-maps';

export interface EventMapData {
  id: string;
  title: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  type?: 'game' | 'event' | 'post';
  sport?: string;
}

export interface EventMapProps {
  events: EventMapData[];
  onEventPress?: (eventId: string) => void;
  initialRegion?: Region;
  showUserLocation?: boolean;
}
