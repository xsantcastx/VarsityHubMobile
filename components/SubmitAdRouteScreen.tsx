import { SubmitAdScreenBase } from '@/components/SubmitAdScreenBase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

type SubmitAdRouteScreenProps = {
  showReachPreview: boolean;
  safeAreaEdges: Array<'top' | 'bottom' | 'left' | 'right'>;
  respectTopInset: boolean;
};

export function SubmitAdRouteScreen({
  showReachPreview,
  safeAreaEdges,
  respectTopInset,
}: SubmitAdRouteScreenProps) {
  const params = useLocalSearchParams<{ zip?: string }>();
  const [zip, setZip] = useState('');

  useEffect(() => {
    const nextZip = Array.isArray(params.zip) ? params.zip[0] : params.zip;
    if (typeof nextZip === 'string' && nextZip.trim()) {
      setZip(nextZip.trim());
    }
  }, [params.zip]);

  return (
    <SubmitAdScreenBase
      zip={zip}
      setZip={setZip}
      showReachPreview={showReachPreview}
      safeAreaEdges={safeAreaEdges}
      respectTopInset={respectTopInset}
    />
  );
}
