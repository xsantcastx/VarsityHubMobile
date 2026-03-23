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
          Last updated: January 19, 2025
        </Text>

        <PolicySection colorScheme={colorScheme} title="Introduction"
          body={'VarsityHub ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.'} />

        <PolicySection colorScheme={colorScheme} title="Personal Information We Collect"
          body={'• Account Information: Email address, username, phone number (optional)\n• Profile Information: Avatar, bio, sports interests, team affiliations\n• Authentication: Google OAuth or Apple Sign-In credentials\n• User-Generated Content: Posts, comments, messages, photos, and videos\n• Team and game information you create\n• Event RSVPs and attendance data'} />

        <PolicySection colorScheme={colorScheme} title="Automatically Collected Information"
          body={'• Device Information: Device type, operating system, unique device identifiers\n• Usage Data: App features used, interactions, time spent in app\n• Location Data: Approximate location (when you enable location services) for event mapping'} />

        <PolicySection colorScheme={colorScheme} title="Payment Information"
          body="Payment processing is handled by Stripe. We do not store credit card numbers. We retain transaction records for subscription management." />

        <PolicySection colorScheme={colorScheme} title="How We Use Your Information"
          body={'We use the collected information to:\n• Provide, maintain, and improve the VarsityHub service\n• Process your subscription payments\n• Send you notifications about events, messages, and app updates\n• Display nearby events on the map (if location enabled)\n• Personalize your experience\n• Respond to your comments and questions\n• Detect and prevent fraud or abuse'} />

        <PolicySection colorScheme={colorScheme} title="Information Sharing"
          body={'We do not sell your personal information. We share information only:\n• With Your Consent: When you choose to share content publicly or with specific teams\n• Service Providers: Stripe (payment processing), Cloudinary (image/video hosting), Railway (server hosting), Google (OAuth authentication and Maps)\n• Legal Requirements: When required by law or to protect rights and safety'} />

        <PolicySection colorScheme={colorScheme} title="Data Storage and Security"
          body={'• Your data is encrypted in transit using HTTPS\n• We use industry-standard security measures to protect your information\n• Data is stored on secure servers provided by Railway (PostgreSQL database)'} />

        <PolicySection colorScheme={colorScheme} title="Your Rights and Choices"
          body={'You have the right to:\n• Access: Request a copy of your personal data\n• Correction: Update incorrect information in your profile settings\n• Deletion: Delete your account and associated data from Settings\n• Opt-Out: Disable location services or push notifications in your device settings\n• Data Portability: Request your data in a portable format\n\nTo exercise these rights, contact us at: support@varsityhub.app'} />

        <PolicySection colorScheme={colorScheme} title="Children's Privacy"
          body="VarsityHub is intended for users 13 years and older. We do not knowingly collect information from children under 13. If we discover such collection, we will delete it immediately." />

        <PolicySection colorScheme={colorScheme} title="Third-Party Services"
          body={'Our app integrates with:\n• Google Maps: For event location display (subject to Google Privacy Policy)\n• Google Sign-In / Apple Sign-In: For authentication\n• Stripe: For payment processing (subject to Stripe Privacy Policy)\n• Sentry: For crash reporting and error tracking, which may collect device information, app state, and diagnostic data at the time of a crash'} />

        <PolicySection colorScheme={colorScheme} title="Push Notifications"
          body="You can control push notifications in your device settings. We send notifications for new messages, event reminders, team updates, and subscription status changes." />

        <PolicySection colorScheme={colorScheme} title="International Users"
          body="VarsityHub is operated in the United States. By using the app, you consent to the transfer of your information to the United States." />

        <PolicySection colorScheme={colorScheme} title="Changes to This Policy"
          body="We may update this Privacy Policy periodically. We will notify you of significant changes via in-app notification or email to your registered address." />

        <PolicySection colorScheme={colorScheme} title="Contact Us"
          body="If you have questions about this Privacy Policy, email us at support@varsityhub.app." />

        <Text style={[styles.footer, { color: Colors[colorScheme].mutedText }]}>
          © 2026 VarsityHub. All rights reserved.
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
