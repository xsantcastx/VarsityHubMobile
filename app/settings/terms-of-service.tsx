import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function TermsOfServiceScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updatedAt, { color: Colors[colorScheme].mutedText }]}>
          Last updated: March 25, 2026
        </Text>

        <TermSection colorScheme={colorScheme} title="1. Agreement"
          body={'By using VarsityHub you agree to these Terms. If you disagree, do not use the app. You must be 13+ (parental consent required for 13-17).'} />

        <TermSection colorScheme={colorScheme} title="2. The Service"
          body={'VarsityHub lets you create/manage sports teams, schedule games, share content, and access premium features via paid subscriptions.'} />

        <TermSection colorScheme={colorScheme} title="3. Your Account"
          body={'Provide accurate info. Keep your credentials secure. You are responsible for all activity on your account. Do not share accounts.'} />

        <TermSection colorScheme={colorScheme} title="4. Rules"
          body={'Do not: post illegal, abusive, or harassing content; impersonate others; upload content you don\'t own; spam; interfere with the app; bully or threaten users; share others\' private info; or upload broadcast/official sports footage.'} />

        <TermSection colorScheme={colorScheme} title="5. Content"
          body={'You own your content. By posting, you grant us a license to display it in the app. All fan content must be personally filmed from your own vantage point. Official broadcast content (ESPN, CBS, Fox, NBC, etc.) is prohibited. VarsityHub has no affiliation with any league, conference, or broadcast partner.'} />

        <TermSection colorScheme={colorScheme} title="6. Subscriptions"
          body={'Rookie: Free (2 teams). Veteran: $1.50/mo per additional team. Legend: $29.99/yr unlimited. Auto-renew unless cancelled. Payments via Apple IAP (iOS), Google Play (Android), or Stripe. Refunds case-by-case. Cancel anytime in Settings.'} />

        <TermSection colorScheme={colorScheme} title="7. Ads"
          body={'Advertisers promote via our Ad Calendar. Ads must comply with content guidelines. We may reject or remove any ad.'} />

        <TermSection colorScheme={colorScheme} title="8. DMCA"
          body={'We are a registered DMCA Designated Service Provider (No. DMCA-1070362). Takedown notices: support@varsityhub.app. Response within 24 hours. Second violation = permanent ban.'} />

        <TermSection colorScheme={colorScheme} title="9. Termination"
          body={'We may suspend or terminate accounts that violate these Terms. Upon termination: access stops, content may be deleted, payment obligations remain.'} />

        <TermSection colorScheme={colorScheme} title="10. Disclaimers & Liability"
          body={'The app is provided "AS IS." We are not liable for indirect or consequential damages. Total liability capped at what you paid us in the past 12 months. You indemnify us against claims from your use or content.'} />

        <TermSection colorScheme={colorScheme} title="11. Disputes"
          body={'Governed by Connecticut law. Disputes resolved via binding arbitration (small claims excepted). Class action waiver applies.'} />

        <TermSection colorScheme={colorScheme} title="12. Changes"
          body={'We may update these Terms. Material changes notified via app or email. Continued use = acceptance.'} />

        <TermSection colorScheme={colorScheme} title="Contact"
          body={'Customer service: customerservice@varsityhub.app\nReport content or users: support@varsityhub.app'} />

        <Text style={[styles.footer, { color: Colors[colorScheme].mutedText }]}>
          © 2025 Lime Productions. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function TermSection({
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
