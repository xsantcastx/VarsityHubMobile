/**
 * Banner Spec Upload Component
 * 
 * Handles banner/logo upload for advertisements with preview and fit options
 * Supports fill transformation with pan/zoom
 */

import { uploadFile } from '@/api/upload';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ensureUploadableUri } from '@/utils/ensureUploadableUri';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type BannerFitMode = 'fill' | 'stretch';
type BannerFitValue = BannerFitMode;

type BannerPosition = { x: number; y: number }; // percent 0-100

interface BannerUploadProps {
  value?: string; // Current banner URL
  onChange: (uri: string, fitMode: BannerFitValue, position?: BannerPosition) => void;
  aspectRatio?: number; // Target aspect ratio (width/height), e.g., 16/9
  maxWidth?: number; // Max width for preview
  required?: boolean;
  onScrollLock?: (locked: boolean) => void;
}

export function BannerUpload({
  value,
  onChange,
  aspectRatio = 16 / 9, // Default 16:9 banner
  maxWidth = 400,
  required = false,
  onScrollLock,
}: BannerUploadProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [fitMode, setFitMode] = useState<BannerFitMode>('fill');
  const [uploading, setUploading] = useState(false);
  const [position, setPosition] = useState<BannerPosition>({ x: 50, y: 50 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const containerSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const panStart = useRef<BannerPosition>({ x: 50, y: 50 });
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialRotation = useRef(0);
  const [showHint, setShowHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const getFitValue = (mode: BannerFitMode): BannerFitValue => mode;

  const handlePickImage = async () => {
    setUploading(true);
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload banner images.'
        );
        setUploading(false);
        return;
      }

      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Allow full image without cropping
        quality: 0.9,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Validate image size (max 5MB)
        let fileSize = (asset as any)?.fileSize as number | undefined;
        if (!fileSize) {
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            fileSize = blob.size;
          } catch {
            // Continue upload without size validation
          }
        }

        if (fileSize && fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Banner images must be under 5MB. Please choose a smaller image.'
          );
          setUploading(false);
          return;
        }

        // Reset scale and rotation when new image is selected
        setScale(1);
        setRotation(0);
        setPosition({ x: 50, y: 50 });

        const rawName = asset.fileName || asset.uri.split('/').pop() || `banner_${Date.now()}.jpg`;
        const fileName = rawName.includes('.') ? rawName : `${rawName}.jpg`;
        const mimeType = (asset as any)?.mimeType as string | undefined;
        const uploadSource =
          Platform.OS === 'web'
            ? { uri: asset.uri, mimeType }
            : await ensureUploadableUri(asset.uri, mimeType);

        const uploaded = await uploadFile(null, uploadSource.uri, fileName, uploadSource.mimeType);
        const uploadedUrl = uploaded?.url || uploaded?.signed_url || uploaded?.path;
        if (!uploadedUrl) {
          throw new Error('Upload succeeded but no URL was returned.');
        }

        onChange(String(uploadedUrl), getFitValue(fitMode), { x: 50, y: 50 });
      }
    } catch (error: any) {
      const msg = error?.message || '';
      const isICloudError = msg.includes('iCloud') || msg.includes('not downloaded') || msg.includes('cloud asset');
      if (isICloudError) {
        Alert.alert(
          'Image Selection Failed',
          'Unable to load this image. This can happen with iCloud-synced photos. Please try selecting a different photo or take a new one with the camera.'
        );
      } else {
        Alert.alert(
          'Image Error',
          'Something went wrong loading this image. Please try a different photo or take a new one.'
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove Banner', 'Are you sure you want to remove this banner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onChange('', getFitValue(fitMode), position),
      },
    ]);
  };

  const handleFitModeChange = (newMode: BannerFitMode) => {
    setFitMode(newMode);
    if (value) {
      onChange(value, getFitValue(newMode), newMode === 'fill' ? position : { x: 50, y: 50 });
    }
  };

  const getContentFit = (): 'contain' | 'cover' => {
    return 'cover'; // Fills container, may crop
  };

  // Quick, minimal hint when Fill or Rotate mode is active
  useEffect(() => {
    if (value && fitMode === 'fill') {
      setShowHint(true);
      hintOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(hintOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setShowHint(false));
    }
  }, [value, fitMode, hintOpacity]);

  useEffect(() => {
    return () => {
      onScrollLock?.(false);
    };
  }, [onScrollLock]);

  // Calculate distance between two touches for pinch gesture
  const getDistance = (touch1: any, touch2: any): number => {
    if (!touch1 || !touch2) return 0;
    const dx = touch2.locationX - touch1.locationX;
    const dy = touch2.locationY - touch1.locationY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate angle between two touches for rotation
  const getAngle = (touch1: any, touch2: any): number => {
    if (!touch1 || !touch2) return 0;
    const dx = touch2.locationX - touch1.locationX;
    const dy = touch2.locationY - touch1.locationY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  return (
    <View style={styles.container}>
      {/* Upload/Preview Area */}
      <View
        style={[
          styles.previewContainer,
          {
            aspectRatio,
            maxWidth,
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
          },
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          containerSize.current = { width, height };
        }}
      >
        {value ? (
          <>
            <Image
              source={{ uri: value }}
              style={[
                styles.previewImage,
                fitMode === 'fill' && {
                  transform: [{ scale }, { rotate: `${rotation}deg` }],
                },
              ]}
              contentFit={getContentFit()}
              contentPosition={
                fitMode === 'fill'
                  ? { left: `${Math.round(position.x)}%`, top: `${Math.round(position.y)}%` }
                  : 'center'
              }
            />
            {/* Visual nudge hint */}
            {showHint && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.hintPill,
                  { opacity: hintOpacity },
                ]}
              >
                <Ionicons name="resize-outline" size={16} color="#111827" />
                <Text style={styles.hintText}>Pinch to zoom</Text>
              </Animated.View>
            )}
            {/* Gesture overlay for Fill mode */}
            {fitMode === 'fill' && (
              <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  onScrollLock?.(true);
                  panStart.current = { ...position };
                  initialScale.current = scale;
                  initialRotation.current = rotation;
                  const touches = Array.from(e.nativeEvent.touches);
                  if (touches.length >= 2) {
                    initialDistance.current = getDistance(touches[0], touches[1]);
                    initialRotation.current = getAngle(touches[0], touches[1]);
                  }
                }}
                onResponderMove={(e) => {
                  const touches = Array.from(e.nativeEvent.touches);
                  const { width, height } = containerSize.current;

                  if (touches.length >= 2) {
                    const currentDistance = getDistance(touches[0], touches[1]);
                    const currentAngle = getAngle(touches[0], touches[1]);

                    // Lazily initialize on the first 2-finger move frame
                    // (onResponderGrant fires on touch-start with only 1 finger,
                    // so initialDistance is still 0 when the second finger arrives)
                    if (initialDistance.current === 0) {
                      initialDistance.current = currentDistance;
                      initialScale.current = scale;
                      initialRotation.current = currentAngle;
                    }

                    if (fitMode === 'fill') {
                      // Pinch to zoom for Fill mode only
                      const newScale = clamp((currentDistance / initialDistance.current) * initialScale.current, 1, 3);
                      setScale(newScale);
                    }

                    // Rotation for Fill mode
                    const angleDiff = currentAngle - initialRotation.current;
                    const nextRotation = initialRotation.current + angleDiff;
                    setRotation(nextRotation);
                  } else if (touches.length === 1) {
                    // Reset pinch state when back to single finger
                    if (initialDistance.current !== 0) {
                      initialDistance.current = 0;
                    }
                    if (fitMode === 'fill') {
                      // Pan the image in fill mode (works at any zoom level)
                      const { locationX, locationY } = touches[0];
                      if (!width || !height) return;
                      const xPct = clamp((locationX / width) * 100, 0, 100);
                      const yPct = clamp((locationY / height) * 100, 0, 100);
                      setPosition({ x: xPct, y: yPct });
                    }
                  }
                }}
                onResponderRelease={() => {
                  // Reset pinch state so next gesture initializes fresh
                  initialDistance.current = 0;
                  onScrollLock?.(false);
                  if (!value) return;
                  if (fitMode === 'fill') {
                    onChange(value, getFitValue(fitMode), position);
                  } else {
                    onChange(value, getFitValue(fitMode), { x: 50, y: 50 });
                  }
                }}
                onResponderTerminate={() => {
                  initialDistance.current = 0;
                  onScrollLock?.(false);
                }}
              />
            )}
            <Pressable style={styles.removeButton} onPress={handleRemove}>
              <Ionicons name="close-circle" size={28} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.uploadPrompt} onPress={handlePickImage}>
            <Ionicons
              name="cloud-upload-outline"
              size={48}
              color={Colors[colorScheme].mutedText}
            />
            <Text style={[styles.uploadText, { color: Colors[colorScheme].text }]}>
              Tap to upload banner
            </Text>
            <Text style={[styles.uploadHint, { color: Colors[colorScheme].mutedText }]}>
              Recommended: 1920x1080 (16:9)
            </Text>
            <Text style={[styles.uploadHint, { color: Colors[colorScheme].mutedText }]}>
              Max size: 5MB
            </Text>
          </Pressable>
        )}
      </View>

      {/* Fit mode is always 'fill' — no selector needed */}

      {/* Upload button (alternative to tap-to-upload) */}
      {!value && (
        <Pressable
          style={[
            styles.uploadButton,
            { backgroundColor: Colors[colorScheme].tint },
          ]}
          onPress={handlePickImage}
        >
          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
          <Text style={styles.uploadButtonText}>
            {required ? 'Upload Banner (Required)' : 'Upload Banner'}
          </Text>
        </Pressable>
      )}

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadHint: {
    fontSize: 13,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hintPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  hintText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
});
