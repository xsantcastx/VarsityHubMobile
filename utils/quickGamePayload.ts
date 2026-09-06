import type { QuickGameData } from '@/components/QuickAddGameModal';

/** Both quick-create entry points use the same local time, team and venue mapping. */
export function buildQuickGamePayload(data: QuickGameData): Record<string, unknown> {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date);
  const time = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(data.time);
  if (!date || !time) throw new Error('Choose a valid event date and time.');
  const [, year, month, day] = date.map(Number);
  const hour = Number(time[1]),
    minute = Number(time[2]);
  if (hour < 1 || hour > 12 || minute > 59) throw new Error('Choose a valid event time.');
  const instant = new Date(
    year,
    month - 1,
    day,
    (hour % 12) + (time[3].toUpperCase() === 'PM' ? 12 : 0),
    minute
  );
  if (
    instant.getFullYear() !== year ||
    instant.getMonth() !== month - 1 ||
    instant.getDate() !== day
  )
    throw new Error('Choose a valid event date.');
  const home = data.type === 'home';
  let location = home ? data.homeVenue : data.awayVenue;
  let latitude = home ? data.homeVenueLat : data.awayVenueLat;
  let longitude = home ? data.homeVenueLng : data.awayVenueLng;
  if (!data.isCompetitive) {
    if (data.eventType === 'watch_party') {
      location = data.watchLocation;
      latitude = data.watchLocationLat;
      longitude = data.watchLocationLng;
    } else if (data.eventType === 'team_trip') {
      location = data.destination;
      latitude = undefined;
      longitude = undefined;
    } else {
      location = data.homeVenue;
      latitude = data.homeVenueLat;
      longitude = data.homeVenueLng;
    }
  }
  if (!location?.trim()) throw new Error('Choose a location for this event.');
  const homeTeamId = data.isCompetitive
    ? home
      ? data.currentTeamId
      : data.opponentTeamId
    : data.currentTeamId;
  const awayTeamId = data.isCompetitive
    ? home
      ? data.opponentTeamId
      : data.currentTeamId
    : undefined;
  return {
    title: data.isCompetitive ? `${data.currentTeam} vs ${data.opponent}` : data.currentTeam,
    date: instant.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: location.trim(),
    latitude,
    longitude,
    description: data.description,
    home_team: data.isCompetitive ? (home ? data.currentTeam : data.opponent) : undefined,
    away_team: data.isCompetitive ? (home ? data.opponent : data.currentTeam) : undefined,
    home_team_id: homeTeamId || undefined,
    away_team_id: awayTeamId || undefined,
    away_team_name: data.isCompetitive && home && !awayTeamId ? data.opponent : undefined,
    event_type: data.eventType || (data.isCompetitive ? 'game' : 'other'),
    expected_attendance: data.expectedAttendance,
    donation_goal: data.donationGoal,
    watch_location: data.watchLocation,
    watch_location_lat: data.watchLocationLat,
    watch_location_lng: data.watchLocationLng,
    watch_location_place_id: data.watchLocationPlaceId,
    destination: data.destination,
    banner_url: data.banner_url,
    cover_image_url: data.banner_url || data.cover_image_url,
    appearance: data.appearance,
    live_window_hours_after_start: data.liveWindowHours,
  };
}
