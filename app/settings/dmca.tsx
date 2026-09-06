import { StyleSheet, Text } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LegalDocumentScreen, LegalSectionCard } from '@/components/settings/LegalDocumentShared';

export default function DMCAScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];

  return (
    <LegalDocumentScreen title="Copyright & DMCA" colorScheme={colorScheme}>
      <LegalSectionCard
        colorScheme={colorScheme}
        title="DMCA Designated Service Provider"
        body="VarsityHub is registered with the U.S. Copyright Office as a DMCA Designated Service Provider (Registration No. DMCA-1070362)."
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="Report Copyright Infringement"
        body={
          'To report copyright infringement, contact VarsityHub:\n\nOrganization: VarsityHub LLC\nEmail: support@varsityhub.app\nWebsite: varsityhub.app'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="What to Include"
        body={
          'Your notice must include:\n\n1. Identification of the copyrighted work you claim is infringed\n2. The specific URL of the infringing content on VarsityHub\n3. Your name, address, phone number, and email\n4. A statement of good faith belief that the use is unauthorized\n5. A statement under penalty of perjury that you are authorized to act on behalf of the rights holder'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="Response & Enforcement"
        body="VarsityHub will respond within 24 hours and remove infringing content promptly. Repeat infringers are permanently banned."
      />

      <Text style={[styles.footer, { color: C.mutedText }]}>
        VarsityHub respects the intellectual property rights of all sports organizations and their
        broadcast partners. We are committed to working cooperatively with rights holders to address
        any concerns promptly.
      </Text>
    </LegalDocumentScreen>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
