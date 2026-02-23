/**
 * useBannerUpload - Encapsulates banner pick + upload API calls
 * Components should use this hook to perform uploads; no API calls in the component.
 */

import { uploadFile } from '@/api/upload';
import { ensureUploadableUri } from '@/utils/ensureUploadableUri';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

export type BannerFitMode = 'rotate' | 'fill' | 'stretch';
export type BannerFitValue = BannerFitMode | `rotate:${number}`;
export type BannerPosition = { x: number; y: number };

export function getFitValue(mode: BannerFitMode, rotationDeg: number): BannerFitValue {
  const normalizeRotation = (deg: number) => {
    const mod = ((deg % 360) + 360) % 360;
    return mod > 180 ? mod - 360 : mod;
  };
  if (mode !== 'rotate') return mode;
  const rounded = Math.round(normalizeRotation(rotationDeg));
  return rounded !== 0 ? (`rotate:${rounded}` as const) : 'rotate';
}

export interface UseBannerUploadParams {
  fitMode: BannerFitMode;
  rotation: number;
  onChange: (uri: string, fitMode: BannerFitValue, position?: BannerPosition) => void;
  onUploadSuccess?: () => void; // e.g. reset scale/rotation/position when new image is selected
}

export interface UseBannerUploadResult {
  uploading: boolean;
  pickAndUpload: () => Promise<void>;
}

export function useBannerUpload({
  fitMode,
  rotation,
  onChange,
  onUploadSuccess,
}: UseBannerUploadParams): UseBannerUploadResult {
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = useCallback(async () => {
    setUploading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload banner images.'
        );
        setUploading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Validate image size (max 5MB) - local fetch for blob size
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

        onUploadSuccess?.();
        onChange(String(uploadedUrl), getFitValue(fitMode, rotation), { x: 50, y: 50 });
      }
    } catch (error: any) {
      if (
        error?.message?.includes('public.png') ||
        error?.message?.includes('Failed to read picked image')
      ) {
        Alert.alert(
          'Image Selection Failed',
          'Unable to load this image. This can happen with iCloud-synced photos. Please try selecting a different photo or take a new one with the camera.'
        );
      } else {
        Alert.alert(
          'Image Selection',
          "We couldn't use that image. Try a different photo or check storage permissions."
        );
      }
    } finally {
      setUploading(false);
    }
  }, [fitMode, rotation, onChange, onUploadSuccess]);

  return { uploading, pickAndUpload };
}
