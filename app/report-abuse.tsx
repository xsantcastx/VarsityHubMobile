import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Support, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadImage } from '@/utils/uploadUtils';
import { ensureUploadableUri } from '../utils/ensureUploadableUri';

export default function ReportAbuseScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Report abuse or safety concern');
  const [details, setDetails] = useState('');
  const [accused, setAccused] = useState('');
  const [contextUrl, setContextUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<{ localUri: string; remoteUrl?: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void (async () => {
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
      setError('Please complete the subject, details, and email fields.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const compiledMessage = [
        details.trim(),
        accused.trim() ? `Reported user: ${accused.trim()}` : null,
        contextUrl.trim() ? `Context: ${contextUrl.trim()}` : null,
        attachment?.remoteUrl ? `Screenshot: ${attachment.remoteUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      await Support.contact({
        name: name.trim() || 'VarsityHub user',
        email: email.trim(),
        subject: subject.trim(),
        message: compiledMessage,
      });
      Alert.alert(
        'Report sent',
        'Thank you for letting us know. Our safety team will review your report and follow up if we need more information.',
      );
      setDetails('');
      setAccused('');
      setContextUrl('');
      setAttachment(null);
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' && err.message.length
          ? err.message
          : 'We were unable to send your report. Please try again in a moment.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttach = async () => {
    if (uploadingAttachment) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to attach a screenshot.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (pick.canceled || !pick.assets?.length) return;
    const asset = pick.assets[0];
    if (!asset?.uri) return;
    const mimeType = asset.mimeType || 'image/jpeg';
    const name = asset.fileName || `screenshot-${Date.now()}.jpg`;
    setUploadingAttachment(true);
    try {
      const ensured = await ensureUploadableUri(asset.uri, mimeType);
      const uploaded = await uploadImage({ uri: ensured.uri, name, type: ensured.mimeType || mimeType });
      setAttachment({ localUri: asset.uri, remoteUrl: uploaded.url || uploaded.path });
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not attach screenshot. Please try again.');
      setAttachment(null);
    } finally {
      setUploadingAttachment(false);
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
              accessibilityLabel="Your name"
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
              accessibilityLabel="Email address"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Subject *</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="What happened?"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              returnKeyType="next"
              accessibilityLabel="Subject"
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
              accessibilityLabel="Details about what happened"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Who are you reporting? (email or username)</Text>
            <TextInput
              value={accused}
              onChangeText={setAccused}
              placeholder="user@example.com or username (optional)"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              autoCapitalize="none"
              autoComplete="off"
              keyboardType="email-address"
              returnKeyType="next"
              accessibilityLabel="Person you are reporting"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Link or evidence (optional)</Text>
            <TextInput
              value={contextUrl}
              onChangeText={setContextUrl}
              placeholder="Link to the post/profile/screenshot"
              placeholderTextColor={palette.mutedText}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
              autoCapitalize="none"
              autoComplete="off"
              keyboardType="url"
              returnKeyType="done"
              accessibilityLabel="Link or evidence"
            />

            <Text style={[styles.label, { color: palette.mutedText }]}>Screenshot (optional)</Text>
            <View style={{ gap: 8 }}>
              <Button onPress={handleAttach} disabled={uploadingAttachment} accessibilityLabel="Attach screenshot">
                {uploadingAttachment ? 'Uploading…' : attachment ? 'Replace Screenshot' : 'Attach Screenshot'}
              </Button>
              {attachment?.localUri ? (
                <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border, borderRadius: 10, overflow: 'hidden' }}>
                  <Image source={{ uri: attachment.localUri }} style={{ width: '100%', height: 180 }} resizeMode="cover" />
                </View>
              ) : null}
            </View>

            <Text style={[styles.helper, { color: palette.mutedText }]}>
              We keep reports confidential and only use this information to enforce community guidelines.
            </Text>

            {error ? (
              <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text>
            ) : null}
            <Button onPress={handleSubmit} disabled={!canSubmit || submitting} accessibilityLabel="Submit report">
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
