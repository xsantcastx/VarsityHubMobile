/**
 * OfflineBanner - Visible connectivity indicator
 *
 * Shows when:
 * - Device has no internet (NetInfo) → "You're offline"
 * - Device online but backend unreachable (health check) → "Unable to connect to server"
 *
 * On reconnect: automatically retries health check and clears banner.
 */

import { useAuth } from '@/context/AuthProvider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function OfflineBanner() {
  const { healthOk, healthError, checkAuth } = useAuth();
  const { isOffline } = useNetworkStatus();
  const colorScheme = useColorScheme() ?? 'light';
  const wasOfflineRef = useRef(false);

  const [retrying, setRetrying] = React.useState(false);

  // Auto-retry when device reconnects (transitions from offline to online)
  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      wasOfflineRef.current = false;
      void (async () => {
        setRetrying(true);
        try {
          await checkAuth();
        } catch {
          // Error already handled by AuthProvider
        } finally {
          setRetrying(false);
        }
      })();
    } else if (isOffline) {
      wasOfflineRef.current = true;
    }
  }, [isOffline, checkAuth]);

  const handleRetry = async () => {
    if (isOffline) return; // Retry only makes sense when device has connection
    setRetrying(true);
    try {
      await checkAuth();
    } catch {
      // Error already handled by AuthProvider
    } finally {
      setRetrying(false);
    }
  };

  const showBanner = isOffline || !healthOk;
  if (!showBanner) return null;

  const errorColor = colorScheme === 'dark' ? '#FCA5A5' : '#DC2626';
  const errorBg = colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2';
  const message = isOffline
    ? "You're offline. Check your connection."
    : (healthError || 'Unable to connect to server');

  return (
    <View style={[styles.banner, { backgroundColor: errorBg }]}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={20} color={errorColor} />
        <Text style={[styles.text, { color: errorColor }]}>{message}</Text>
      </View>
      {!isOffline && (
        <Pressable
          onPress={handleRetry}
          disabled={retrying}
          style={[styles.retryButton, { backgroundColor: errorColor }]}
        >
          <Text style={styles.retryText}>
            {retrying ? 'Retrying...' : 'Retry'}
          </Text>
        </Pressable>
      )}
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
