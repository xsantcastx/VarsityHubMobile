import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  const openExternalLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color={theme.tint} />
          <Text style={[styles.title, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Last updated: November 4, 2025
          </Text>
        </View>

        {/* Placeholder Content */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="document-text-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Privacy Policy Coming Soon</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            Our full Privacy Policy is currently being finalized. This document will outline how we collect, use, and protect your personal information.
          </Text>
        </View>

        {/* What We Collect */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="information-circle-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Information We Collect</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • Account information (email, username, display name){'\n'}
            • Profile data (bio, avatar, preferences){'\n'}
            • Content you create (posts, comments, media){'\n'}
            • Usage data and analytics{'\n'}
            • Device information
          </Text>
        </View>

        {/* How We Use Your Data */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="lock-closed-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>How We Use Your Data</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • To provide and improve our services{'\n'}
            • To personalize your experience{'\n'}
            • To communicate important updates{'\n'}
            • To ensure platform safety{'\n'}
            • To analyze usage patterns
          </Text>
        </View>

        {/* Your Rights */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="hand-right-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Your Rights</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • Access your personal data{'\n'}
            • Request data deletion{'\n'}
            • Opt-out of marketing communications{'\n'}
            • Update your information{'\n'}
            • Export your data
          </Text>
        </View>

        {/* Contact Information */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="mail-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Contact Us</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            If you have questions about our privacy practices, please contact us:
          </Text>
          <Pressable 
            onPress={() => openExternalLink('mailto:privacy@varsityhub.com')}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: theme.tint }]}>privacy@varsityhub.com</Text>
          </Pressable>
        </View>

        {/* External Policy Link (when ready) */}
        <Pressable 
          style={[styles.externalLinkButton, { backgroundColor: theme.tint }]}
          onPress={() => openExternalLink('https://limeprod.com/VarsityHubPrivacy')}
        >
          <Text style={styles.externalLinkText}>View Full Policy on Web</Text>
          <Ionicons name="open-outline" size={18} color="#ffffff" />
        </Pressable>

        <Text style={[styles.footer, { color: theme.mutedText }]}>
          By using VarsityHub, you agree to our Privacy Policy and Terms of Service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  linkButton: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  externalLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  externalLinkText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
