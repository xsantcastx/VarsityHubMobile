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
import { useMemo, useState } from 'react';

interface BannerAdProps {
  bannerUrl?: string | null;
  targetUrl?: string | null;
  businessName?: string;
  description?: string;
  fitMode?: 'rotate' | 'fill' | 'stretch' | 'letterbox' | `rotate:${number}`;
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

    // If no target URL, show message
    if (!targetUrl) {
      Alert.alert('No Link', 'This ad does not have a website link.');
      return;
    }

    // Normalize the URL - add https:// if no protocol is present
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Show confirmation dialog before opening external link
    Alert.alert(
      'Open Website',
      `Do you want to visit ${businessName || 'this website'}?\n\n${normalizedUrl}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open',
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(normalizedUrl);
              if (canOpen) {
                await Linking.openURL(normalizedUrl);
              } else {
                Alert.alert('Invalid Link', 'Unable to open this link. Please check the URL format.');
              }
            } catch (error) {
              console.error('Error opening ad link:', error);
              Alert.alert('Error', 'Failed to open link. Please try again.');
            }
          },
        },
      ]
    );
  };

  const parseRotate = (mode?: string | null) => {
    if (!mode) return { base: 'fill', rotation: 0 };
    if (mode.startsWith('rotate:')) {
      const raw = Number(mode.split(':')[1]);
      return { base: 'rotate', rotation: Number.isFinite(raw) ? raw : 0 };
    }
    return { base: mode, rotation: 0 };
  };

  const { base, rotation } = parseRotate(fitMode || 'fill');

  const getContentFit = (): 'contain' | 'cover' | 'fill' => {
    switch (base) {
      case 'rotate':
      case 'letterbox':
        return 'contain'; // Fits entire image, may show bars
      case 'stretch':
        return 'fill'; // Stretches to fill, may distort
      case 'fill':
      default:
        return 'cover'; // Fills container, may crop
    }
  };

  const getRotateFitScale = (angleDeg: number, width: number, height: number) => {
    if (!width || !height) return 1;
    const rad = (Math.abs(angleDeg) % 360) * (Math.PI / 180);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedWidth = width * cos + height * sin;
    const rotatedHeight = width * sin + height * cos;
    const scaleX = width / rotatedWidth;
    const scaleY = height / rotatedHeight;
    return Math.min(scaleX, scaleY, 1);
  };

  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rotateScale = useMemo(() => {
    if (base !== 'rotate' || !rotation) return 1;
    return getRotateFitScale(rotation, layout.width, layout.height);
  }, [base, rotation, layout.width, layout.height]);

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
      style={({ pressed }) => [
        styles.container,
        {
          aspectRatio,
          backgroundColor: Colors[colorScheme].surface,
          borderColor: Colors[colorScheme].border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width && height && (layout.width !== width || layout.height !== height)) {
          setLayout({ width, height });
        }
      }}
      onPress={handlePress}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}
    >
      <Image
        source={{ uri: bannerUrl }}
        style={[
          styles.image,
          base === 'rotate' && rotation !== 0 && {
            transform: [{ scale: rotateScale }, { rotate: `${rotation}deg` }],
          },
        ]}
        contentFit={getContentFit()}
      />

      {/* "Tap to visit" overlay — top-left */}
      {targetUrl && (
        <View style={styles.linkIndicator}>
          <Text style={styles.linkIndicatorText}>Tap to visit</Text>
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
  linkIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  linkIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
