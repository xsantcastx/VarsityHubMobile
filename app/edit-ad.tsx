import { ReachMapPreview } from '@/components/ReachMapPreview';
import { EditAdScreenBase } from '@/components/EditAdScreenBase';
import { AD_GEOFENCE_RADIUS_MILES } from '@/constants/adGeofencing';

export default function EditAdScreen() {
  return (
    <EditAdScreenBase
      showHeaderChevron
      renderReachPreview={(zipCode) => (
        <ReachMapPreview zipCode={zipCode} radiusMiles={AD_GEOFENCE_RADIUS_MILES} />
      )}
    />
  );
}
