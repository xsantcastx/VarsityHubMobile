/**
 * Rotating Ad Display Component
 * 
 * Displays ads in a rotating carousel that cycles every minute.
 * Shows up to 2 active ads, or falls back to "Reserve Ad Space" button if no ads.
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BannerAd } from './BannerAd';

type AdData = {
  id: string;
  business_name: string;
  description?: string;
  banner_url?: string | null;
  banner_fit_mode?: 'letterbox' | 'fill' | 'stretch';
  target_url?: string | null;
};

interface RotatingAdProps {
  ads: AdData[];
  rotationInterval?: number; // milliseconds, default 60000 (1 minute)
  aspectRatio?: number;
  onReserveAdSpace?: () => void;
}

export function RotatingAd({
  ads,
  rotationInterval = 60000, // 1 minute default
  aspectRatio = 16 / 9,
  onReserveAdSpace,
}: RotatingAdProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter to valid ads with banners (up to 2)
  const validAds = ads.filter(ad => ad.banner_url && ad.banner_url.length > 0).slice(0, 2);

  // Rotation logic
  useEffect(() => {
    // Only rotate if we have multiple ads
    if (validAds.length <= 1) return;

    const rotate = () => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change ad
        setCurrentIndex(prev => (prev + 1) % validAds.length);
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    };

    // Start rotation timer
    rotationTimerRef.current = setInterval(rotate, rotationInterval);

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [validAds.length, rotationInterval, fadeAnim]);

  // If no ads, show "Reserve Ad Space" button
  if (validAds.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            aspectRatio,
            backgroundColor: Colors[colorScheme].card,
            borderColor: Colors[colorScheme].border,
          },
        ]}
      >
        <Pressable
          style={styles.reserveButton}
          onPress={() => {
            if (onReserveAdSpace) {
              onReserveAdSpace();
            } else {
              router.push('/submit-ad');
            }
          }}
        >
          <Ionicons name="megaphone-outline" size={48} color={Colors[colorScheme].tint} />
          <Text style={[styles.reserveTitle, { color: Colors[colorScheme].text }]}>
            Reserve Ad Space
          </Text>
          <Text style={[styles.reserveSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Promote your business to local athletes and fans
          </Text>
          <View style={[styles.reserveCta, { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={styles.reserveCtaText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    );
  }

  const currentAd = validAds[currentIndex];

  return (
    <View style={styles.wrapper}>
      <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
        <BannerAd
          bannerUrl={currentAd.banner_url}
          targetUrl={currentAd.target_url}
          businessName={currentAd.business_name}
          description={currentAd.description}
          fitMode={currentAd.banner_fit_mode || 'fill'}
          aspectRatio={aspectRatio}
        />
      </Animated.View>

      {/* Rotation indicators - only show if multiple ads */}
      {validAds.length > 1 && (
        <View style={styles.indicators}>
          {validAds.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor: index === currentIndex 
                    ? Colors[colorScheme].tint 
                    : Colors[colorScheme].mutedText,
                  opacity: index === currentIndex ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Ad count badge */}
      {validAds.length > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {currentIndex + 1} / {validAds.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reserveButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  reserveTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  reserveSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '80%',
  },
  reserveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  reserveCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  indicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
