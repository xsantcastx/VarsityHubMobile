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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { httpPost } from '@/api/http';

const EVENT_TYPES = [
  { value: 'game', label: '🏈 Game/Match', icon: 'football' },
  { value: 'watch_party', label: '📺 Watch Party', icon: 'tv' },
  { value: 'fundraiser', label: '💰 Fundraiser', icon: 'cash' },
  { value: 'tryout', label: '🏃 Tryout/Practice', icon: 'fitness' },
  { value: 'bbq', label: '🍔 BBQ/Social', icon: 'restaurant' },
  { value: 'other', label: '📌 Other', icon: 'ellipsis-horizontal' },
];

export default function CreateFanEventScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('watch_party');
  const [location, setLocation] = useState('');
  const [linkedLeague, setLinkedLeague] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!title.trim()) {
      newErrors.title = 'Event title is required';
    }
    
    if (!eventType) {
      newErrors.eventType = 'Event type is required';
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
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const eventData = {
        title,
        description,
        event_type: eventType,
        location,
        linked_league: linkedLeague || undefined,
        contact_info: contactInfo || undefined,
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        date: date.toISOString(),
      };
      
      const response = await httpPost('/events', eventData);
      
      if (response.approval_status === 'pending') {
        Alert.alert(
          'Event Submitted!',
          'Your event has been submitted for approval. You\'ll be notified when it\'s reviewed.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Event Created!',
          'Your event has been created and published successfully!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      if (e?.code === 'EVENT_LIMIT_EXCEEDED') {
        Alert.alert(
          'Event Limit Reached',
          e.message || "You've reached your limit of 3 pending events. Upgrade to create more.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/billing') },
          ]
        );
      } else {
        Alert.alert('Error', e?.message || 'Failed to create event. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
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
      <Stack.Screen options={{ title: 'Create Event', headerShown: true }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Create Community Event
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            Share local sports events, watch parties, fundraisers, and more with your community
          </Text>
        </View>
        
        {/* Event Type */}
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
                    borderColor: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  },
                  eventType === type.value && styles.typeButtonActive,
                ]}
                onPress={() => setEventType(type.value)}
              >
                <Ionicons 
                  name={type.icon as any} 
                  size={24} 
                  color={eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text} 
                />
                <Text 
                  style={[
                    styles.typeLabel, 
                    { color: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text }
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Title *</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: errors.title ? '#DC2626' : Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="e.g., Varsity Football Watch Party"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={title}
            onChangeText={setTitle}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>
        
        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Description</Text>
          <TextInput
            style={[
              styles.textArea,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
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
        
        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <Pressable
              style={[
                styles.dateTimeButton,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.date ? '#DC2626' : Colors[colorScheme].border,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                {date.toLocaleDateString()}
              </Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.dateTimeButton,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
          {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        </View>
        
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        
        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
        
        {/* Location */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: errors.location ? '#DC2626' : Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="e.g., Campus Pub, Stamford CT"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={location}
            onChangeText={setLocation}
          />
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>
        
        {/* League/School */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>League/School (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="e.g., Stamford High School"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={linkedLeague}
            onChangeText={setLinkedLeague}
          />
        </View>
        
        {/* Max Attendees */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Max Attendees (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="e.g., 50"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="number-pad"
          />
        </View>
        
        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Contact Info (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="Email or phone for RSVP"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={contactInfo}
            onChangeText={setContactInfo}
          />
        </View>
        
        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="information-circle" size={20} color={Colors[colorScheme].tint} />
          <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>
            Fan-submitted events will be reviewed by coaches or admins before appearing publicly.
          </Text>
        </View>
        
        {/* Submit Button */}
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
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </Pressable>
        
        <View style={{ height: 40 }} />
      </ScrollView>
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  typeButtonActive: {
    borderWidth: 2,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateTimeText: {
    fontSize: 16,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
