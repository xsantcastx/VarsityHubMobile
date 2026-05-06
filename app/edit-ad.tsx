import { ReachMapPreview } from '@/components/ReachMapPreview';
import { EditAdScreenBase } from '@/components/EditAdScreenBase';

export default function EditAdScreen() {
  return (
    <EditAdScreenBase
      showHeaderChevron
      renderReachPreview={(zipCode) => <ReachMapPreview zipCode={zipCode} radiusKm={9} />}
    />
  );
}
