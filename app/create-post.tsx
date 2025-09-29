import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Image as RNImage, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedGestureHandler, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  runOnJS,
  interpolate 
} from 'react-native-reanimated';
// @ts-ignore
import { Post, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { Input } from '@/components/ui/input';
import VideoPlayer from '@/components/VideoPlayer';
import PrimaryButton from '@/ui/PrimaryButton';
import { pickerMediaTypeFor } from '@/utils/picker';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId?: string; type?: string }>();
  const gameId = params?.gameId ? String(params.gameId) : undefined;
  const postType = params?.type === 'highlight' ? 'highlight' : 'post';
  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video'; mime?: string } | null>(null);
  const [shareLocation, setShareLocation] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locGranted, setLocGranted] = useState<boolean | null>(null);

  // Animation values for swipe gesture
  const translateY = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);
  const cameraScale = useSharedValue(1);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setLocGranted(granted);
        if (granted) {
          const last = await Location.getLastKnownPositionAsync();
          const fresh = last && (Date.now() - (last.timestamp || 0)) < 10 * 60 * 1000 ? last : null;
          const pos = fresh || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (pos?.coords) { setLat(pos.coords.latitude); setLng(pos.coords.longitude); }
        }
      } catch { setLocGranted(false); }
    })();
  }, []);

  const pickFromLibrary = async (media: 'image' | 'video') => {
    const r = await ImagePicker.launchImageLibraryAsync({
      ...(pickerMediaTypeFor(media)),
      quality: media === 'image' ? 0.85 : undefined,
      videoMaxDuration: 30,
    } as any);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      let uri = a.uri;
      if (media === 'image') {
        // Compress/resize image before upload
        try {
          const result = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = result.uri;
        } catch {}
      }
      setPicked({ uri, type: media, mime: a.mimeType || (media === 'image' ? 'image/jpeg' : 'video/mp4') });
    }
  };

  const captureWithCamera = async (media: 'image' | 'video') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to capture media.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      ...(pickerMediaTypeFor(media)),
      quality: media === 'image' ? 0.85 : undefined,
      videoMaxDuration: 30,
    } as any);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      let uri = a.uri;
      if (media === 'image') {
        try {
          const result = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = result.uri;
        } catch {}
      }
      setPicked({ uri, type: media, mime: a.mimeType || (media === 'image' ? 'image/jpeg' : 'video/mp4') });
    }
  };

  // Gesture handler for swipe up to camera
  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      swipeOpacity.value = withSpring(0.7);
    },
    onActive: (event) => {
      translateY.value = event.translationY;
    },
    onEnd: (event) => {
      if (event.translationY < -50 && event.velocityY < -500) {
        // Trigger camera with scale animation
        cameraScale.value = withSpring(1.1, {}, () => {
          cameraScale.value = withSpring(1);
        });
        runOnJS(captureWithCamera)('image');
      }
      translateY.value = withSpring(0);
      swipeOpacity.value = withSpring(1);
    }
  });

  const animatedSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(translateY.value, 0) }],
    opacity: swipeOpacity.value,
  }));

  const animatedCameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Ensure user is authenticated
      try { await User.me(); } catch { throw new Error('Please sign in to create a post.'); }
      let finalMediaUrl = '';
      if (picked?.uri) {
        const base = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
        const name = picked.type === 'image' ? 'image.jpg' : 'video.mp4';
        const mime = picked.mime || (picked.type === 'image' ? 'image/jpeg' : 'video/mp4');
        const res = await uploadFile(base, picked.uri, name, mime);
        finalMediaUrl = res?.url || res?.path;
      }
      const trimmedContent = content.trim();
      if (!trimmedContent && !finalMediaUrl) {
        setError('Add content or select a media file');
        setSubmitting(false);
        return;
      }
      const location = shareLocation ? { lat, lng, source: 'device' as const } : {};
      const payload: Record<string, any> = {
        content: trimmedContent,
        media_url: finalMediaUrl || undefined,
        type: postType,
        location,
      };
      if (gameId) {
        payload.game_id = gameId;
      }
      await Post.create(payload);
      Alert.alert(
        postType === 'highlight' ? 'Highlight shared' : 'Posted',
        postType === 'highlight' ? 'Your highlight has been shared.' : 'Your post has been created.'
      );
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      const issues = (e?.data?.issues || []) as { message: string }[];
      if (issues.length) {
        setError(issues.map(i => i.message).join('\n'));
      } else {
        setError(e?.message || 'Failed to create post');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = useMemo(() => !!content.trim() || !!picked?.uri, [content, picked]);
  const buttonLabel = submitting
    ? (postType === 'highlight' ? 'Posting highlight...' : 'Posting...')
    : (postType === 'highlight' ? 'Share Highlight' : 'Post');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#111827" />
        </Pressable>
        <PrimaryButton label={buttonLabel} onPress={onSubmit} disabled={!canPost || submitting} loading={submitting} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Composer Section */}
        <View style={styles.composerSection}>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder="Respect for every player on the field."
            multiline
            style={styles.textarea}
          />
          <Text style={styles.helper}>Use # to tag teams and @ to mention players</Text>
        </View>

        {/* Interactive Swipe Camera */}
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.swipeSection, animatedSwipeStyle]}>
            <View style={styles.swipeIndicator}>
              <Ionicons name="chevron-up" size={20} color="#1D4ED8" />
              <Text style={styles.swipeText}>Swipe up for camera</Text>
              <Ionicons name="camera-outline" size={16} color="#1D4ED8" />
            </View>
          </Animated.View>
        </PanGestureHandler>

        {/* Media Actions */}
        <View style={styles.mediaSection}>
          <Text style={styles.sectionTitle}>Add Media</Text>
          <View style={styles.tilesRow}>
            <Pressable style={styles.tile} onPress={() => pickFromLibrary('image')} accessibilityLabel="Gallery">
              <Ionicons name="image-outline" size={24} color="#6B7280" />
              <Text style={styles.tileLabel}>Gallery</Text>
            </Pressable>
            <Animated.View style={animatedCameraStyle}>
              <Pressable style={[styles.tile, styles.primaryTile]} onPress={() => captureWithCamera('image')} accessibilityLabel="Camera">
                <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
                <Text style={[styles.tileLabel, styles.primaryTileLabel]}>Camera</Text>
              </Pressable>
            </Animated.View>
            <Pressable style={styles.tile} onPress={() => captureWithCamera('video')} accessibilityLabel="Video">
              <Ionicons name="videocam-outline" size={24} color="#6B7280" />
              <Text style={styles.tileLabel}>Video</Text>
            </Pressable>
          </View>
        </View>

        {/* Media Preview */}
        {picked?.uri ? (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewContainer}>
              {picked.type === 'image' ? (
                <RNImage source={{ uri: picked.uri }} style={styles.previewMedia} />
              ) : (
                <VideoPlayer uri={picked.uri} style={styles.previewMedia} />
              )}
              <Pressable style={styles.removeButton} onPress={() => setPicked(null)} accessibilityLabel="Remove media">
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.locRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.locLabel}>Share location</Text>
              <Text style={styles.settingDescription}>Help others discover local content</Text>
            </View>
            <Switch value={shareLocation} onValueChange={setShareLocation} />
          </View>
          {locGranted === false && shareLocation ? (
            <Text style={styles.muted}>Location permission denied. You can still post; we'll try to infer your country from your profile.</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <Pressable onPress={() => {}}>
            <Text style={styles.footerLink}>Respect all the players on the field.</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#FFFFFF' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  iconBtn: { 
    padding: 8, 
    borderRadius: 999, 
    backgroundColor: 'transparent' 
  },
  
  // Composer Section
  composerSection: { 
    marginBottom: 24 
  },
  textarea: { 
    height: 120, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    padding: 16, 
    textAlignVertical: 'top', 
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 22
  },
  helper: { 
    color: '#6B7280', 
    fontSize: 14,
    fontStyle: 'italic'
  },
  
  // Swipe Section
  swipeSection: { 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  swipeIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#EBF4FF', 
    paddingVertical: 16, 
    paddingHorizontal: 24,
    borderRadius: 16, 
    width: '100%',
    borderWidth: 2,
    borderColor: '#DBEAFE',
    borderStyle: 'dashed'
  },
  swipeText: { 
    color: '#1D4ED8', 
    fontWeight: '600', 
    marginHorizontal: 8,
    fontSize: 14
  },
  
  // Media Section
  mediaSection: { 
    marginBottom: 24 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 16,
    textAlign: 'center'
  },
  tilesRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 20 
  },
  tile: { 
    width: 100, 
    height: 100, 
    borderRadius: 20, 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1.5, 
    borderColor: '#E5E7EB', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 
  },
  primaryTile: { 
    backgroundColor: '#2563EB', 
    borderColor: '#2563EB' 
  },
  tileLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6B7280', 
    marginTop: 6 
  },
  primaryTileLabel: { 
    color: '#FFFFFF' 
  },
  
  // Preview Section
  previewSection: { 
    marginBottom: 24 
  },
  previewContainer: { 
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  previewMedia: { 
    width: '100%', 
    height: 240, 
    backgroundColor: '#F9FAFB' 
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  // Settings Section
  settingsSection: { 
    marginBottom: 24 
  },
  locRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12
  },
  settingInfo: {
    flex: 1
  },
  locLabel: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#111827'
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2
  },
  muted: { 
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  
  // Footer Section
  footerSection: {
    alignItems: 'center',
    paddingTop: 12
  },
  footerLink: { 
    color: '#2563EB', 
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500'
  },
  error: { 
    color: '#DC2626', 
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500'
  },
});