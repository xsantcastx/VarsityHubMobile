import { Advertisement } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdConfirmationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ 
    ad_id?: string;
    businessName?: string; 
    selectedDates?: string;
    totalAmount?: string;
  }>();
  
  const [adDetails, setAdDetails] = useState<any>(null);
  const [loading, setLoading] = useState(!!params.ad_id);

  useEffect(() => {
    if (params.ad_id) {
      Advertisement.get(params.ad_id)
        .then(data => {
          setAdDetails(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load ad details:', err);
          setLoading(false);
        });
    }
  }, [params.ad_id]);
  
  const businessName = adDetails?.business_name || params.businessName || 'Your Business';
  const selectedDates = params.selectedDates || 'your selected dates';
  const totalAmount = params.totalAmount || '$0.00';
  const bannerUrl = adDetails?.banner_url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
            Loading your ad details...
          </Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Animation */}
          <View style={styles.animationContainer}>
            <View style={[styles.successCircle, { backgroundColor: colorScheme === 'dark' ? '#065F46' : '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={100} color="#10B981" />
            </View>
          </View>

          {/* Success Message */}
          <View style={styles.messageContainer}>
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
              🎉 Your Ad is Live!
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
              Your payment was successful and your ad campaign is now active.
            </Text>
          </View>

          {/* Ad Preview Section */}
          {bannerUrl && (
            <View style={[styles.previewSection, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.previewHeader}>
                <Ionicons name="eye" size={20} color={Colors[colorScheme].text} />
                <Text style={[styles.previewTitle, { color: Colors[colorScheme].text }]}>
                  Ad Preview
                </Text>
              </View>
              <View style={styles.bannerContainer}>
                <Image 
                  source={{ uri: bannerUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </View>
              {adDetails?.target_url && (
                <View style={styles.linkRow}>
                  <Ionicons name="link" size={16} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.linkText, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>
                    {adDetails.target_url}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Details Card */}
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
            style={[styles.detailsCard, { borderColor: Colors[colorScheme].border }]}
          >
          <View style={styles.detailRow}>
            <Ionicons name="business" size={24} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].mutedText }]}>
                Business Name
              </Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {businessName}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={24} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].mutedText }]}>
                Campaign Dates
              </Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {selectedDates}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: Colors[colorScheme].border }]} />

          <View style={styles.detailRow}>
            <Ionicons name="cash" size={24} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].mutedText }]}>
                Total Paid
              </Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {totalAmount}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#EFF6FF', borderColor: colorScheme === 'dark' ? '#334155' : '#BFDBFE' }]}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.infoText, { color: colorScheme === 'dark' ? '#93C5FD' : '#1E40AF' }]}>
              <Text style={{ fontWeight: '700' }}>What's Next?</Text>{'\n'}
              Your ad will appear in feeds for users in your target area. You can view campaign performance and manage your ads in the "My Ads" section.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.replace('/(tabs)/my-ads')}
          >
            <Ionicons name="briefcase" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>View My Ads</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].card }]}
            onPress={() => router.replace('/(tabs)/feed')}
          >
            <Ionicons name="home" size={20} color={Colors[colorScheme].text} />
            <Text style={[styles.secondaryButtonText, { color: Colors[colorScheme].text }]}>
              Back to Feed
            </Text>
          </Pressable>
        </View>

        {/* Support Link */}
        <Pressable 
          style={styles.supportLink}
          onPress={() => router.push('/help')}
        >
          <Ionicons name="help-circle-outline" size={16} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.supportText, { color: Colors[colorScheme].mutedText }]}>
            Need help? Contact Support
          </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  previewSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  bannerImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
  },
  linkText: {
    fontSize: 13,
    flex: 1,
  },
  detailsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  supportText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
