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
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type BannerFitMode = 'letterbox' | 'fill' | 'stretch';

interface BannerUploadProps {
  value?: string; // Current banner URL
  onChange: (uri: string, fitMode: BannerFitMode) => void;
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

  const handlePickImage = async () => {
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
        allowsEditing: true,
        aspect: [16, 9], // Suggest 16:9 crop
        quality: 1,
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
        onChange(asset.uri, fitMode);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove Banner', 'Are you sure you want to remove this banner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onChange('', fitMode),
      },
    ]);
  };

  const handleFitModeChange = (newMode: BannerFitMode) => {
    setFitMode(newMode);
    if (value) {
      onChange(value, newMode);
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
      >
        {value ? (
          <>
            <Image
              source={{ uri: value }}
              style={styles.previewImage}
              contentFit={getContentFit()}
            />
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
});
