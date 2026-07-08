import { Text, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  LegalDocumentScreen,
  LegalSectionCard,
  legalDocumentSharedStyles as sharedStyles,
} from '@/components/settings/LegalDocumentShared';

// Public web route: https://varsityhub.app/account-deletion (PUBLIC_ACCOUNT_DELETION_URL,
// required by the Play Store data-deletion listing). Keep the deletion terms in sync with
// app/settings/privacy-policy.tsx and the fallback pages in server/src/routes/publicSite.ts.
export default function AccountDeletionScreen() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <LegalDocumentScreen title="Account Deletion" colorScheme={colorScheme}>
      <Text style={[sharedStyles.updatedAt, { color: Colors[colorScheme].mutedText }]}>
        Last updated: July 6, 2026
      </Text>

      <LegalSectionCard
        colorScheme={colorScheme}
        title="How to Delete Your Account"
        body={
          'Open the VarsityHub app, go to Settings, tap Account, then tap Delete Account and confirm. Your personal data (email, display name, username, profile, preferences) is anonymized immediately, and your comments and social connections are removed. Residual backup copies are purged within 90 days.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="Can't Access the App?"
        body={
          'Email customerservice@varsityhub.app from your registered address and we will process your deletion request manually.'
        }
      />

      <Text style={[sharedStyles.footer, { color: Colors[colorScheme].mutedText }]}>
        © 2025 Lime Productions. All rights reserved.
      </Text>
    </LegalDocumentScreen>
  );
}
