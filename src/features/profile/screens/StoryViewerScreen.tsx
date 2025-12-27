import VideoPlayer from '@/components/VideoPlayer';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

interface Story {
  id: string;
  media_url: string;
  media_type?: 'image' | 'video';
  created_at: string;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export default function StoryViewerScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ stories?: string; currentIndex?: string }>();
  
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Parse stories from params
    try {
      if (params.stories) {
        const parsedStories = JSON.parse(params.stories as string);
        setStories(parsedStories);
      }
      if (params.currentIndex) {
        setCurrentIndex(parseInt(params.currentIndex as string, 10));
      }
    } catch (e) {
      console.error('Failed to parse stories:', e);
      router.back();
    }
  }, [params]);

  const startProgress = useCallback(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        goToNext();
      }
    });
  }, [currentIndex, stories.length]);

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (stories.length > 0) {
      startProgress();
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, stories]);

  if (stories.length === 0) {
    return null;
  }

  const currentStory = stories[currentIndex];
  const isVideo = currentStory.media_type === 'video' || 
                  currentStory.media_url?.match(/\.(mp4|mov|webm|m4v|avi)$/i);
  
  // Calculate time remaining
  const createdAt = new Date(currentStory.created_at);
  const now = new Date();
  const hoursRemaining = Math.max(0, 24 - Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]} edges={['top', 'bottom']}>
      {/* Close Button */}
      <Pressable 
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={28} color="#ffffff" />
      </Pressable>

      {/* Progress Bars */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarWrapper}>
            <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
            {index < currentIndex && (
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#ffffff' }]} />
            )}
            {index === currentIndex && (
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: '#ffffff',
                  },
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {/* Story Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {currentStory.author?.avatar_url ? (
            <Image 
              source={{ uri: currentStory.author.avatar_url }} 
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.tint }]}>
              <Ionicons name="person" size={16} color="#ffffff" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>
            {currentStory.author?.display_name || 'User'}
          </Text>
          <Text style={styles.timeRemaining}>
            {hoursRemaining}h remaining
          </Text>
        </View>
      </View>

      {/* Story Content */}
      <Pressable 
        style={styles.contentContainer}
        onPress={(e) => {
          const x = e.nativeEvent.locationX;
          if (x < SCREEN_WIDTH / 2) {
            goToPrevious();
          } else {
            goToNext();
          }
        }}
      >
        {isVideo ? (
          <VideoPlayer 
            uri={currentStory.media_url} 
            style={styles.media}
            autoPlay={true}
          />
        ) : (
          <Image 
            source={{ uri: currentStory.media_url }} 
            style={styles.media}
            contentFit="contain"
          />
        )}
      </Pressable>

      {/* Navigation Hint */}
      <View style={styles.navHintContainer}>
        <View style={styles.navHint}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={styles.navHintText}>Tap left</Text>
        </View>
        <View style={styles.navHint}>
          <Text style={styles.navHintText}>Tap right</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 56,
    flexDirection: 'row',
    gap: 4,
    zIndex: 99,
  },
  progressBarWrapper: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 1.5,
  },
  header: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 98,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeRemaining: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  navHintContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    opacity: 0.3,
  },
  navHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navHintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
});
