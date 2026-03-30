import type { Region } from 'react-native-maps';

export interface EventMapData {
  id: string;
  title: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  type?: 'game' | 'event' | 'post';
}

export interface EventMapProps {
  events: EventMapData[];
  onEventPress?: (eventId: string, eventType?: 'game' | 'event' | 'post') => void;
  initialRegion?: Region;
  showUserLocation?: boolean;
  /** Set to true once the parent has finished loading its data. The empty state is suppressed until then. */
  dataLoaded?: boolean;
}
