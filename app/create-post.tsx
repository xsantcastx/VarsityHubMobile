import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Image as RNImage } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { Post, User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadFile } from '@/api/upload';
import { Platform } from 'react-native';
import VideoPlayer from '@/components/VideoPlayer';

export default function CreatePostScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video'; mime?: string } | null>(null);

  const pickFromLibrary = async (media: 'image' | 'video') => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: media === 'image' ? ImagePicker.MediaType.Image : ImagePicker.MediaType.Video,
      quality: media === 'image' ? 0.85 : undefined,
      videoMaxDuration: 30,
    });
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
      mediaTypes: media === 'image' ? ImagePicker.MediaType.Image : ImagePicker.MediaType.Video,
      quality: media === 'image' ? 0.85 : undefined,
      videoMaxDuration: 30,
    });
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
      await Post.create({ title: title || undefined, content, media_url: finalMediaUrl || undefined, type: 'post' });
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Post' }} />
      <Text style={styles.title}>Create Post</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Title (optional)</Text>
      <Input value={title} onChangeText={setTitle} placeholder="Post title" style={{ marginBottom: 8 }} />
      <Text style={styles.label}>Content</Text>
      <Input value={content} onChangeText={setContent} placeholder="Say something..." style={{ marginBottom: 8, height: 90 }} multiline />
      <Text style={styles.label}>Add Media</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="outline" onPress={() => pickFromLibrary('image')}>Photo</Button>
        <Button variant="outline" onPress={() => pickFromLibrary('video')}>Video</Button>
        <Button variant="outline" onPress={() => captureWithCamera('image')}>Take Photo</Button>
        <Button variant="outline" onPress={() => captureWithCamera('video')}>Record Video</Button>
        {picked ? <Button variant="ghost" onPress={() => setPicked(null)}>Remove</Button> : null}
      </View>
      {picked?.uri ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>Selected {picked.type}</Text>
          {picked.type === 'image' ? (
            <RNImage source={{ uri: picked.uri }} style={{ width: '100%', height: 220, borderRadius: 10 }} />
          ) : (
            <VideoPlayer uri={picked.uri} style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: '#111827' }} />
          )}
        </View>
      ) : null}
      <View style={{ height: 12 }} />
      <Button onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : 'Post'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '700', marginBottom: 4 },
  error: { color: '#b91c1c', marginBottom: 8 },
});
