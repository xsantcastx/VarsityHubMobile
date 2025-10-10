/**
 * Rotating Prompts Component
 * 
 * Displays helpful rotating tips to guide users when creating content
 * Cycles through prompts automatically with smooth transitions
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Prompt {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  category: 'tips' | 'ideas' | 'engagement';
}

const DEFAULT_PROMPTS: Prompt[] = [
  {
    icon: 'camera',
    text: 'Capture the pre-game energy and warm-ups!',
    category: 'ideas',
  },
  {
    icon: 'trophy',
    text: 'Highlight key plays and game-changing moments',
    category: 'ideas',
  },
  {
    icon: 'flash',
    text: 'Tip: Use natural lighting for better quality',
    category: 'tips',
  },
  {
    icon: 'people',
    text: 'Tag your teammates to boost engagement',
    category: 'engagement',
  },
  {
    icon: 'videocam',
    text: 'Record in landscape mode for wider coverage',
    category: 'tips',
  },
  {
    icon: 'star',
    text: "Don't forget post-game celebrations and reactions!",
    category: 'ideas',
  },
  {
    icon: 'chatbubbles',
    text: 'Add a caption to give context to your moment',
    category: 'engagement',
  },
  {
    icon: 'timer',
    text: 'Post within 24 hours while the moment is fresh',
    category: 'tips',
  },
  {
    icon: 'basketball',
    text: 'Show off your skills and practice sessions',
    category: 'ideas',
  },
  {
    icon: 'heart',
    text: 'Engage with other posts to build your community',
    category: 'engagement',
  },
];

interface RotatingPromptsProps {
  prompts?: Prompt[];
  interval?: number; // milliseconds between rotations
  showIcon?: boolean;
  compact?: boolean;
}

export function RotatingPrompts({
  prompts = DEFAULT_PROMPTS,
  interval = 5000,
  showIcon = true,
  compact = false,
}: RotatingPromptsProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (prompts.length <= 1) return;

    const timer = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change prompt
        setCurrentIndex((prev) => (prev + 1) % prompts.length);
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, interval);

    return () => clearInterval(timer);
  }, [prompts.length, interval, fadeAnim]);

  if (!prompts || prompts.length === 0) return null;

  const currentPrompt = prompts[currentIndex];
  const iconColor = getCategoryColor(currentPrompt.category);

  return (
    <Animated.View
      style={[
        compact ? styles.containerCompact : styles.container,
        { backgroundColor: Colors[colorScheme].background, opacity: fadeAnim },
      ]}
    >
      {showIcon && (
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={currentPrompt.icon} size={compact ? 16 : 20} color={iconColor} />
        </View>
      )}
      <Text
        style={[
          compact ? styles.textCompact : styles.text,
          { color: Colors[colorScheme].text },
        ]}
        numberOfLines={2}
      >
        {currentPrompt.text}
      </Text>
      
      {/* Pagination dots */}
      {prompts.length > 1 && !compact && (
        <View style={styles.pagination}>
          {prompts.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                index === currentIndex && { backgroundColor: iconColor },
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function getCategoryColor(category: Prompt['category']): string {
  switch (category) {
    case 'tips':
      return '#2563EB'; // Blue
    case 'ideas':
      return '#7C3AED'; // Purple
    case 'engagement':
      return '#10B981'; // Green
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Compact inline version for smaller spaces
 */
export function RotatingPromptsInline({ prompts }: { prompts?: Prompt[] }) {
  return <RotatingPrompts prompts={prompts} showIcon={false} compact={true} interval={4000} />;
}

/**
 * Prompt presets for different contexts
 */
export const PromptPresets = {
  posting: DEFAULT_PROMPTS,
  
  game: [
    { icon: 'trophy' as const, text: 'Capture the winning moment!', category: 'ideas' as const },
    { icon: 'people' as const, text: 'Show team spirit and celebration', category: 'ideas' as const },
    { icon: 'videocam' as const, text: 'Record key plays in landscape mode', category: 'tips' as const },
    { icon: 'star' as const, text: 'Highlight standout performances', category: 'ideas' as const },
  ],
  
  practice: [
    { icon: 'basketball' as const, text: 'Show off new skills and drills', category: 'ideas' as const },
    { icon: 'flash' as const, text: 'Use good lighting for indoor shots', category: 'tips' as const },
    { icon: 'trophy' as const, text: 'Celebrate personal achievements', category: 'ideas' as const },
    { icon: 'people' as const, text: 'Feature your practice squad', category: 'engagement' as const },
  ],
  
  story: [
    { icon: 'camera' as const, text: 'Quick moments, big impact!', category: 'ideas' as const },
    { icon: 'timer' as const, text: 'Stories disappear in 24 hours', category: 'tips' as const },
    { icon: 'flash' as const, text: 'Use filters to enhance your shot', category: 'tips' as const },
    { icon: 'heart' as const, text: 'Share behind-the-scenes content', category: 'engagement' as const },
  ],
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  textCompact: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  pagination: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
