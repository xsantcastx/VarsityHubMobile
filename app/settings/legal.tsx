import { Colors } from '@/constants/Colors';
import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LegalScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Legal' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Terms of Service */}
        <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Terms of Service</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            Our Terms of Service outline the rules and regulations for using VarsityHub.
          </Text>
          <Pressable onPress={() => openLink('https://varsityhub.app/terms')}>
            <Text style={styles.link}>https://varsityhub.app/terms</Text>
          </Pressable>
        </View>

        {/* Privacy Policy */}
        <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Privacy Policy</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            Our Privacy Policy describes how we collect, use, and protect your personal information.
          </Text>
          <Pressable onPress={() => openLink('https://varsityhub.app/privacy')}>
            <Text style={styles.link}>https://varsityhub.app/privacy</Text>
          </Pressable>
        </View>

        {/* DMCA / Copyright Policy */}
        <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>DMCA / Copyright Policy</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            VarsityHub respects the intellectual property rights of others and expects its users to do the same.
          </Text>

          <Text style={[styles.subheading, { color: palette.text }]}>Designated DMCA Agent</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            VarsityHub Legal{'\n'}
            Email: support@varsityhub.app
          </Text>

          <Text style={[styles.subheading, { color: palette.text }]}>How to Submit a Takedown Notice</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            To report copyrighted material, send an email to support@varsityhub.app with the following information:
          </Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText, marginTop: 4 }]}>
            {'\u2022'} The URL of the infringing content on VarsityHub{'\n'}
            {'\u2022'} A description of the copyrighted work being infringed{'\n'}
            {'\u2022'} Your full name and contact information
          </Text>

          <Text style={[styles.subheading, { color: palette.text }]}>Repeat Infringer Policy</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            Users who receive two or more copyright violation notices will be permanently banned from VarsityHub.
          </Text>
        </View>

        {/* Contact for Legal Notices */}
        <View style={[styles.section, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Contact for Legal Notices</Text>
          <Text style={[styles.sectionBody, { color: palette.mutedText }]}>
            For all legal inquiries and notices, please contact us at:
          </Text>
          <Pressable onPress={() => openLink('mailto:support@varsityhub.app')}>
            <Text style={styles.link}>support@varsityhub.app</Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: palette.mutedText }]}>
          © 2026 VarsityHub. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0a7ea4',
    textDecorationLine: 'underline',
  },
});
