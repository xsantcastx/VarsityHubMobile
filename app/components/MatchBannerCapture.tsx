import { uploadFile } from '@/api/upload';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import MatchBanner from './MatchBanner';

type Props = {
  leftImage?: string | null;
  rightImage?: string | null;
  leftName?: string;
  rightName?: string;
  bannerHeight?: number;
  onUploaded?: (url: string) => void;
  appearance?: 'classic' | 'sparkle' | 'sporty';
};

export default function MatchBannerCapture({ leftImage, rightImage, leftName, rightName, bannerHeight = 260, onUploaded, appearance = 'classic' }: Props) {
  const viewRef = useRef<View | null>(null);
  const [uploading, setUploading] = useState(false);

  const captureAndUpload = async () => {
    if (!viewRef.current) return;
    setUploading(true);
    try {
      // Capture banner as an image
      const uri = await captureRef(viewRef, { format: 'png', quality: 0.9 });

      // Determine API base URL (match upload helper usage pattern)
      const base = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

      // Upload image
      const uploaded = await uploadFile(base, uri, 'match-banner.png', 'image/png');
      const bannerUrl = uploaded?.url || uploaded?.path;
      if (onUploaded && bannerUrl) onUploaded(bannerUrl);
      Alert.alert('Banner saved', 'Match banner uploaded successfully.');
    } catch (e: any) {
      console.error('Banner capture/upload failed', e);
      Alert.alert('Error', 'Failed to capture or upload banner. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <ViewShot ref={(r: any) => { viewRef.current = r; }} options={{ format: 'png', quality: 0.9 }}>
  <MatchBanner leftImage={leftImage} rightImage={rightImage} leftName={leftName} rightName={rightName} height={bannerHeight} appearance={appearance} />
      </ViewShot>

      <Pressable onPress={captureAndUpload} style={{ marginTop: 12, padding: 12, backgroundColor: '#2563EB', borderRadius: 8, alignItems: 'center' }} disabled={uploading}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Capture & Upload Banner</Text>}
      </Pressable>
    </View>
  );
}
