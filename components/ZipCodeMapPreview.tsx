import { GeocodedMapPreview } from '@/components/GeocodedMapPreview';

interface ZipCodeMapPreviewProps {
  zipCode: string;
  title?: string;
  subtitle?: string;
  radiusKm?: number;
  showCircle?: boolean;
}

export function ZipCodeMapPreview({
  zipCode,
  title = 'Your Area',
  subtitle,
  radiusKm = 15,
  showCircle = true,
}: ZipCodeMapPreviewProps) {
  const displaySubtitle = subtitle
    ? subtitle.replace('{zip}', zipCode)
    : `Showing location for ZIP ${zipCode}`;

  return (
    <GeocodedMapPreview
      zipCode={zipCode}
      title={title}
      subtitle={displaySubtitle}
      radiusKm={radiusKm}
      showCircle={showCircle}
      loadingText="Locating ZIP code..."
      emptyText="Enter a ZIP code to preview"
      signInErrorText="Sign in to preview location"
      markerTitle={`ZIP ${zipCode}`}
      headerIconName="location-on"
      headerIconColor="#0EA5E9"
      markerIconName="location-on"
      markerIconColor="#0EA5E9"
      circleStrokeColor="rgba(14, 165, 233, 0.6)"
      circleFillColor="rgba(14, 165, 233, 0.12)"
      latitudeDelta={0.35}
      longitudeDelta={0.35}
    />
  );
}
