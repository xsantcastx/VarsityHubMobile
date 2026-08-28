import type { Region } from 'react-native-maps';

export interface EventMapData {
  id: string;
  title: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  type?: 'game' | 'event' | 'post';
  /** Canonical sport slug (see constants/sports.ts) — drives the map sport filter. */
  sport?: string | null;
}

export interface EventMapProps {
  events: EventMapData[];
  onEventPress?: (eventId: string, eventType?: 'game' | 'event' | 'post') => void;
  initialRegion?: Region;
  showUserLocation?: boolean;
  /** Set to true once the parent has finished loading its data. The empty state is suppressed until then. */
  dataLoaded?: boolean;
  /** When provided, renders a refresh control button that re-runs the parent's data load (e.g. so games added mid-event appear without leaving the map). */
  onRefresh?: () => void;
  /** Hide the "center on user" (navigate) control button. Owner note 8: the map's
   *  middle button is replaced by the dates tracker on the Nearby Games page. */
  hideCenterOnUser?: boolean;
  /** When provided, renders a calendar/dates-tracker control button (in place of
   *  the removed center-on-user button) that opens the parent's date picker. */
  onCalendarPress?: () => void;
  /** Highlights the calendar control when a specific date is being viewed. */
  calendarActive?: boolean;
  /** Start on a wide (country-wide) view instead of auto-zooming to the user.
   *  The map still fits to the loaded pins; "center on me" becomes a button. */
  startWide?: boolean;
}
