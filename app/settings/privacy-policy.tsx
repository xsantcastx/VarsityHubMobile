import { Text, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  LegalDocumentScreen,
  LegalSectionCard,
  legalDocumentSharedStyles as sharedStyles,
} from '@/components/settings/LegalDocumentShared';

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <LegalDocumentScreen title="Privacy Policy" colorScheme={colorScheme}>
      <Text style={[sharedStyles.updatedAt, { color: Colors[colorScheme].mutedText }]}>
          Last updated: March 25, 2026
      </Text>

      <LegalSectionCard
          colorScheme={colorScheme}
          title="What We Collect"
          body={
            'We collect: email, username, profile info, posts, photos, videos, messages, team/game data, event RSVPs, device info, usage data, product analytics events (screen views, taps, feature usage), crash diagnostics, and approximate location (when enabled). Payments are processed by Apple, Google Play, or Stripe depending on platform — we never store full card numbers.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="How We Use It"
          body={
            'To run VarsityHub: deliver the service, process payments, send notifications, show nearby events, personalize your experience, and prevent abuse.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="Who We Share With"
          body={
            'We do not sell your data. We share only with: service providers (Stripe, Cloudinary, Railway, Google, Sentry for crash diagnostics, PostHog for product analytics, SendGrid for email), when you post publicly, or when required by law. We do not share data with sports leagues or universities.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="Your Rights"
          body={
            'You can access, correct, delete, or export your data. Delete your account in Settings — we anonymize your data immediately. Contact customerservice@varsityhub.app for account requests or support@varsityhub.app to report content.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="Children"
          body={
            'You must be 13+ to use VarsityHub. Users 13-17 need parental consent. We deny accounts for users under 13 and delete under-13 data immediately upon discovery.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="Security & Storage"
          body={
            'Data encrypted in transit (HTTPS), stored on Railway (PostgreSQL). We use industry-standard security. VarsityHub is US-based; by using the app you consent to US data transfer.'
          }
        />

      <LegalSectionCard
          colorScheme={colorScheme}
          title="Changes & Contact"
          body={
            'We may update this policy and will notify you of material changes. Questions? Email customerservice@varsityhub.app.'
          }
        />

      <Text style={[sharedStyles.footer, { color: Colors[colorScheme].mutedText }]}>
        © 2025 Lime Productions. All rights reserved.
      </Text>
    </LegalDocumentScreen>
  );
}
