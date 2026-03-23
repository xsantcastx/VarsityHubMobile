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
          Last updated: March 23, 2026
        </Text>

        <TermSection colorScheme={colorScheme} title="1. Acceptance of Terms"
          body={'By accessing and using VarsityHub ("the App"), you accept and agree to be bound by these Terms of Service. If you do not agree, do not use the App.'} />

        <TermSection colorScheme={colorScheme} title="2. Description of Service"
          body={'VarsityHub is a sports team management and social platform that allows users to:\n• Create and manage sports teams\n• Schedule and track games/events\n• Share photos, videos, and posts\n• Communicate with team members\n• Access premium features through paid subscriptions'} />

        <TermSection colorScheme={colorScheme} title="3. User Accounts"
          body={'Registration:\n• You must be at least 13 years old to use VarsityHub\n• You must provide accurate and complete information\n• You are responsible for maintaining the confidentiality of your account credentials\n• You are responsible for all activities under your account\n\nAccount Security:\n• Notify us immediately of any unauthorized access\n• We are not liable for losses from unauthorized account use\n• You may not share your account with others'} />

        <TermSection colorScheme={colorScheme} title="4. User Conduct"
          body={'You agree NOT to:\n• Post illegal, harmful, threatening, abusive, or harassing content\n• Impersonate others or misrepresent your affiliation\n• Upload content you don\'t have rights to\n• Spam, phish, or distribute malware\n• Interfere with the App\'s operation or security\n• Scrape or copy content using automated means\n• Harass, bully, or threaten other users\n• Share private information about others without consent\n• Upload content produced by or licensed to any professional or collegiate sports league, team, conference, or broadcast partner, including game broadcasts, official highlight packages, sideline footage, and any media produced by teams, schools, or their affiliated networks'} />

        <TermSection colorScheme={colorScheme} title="5. Content Ownership and Rights"
          body={'Your Content:\n• You retain ownership of content you post\n• By posting, you grant VarsityHub a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content within the App\n• You represent that you have rights to all content you post\n\nVarsityHub Content:\n• VarsityHub owns all proprietary content, features, and functionality\n• You may not copy, modify, or create derivative works without permission'} />

        <TermSection colorScheme={colorScheme} title="6. Subscriptions and Payments"
          body={'Subscription Tiers:\n• Rookie (Free): First two teams are free; basic features\n• Veteran ($1.50/month per additional team): Enhanced features\n• Legend ($20/year): Flat annual pricing with premium features\n\nBilling:\n• Subscriptions auto-renew unless cancelled\n• Prices are in USD and subject to change with 30 days notice\n• Payment processing handled by Stripe\n• Refunds handled on a case-by-case basis\n• You can cancel anytime through app settings'} />

        <TermSection colorScheme={colorScheme} title="7. Advertising"
          body={'• Paid advertisers can promote content through our Ad Calendar\n• Ad content must comply with our Content Guidelines\n• We reserve the right to reject or remove ads\n• Ad pricing and placements subject to our Ad Policies'} />

        <TermSection colorScheme={colorScheme} title="8. Broadcast & Team Content Policy"
          body={'VarsityHub is a fan-perspective platform. All content must be personally filmed by the uploading user from their own vantage point as an attendee.\n\nVarsityHub has no affiliation with, endorsement from, or license agreement with any professional sports league, collegiate athletic conference, university athletic program, or broadcast rights holder. Any team names, logos, or marks appearing incidentally in fan-filmed content do not imply any such affiliation.\n\nOfficial broadcast content — including footage produced by or licensed to ESPN, CBS, Fox, NBC, conference networks, or any team or school media department — is strictly prohibited on this platform.'} />

        <TermSection colorScheme={colorScheme} title="9. Intellectual Property & DMCA"
          body={'VarsityHub is registered with the U.S. Copyright Office as a DMCA Designated Service Provider (Registration No. DMCA-1070362).\n\nRights holders including sports leagues, athletic conferences, universities, and broadcast partners may submit takedown notices to support@varsityhub.app. VarsityHub will respond within 24 hours and remove infringing content promptly.\n\nUsers who upload infringing content are permanently banned after a second violation.\n\nVarsityHub trademarks may not be used without written permission.'} />

        <TermSection colorScheme={colorScheme} title="10. Privacy"
          body="Your use of the App is subject to our Privacy Policy, which is accessible from Settings." />

        <TermSection colorScheme={colorScheme} title="11. Termination"
          body={'We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or harm other users or the App.\n\nUpon termination:\n• Your right to use the App ceases immediately\n• We may delete your account and content\n• Outstanding payment obligations remain'} />

        <TermSection colorScheme={colorScheme} title="12. Disclaimers"
          body={'• The App is provided "AS IS" without warranties of any kind\n• We don\'t guarantee uninterrupted or error-free service\n• We are not responsible for user-generated content\n• The App integrates third-party services (Google, Stripe, etc.) — we are not responsible for those services'} />

        <TermSection colorScheme={colorScheme} title="13. Limitation of Liability"
          body={'TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n• VarsityHub is not liable for any indirect, incidental, special, or consequential damages\n• Our total liability shall not exceed the amount you paid in the past 12 months'} />

        <TermSection colorScheme={colorScheme} title="14. Indemnification"
          body="You agree to indemnify and hold VarsityHub harmless from any claims, damages, or expenses arising from your use of the App, your content, or your violation of these Terms." />

        <TermSection colorScheme={colorScheme} title="15. Dispute Resolution"
          body={'Governing Law: These Terms are governed by the laws of the State of Connecticut, United States.\n\nArbitration: Disputes will be resolved through binding arbitration, except for small claims court or injunctive relief cases.\n\nClass Action Waiver: You waive the right to participate in class actions against VarsityHub.'} />

        <TermSection colorScheme={colorScheme} title="16. Changes to Terms"
          body="We may modify these Terms at any time. We will notify you of material changes via in-app notification or email. Continued use after changes constitutes acceptance." />

        <TermSection colorScheme={colorScheme} title="17. General Provisions"
          body={'• Severability: If any provision is found invalid, the rest remains in effect\n• No Waiver: Failure to enforce any right doesn\'t waive that right\n• Assignment: We may assign these Terms; you may not without our consent\n• Entire Agreement: These Terms and the Privacy Policy constitute the entire agreement'} />

        <TermSection colorScheme={colorScheme} title="18. Special Provisions"
          body={'Minors: Users aged 13-17 must have parental consent to use the App.\n\nContent Guidelines:\n• Be respectful and sportsmanlike\n• Keep content appropriate for all ages\n• Report violations using in-app reporting\n\nData Retention:\n• We retain data as long as your account is active\n• When you delete your account, we immediately anonymize your personal data; there is no grace period\n• Some data may be retained for legal compliance'} />

        <TermSection colorScheme={colorScheme} title="Contact Us"
          body={'For questions about these Terms:\nEmail: support@varsityhub.app\n\nVarsityHub respects the intellectual property rights of all sports organizations and their broadcast partners. We are committed to working cooperatively with rights holders to address any concerns promptly.'} />

        <Text style={[styles.footer, { color: Colors[colorScheme].mutedText }]}>
          © 2026 VarsityHub. All rights reserved.
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
