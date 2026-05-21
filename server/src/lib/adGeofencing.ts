export const AD_GEOFENCE_RADIUS_KM = 9;
export const AD_GEOFENCE_RADIUS_MILES = Number((AD_GEOFENCE_RADIUS_KM / 1.60934).toFixed(3));

export function getAdBoundingBoxDegrees(latitude: number, paddingMultiplier: number = 1.15) {
  const paddedRadiusMiles = AD_GEOFENCE_RADIUS_MILES * paddingMultiplier;
  const latDegrees = paddedRadiusMiles / 69;
  const milesPerLongitudeDegree = Math.max(
    69 * Math.cos((latitude * Math.PI) / 180),
    1
  );
  const lngDegrees = paddedRadiusMiles / milesPerLongitudeDegree;

  return {
    lat: latDegrees,
    lng: lngDegrees,
  };
}
