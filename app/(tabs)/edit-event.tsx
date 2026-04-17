import { Colors } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { safeGoBack } from '@/utils/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
// @ts-ignore
import { Event } from '@/api/entities';

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [event, setEvent] = useState<any>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await Event.get(String(id));
      if (!data || typeof data.id === 'undefined') {
        Alert.alert('Error', 'Event not found.');
        safeGoBack(router);
        return;
      }
      if (!data.can_cancel) {
        Alert.alert('Access Denied', 'You do not have permission to edit this event.');
        safeGoBack(router);
        return;
      }
      setEvent(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setLocation(data.location || '');
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
      if (handleCoachAccessError(router, e, 'editing events')) {
        return;
      }
      if (__DEV__) console.error('[edit-event] Failed to load event:', e);
      Alert.alert('Error', 'Failed to load event data.');
      safeGoBack(router);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

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
      };
      if (parsedDate) {
        updateData.date = parsedDate;
      }

      await Event.update(String(id), updateData);
      Alert.alert('Success', 'Event updated successfully.', [
        { text: 'OK', onPress: () => safeGoBack(router) },
      ]);
    } catch (e: any) {
      if (handleCoachAccessError(router, e, 'editing events')) {
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
            <Pressable style={styles.backButton} onPress={() => safeGoBack(router)}>
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
              style={[styles.submitButton, { backgroundColor: Colors[colorScheme].tint }, submitting && styles.submitButtonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
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
