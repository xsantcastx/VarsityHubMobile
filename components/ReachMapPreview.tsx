import { GeocodedMapPreview } from '@/components/GeocodedMapPreview';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ReachMapPreviewProps {
  zipCode: string;
  radiusKm?: number;
}

export function ReachMapPreview({ zipCode, radiusKm = 15 }: ReachMapPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const radiusMiles = Math.round(radiusKm * 0.621371);

  return (
    <GeocodedMapPreview
      zipCode={zipCode}
      radiusKm={radiusKm}
      title="Ad Reach Area"
      subtitle={`Your ad will be shown to users within ${radiusMiles} miles (${radiusKm}km) of ZIP ${zipCode}`}
      loadingText="Locating ZIP code..."
      emptyText="Enter a ZIP code to preview reach area"
      signInErrorText="Sign in to preview reach area"
      errorHint="Please enter a valid US or Canadian ZIP code"
      markerTitle={`ZIP ${zipCode}`}
      markerDescription="Your ad targeting center"
      headerIconName="location-on"
      headerIconColor="#10B981"
      markerIconName="business"
      markerIconColor={Colors[colorScheme].tint}
      circleStrokeColor="rgba(59, 130, 246, 0.6)"
      circleFillColor="rgba(59, 130, 246, 0.15)"
      latitudeDelta={0.6}
      longitudeDelta={1.8}
      scrollEnabled={true}
      zoomEnabled={true}
      legendItems={[
        { color: '#10B981', label: 'Your targeting center' },
        { color: 'rgba(59, 130, 246, 0.4)', label: `Ad reach area (~${radiusMiles} miles)` },
      ]}
    />
  );
}
