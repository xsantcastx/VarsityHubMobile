/**
 * ErrorToast - Global error notification component
 *
 * Usage:
 * import { showErrorToast } from '@/components/ErrorToast';
 * showErrorToast('Something went wrong!');
 */

import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'error' | 'success' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const toasts: Toast[] = [];
const listeners: Array<(toasts: Toast[]) => void> = [];

export function showErrorToast(message: string, duration = 4000) {
  showToast(message, 'error', duration);
}

export function showSuccessToast(message: string, duration = 3000) {
  showToast(message, 'success', duration);
}

export function showWarningToast(message: string, duration = 3500) {
  showToast(message, 'warning', duration);
}

export function showInfoToast(message: string, duration = 3000) {
  showToast(message, 'info', duration);
}

function showToast(message: string, type: ToastType, duration = 3000) {
  const toast: Toast = {
    id: Date.now().toString() + Math.random(),
    message,
    type,
    duration,
  };
  toasts.push(toast);
  notifyListeners();

  // Auto-dismiss
  setTimeout(() => {
    hideToast(toast.id);
  }, duration);
}

function hideToast(id: string) {
  const index = toasts.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
    notifyListeners();
  }
}

function notifyListeners() {
  listeners.forEach(listener => listener([...toasts]));
}

export function ErrorToastContainer() {
  const [visibleToasts, setVisibleToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setVisibleToasts(newToasts);
    };
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  }, []);

  if (visibleToasts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { top: insets.top + 10 },
        Platform.OS === 'web' ? { pointerEvents: 'box-none' } : null,
      ]}
      pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
    >
      {visibleToasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => hideToast(toast.id)} />
      ))}
    </View>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [slideAnim] = useState(new Animated.Value(-100));
  const [fadeAnim] = useState(new Animated.Value(0));
  const colorScheme = useColorScheme() ?? 'light';
  const _colors = Colors[colorScheme];
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    // Slide in and fade in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver,
        friction: 8,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fadeAnim and slideAnim are Animated.Values (ref-like), initial mount only
  }, []);

  const getToastStyle = () => {
    switch (toast.type) {
      case 'error':
        return { backgroundColor: '#ef4444', iconName: 'alert-circle' as const };
      case 'success':
        return { backgroundColor: '#22c55e', iconName: 'checkmark-circle' as const };
      case 'warning':
        return { backgroundColor: '#f59e0b', iconName: 'warning' as const };
      case 'info':
        return { backgroundColor: '#3b82f6', iconName: 'information-circle' as const };
      default:
        return { backgroundColor: '#ef4444', iconName: 'alert-circle' as const };
    }
  };

  const toastStyle = getToastStyle();

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: toastStyle.backgroundColor },
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <Ionicons name={toastStyle.iconName} size={24} color="#fff" style={styles.icon} />
      <Text style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    minWidth: 300,
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }),
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
