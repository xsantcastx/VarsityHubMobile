
import { Event, Message } from '@/api/entities';
import { autocompleteLocations, PlaceSuggestion } from '@/api/geocoding';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Colors } from '@/constants/Colors';
import { useUserProfile } from '@/hooks/useUser';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function RequestHostEventScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { displayName, email: profileEmail } = useUserProfile();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [locationQuerying, setLocationQuerying] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const locationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [date, setDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default to next week
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Google Maps location autocomplete
  const requestLocationSuggestions = useCallback((text: string) => {
    if (locationTimerRef.current) {
      clearTimeout(locationTimerRef.current);
      locationTimerRef.current = null;
    }
    if (text.length < 3) {
      setLocationSuggestions([]);
      setLocationQuerying(false);
      return;
    }
    setLocationQuerying(true);
    locationTimerRef.current = setTimeout(async () => {
      try {
        const suggestions = await autocompleteLocations(text, 6);
        setLocationSuggestions(suggestions);
      } catch (error) {
        setLocationSuggestions([]);
      } finally {
        setLocationQuerying(false);
      }
    }, 300);
  }, []);

  const handleLocationChange = useCallback((text: string) => {
    setLocation(text);
    setLocationTouched(true);
    setSelectedPlace(null);
    setErrors(prev => ({ ...prev, location: '' }));
    if (text.length >= 3) {
      requestLocationSuggestions(text);
    } else {
      setLocationSuggestions([]);
    }
  }, [requestLocationSuggestions]);

  const handleSelectLocation = useCallback((suggestion: PlaceSuggestion) => {
    setLocation(suggestion.description);
    setSelectedPlace(suggestion);
    setLocationSuggestions([]);
    setLocationQuerying(false);
    setLocationTouched(true);
    setErrors(prev => ({ ...prev, location: '' }));
  }, []);

  useEffect(() => {
    return () => {
      if (locationTimerRef.current) {
        clearTimeout(locationTimerRef.current);
      }
    };
  }, []);

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    if (!title.trim()) {
      newErrors.title = 'Event title is required';
    }
    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }
    if (date < new Date()) {
      newErrors.date = 'Event date cannot be in the past';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const eventData = {
        title,
        description,
        event_type: 'host_request',
        location: selectedPlace?.description || location,
        venue_address: selectedPlace?.description || location,
        venue_place_id: selectedPlace?.place_id,
        date: date.toISOString(),
        requested_by: displayName || 'Unknown',
        requested_email: profileEmail || 'unknown@example.com',
      };
      await Event.create(eventData);
      // Send notification to coach/admin (placeholder email)
      await Message.send({
        content: `New event host request submitted: ${title}\nLocation: ${location}\nDate: ${date.toLocaleString()}\nRequested by: ${displayName || 'Unknown'} (${profileEmail || 'unknown@example.com'})`,
        recipient_email: 'admin@varsityhub.com',
      });
      Alert.alert('Request Submitted!', 'Your request to host an event has been submitted. You will be notified when it is reviewed.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setDate(newDate);
      if (Platform.OS === 'ios') {
        setShowTimePicker(false);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Request to Host Event', headerBackTitle: 'Back', headerShown: true }} />
      <KeyboardAwareScreen style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Request to Host Event</Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Submit your request to host an event. A coach or admin will review your request.</Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Title *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: Colors[colorScheme].card, borderColor: errors.title ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text },
            ]}
            placeholder="e.g., Varsity Basketball Game"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={title}
            onChangeText={setTitle}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Description</Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text },
            ]}
            placeholder="Describe your event..."
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <Pressable
              style={[
                styles.dateTimeButton,
                { backgroundColor: Colors[colorScheme].card, borderColor: errors.date ? '#DC2626' : Colors[colorScheme].border },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>{date.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.dateTimeButton,
                { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
          </View>
          {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <View style={styles.locationFieldWrapper}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: Colors[colorScheme].card, borderColor: errors.location ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text },
              ]}
              placeholder="Start typing an address, venue, or city"
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={location}
              onChangeText={handleLocationChange}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {locationQuerying && (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={styles.locationSpinner} />
            )}
            {locationSuggestions.length > 0 && (
              <View style={[styles.locationSuggestionList, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}> 
                {locationSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.place_id}
                    style={[
                      styles.locationSuggestionItem,
                      { borderBottomColor: Colors[colorScheme].border },
                      index === locationSuggestions.length - 1 && styles.locationSuggestionItemLast,
                    ]}
                    onPress={() => handleSelectLocation(suggestion)}
                  >
                    <Ionicons name="location" size={16} color={Colors[colorScheme].tint} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationSuggestionMain, { color: Colors[colorScheme].text }]}>
                        {suggestion.structured_formatting?.main_text || suggestion.description}
                      </Text>
                      {suggestion.structured_formatting?.secondary_text && (
                        <Text style={[styles.locationSuggestionSecondary, { color: Colors[colorScheme].mutedText }]}> 
                          {suggestion.structured_formatting.secondary_text}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
          {!selectedPlace && locationTouched && location.length >= 3 && locationSuggestions.length === 0 && !locationQuerying && (
            <Text style={[styles.inputHelperText, { color: Colors[colorScheme].mutedText }]}>Tip: Select a suggested location for better accuracy, or continue typing to enter manually</Text>
          )}
        </View>
        <View style={[styles.infoBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}> 
          <Ionicons name="information-circle" size={20} color={Colors[colorScheme].tint} />
          <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>Requests will be reviewed by coaches or admins before approval.</Text>
        </View>
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: Colors[colorScheme].tint },
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </Pressable>
        <View style={{ height: 40 }} />
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { marginBottom: 20 },
  label: { fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 4 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, minHeight: 80, marginBottom: 4 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  dateTimeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12, marginRight: 8 },
  dateTimeText: { marginLeft: 8, fontSize: 16 },
  locationFieldWrapper: { position: 'relative' },
  locationSpinner: { position: 'absolute', right: 12, top: 16 },
  locationSuggestionList: { position: 'absolute', top: 48, left: 0, right: 0, zIndex: 10, borderWidth: 1, borderRadius: 8, maxHeight: 180 },
  locationSuggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  locationSuggestionItemLast: { borderBottomWidth: 0 },
  locationSuggestionMain: { fontSize: 16 },
  locationSuggestionSecondary: { fontSize: 12 },
  errorText: { color: '#DC2626', marginTop: 2, marginBottom: 2 },
  inputHelperText: { fontSize: 12, marginTop: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 16 },
  infoText: { marginLeft: 8, fontSize: 14 },
  submitButton: { marginTop: 16, borderRadius: 8, padding: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});
