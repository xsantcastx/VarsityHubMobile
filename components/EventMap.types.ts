// Region type - compatible with react-native-maps but defined here for web support
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

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
}
