export const AD_GEOFENCE_RADIUS_KM = 9;
export const AD_GEOFENCE_RADIUS_MILES = Number((AD_GEOFENCE_RADIUS_KM / 1.60934).toFixed(3));
export const AD_GEOFENCE_RADIUS_METERS = AD_GEOFENCE_RADIUS_KM * 1000;

export function getAdReachPreviewRegion(latitude: number, longitude: number) {
  const paddedRadiusMiles = AD_GEOFENCE_RADIUS_MILES * 1.08;
  const latitudeDelta = Math.max(0.14, (paddedRadiusMiles * 2) / 69);
  const milesPerLongitudeDegree = Math.max(69 * Math.cos((latitude * Math.PI) / 180), 1);
  const longitudeDelta = Math.max(0.14, (paddedRadiusMiles * 2) / milesPerLongitudeDegree);

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}
