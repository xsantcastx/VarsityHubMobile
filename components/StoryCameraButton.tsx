/**
 * Story Camera Component
 * 
 * Quick camera capture for Stories (24-hour ephemeral content)
 * Opens camera directly, not gallery, for immediate capture
 */

import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';

interface StoryCameraButtonProps {
  onCapture: (mediaUri: string, mediaType: 'photo' | 'video') => void;
  variant?: 'button' | 'fab' | 'icon';
  disabled?: boolean;
}

/**
 * Button to trigger Story camera
 * Opens camera directly (not gallery) per AC requirements
 */
export function StoryCameraButton({
  onCapture,
  variant = 'button',
  disabled = false,
}: StoryCameraButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [capturing, setCapturing] = useState(false);
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    options: Array<{ label: string; onPress: () => void; color?: string }>;
  } | null>(null);

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      setModal({
        visible: true,
        title: 'Camera Permission Required',
        message: 'Please enable camera access in your device settings to capture Stories.',
        options: [
          { label: 'OK', onPress: () => setModal(null), color: '#2563EB' },
        ],
      });
      return false;
    }
    
    return true;
  };

  const openCamera = async () => {
    if (disabled || capturing) return;

    setCapturing(true);
    
    try {
      // Request camera permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        setCapturing(false);
        return;
      }

      // Launch camera (not gallery)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60, // 60 second max for Stories
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'photo';
        onCapture(asset.uri, mediaType);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setModal({
        visible: true,
        title: 'Camera Error',
        message: 'Unable to open camera. Please try again.',
        options: [
          { label: 'OK', onPress: () => setModal(null), color: '#DC2626' },
        ],
      });
    } finally {
      setCapturing(false);
    }
  };

  // Render based on variant
  if (variant === 'fab') {
    return (
      <>
        <Pressable
          style={[styles.fab, disabled && styles.fabDisabled]}
          onPress={openCamera}
          disabled={disabled || capturing}
        >
          {capturing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.fabLabel}>Story</Text>
            </>
          )}
        </Pressable>
        {modal && (
          <CustomActionModal
            visible={modal.visible}
            title={modal.title}
            message={modal.message}
            options={modal.options}
            onClose={() => setModal(null)}
          />
        )}
      </>
    );
  }

  if (variant === 'icon') {
    return (
      <>
        <Pressable
          style={[styles.iconButton, disabled && styles.iconButtonDisabled]}
          onPress={openCamera}
          disabled={disabled || capturing}
          accessibilityLabel="Add to Story"
          accessibilityRole="button"
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="camera" size={24} color={disabled ? '#9CA3AF' : '#2563EB'} />
          )}
        </Pressable>
        {modal && (
          <CustomActionModal
            visible={modal.visible}
            title={modal.title}
            message={modal.message}
            options={modal.options}
            onClose={() => setModal(null)}
          />
        )}
      </>
    );
  }

  // Default: button variant
  return (
    <>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: Colors[colorScheme].tint },
          disabled && styles.buttonDisabled,
        ]}
        onPress={openCamera}
        disabled={disabled || capturing}
        accessibilityLabel="Add to Story"
        accessibilityRole="button"
      >
        {capturing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Add to Story</Text>
          </>
        )}
      </Pressable>
      {modal && (
        <CustomActionModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          options={modal.options}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

/**
 * Story capture with timer indicator
 */
export function StoryCameraWithTimer({ onCapture }: { onCapture: (mediaUri: string) => void }) {
  const [showTimer, setShowTimer] = useState(false);

  const handleCapture = (uri: string, type: 'photo' | 'video') => {
    if (type === 'photo') {
      // Show 24-hour timer for Stories
      setShowTimer(true);
      setTimeout(() => setShowTimer(false), 3000);
    }
    onCapture(uri);
  };

  return (
    <View style={styles.timerContainer}>
      <StoryCameraButton onCapture={handleCapture} variant="button" />
      {showTimer && (
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={14} color="#FFFFFF" />
          <Text style={styles.timerText}>Expires in 24h</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Compact Story button for headers/toolbars
 */
export function StoryCameraCompact({ onCapture }: { onCapture: (uri: string) => void }) {
  return (
    <StoryCameraButton
      onCapture={(uri) => onCapture(uri)}
      variant="icon"
    />
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minHeight: 44, // Accessibility: minimum tap target
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7C3AED', // Purple for Stories
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 2,
  },
  fabDisabled: {
    opacity: 0.5,
  },
  fabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  timerContainer: {
    position: 'relative',
  },
  timerBadge: {
    position: 'absolute',
    bottom: -24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
