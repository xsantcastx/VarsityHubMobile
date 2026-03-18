import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
// @ts-ignore
import { httpPost } from '@/api/http';
import { autocompleteLocations, PlaceSuggestion } from '@/api/geocoding';
import { safeGoBack } from '@/utils/navigation';
import { sanitizeText } from '@/utils/formUtils';
import DateTimePicker from '@react-native-community/datetimepicker';

const EVENT_TYPES = [
  { value: 'game', label: 'Game/Match', emoji: '🏈' },
  { value: 'watch_party', label: 'Watch Party', emoji: '📺' },
  { value: 'fundraiser', label: 'Fundraiser', emoji: '💰' },
  { value: 'tryout', label: 'Tryout/Practice', emoji: '🏃' },
  { value: 'bbq', label: 'BBQ/Social', emoji: '🍔' },
  { value: 'team_meal', label: 'Team Meal', emoji: '🍽️' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export default function CreateEventScreen() {
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('game');
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [locationQuerying, setLocationQuerying] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleLocationChange = useCallback((text: string) => {
    setLocation(text);
    setSelectedPlace(null);
    setErrors(prev => ({ ...prev, location: '' }));
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    if (text.length < 3) { setLocationSuggestions([]); setLocationQuerying(false); return; }
    setLocationQuerying(true);
    locationTimerRef.current = setTimeout(async () => {
      try {
        const suggestions = await autocompleteLocations(text, 6);
        setLocationSuggestions(suggestions);
      } catch { setLocationSuggestions([]); }
      finally { setLocationQuerying(false); }
    }, 300);
  }, []);

  const handleSelectLocation = useCallback((suggestion: PlaceSuggestion) => {
    setLocation(suggestion.description);
    setSelectedPlace(suggestion);
    setLocationSuggestions([]);
    setLocationQuerying(false);
    setErrors(prev => ({ ...prev, location: '' }));
  }, []);

  useEffect(() => { return () => { if (locationTimerRef.current) clearTimeout(locationTimerRef.current); }; }, []);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const eventData: Record<string, any> = {
        title: sanitizeText(title),
        description: sanitizeText(description),
        event_type: eventType,
        location: selectedPlace?.description || location,
        venue_address: selectedPlace?.description || location,
        venue_place_id: selectedPlace?.place_id,
        date: date.toISOString(),
      };

      await httpPost('/events', eventData);

      Alert.alert('Event Created!', 'Your event has been published successfully!', [
        { text: 'OK', onPress: () => { safeGoBack(router); } },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (adminLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: Colors[colorScheme].text }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title: 'Create Official Event' }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Create Official Event</Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            As an administrator, this event will be automatically approved and published.
          </Text>
        </View>

        {/* Event Details Form */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Title *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: errors.title ? '#EF4444' : Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Varsity Championship Game"
            placeholderTextColor={Colors[colorScheme].mutedText}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Description</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add details about the event..."
            placeholderTextColor={Colors[colorScheme].mutedText}
            multiline
          />
        </View>

        <View style={[styles.section, { zIndex: 10 }]}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.location ? '#EF4444' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              value={location}
              onChangeText={handleLocationChange}
              placeholder="Start typing an address or venue"
              placeholderTextColor={Colors[colorScheme].mutedText}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {locationQuerying && (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={{ position: 'absolute', right: 12, top: 12 }} />
            )}
            {locationSuggestions.length > 0 && (
              <View style={[styles.suggestionList, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                {locationSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.place_id}
                    style={[styles.suggestionItem, { borderBottomColor: Colors[colorScheme].border }, index === locationSuggestions.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => handleSelectLocation(suggestion)}
                  >
                    <MaterialIcons name="location-on" size={16} color={Colors[colorScheme].tint} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: Colors[colorScheme].text }}>
                        {suggestion.structured_formatting?.main_text || suggestion.description}
                      </Text>
                      {suggestion.structured_formatting?.secondary_text && (
                        <Text style={{ fontSize: 13, color: Colors[colorScheme].mutedText, marginTop: 2 }}>
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
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date & Time *</Text>
          <View style={styles.dateContainer}>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
              <Text style={{ color: Colors[colorScheme].text }}>{date.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable onPress={() => setShowTimePicker(true)} style={styles.dateDisplay}>
              <Text style={{ color: Colors[colorScheme].text }}>{date.toLocaleTimeString()}</Text>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Type *</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: Colors[colorScheme].card,
                    borderColor:
                      eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  },
                ]}
                onPress={() => setEventType(type.value)}
              >
                <Text style={{ fontSize: 24 }}>{type.emoji}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    {
                      color:
                        eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].mutedText,
                    },
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: Colors[colorScheme].border }]}>
        <Pressable
          style={[styles.submitButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateDisplay: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeLabel: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  suggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
});
