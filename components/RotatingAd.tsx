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
  const [showFallback, setShowFallback] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter to valid ads with banners (up to 2)
  const validAds = ads.filter(ad => ad.banner_url && ad.banner_url.length > 0).slice(0, 2);

  // Rotation logic (customized)
  useEffect(() => {
    // Cleanup timers on unmount or ads change
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    // Clear all timers on ads change
    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);

    setShowFallback(false);
    setCurrentIndex(0);

    if (validAds.length === 0) {
      // Always fallback, nothing to rotate
      return;
    }

    if (validAds.length === 1) {
      // Show ad for 2min, then fallback for 10s, repeat
      const startCycle = () => {
        setShowFallback(false);
        fallbackTimerRef.current = setTimeout(() => {
          setShowFallback(true);
          fallbackTimerRef.current = setTimeout(() => {
            setShowFallback(false);
            startCycle();
          }, 10000); // 10s fallback
        }, 120000); // 2min ad
      };
      startCycle();
      return;
    }

    if (validAds.length === 2) {
      // Rotate each ad for 45s, every 5min show fallback for 10s
      let adIndex = 0;
      const rotateAds = () => {
        setShowFallback(false);
        setCurrentIndex(adIndex);
        adIndex = (adIndex + 1) % 2;
      };
      rotateAds();
      rotationTimerRef.current = setInterval(rotateAds, 45000); // 45s per ad
      // Every 5min, show fallback for 10s
      fallbackIntervalRef.current = setInterval(() => {
        setShowFallback(true);
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = setTimeout(() => {
          setShowFallback(false);
        }, 10000); // 10s fallback
      }, 300000); // 5min
      return;
    }
  }, [validAds.length, rotationInterval, fadeAnim]);

  // Show fallback if needed (for 0 ads, or during fallback interval)
  if (validAds.length === 0 || showFallback) {
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
