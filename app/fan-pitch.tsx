import { pitchEvent, normalizeApiError } from '@/api/events';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Button, Input } from '@/shared/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function FanPitchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [teamHint, setTeamHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please add a title for your event.');
      return;
    }
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Invalid date', 'Enter a valid date (e.g., 2025-01-15T18:00:00Z).');
      return;
    }

    setSubmitting(true);
    try {
      await pitchEvent({
        title: title.trim(),
        date: parsedDate.toISOString(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        team_hint: teamHint.trim() || undefined,
      });
      Alert.alert('Pitch submitted', 'A coach will review and approve it. Thank you!');
      router.back();
    } catch (err: any) {
      Alert.alert('Pitch failed', normalizeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: palette.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: palette.text }]}>Pitch an Event</Text>
      <Text style={[styles.subtitle, { color: palette.mutedText }]}>
        Fans can suggest events for coaches to review. Email verification is required.
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.mutedText }]}>Title</Text>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Friday Night Lights"
          placeholderTextColor={palette.mutedText}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.mutedText }]}>Date/Time (ISO)</Text>
        <Input
          value={date}
          onChangeText={setDate}
          placeholder="2025-01-15T18:00:00Z"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={palette.mutedText}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.mutedText }]}>Location</Text>
        <Input
          value={location}
          onChangeText={setLocation}
          placeholder="Stadium name or address"
          placeholderTextColor={palette.mutedText}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.mutedText }]}>Team hint (optional)</Text>
        <Input
          value={teamHint}
          onChangeText={setTeamHint}
          placeholder="Team or league name to route to coaches"
          placeholderTextColor={palette.mutedText}
          style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: palette.mutedText }]}>Description (optional)</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="What is this event about?"
          multiline
          placeholderTextColor={palette.mutedText}
          style={[
            styles.textArea,
            { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text },
          ]}
        />
      </View>

      <Button onPress={onSubmit} disabled={submitting}>
        <Text>{submitting ? 'Submitting…' : 'Submit pitch'}</Text>
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 14,
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
