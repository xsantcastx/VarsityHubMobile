/**
 * Clickable Banner Ad Component
 * 
 * Displays a banner ad with proper fit mode and handles clicks to open target URL
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface BannerAdProps {
  bannerUrl?: string | null;
  targetUrl?: string | null;
  businessName?: string;
  description?: string;
  fitMode?: 'letterbox' | 'fill' | 'stretch';
  aspectRatio?: number;
  onPress?: () => void; // Optional override for click behavior
}

export function BannerAd({
  bannerUrl,
  targetUrl,
  businessName,
  description,
  fitMode = 'fill',
  aspectRatio = 16 / 9,
  onPress,
}: BannerAdProps) {
  const colorScheme = useColorScheme() ?? 'light';

  const handlePress = async () => {
    // Use custom onPress if provided
    if (onPress) {
      onPress();
      return;
    }

    // Otherwise, open target URL
    if (!targetUrl) {
      Alert.alert('No Link', 'This ad does not have a website link.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert('Invalid Link', 'Unable to open this link.');
      }
    } catch (error) {
      console.error('Error opening ad link:', error);
      Alert.alert('Error', 'Failed to open link. Please try again.');
    }
  };

  const getContentFit = (): 'contain' | 'cover' | 'fill' => {
    switch (fitMode) {
      case 'letterbox':
        return 'contain'; // Fits entire image, may show bars
      case 'stretch':
        return 'fill'; // Stretches to fill, may distort
      case 'fill':
      default:
        return 'cover'; // Fills container, may crop
    }
  };

  // If no banner URL, show placeholder
  if (!bannerUrl) {
    return (
      <View
        style={[
          styles.container,
          {
            aspectRatio,
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
          },
        ]}
      >
        <View style={styles.placeholder}>
          <Ionicons
            name="image-outline"
            size={48}
            color={Colors[colorScheme].mutedText}
          />
          {businessName && (
            <Text
              style={[styles.placeholderText, { color: Colors[colorScheme].text }]}
            >
              {businessName}
            </Text>
          )}
          {description && (
            <Text
              style={[
                styles.placeholderDesc,
                { color: Colors[colorScheme].mutedText },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.container,
        {
          aspectRatio,
          backgroundColor: Colors[colorScheme].surface,
          borderColor: Colors[colorScheme].border,
        },
      ]}
      onPress={handlePress}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}
    >
      <Image
        source={{ uri: bannerUrl }}
        style={styles.image}
        contentFit={getContentFit()}
      />

      {/* "Ad" Badge */}
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>Ad</Text>
      </View>

      {/* External Link Indicator */}
      {targetUrl && (
        <View style={styles.linkIndicator}>
          <Ionicons name="open-outline" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  adBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  linkIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
