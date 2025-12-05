/**
 * OfflineBanner - Visible connectivity indicator
 * 
 * Shows when backend health check fails
 * Provides retry mechanism
 */

import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function OfflineBanner() {
  const { healthOk, healthError, checkAuth } = useAuth();
  const colorScheme = useColorScheme();

  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await checkAuth();
    } catch {
      // Error already handled by AuthProvider
    } finally {
      setRetrying(false);
    }
  };

  if (healthOk) return null;

  const errorColor = '#DC2626';
  const errorBg = '#FEE2E2';

  return (
    <View style={[styles.banner, { backgroundColor: errorBg }]}>
      <View style={styles.content}>
        <Ionicons 
          name="cloud-offline-outline" 
          size={20} 
          color={errorColor} 
        />
        <Text style={[styles.text, { color: errorColor }]}>
          {healthError || 'Unable to connect to server'}
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
