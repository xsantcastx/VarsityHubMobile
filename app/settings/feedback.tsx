import Textarea from '@/components/ui/textarea';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';
// @ts-ignore JS exports
import { Support } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { getApiBaseUrl } from '@/api/http';
import { pickerMediaTypesProp } from '@/utils/picker';
import { Colors } from '@/constants/Colors';
import { safeGoBack } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';

export default function FeedbackScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const pickImage = async (source: 'library' | 'camera') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to take a screenshot.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Photo library access is needed to select a screenshot.');
          return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ ...pickerMediaTypesProp(), allowsEditing: true, quality: 0.8 } as any)
        : await ImagePicker.launchImageLibraryAsync({ ...pickerMediaTypesProp(), allowsEditing: true, quality: 0.8, selectionLimit: 1 } as any);

      if ((result as any).canceled || !(result as any).assets?.[0]) return;

      const asset = (result as any).assets[0];
      const localUri = await materializeICloudAssetIfNeeded(asset.uri);
      setScreenshotUri(localUri);

      // Upload to Cloudinary
      setUploading(true);
      try {
        const uploaded = await uploadFile(getApiBaseUrl(), localUri, asset.fileName || 'screenshot.jpg', 'image/jpeg');
        setScreenshotUrl(uploaded?.url || uploaded?.path || null);
      } catch (e: any) {
        Alert.alert('Upload Failed', e?.message || 'Could not upload the screenshot. You can still submit feedback without it.');
        setScreenshotUri(null);
        setScreenshotUrl(null);
      } finally {
        setUploading(false);
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[feedback] Image picker error:', e);
    }
  };

  const removeScreenshot = () => {
    setScreenshotUri(null);
    setScreenshotUrl(null);
  };

  const onSubmit = async () => {
    if (!message.trim()) { Alert.alert('Please enter a message'); return; }
    setSending(true);
    try {
      await Support.feedback({
        user_id: 'me',
        category,
        message: message.trim(),
        screenshot_url: screenshotUrl || undefined,
      });
      Alert.alert('Thanks!', 'Your feedback was sent.');
      safeGoBack(router);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Try again later');
    } finally {
      setSending(false);
    }
  };

  const categoryOptions: { key: 'bug' | 'idea' | 'other'; label: string; icon: string }[] = [
    { key: 'bug', label: 'Bug', icon: 'bug-outline' },
    { key: 'idea', label: 'Idea', icon: 'bulb-outline' },
    { key: 'other', label: 'Other', icon: 'chatbubble-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Leave Feedback', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={[styles.title, { color: theme.text }]}>Send Feedback</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>Help us improve VarsityHub</Text>

        {/* Category Selector */}
        <Text style={[styles.label, { color: theme.text }]}>Category</Text>
        <View style={styles.categoryRow}>
          {categoryOptions.map((opt) => {
            const isActive = category === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.categoryBtn,
                  { borderColor: isActive ? theme.tint : theme.border, backgroundColor: isActive ? theme.tint + '15' : theme.surface },
                ]}
                onPress={() => setCategory(opt.key)}
              >
                <Ionicons name={opt.icon as any} size={18} color={isActive ? theme.tint : theme.mutedText} />
                <Text style={[styles.categoryBtnText, { color: isActive ? theme.tint : theme.text, fontWeight: isActive ? '700' : '500' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Message */}
        <Text style={[styles.label, { color: theme.text }]}>Message</Text>
        <Textarea
          placeholder="Describe the issue or your idea..."
          placeholderTextColor={theme.mutedText}
          value={message}
          onChangeText={setMessage}
          style={[styles.textarea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        />

        {/* Screenshot Upload */}
        <Text style={[styles.label, { color: theme.text }]}>Screenshot (optional)</Text>
        {screenshotUri ? (
          <View style={[styles.screenshotPreview, { borderColor: theme.border }]}>
            <Image source={{ uri: screenshotUri }} style={styles.screenshotImage} resizeMode="cover" />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
            <Pressable style={styles.removeBtn} onPress={removeScreenshot}>
              <Ionicons name="close-circle" size={28} color="#DC2626" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.uploadRow}>
            <Pressable
              style={[styles.uploadBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickImage('library')}
            >
              <Ionicons name="images-outline" size={22} color={theme.tint} />
              <Text style={[styles.uploadBtnText, { color: theme.text }]}>Photo Library</Text>
            </Pressable>
            <Pressable
              style={[styles.uploadBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickImage('camera')}
            >
              <Ionicons name="camera-outline" size={22} color={theme.tint} />
              <Text style={[styles.uploadBtnText, { color: theme.text }]}>Take Photo</Text>
            </Pressable>
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, { backgroundColor: theme.tint }, (sending || uploading) && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={sending || uploading}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Feedback</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  categoryBtnText: { fontSize: 14 },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  uploadRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  uploadBtnText: { fontSize: 14, fontWeight: '600' },
  screenshotPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  screenshotImage: { width: '100%', height: '100%' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  uploadingText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
