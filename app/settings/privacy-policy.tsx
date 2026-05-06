import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updatedAt, { color: Colors[colorScheme].mutedText }]}>
          Last updated: March 25, 2026
        </Text>

        <PolicySection colorScheme={colorScheme} title="What We Collect"
          body={'We collect: email, username, profile info, posts, photos, videos, messages, team/game data, event RSVPs, device info, usage data, and approximate location (when enabled). Payments are processed by Stripe — we never store card numbers.'} />

        <PolicySection colorScheme={colorScheme} title="How We Use It"
          body={'To run VarsityHub: deliver the service, process payments, send notifications, show nearby events, personalize your experience, and prevent abuse.'} />

        <PolicySection colorScheme={colorScheme} title="Who We Share With"
          body={'We do not sell your data. We share only with: service providers (Stripe, Cloudinary, Railway, Google, Sentry), when you post publicly, or when required by law. We do not share data with sports leagues or universities.'} />

        <PolicySection colorScheme={colorScheme} title="Your Rights"
          body={'You can access, correct, delete, or export your data. Delete your account in Settings — we anonymize your data immediately. Contact customerservice@varsityhub.app for account requests or support@varsityhub.app to report content.'} />

        <PolicySection colorScheme={colorScheme} title="Children"
          body={'You must be 13+ to use VarsityHub. We deny accounts for users under 13 and delete under-13 data immediately upon discovery.'} />

        <PolicySection colorScheme={colorScheme} title="Security & Storage"
          body={'Data encrypted in transit (HTTPS), stored on Railway (PostgreSQL). We use industry-standard security. VarsityHub is US-based; by using the app you consent to US data transfer.'} />

        <PolicySection colorScheme={colorScheme} title="Changes & Contact"
          body={'We may update this policy and will notify you of material changes. Questions? Email customerservice@varsityhub.app.'} />

        <Text style={[styles.footer, { color: Colors[colorScheme].mutedText }]}>
          © 2025 Lime Productions. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicySection({
  title,
  body,
  colorScheme,
}: {
  title: string;
  body: string;
  colorScheme: 'light' | 'dark';
}) {
  return (
    <View style={[styles.section, { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].card }]}>
      <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
      <Text style={[styles.sectionBody, { color: Colors[colorScheme].mutedText }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  updatedAt: { fontSize: 12, marginBottom: 4 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
