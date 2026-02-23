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
    Text
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
        allowsEditing: false,
        quality: 0.9,
        exif: false,
        videoMaxDuration: 60, // 60 second max for Stories
        videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540, // Force transcode
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
});
