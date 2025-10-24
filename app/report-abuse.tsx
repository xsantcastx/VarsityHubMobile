import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { Support, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReportAbuseScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Report abuse or safety concern');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const me: any = await User.me();
        if (canceled) return;
        if (typeof me?.display_name === 'string' && !name) {
          setName(me.display_name);
        }
        if (typeof me?.email === 'string' && !email) {
          setEmail(me.email);
        }
      } catch {
        // Ignore, user can fill fields manually.
      }
    })();
    return () => {
      canceled = true;
    };
  }, [name, email]);

  const canSubmit = useMemo(() => {
    return Boolean(subject.trim() && details.trim() && email.trim());
  }, [subject, details, email]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      Alert.alert('Missing information', 'Please complete the subject, details, and email fields.');
      return;
    }

    setSubmitting(true);
    try {
      await Support.contact({
        name: name.trim() || 'VarsityHub user',
        email: email.trim(),
        subject: subject.trim(),
        message: details.trim(),
      });
      Alert.alert(
        'Report sent',
        'Thank you for letting us know. Our safety team will review your report and follow up if we need more information.',
      );
      setDetails('');
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' && err.message.length
          ? err.message
          : 'We were unable to send your report. Please try again in a moment.';
      Alert.alert('Submission failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Report Abuse' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Report Abuse</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>
              Tell us what happened so we can investigate. Include any usernames, teams, or posts involved.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.label, { color: palette.mutedText }]}>Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Optional"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Email *</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Subject *</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="What happened?"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              returnKeyType="next"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Details *</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Describe the situation, including relevant names, dates, or links."
              placeholderTextColor={palette.mutedText}
              style={[
                styles.textArea,
                { color: palette.text, borderColor: palette.border, backgroundColor: palette.background },
              ]}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={[styles.helper, { color: palette.mutedText }]}>
              We keep reports confidential and only use this information to enforce community guidelines.
            </Text>

            <Button onPress={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? 'Sending...' : 'Submit report'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  helper: {
    fontSize: 13,
  },
});
