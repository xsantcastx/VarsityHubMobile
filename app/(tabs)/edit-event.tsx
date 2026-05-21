import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { safeGoBack } from '@/utils/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/api/http';
import { uploadFile } from '@/api/upload';
import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
// @ts-ignore
import { Event } from '@/api/entities';

export default function EditEventScreen() {
  const { user } = useAuth();
  const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();
  const router = useRouter();
  const { id, fallback } = useLocalSearchParams<{ id?: string; fallback?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const backFallback =
    typeof fallback === 'string' && fallback.trim().startsWith('/')
      ? fallback.trim()
      : id
        ? `/event-detail?id=${encodeURIComponent(String(id))}`
        : undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const loadEvent = useCallback(async () => {
    if (!id || coachLoading || !canAccessCoachTools) return;
    setLoading(true);
    try {
      const data = await Event.get(String(id));
      if (!data || typeof data.id === 'undefined') {
        Alert.alert('Error', 'Event not found.');
        safeGoBack(router, backFallback);
        return;
      }
      if (!data.can_cancel) {
        Alert.alert('Access Denied', 'You do not have permission to edit this event.');
        safeGoBack(router, backFallback);
        return;
      }
      setTitle(data.title || '');
      setDescription(data.description || '');
      setLocation(data.location || '');
      setBannerUrl(data.banner_url || data.cover_image_url || null);
      // Format date for editing — show ISO local datetime string
      if (data.date) {
        const d = new Date(data.date);
        if (!isNaN(d.getTime())) {
          // Format as YYYY-MM-DDTHH:MM for display
          const pad = (n: number) => String(n).padStart(2, '0');
          setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
      }
    } catch (e: any) {
      if (handleCoachAccessError(router, e, 'editing events', user)) {
        return;
      }
      if (__DEV__) console.error('[edit-event] Failed to load event:', e);
      Alert.alert('Error', 'Failed to load event data.');
      safeGoBack(router, backFallback);
    } finally {
      setLoading(false);
    }
  }, [backFallback, canAccessCoachTools, coachLoading, id, router]);

  useEffect(() => {
    if (coachLoading || !canAccessCoachTools) return;
    void loadEvent();
  }, [canAccessCoachTools, coachLoading, loadEvent]);

  // All useCallback hooks must run on every render — declared above the
  // coach-gate early returns so React's hook-order invariant holds.
  const uploadBannerFromUri = useCallback(async (uri: string) => {
    setUploadingBanner(true);
    try {
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
      setBannerUrl(nextUrl);
    } finally {
      setUploadingBanner(false);
    }
  }, []);

  const pickBannerFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library permission is needed to upload an event photo.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await uploadBannerFromUri(result.assets[0].uri);
      } catch (error: any) {
        Alert.alert('Upload Failed', error?.message || 'Failed to upload event photo. Please try again.');
      }
    }
  }, [uploadBannerFromUri]);

  const takeBannerPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed to take an event photo.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await uploadBannerFromUri(result.assets[0].uri);
      } catch (error: any) {
        Alert.alert('Upload Failed', error?.message || 'Failed to upload event photo. Please try again.');
      }
    }
  }, [uploadBannerFromUri]);

  const showBannerOptions = useCallback(() => {
    Alert.alert(
      'Event Photo',
      'Choose how you want to update the event photo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: () => void pickBannerFromLibrary() },
        { text: 'Take Photo', onPress: () => void takeBannerPhoto() },
      ]
    );
  }, [pickBannerFromLibrary, takeBannerPhoto]);

  if (coachLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </SafeAreaView>
    );
  }

  if (!canAccessCoachTools) {
    return (
      <CoachAccessRedirecting
        backgroundColor={Colors[colorScheme].background}
        spinnerColor={Colors[colorScheme].tint}
        textColor={Colors[colorScheme].mutedText}
      />
    );
  }

  const onSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter an event title.');
      return;
    }

    // Validate date if provided
    let parsedDate: string | undefined;
    if (dateStr.trim()) {
      const d = new Date(dateStr.trim());
      if (isNaN(d.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DDTHH:MM format (e.g. 2026-04-15T18:00).');
        return;
      }
      parsedDate = d.toISOString();
    }

    setSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        banner_url: bannerUrl ?? null,
      };
      if (parsedDate) {
        updateData.date = parsedDate;
      }

      await Event.update(String(id), updateData);
      Alert.alert('Success', 'Event updated successfully.', [
        { text: 'OK', onPress: () => safeGoBack(router, backFallback) },
      ]);
    } catch (e: any) {
      if (handleCoachAccessError(router, e, 'editing events', user)) {
        return;
      }
      if (__DEV__) console.error('[edit-event] Update failed:', e);
      const msg = e?.data?.error || e?.message || 'Failed to update event.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Edit Event', headerShown: false }} />
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading event...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit Event', headerShown: false }} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
            <Pressable style={styles.backButton} onPress={() => safeGoBack(router, backFallback)}>
              <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Edit Event</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor={Colors[colorScheme].mutedText}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Description</Text>
                <Text style={[styles.charCount, { color: description.length > 1000 ? '#DC2626' : Colors[colorScheme].mutedText }]}>
                  {description.length}/1000
                </Text>
              </View>
              <TextInput
                style={[styles.textArea, { backgroundColor: Colors[colorScheme].surface, borderColor: description.length > 1000 ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                value={description}
                onChangeText={(text) => { if (text.length <= 1000) setDescription(text); }}
                placeholder="Event description (optional)"
                placeholderTextColor={Colors[colorScheme].mutedText}
                multiline
                numberOfLines={4}
                maxLength={1000}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Event Photo</Text>
              <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
                Update the image used on the event card and background so edited events do not stay blank.
              </Text>
              <View
                style={[
                  styles.bannerCard,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
              >
                {bannerUrl ? (
                  <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} resizeMode="cover" />
                ) : (
                  <View style={[styles.bannerEmptyState, { backgroundColor: Colors[colorScheme].background }]}>
                    <MaterialIcons
                      name="image"
                      size={28}
                      color={Colors[colorScheme].mutedText}
                    />
                    <Text style={[styles.bannerEmptyText, { color: Colors[colorScheme].mutedText }]}>
                      No event photo uploaded yet
                    </Text>
                  </View>
                )}
                <View style={styles.bannerActionRow}>
                  <Pressable
                    style={[styles.bannerPrimaryButton, { backgroundColor: Colors[colorScheme].tint }]}
                    onPress={showBannerOptions}
                    disabled={uploadingBanner}
                  >
                    <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
                    <Text style={styles.bannerPrimaryButtonText}>
                      {uploadingBanner ? 'Uploading...' : bannerUrl ? 'Change Photo' : 'Upload Photo'}
                    </Text>
                  </Pressable>
                  {bannerUrl ? (
                    <Pressable
                      style={[styles.bannerSecondaryButton, { borderColor: Colors[colorScheme].border }]}
                      onPress={() => setBannerUrl(null)}
                      disabled={uploadingBanner}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={Colors[colorScheme].text} />
                      <Text style={[styles.bannerSecondaryButtonText, { color: Colors[colorScheme].text }]}>
                        Remove
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Location</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Event location (optional)"
                placeholderTextColor={Colors[colorScheme].mutedText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Date & Time</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="YYYY-MM-DDTHH:MM (e.g. 2026-04-15T18:00)"
                placeholderTextColor={Colors[colorScheme].mutedText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
                Format: YYYY-MM-DDTHH:MM (24-hour time)
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: Colors[colorScheme].tint },
                (submitting || uploadingBanner) && styles.submitButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={submitting || uploadingBanner}
            >
              {submitting || uploadingBanner ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Update Event</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  fieldHint: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  bannerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  bannerPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
  },
  bannerEmptyState: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerEmptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bannerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bannerPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  bannerPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSecondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  bannerSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitSection: {
    paddingHorizontal: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
