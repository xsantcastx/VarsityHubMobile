import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
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
// @ts-ignore
import { httpPost } from '@/api/http';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';

const EVENT_TYPES = [
  { value: 'game', label: 'Game/Match', emoji: '⚽️' },
  { value: 'practice', label: 'Practice/Clinic', emoji: '🏋️' },
  { value: 'meeting', label: 'Team Meeting', emoji: '📅' },
  { value: 'fundraiser', label: 'Fundraiser', emoji: '🎟️' },
  { value: 'watch_party', label: 'Watch Party', emoji: '📺' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export default function CreatePitchEventScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('game');
  const [location, setLocation] = useState('');
  const [teamOrOrg, setTeamOrOrg] = useState('');
  const [opponent, setOpponent] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    if (!title.trim()) newErrors.title = 'Event title is required';
    if (!eventType) newErrors.eventType = 'Event type is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (!teamOrOrg.trim()) newErrors.teamOrOrg = 'Team or Organization is required';
    if (eventType === 'game' && !opponent.trim()) newErrors.opponent = 'Opponent team is required for games';
    if (maxAttendees && isNaN(Number(maxAttendees))) newErrors.maxAttendees = 'Max attendees must be a number';
    if (date < new Date()) newErrors.date = 'Event date cannot be in the past';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const eventData: any = {
        title,
        description,
        event_type: eventType,
        location,
        team_or_org: teamOrOrg,
        date: date.toISOString(),
      };
      if (eventType === 'game') {
        eventData.opponent = opponent;
      }
      if (maxAttendees) {
        eventData.max_attendees = Number(maxAttendees);
      }
      const response = await httpPost('/events/pitch', eventData);
      Alert.alert(
        'Event Proposed!',
        'Your event has been proposed and will be reviewed by your team/org admins.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to propose event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setDate(newDate);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Pitch Event',
          headerShown: true,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAwareScreen style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Propose an Event</Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Suggest an event for your team or organization. Admins will review and approve.</Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Type *</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[styles.typeButton, { backgroundColor: Colors[colorScheme].card, borderColor: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].border }, eventType === type.value && styles.typeButtonActive]}
                onPress={() => setEventType(type.value)}
              >
                <Text style={[styles.typeEmoji, { color: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text }]}>{type.emoji}</Text>
                <Text style={[styles.typeLabel, { color: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text }]}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors[colorScheme].card, borderColor: errors.title ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
            placeholder="e.g., Team Fundraiser Night"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={title}
            onChangeText={setTitle}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>
        {eventType === 'game' && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Opponent Team *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: Colors[colorScheme].card, borderColor: errors.opponent ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              placeholder="e.g., Springfield Tigers (enter name if not on VarsityHub)"
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={opponent}
              onChangeText={setOpponent}
            />
            {errors.opponent && <Text style={styles.errorText}>{errors.opponent}</Text>}
          </View>
        )}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
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
            <Pressable style={[styles.dateTimeButton, { backgroundColor: Colors[colorScheme].card, borderColor: errors.date ? '#DC2626' : Colors[colorScheme].border }]} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>{date.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable style={[styles.dateTimeButton, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
          </View>
          {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        </View>
        {showDatePicker && (
          <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
        )}
        {showTimePicker && (
          <DateTimePicker value={date} mode="time" display="default" onChange={handleTimeChange} />
        )}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Team or Organization *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors[colorScheme].card, borderColor: errors.teamOrOrg ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
            placeholder="e.g., Stamford High School Football"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={teamOrOrg}
            onChangeText={setTeamOrOrg}
          />
          {errors.teamOrOrg && <Text style={styles.errorText}>{errors.teamOrOrg}</Text>}
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors[colorScheme].card, borderColor: errors.location ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
            placeholder="e.g., School Gymnasium"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={location}
            onChangeText={setLocation}
          />
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Max Attendees</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors[colorScheme].card, borderColor: errors.maxAttendees ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
            placeholder="e.g., 100"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="number-pad"
          />
          {errors.maxAttendees && <Text style={styles.errorText}>{errors.maxAttendees}</Text>}
        </View>
        <Pressable style={[styles.submitButton, { backgroundColor: Colors[colorScheme].tint }, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Propose Event</Text>
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
  scrollContent: {},
  header: { marginTop: 24, marginBottom: 12, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  section: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: '500', marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  typeButtonActive: { borderWidth: 2 },
  typeEmoji: { fontSize: 18, marginRight: 6 },
  typeLabel: { fontSize: 15 },
  input: { padding: 10, borderWidth: 1, borderRadius: 8, fontSize: 15 },
  textArea: { minHeight: 60 },
  dateTimeRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  dateTimeButton: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderRadius: 8 },
  dateTimeText: { marginLeft: 6, fontSize: 15 },
  submitButton: { marginTop: 18, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 2 },
});
