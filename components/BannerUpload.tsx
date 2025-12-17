/**
 * Banner Spec Upload Component
 * 
 * Handles banner/logo upload for advertisements with preview and fit options
 * Supports letterbox, fill, and stretch transformations
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type BannerFitMode = 'letterbox' | 'fill' | 'stretch';

type BannerPosition = { x: number; y: number }; // percent 0-100

interface BannerUploadProps {
  value?: string; // Current banner URL
  onChange: (uri: string, fitMode: BannerFitMode, position?: BannerPosition) => void;
  aspectRatio?: number; // Target aspect ratio (width/height), e.g., 16/9
  maxWidth?: number; // Max width for preview
  required?: boolean;
}

export function BannerUpload({
  value,
  onChange,
  aspectRatio = 16 / 9, // Default 16:9 banner
  maxWidth = 400,
  required = false,
}: BannerUploadProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [fitMode, setFitMode] = useState<BannerFitMode>('fill');
  const [uploading, setUploading] = useState(false);
  const [position, setPosition] = useState<BannerPosition>({ x: 50, y: 50 });
  const containerSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const panStart = useRef<BannerPosition>({ x: 50, y: 50 });
  const [showHint, setShowHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        if (blob.size > 5 * 1024 * 1024) {
          Alert.alert(
            'File Too Large',
            'Banner images must be under 5MB. Please choose a smaller image.'
          );
          return;
        }

        // Update with selected image
        onChange(asset.uri, fitMode, position);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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
        onPress: () => onChange('', fitMode, position),
      },
    ]);
  };

  const handleFitModeChange = (newMode: BannerFitMode) => {
    setFitMode(newMode);
    if (value) {
      onChange(value, newMode, position);
    }
  };

  const getContentFit = (): 'contain' | 'cover' | 'fill' => {
    switch (fitMode) {
      case 'letterbox':
        return 'contain'; // Fits entire image, may show bars
      case 'stretch':
        return 'fill'; // Stretches to fill, may distort
      case 'fill':
      default:
        return 'cover'; // Fills container, may crop
    }
  };

  // Quick, minimal hint when Fill mode is active
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
              style={styles.previewImage}
              contentFit={getContentFit()}
              contentPosition={
                fitMode === 'fill' ? `${position.x}% ${position.y}%` as any : 'center'
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
                <Ionicons name="hand-left-outline" size={16} color="#111827" />
                <Text style={styles.hintText}>Drag to adjust</Text>
              </Animated.View>
            )}
            {/* Drag overlay for reposition when Fill mode */}
            {fitMode === 'fill' && (
              <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={() => {
                  panStart.current = { ...position };
                }}
                onResponderMove={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  const { width, height } = containerSize.current;
                  if (!width || !height) return;
                  // Convert location to percentage and clamp
                  const xPct = clamp((locationX / width) * 100, 0, 100);
                  const yPct = clamp((locationY / height) * 100, 0, 100);
                  setPosition({ x: xPct, y: yPct });
                }}
                onResponderRelease={() => {
                  if (value) onChange(value, fitMode, position);
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

      {/* Fit Mode Selector */}
      {value && (
        <View style={styles.fitModeContainer}>
          <Text style={[styles.fitModeLabel, { color: Colors[colorScheme].text }]}>
            Banner Fit:
          </Text>
          <View style={styles.fitModeButtons}>
            {(['letterbox', 'fill', 'stretch'] as BannerFitMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.fitModeButton,
                  {
                    backgroundColor:
                      fitMode === mode
                        ? Colors[colorScheme].tint
                        : Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
                onPress={() => handleFitModeChange(mode)}
              >
                <Ionicons
                  name={getFitModeIcon(mode)}
                  size={18}
                  color={
                    fitMode === mode
                      ? '#FFFFFF'
                      : Colors[colorScheme].text
                  }
                />
                <Text
                  style={[
                    styles.fitModeButtonText,
                    {
                      color:
                        fitMode === mode
                          ? '#FFFFFF'
                          : Colors[colorScheme].text,
                    },
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Fit Mode Descriptions */}
      {value && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionText, { color: Colors[colorScheme].mutedText }]}>
            {getFitModeDescription(fitMode)}
          </Text>
          {fitMode === 'fill' && (
            <Text style={[styles.descriptionText, { color: Colors[colorScheme].mutedText }]}>Drag image to reposition</Text>
          )}
        </View>
      )}

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

function getFitModeIcon(mode: BannerFitMode): keyof typeof Ionicons.glyphMap {
  switch (mode) {
    case 'letterbox':
      return 'scan-outline';
    case 'stretch':
      return 'resize-outline';
    case 'fill':
    default:
      return 'crop-outline';
  }
}

function getFitModeDescription(mode: BannerFitMode): string {
  switch (mode) {
    case 'letterbox':
      return 'Fits entire image with padding bars (no cropping, no distortion)';
    case 'stretch':
      return 'Stretches image to fill entire space (may distort aspect ratio)';
    case 'fill':
    default:
      return 'Fills entire space by cropping edges (maintains aspect ratio)';
  }
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
  fitModeContainer: {
    gap: 8,
  },
  fitModeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fitModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  fitModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  fitModeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionContainer: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
