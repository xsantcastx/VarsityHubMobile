/**
 * Story Camera Component
 *
 * Quick camera capture for Stories (24-hour ephemeral content)
 * Opens camera directly, not gallery, for immediate capture
 */

import CustomActionModal from '@/components/CustomActionModal';
import VideoPlayer from '@/components/VideoPlayer';
import VideoTrimmer from '@/components/VideoTrimmer';
import { Colors } from '@/constants/Colors';
import { STORY_MAX_DURATION_S, VIDEO_CAPTURE_PRESET } from '@/constants/video';
import { useColorScheme } from '@/hooks/useColorScheme';
import { compressVideoSafe } from '@/utils/compressVideo';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [videoToTrim, setVideoToTrim] = useState<string | null>(null);
  const [trimmedUri, setTrimmedUri] = useState<string | null>(null);

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      setModal({
        visible: true,
        title: 'Camera Permission Required',
        message: 'Please enable camera access in your device settings to capture Stories.',
        options: [
          { label: 'Cancel', onPress: () => setModal(null) },
          {
            label: 'Open Settings',
            onPress: () => {
              setModal(null);
              void Linking.openSettings();
            },
            color: '#2563EB',
          },
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
        videoMaxDuration: STORY_MAX_DURATION_S,
        videoExportPreset: VIDEO_CAPTURE_PRESET,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.type === 'video') {
          // Show trim preview for videos
          setVideoToTrim(asset.uri);
          setTrimmedUri(null);
          return; // onCapture will be called after trim confirmation
        }
        onCapture(asset.uri, 'photo');
      }
    } catch (error) {
      if (__DEV__) console.error('Camera error:', error);
      setModal({
        visible: true,
        title: 'Camera Error',
        message: 'Unable to open camera. Please try again.',
        options: [{ label: 'OK', onPress: () => setModal(null), color: '#DC2626' }],
      });
    } finally {
      setCapturing(false);
    }
  };

  const confirmVideoTrim = useCallback(async () => {
    if (!videoToTrim) return;
    const sourceUri = trimmedUri ?? videoToTrim;
    // Compress before handing off; falls back to the original URI on any
    // failure, so this can never block the story.
    const uri = await compressVideoSafe(sourceUri);
    onCapture(uri, 'video');
    setVideoToTrim(null);
    setTrimmedUri(null);
  }, [videoToTrim, trimmedUri, onCapture]);

  const cancelVideoTrim = useCallback(() => {
    setVideoToTrim(null);
    setTrimmedUri(null);
  }, []);

  const trimModal = videoToTrim ? (
    <Modal visible transparent animationType="slide" onRequestClose={cancelVideoTrim}>
      <View style={styles.trimModalContainer}>
        <VideoPlayer uri={trimmedUri ?? videoToTrim} style={styles.trimPreview} />
        <VideoTrimmer
          uri={videoToTrim}
          onTrimComplete={u => setTrimmedUri(u)}
          onTrimReset={() => setTrimmedUri(null)}
        />
        <View style={styles.trimActions}>
          <Pressable onPress={cancelVideoTrim} style={styles.trimCancelBtn}>
            <Text style={styles.trimBtnText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={confirmVideoTrim} style={styles.trimConfirmBtn}>
            <Text style={styles.trimBtnText}>Use Video</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  ) : null;

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
              <MaterialIcons name="camera-alt" size={24} color="#FFFFFF" />
              <Text style={styles.fabLabel}>Story</Text>
            </>
          )}
        </Pressable>
        {trimModal}
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
            <MaterialIcons name="camera-alt" size={24} color={disabled ? '#9CA3AF' : '#2563EB'} />
          )}
        </Pressable>
        {trimModal}
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
            <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Add to Story</Text>
          </>
        )}
      </Pressable>
      {trimModal}
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
  trimModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 16,
  },
  trimPreview: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 12,
    alignSelf: 'center',
    maxHeight: 350,
  },
  trimActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  trimCancelBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  trimConfirmBtn: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  trimBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
