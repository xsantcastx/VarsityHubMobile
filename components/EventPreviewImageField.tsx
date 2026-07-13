import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getApiBaseUrl } from '@/api/http';
import { uploadFile } from '@/api/upload';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { optimizeImageUrl } from '@/utils/imageUrl';
import { pickerMediaTypesProp } from '@/utils/picker';

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
};

async function requestPickerPermission(kind: 'library' | 'camera') {
  if (kind === 'library') {
    return ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  return ImagePicker.requestCameraPermissionsAsync();
}

export default function EventPreviewImageField({
  value,
  onChange,
  label = 'Preview Photo',
  helperText = 'Upload a photo so the event has a proper preview on cards and detail pages.',
  disabled = false,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const [uploading, setUploading] = useState(false);

  const uploadAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      setUploading(true);
      try {
        const uploadResult = await uploadFile(
          getApiBaseUrl(),
          asset.uri,
          asset.fileName || 'event-preview.jpg',
          asset.mimeType || 'image/jpeg'
        );
        const nextUrl = uploadResult?.url || uploadResult?.path || null;
        if (!nextUrl) {
          throw new Error('Upload failed. No image URL was returned.');
        }
        onChange(nextUrl);
      } catch (error: any) {
        Alert.alert('Upload Failed', error?.message || 'Failed to upload the preview image.');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const pickFromLibrary = useCallback(async () => {
    const permission = await requestPickerPermission('library');
    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library access is required to choose an event image.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      ...pickerMediaTypesProp(),
      allowsEditing: true,
      // Event cards render banners at 4:5 (app/feed.tsx FullBleedCardImage) —
      // crop at the displayed ratio so uploads aren't re-cropped at render time.
      aspect: [4, 5],
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAsset(result.assets[0]);
    }
  }, [uploadAsset]);

  const takePhoto = useCallback(async () => {
    const permission = await requestPickerPermission('camera');
    if (permission.status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is required to take an event image.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      ...pickerMediaTypesProp(),
      allowsEditing: true,
      // Event cards render banners at 4:5 (app/feed.tsx FullBleedCardImage) —
      // crop at the displayed ratio so uploads aren't re-cropped at render time.
      aspect: [4, 5],
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAsset(result.assets[0]);
    }
  }, [uploadAsset]);

  const openPickerOptions = useCallback(() => {
    Alert.alert('Event Preview Photo', 'Choose how you want to add the preview image.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo Library', onPress: () => void pickFromLibrary() },
      { text: 'Take Photo', onPress: () => void takePhoto() },
    ]);
  }, [pickFromLibrary, takePhoto]);

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: Colors[colorScheme].text }]}>{label}</Text>
      <Text style={[styles.helperText, { color: Colors[colorScheme].mutedText }]}>
        {helperText}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: Colors[colorScheme].card,
            borderColor: Colors[colorScheme].border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {value ? (
          <Image
            source={{ uri: optimizeImageUrl(value, 1200) }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="image" size={28} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
              No preview image selected yet
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: Colors[colorScheme].tint },
              disabled && styles.disabledButton,
            ]}
            onPress={openPickerOptions}
            disabled={disabled || uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons
                  name={value ? 'photo-camera' : 'cloud-upload'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>
                  {value ? 'Change Photo' : 'Add Preview Photo'}
                </Text>
              </>
            )}
          </Pressable>

          {value ? (
            <Pressable
              style={[
                styles.secondaryButton,
                { borderColor: Colors[colorScheme].border },
                disabled && styles.disabledButton,
              ]}
              onPress={() => onChange(null)}
              disabled={disabled || uploading}
            >
              <MaterialIcons name="delete-outline" size={16} color={Colors[colorScheme].text} />
              <Text style={[styles.secondaryButtonText, { color: Colors[colorScheme].text }]}>
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '700',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 180,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
