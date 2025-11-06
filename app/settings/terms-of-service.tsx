import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  const openExternalLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="document-text" size={48} color={theme.tint} />
          <Text style={[styles.title, { color: theme.text }]}>Terms of Service</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Last updated: November 4, 2025
          </Text>
        </View>

        {/* Placeholder Content */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="document-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Terms Coming Soon</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            Our full Terms of Service are currently being finalized. This document will outline the rules and guidelines for using VarsityHub.
          </Text>
        </View>

        {/* User Responsibilities */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="person-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>User Responsibilities</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • Maintain accurate account information{'\n'}
            • Keep your password secure{'\n'}
            • Follow our Core Values and Community Guidelines{'\n'}
            • Respect intellectual property rights{'\n'}
            • Do not engage in harassment or abuse
          </Text>
        </View>

        {/* Acceptable Use */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Acceptable Use</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • Share sports content and highlights{'\n'}
            • Connect with teams and fans{'\n'}
            • Participate in community discussions{'\n'}
            • Report violations responsibly{'\n'}
            • Support positive sportsmanship
          </Text>
        </View>

        {/* Prohibited Activities */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Prohibited Activities</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            • Spam or unsolicited advertising{'\n'}
            • Impersonation or fake accounts{'\n'}
            • Sharing illegal content{'\n'}
            • Automated scraping or data collection{'\n'}
            • Violating others' privacy
          </Text>
        </View>

        {/* Content Rights */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="images-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Content Rights</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            You retain ownership of content you post. By sharing on VarsityHub, you grant us a license to display, distribute, and promote your content within our platform.
          </Text>
        </View>

        {/* Contact Information */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconRow}>
            <Ionicons name="mail-outline" size={24} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Questions?</Text>
          </View>
          <Text style={[styles.cardText, { color: theme.mutedText }]}>
            If you have questions about our terms, please contact us:
          </Text>
          <Pressable 
            onPress={() => openExternalLink('mailto:legal@varsityhub.com')}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: theme.tint }]}>legal@varsityhub.com</Text>
          </Pressable>
        </View>

        {/* External Policy Link (when ready) */}
        <Pressable 
          style={[styles.externalLinkButton, { backgroundColor: theme.tint }]}
          onPress={() => openExternalLink('https://varsityhub.com/terms')}
        >
          <Text style={styles.externalLinkText}>View Full Terms on Web</Text>
          <Ionicons name="open-outline" size={18} color="#ffffff" />
        </Pressable>

        <Text style={[styles.footer, { color: theme.mutedText }]}>
          By using VarsityHub, you agree to these Terms of Service. We may update these terms periodically.
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
