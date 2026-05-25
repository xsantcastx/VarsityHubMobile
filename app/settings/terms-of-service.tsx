import { Text, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  LEGEND_YEARLY_PRICE_LABEL,
  ROOKIE_TEAM_LIMIT,
  VETERAN_MONTHLY_TEAM_PRICE_LABEL,
} from '@/constants/plans';
import {
  LegalDocumentScreen,
  LegalSectionCard,
  legalDocumentSharedStyles as sharedStyles,
} from '@/components/settings/LegalDocumentShared';

export default function TermsOfServiceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const subscriptionTerms = `Rookie: Free (${ROOKIE_TEAM_LIMIT} teams). Veteran: ${VETERAN_MONTHLY_TEAM_PRICE_LABEL}. Legend: ${LEGEND_YEARLY_PRICE_LABEL} unlimited. Auto-renew unless cancelled. Payments via Apple IAP (iOS), Google Play (Android), or Stripe. Refunds case-by-case. Cancel anytime in Settings.`;

  return (
    <LegalDocumentScreen title="Terms of Service" colorScheme={colorScheme}>
      <Text style={[sharedStyles.updatedAt, { color: Colors[colorScheme].mutedText }]}>
          Last updated: March 25, 2026
      </Text>

      <LegalSectionCard colorScheme={colorScheme} title="1. Agreement"
          body={'By using VarsityHub you agree to these Terms. If you disagree, do not use the app. You must be 13 or older to use VarsityHub.'} />

      <LegalSectionCard colorScheme={colorScheme} title="2. The Service"
          body={'VarsityHub lets you create/manage sports teams, schedule games, share content, and access premium features via paid subscriptions.'} />

      <LegalSectionCard colorScheme={colorScheme} title="3. Your Account"
          body={'Provide accurate info. Keep your credentials secure. You are responsible for all activity on your account. Do not share accounts.'} />

      <LegalSectionCard colorScheme={colorScheme} title="4. Rules"
          body={'Do not: post illegal, abusive, or harassing content; impersonate others; upload content you don\'t own; spam; interfere with the app; bully or threaten users; share others\' private info; or upload broadcast/official sports footage.'} />

      <LegalSectionCard colorScheme={colorScheme} title="5. Content"
          body={'You own your content. By posting, you grant us a license to display it in the app. All fan content must be personally filmed from your own vantage point. Official broadcast content (ESPN, CBS, Fox, NBC, etc.) is prohibited. VarsityHub has no affiliation with any league, conference, or broadcast partner.'} />

      <LegalSectionCard colorScheme={colorScheme} title="6. Subscriptions"
          body={subscriptionTerms} />

      <LegalSectionCard colorScheme={colorScheme} title="7. Ads"
          body={'Advertisers promote via our Ad Calendar. Ads must comply with content guidelines. We may reject or remove any ad.'} />

      <LegalSectionCard colorScheme={colorScheme} title="8. DMCA"
          body={'We are a registered DMCA Designated Service Provider (No. DMCA-1070362). Takedown notices: support@varsityhub.app. Response within 24 hours. Second violation = permanent ban.'} />

      <LegalSectionCard colorScheme={colorScheme} title="9. Termination"
          body={'We may suspend or terminate accounts that violate these Terms. Upon termination: access stops, content may be deleted, payment obligations remain.'} />

      <LegalSectionCard colorScheme={colorScheme} title="10. Disclaimers & Liability"
          body={'The app is provided "AS IS." We are not liable for indirect or consequential damages. Total liability capped at what you paid us in the past 12 months. You indemnify us against claims from your use or content.'} />

      <LegalSectionCard colorScheme={colorScheme} title="11. Disputes"
          body={'Governed by Connecticut law. Disputes resolved via binding arbitration (small claims excepted). Class action waiver applies.'} />

      <LegalSectionCard colorScheme={colorScheme} title="12. Changes"
          body={'We may update these Terms. Material changes notified via app or email. Continued use = acceptance.'} />

      <LegalSectionCard colorScheme={colorScheme} title="Contact"
          body={'Customer service: customerservice@varsityhub.app\nReport content or users: support@varsityhub.app'} />

      <Text style={[sharedStyles.footer, { color: Colors[colorScheme].mutedText }]}>
        © 2025 Lime Productions. All rights reserved.
      </Text>
    </LegalDocumentScreen>
  );
}
