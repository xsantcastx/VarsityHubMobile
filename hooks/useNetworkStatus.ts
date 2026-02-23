/**
 * useNetworkStatus - Real-time device network connectivity
 *
 * Uses NetInfo to detect when the user loses or regains internet.
 * Complements AuthProvider's health check (which tests API reachability).
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // state.isConnected can be null on first fetch; treat as connected for initial UX
      setIsConnected(state.isConnected ?? true);
    });

    // Initial fetch
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isConnected, isOffline: isConnected === false };
}
