/**
 * OfflineBanner - Real-time connectivity indicator
 *
 * Shows when device loses network connectivity (via NetInfo) OR backend health check fails.
 * Hides immediately when connectivity is restored.
 */

import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// NetInfo is a native module — dynamically import so OTA updates
// don't crash on binaries built before it was added.
let NetInfoModule: typeof import('@react-native-community/netinfo').default | null = null;
try {
  NetInfoModule = require('@react-native-community/netinfo').default;
} catch {
  // Native module not available in this binary — fall back to health-check only
}

export function OfflineBanner() {
  const { healthOk, healthError, checkAuth } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  const [retrying, setRetrying] = useState(false);
  const [networkConnected, setNetworkConnected] = useState(true);

  // Listen for real-time connectivity changes (only if native module exists)
  useEffect(() => {
    if (!NetInfoModule) return;
    const unsubscribe = NetInfoModule.addEventListener((state) => {
      const isConnected = state.isConnected !== false && state.isInternetReachable !== false;
      setNetworkConnected(isConnected);
      // When connectivity returns, auto-retry the health check
      if (isConnected && !healthOk) {
        checkAuth().catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [healthOk, checkAuth]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await checkAuth();
    } catch (error) {
      if (__DEV__) console.warn('[OfflineBanner] Retry checkAuth error:', error);
    } finally {
      setRetrying(false);
    }
  };

  // Show banner if device is offline OR backend health check failed
  const isOffline = !networkConnected || !healthOk;
  if (!isOffline) return null;

  const errorColor = colorScheme === 'dark' ? '#FCA5A5' : '#DC2626';
  const errorBg = colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2';

  const message = !networkConnected
    ? 'No internet connection'
    : (healthError || 'Unable to connect to server');

  return (
    <View style={[styles.banner, { backgroundColor: errorBg }]}>
      <View style={styles.content}>
        <MaterialIcons
          name={networkConnected ? 'cloud-off' : 'wifi-off'}
          size={20}
          color={errorColor}
        />
        <Text style={[styles.text, { color: errorColor }]}>
          {message}
        </Text>
      </View>
      <Pressable
        onPress={handleRetry}
        disabled={retrying}
        style={[styles.retryButton, { backgroundColor: errorColor }]}
      >
        <Text style={styles.retryText}>
          {retrying ? 'Retrying...' : 'Retry'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
