import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Image as RNImage, Pressable, ScrollView, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { Post, User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { pickerMediaTypeFor } from '@/utils/picker';
import { uploadFile } from '@/api/upload';
import { Platform } from 'react-native';
import VideoPlayer from '@/components/VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from '@/ui/PrimaryButton';
import * as Location from 'expo-location';

export default function CreatePostScreen() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video'; mime?: string } | null>(null);
  const [shareLocation, setShareLocation] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locGranted, setLocGranted] = useState<boolean | null>(null);

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
      if (!content.trim() && !finalMediaUrl) {
        setError('Add content or select a media file');
        setSubmitting(false);
        return;
      }
      const location = shareLocation ? { lat, lng, source: 'device' as const } : {};
      await Post.create({ content, media_url: finalMediaUrl || undefined, type: 'post', location });
      Alert.alert('Posted', 'Your post has been created.');
      router.back();
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.iconBtn}><Ionicons name="close" size={22} color="#111827" /></Pressable>
        <PrimaryButton label={submitting ? 'Posting…' : 'Post'} onPress={onSubmit} disabled={!canPost || submitting} loading={submitting} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Composer */}
        <Input
          value={content}
          onChangeText={setContent}
          placeholder="Respect for every player on the field."
          multiline
          style={styles.textarea}
        />
        <Text style={styles.helper}>Use # to tag teams and @ to mention players</Text>

        {/* Swipe bar */}
        <Pressable onPress={() => captureWithCamera('image')} style={styles.swipeBar} accessibilityLabel="Swipe up for camera">
          <Ionicons name="chevron-up" size={18} color="#1D4ED8" />
          <Text style={styles.swipeText}>Swipe up for camera</Text>
        </Pressable>

        {/* Action tiles */}
        <View style={styles.tilesRow}>
          <Pressable style={styles.tile} onPress={() => pickFromLibrary('image')} accessibilityLabel="Gallery">
            <Ionicons name="image-outline" size={24} color="#111827" />
          </Pressable>
          <Pressable style={styles.tile} onPress={() => captureWithCamera('image')} accessibilityLabel="Camera">
            <Ionicons name="camera-outline" size={24} color="#2563EB" />
          </Pressable>
          <Pressable style={styles.tile} onPress={() => captureWithCamera('video')} accessibilityLabel="Video">
            <Ionicons name="videocam-outline" size={24} color="#111827" />
          </Pressable>
        </View>

        {/* Selected preview */}
        {picked?.uri ? (
          <View style={{ marginTop: 8 }}>
            {picked.type === 'image' ? (
              <RNImage source={{ uri: picked.uri }} style={{ width: '100%', height: 220, borderRadius: 10 }} />
            ) : (
              <VideoPlayer uri={picked.uri} style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: '#111827' }} />
            )}
          </View>
        ) : null}

        {/* Location toggle */}
        <View style={styles.locRow}>
          <Text style={styles.locLabel}>Share location</Text>
          <Switch value={shareLocation} onValueChange={setShareLocation} />
        </View>
        {locGranted === false && shareLocation ? (
          <Text style={styles.muted}>Location permission denied. You can still post; we’ll try to infer your country from your profile.</Text>
        ) : null}

        {/* Footer link */}
        <Pressable onPress={() => {}}><Text style={styles.footerLink}>Respect all the players on the field.</Text></Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  iconBtn: { padding: 8, borderRadius: 999, backgroundColor: 'transparent' },
  textarea: { height: 120, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', padding: 12, textAlignVertical: 'top', marginBottom: 6 },
  helper: { color: '#6B7280', marginBottom: 12 },
  swipeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DBEAFE', paddingVertical: 10, borderRadius: 12, marginBottom: 12 },
  swipeText: { color: '#1D4ED8', fontWeight: '800', marginLeft: 6 },
  tilesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  tile: { width: 84, height: 84, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  locLabel: { fontWeight: '700' },
  footerLink: { color: '#2563EB', textAlign: 'center', marginTop: 12 },
  error: { color: '#b91c1c', marginBottom: 8 },
});
