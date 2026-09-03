import { getApiBaseUrl } from '@/api/http';
import { uploadFile } from '@/api/upload';
import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';
import * as ImageManipulator from 'expo-image-manipulator';

export async function uploadEventBannerFromUri(uri: string): Promise<string> {
  const localUri = await materializeICloudAssetIfNeeded(uri);
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  const uploadResult = await uploadFile(
    getApiBaseUrl(),
    manipulatedImage.uri,
    'event-banner.jpg',
    'image/jpeg'
  );
  const nextUrl = uploadResult?.url || uploadResult?.path;
  if (!nextUrl) {
    throw new Error('Upload failed - no URL returned');
  }
  return nextUrl;
}
