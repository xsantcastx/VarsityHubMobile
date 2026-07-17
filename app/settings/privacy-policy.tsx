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
        Last updated: July 17, 2026
      </Text>

      <LegalSectionCard
        colorScheme={colorScheme}
        title="1. Introduction"
        body={
          'This Privacy Policy describes how Lime Productions ("VarsityHub," "we," "us," or "our") collects, uses, and discloses information in connection with the VarsityHub application and related services (the "Service"). By using the Service, you agree to the practices described in this Policy.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="2. Information We Collect"
        body={
          'Account Information. Information you provide when creating or maintaining an account, such as your email address, username, and profile details. You may sign in using your email address or a supported third-party sign-in service.\n\nContent You Submit. Posts, photographs, videos, messages, team and event information, and other materials you choose to upload or share through the Service.\n\nTransaction Information. Records of purchases and subscriptions. Payments are processed by the applicable app store or our third-party payment processor; we do not receive or store full payment card numbers.\n\nTechnical and Usage Information. Device and diagnostic information, identifiers, IP address, and browser or device user-agent, along with information about how you interact with the Service, collected to operate, secure, and improve the Service.\n\nLocation Information. With your permission, approximate location to surface nearby games and events, and, at the moment you use certain location-based posting features, precise device location solely to verify eligibility to use that feature. We do not track your location in the background.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="3. How We Use Information"
        body={
          'We use the information we collect to provide, maintain, and improve the Service; process transactions; deliver notifications and communications; personalize your experience; verify eligibility for certain features; maintain the safety and integrity of the Service, including fraud and abuse prevention; and comply with legal obligations.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="4. How We Share Information"
        body={
          'We do not sell your personal information. We disclose information only: (a) to service providers performing services on our behalf — such as cloud hosting, media storage, payment processing, analytics, diagnostics, communications delivery, and content safety and automated moderation — under obligations limiting their use of that information; (b) when you choose to share content publicly or with other users; (c) as required by law, legal process, or to protect the rights, property, or safety of VarsityHub, our users, or others; and (d) in connection with a merger, acquisition, or sale of assets, in which case this Policy will continue to apply to your information.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="5. User Content and Sporting Events"
        body={
          'VarsityHub is an independent platform and is not affiliated with, endorsed by, or sponsored by any sports league, conference, team, venue, broadcaster, or governing body. Content shared through the Service is created and submitted by users. Each user is solely responsible for the content they record, upload, or share — including recordings made at sporting events — and for complying with applicable laws, venue policies, and third-party rights. Content you share publicly may be viewed, and further shared, by others.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="6. Data Retention and Deletion"
        body={
          'We retain personal information for as long as your account is active or as needed to provide the Service and meet legal obligations. You may delete your account at any time in Settings. Deletion is immediate and permanent: your account and the content you created — including your posts, media, and comments — are deleted right away, rather than anonymized or held for a grace period, and this cannot be undone. Residual copies are removed from backup systems within 90 days. We retain only the records we are legally required to keep, such as parental-consent decisions made by platform administrators.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="7. Your Rights and Choices"
        body={
          'Subject to applicable law, you may request access to, correction of, deletion of, or a portable copy of your personal information. You may manage location and notification permissions in your device settings at any time. To exercise your rights, contact customerservice@varsityhub.app.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="8. Children's Privacy"
        body={
          'The Service is not directed to and may not be used by children under 13, and we do not knowingly collect personal information from anyone under 13. Users aged 13 and older may create and use an account on their own. If we learn that we have collected personal information from a child under 13, we will delete it promptly.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="9. Security"
        body={
          'We use commercially reasonable administrative, technical, and physical safeguards designed to protect your information, including encryption of data in transit. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="10. International Users"
        body={
          'The Service is operated from the United States. If you access the Service from outside the United States, you understand that your information will be transferred to, stored, and processed in the United States.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="11. Changes to This Policy"
        body={
          'We may update this Policy from time to time. If we make material changes, we will provide notice through the Service or by other reasonable means. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.'
        }
      />

      <LegalSectionCard
        colorScheme={colorScheme}
        title="12. Contact"
        body={
          'Questions about this Policy or requests concerning your information: customerservice@varsityhub.app. To report content: support@varsityhub.app.'
        }
      />

      <Text style={[sharedStyles.footer, { color: Colors[colorScheme].mutedText }]}>
        © 2025 Lime Productions. All rights reserved.
      </Text>
    </LegalDocumentScreen>
  );
}
