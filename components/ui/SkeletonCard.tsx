import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle, View, StyleSheet } from 'react-native';

// --- Base Skeleton Block ---

interface SkeletonCardProps {
  width: number | `${number}%` | 'auto';
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ width, height, borderRadius = 8, style }: SkeletonCardProps) {
  const colorScheme = useCustomColorScheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors[colorScheme].border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// --- PostCardSkeleton ---

export function PostCardSkeleton() {
  const colorScheme = useCustomColorScheme();
  return (
    <View
      style={[
        styles.postCard,
        { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
      ]}
    >
      {/* Header: avatar + name + timestamp */}
      <View style={styles.postHeader}>
        <SkeletonCard width={40} height={40} borderRadius={20} />
        <View style={styles.postHeaderText}>
          <SkeletonCard width={120} height={14} borderRadius={4} />
          <SkeletonCard width={80} height={10} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>
      {/* Content lines */}
      <SkeletonCard width="100%" height={14} borderRadius={4} style={{ marginTop: 12 }} />
      <SkeletonCard width="75%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      {/* Action bar */}
      <View style={styles.postActions}>
        <SkeletonCard width={60} height={12} borderRadius={4} />
        <SkeletonCard width={60} height={12} borderRadius={4} />
        <SkeletonCard width={60} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

// --- ProfileHeaderSkeleton ---

export function ProfileHeaderSkeleton() {
  const colorScheme = useCustomColorScheme();
  return (
    <View style={[styles.profileContainer, { backgroundColor: Colors[colorScheme].card }]}>
      {/* Banner */}
      <SkeletonCard width="100%" height={140} borderRadius={0} />
      {/* Avatar */}
      <View style={styles.profileAvatarRow}>
        <SkeletonCard width={88} height={88} borderRadius={44} style={styles.profileAvatar} />
      </View>
      {/* Name + bio */}
      <View style={styles.profileInfo}>
        <SkeletonCard width={160} height={20} borderRadius={4} />
        <SkeletonCard width={200} height={14} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
      {/* Stats row */}
      <View style={styles.profileStats}>
        <SkeletonCard width={50} height={14} borderRadius={4} />
        <SkeletonCard width={50} height={14} borderRadius={4} />
        <SkeletonCard width={50} height={14} borderRadius={4} />
      </View>
    </View>
  );
}

// --- TeamCardSkeleton ---

export function TeamCardSkeleton() {
  const colorScheme = useCustomColorScheme();
  return (
    <View
      style={[
        styles.teamCard,
        { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
      ]}
    >
      {/* Team logo */}
      <SkeletonCard width={56} height={56} borderRadius={12} />
      {/* Text area */}
      <View style={styles.teamText}>
        <SkeletonCard width={140} height={16} borderRadius={4} />
        <SkeletonCard width={100} height={12} borderRadius={4} style={{ marginTop: 6 }} />
        <SkeletonCard width={70} height={12} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
      {/* Chevron placeholder */}
      <SkeletonCard width={20} height={20} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Post card
  postCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
  },
  // Profile header
  profileContainer: {
    overflow: 'hidden',
  },
  profileAvatarRow: {
    marginTop: -44,
    paddingHorizontal: 16,
  },
  profileAvatar: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  // Team card
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  teamText: {
    flex: 1,
    marginLeft: 12,
  },
});
