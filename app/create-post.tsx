import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Image as RNImage, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Game, Post, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { PromptPresets, RotatingPrompts } from '@/components/RotatingPrompts';
import { StoryCameraButton } from '@/components/StoryCameraButton';
import { MentionInput } from '@/components/ui/MentionInput';
import VideoPlayer from '@/components/VideoPlayer';
import PrimaryButton from '@/ui/PrimaryButton';
import { pickerMediaTypeFor } from '@/utils/picker';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Media validation constants
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  'image/heic',      // ✅ iPhone format
  'image/heif',      // ✅ iPhone format
  'image/heic-sequence',
  'image/heif-sequence'
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// Validation helpers
const validateMediaType = (mimeType: string | undefined, mediaType: 'image' | 'video'): boolean => {
  if (!mimeType) return false;
  const allowedTypes = mediaType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  return allowedTypes.some(type => mimeType.toLowerCase().includes(type.toLowerCase()));
};

const getFileSizeFromUri = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    console.warn('Could not determine file size:', error);
    return 0;
  }
};

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId?: string; type?: string }>();
  const gameId = params?.gameId ? String(params.gameId) : undefined;
  const postType = params?.type === 'highlight' ? 'highlight' : 'post';
  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video'; mime?: string } | null>(null);
  const [shareLocation, setShareLocation] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locGranted, setLocGranted] = useState<boolean | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>(gameId);
  const [suggestedGame, setSuggestedGame] = useState<any>(null);
  const [nearbyGames, setNearbyGames] = useState<any[]>([]);
  const [gestureMode, setGestureMode] = useState<'camera' | 'review'>('camera');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  // Animation values for swipe gesture
  const translateY = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);
  const cameraScale = useSharedValue(1);
  const reviewScale = useSharedValue(1);

  const handleCloseReviewModal = () => setReviewModalVisible(false);

  const handleReviewMode = () => {
    const hasMedia = Boolean(picked?.uri);
    const hasText = Boolean(content.trim());
    if (!hasMedia && !hasText) {
      Alert.alert('Nothing to review yet', 'Capture media or add a caption before reviewing.');
      setGestureMode('camera');
      return;
    }
    setReviewModalVisible(true);
  };

  const activateCameraMode = () => {
    setGestureMode('camera');
  };

  const triggerReviewMode = () => {
    setGestureMode('review');
    handleReviewMode();
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setLocGranted(granted);
        if (granted) {
          const last = await Location.getLastKnownPositionAsync();
          const fresh = last && (Date.now() - (last.timestamp || 0)) < 10 * 60 * 1000 ? last : null;
          const pos = fresh || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (pos?.coords) { setLat(pos.coords.latitude); setLng(pos.coords.longitude); }
        }
      } catch { setLocGranted(false); }
    })();
  }, []);

  // Auto-suggest nearest event based on time and location
  useEffect(() => {
    if (selectedGameId) return; // Don't override if already selected via params
    
    (async () => {
      try {
        // Fetch upcoming games
        const games = await Game.list('-date');
        const gamesArray = Array.isArray(games) ? games : (games?.items || []);
        
        if (!gamesArray.length) return;
        
        const now = new Date();
        
        // Filter to upcoming games (within next 7 days)
        const upcomingGames = gamesArray.filter((g: any) => {
          if (!g.date) return false;
          const gameDate = new Date(g.date);
          const daysDiff = (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff >= -0.5 && daysDiff <= 7; // Include games from 12 hours ago to 7 days ahead
        });
        
        if (!upcomingGames.length) return;
        
        // Sort by closest time
        upcomingGames.sort((a: any, b: any) => {
          const aTime = new Date(a.date).getTime();
          const bTime = new Date(b.date).getTime();
          const aDiff = Math.abs(aTime - now.getTime());
          const bDiff = Math.abs(bTime - now.getTime());
          return aDiff - bDiff;
        });
        
        setNearbyGames(upcomingGames.slice(0, 5)); // Keep top 5 for selection
        
        // Auto-select the nearest game
        const nearest = upcomingGames[0];
        setSuggestedGame(nearest);
        setSelectedGameId(String(nearest.id));
      } catch (error) {
        console.warn('Failed to fetch nearby games:', error);
      }
    })();
  }, [selectedGameId]);

  const pickFromLibrary = async (media: 'image' | 'video') => {
    const r = await ImagePicker.launchImageLibraryAsync({
      ...(pickerMediaTypeFor(media)),
      allowsEditing: false,
      quality: media === 'image' ? 0.85 : undefined,
      exif: false,
      videoMaxDuration: 30,
    } as any);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      
      // Validate file type
      const mimeType = a.mimeType || (media === 'image' ? 'image/jpeg' : 'video/mp4');
      if (!validateMediaType(mimeType, media)) {
        Alert.alert(
          'Invalid File Type',
          media === 'image' 
            ? 'Please select a valid image file (JPG, PNG, GIF, WebP, or HEIC).'
            : 'Please select a valid video file (MP4, MOV, or WebM).'
        );
        return;
      }
      
      // Validate file size
      const fileSize = await getFileSizeFromUri(a.uri);
      const maxSize = media === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      const maxSizeMB = media === 'image' ? 10 : 100;
      
      if (fileSize > maxSize) {
        Alert.alert(
          'File Too Large',
          `The selected ${media} is too large. Maximum size is ${maxSizeMB}MB.`
        );
        return;
      }
      
      let uri = a.uri;
      if (media === 'image') {
        // Compress/resize image before upload
        try {
          const result = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = result.uri;
        } catch {}
      }
      setPicked({ uri, type: media, mime: mimeType });
      setGestureMode('review');
    }
  };

  const captureWithCamera = async (media: 'image' | 'video') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to capture media.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      ...(pickerMediaTypeFor(media)),
      allowsEditing: false,
      quality: media === 'image' ? 0.85 : undefined,
      exif: false,
      videoMaxDuration: 30,
    } as any);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      
      // Validate file type
      const mimeType = a.mimeType || (media === 'image' ? 'image/jpeg' : 'video/mp4');
      if (!validateMediaType(mimeType, media)) {
        Alert.alert(
          'Invalid File Type',
          media === 'image' 
            ? 'Please capture a valid image format.'
            : 'Please capture a valid video format.'
        );
        return;
      }
      
      // Validate file size
      const fileSize = await getFileSizeFromUri(a.uri);
      const maxSize = media === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      const maxSizeMB = media === 'image' ? 10 : 100;
      
      if (fileSize > maxSize) {
        Alert.alert(
          'File Too Large',
          `The captured ${media} is too large. Maximum size is ${maxSizeMB}MB. Try reducing quality or duration.`
        );
        return;
      }
      
      let uri = a.uri;
      if (media === 'image') {
        try {
          const result = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = result.uri;
        } catch {}
      }
      setPicked({ uri, type: media, mime: mimeType });
      setGestureMode('camera');
      setReviewModalVisible(false);
    }
  };

  // Gesture handler for camera/review toggle
  const panGesture = Gesture.Pan()
    .onStart(() => {
      swipeOpacity.value = withSpring(0.7);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -500) {
        // Trigger camera with scale animation
        cameraScale.value = withSpring(1.1, {}, () => {
          cameraScale.value = withSpring(1);
        });
        runOnJS(captureWithCamera)('image');
        runOnJS(activateCameraMode)();
      } else if (event.translationY > 50 && event.velocityY > 500) {
        reviewScale.value = withSpring(1.1, {}, () => {
          reviewScale.value = withSpring(1);
        });
        runOnJS(triggerReviewMode)();
      }
      translateY.value = withSpring(0);
      swipeOpacity.value = withSpring(1);
    });

  const animatedSwipeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: Math.max(Math.min(translateY.value, 60), -60),
      },
    ],
    opacity: swipeOpacity.value,
  }));

  const animatedCameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  const animatedReviewStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reviewScale.value }],
  }));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Ensure user is authenticated
      try { await User.me(); } catch { throw new Error('Please sign in to create a post.'); }
      let finalMediaUrl = '';
      if (picked?.uri) {
        const base = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
        const name = picked.type === 'image' ? 'image.jpg' : 'video.mp4';
        const mime = picked.mime || (picked.type === 'image' ? 'image/jpeg' : 'video/mp4');
        const res = await uploadFile(base, picked.uri, name, mime);
        finalMediaUrl = res?.url || res?.path;
      }
      const trimmedContent = content.trim();
      if (!trimmedContent && !finalMediaUrl) {
        setError('Add content or select a media file');
        setSubmitting(false);
        return;
      }
      const location = shareLocation ? { lat, lng, source: 'device' as const } : {};
      const payload: Record<string, any> = {
        content: trimmedContent,
        media_url: finalMediaUrl || undefined,
        type: postType,
        location,
      };
      if (selectedGameId) {
        payload.game_id = selectedGameId;
      }
      await Post.create(payload);
      Alert.alert(
        postType === 'highlight' ? 'Highlight shared' : 'Posted',
        postType === 'highlight' ? 'Your highlight has been shared.' : 'Your post has been created.'
      );
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      const issues = (e?.data?.issues || []) as { message: string }[];
      if (issues.length) {
        setError(issues.map(i => i.message).join('\n'));
      } else {
        setError(e?.message || 'Failed to create post');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = useMemo(() => !!content.trim() || !!picked?.uri, [content, picked]);
  const buttonLabel = submitting
    ? (postType === 'highlight' ? 'Posting highlight...' : 'Posting...')
    : (postType === 'highlight' ? 'Share Highlight' : 'Post');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#111827" />
        </Pressable>
        <View style={styles.headerSpacer} />
        <View style={styles.postButtonContainer}>
          <PrimaryButton label={buttonLabel} onPress={onSubmit} disabled={!canPost || submitting} loading={submitting} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Rotating Prompts */}
        <View style={styles.promptsSection}>
          <RotatingPrompts 
            prompts={PromptPresets.posting} 
            interval={6000}
            showIcon={true}
          />
        </View>

        {/* Composer Section */}
        <View style={styles.composerSection}>
          <MentionInput
            value={content}
            onChangeText={setContent}
            placeholder="Respect for every player on the field."
            multiline
            style={styles.textarea}
            maxLength={500}
          />
          <Text style={styles.helper}>Use # to tag teams and @ to mention players</Text>
        </View>

        {/* Interactive Swipe Camera */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.swipeSection,
              animatedSwipeStyle,
              gestureMode === 'review' ? styles.swipeSectionReview : styles.swipeSectionCamera,
            ]}
          >
            <View style={styles.swipeIndicatorRow}>
              <Animated.View style={animatedCameraStyle}>
                <View
                  style={[
                    styles.swipeOption,
                    gestureMode === 'camera' ? styles.swipeOptionActiveCamera : styles.swipeOptionInactive,
                  ]}
                >
                  <Ionicons
                    name="chevron-up"
                    size={18}
                    color={gestureMode === 'camera' ? '#FFFFFF' : '#1D4ED8'}
                  />
                  <Text
                    style={[
                      styles.swipeOptionLabel,
                      gestureMode === 'camera' ? styles.swipeOptionLabelActiveCamera : null,
                    ]}
                  >
                    Camera
                  </Text>
                </View>
              </Animated.View>

              <View style={styles.swipeDivider} />

              <Animated.View style={animatedReviewStyle}>
                <View
                  style={[
                    styles.swipeOption,
                    gestureMode === 'review' ? styles.swipeOptionActiveReview : styles.swipeOptionInactive,
                  ]}
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={gestureMode === 'review' ? '#FFFFFF' : '#DC2626'}
                  />
                  <Text
                    style={[
                      styles.swipeOptionLabel,
                      gestureMode === 'review' ? styles.swipeOptionLabelActiveReview : null,
                    ]}
                  >
                    Review
                  </Text>
                </View>
              </Animated.View>
            </View>
            <Text
              style={[
                styles.swipeHint,
                gestureMode === 'review' ? styles.swipeHintReview : styles.swipeHintCamera,
              ]}
            >
              {gestureMode === 'review'
                ? 'Swipe down to review your capture'
                : 'Swipe up to open the camera'}
            </Text>
          </Animated.View>
        </GestureDetector>

        {/* Media Actions */}
        <View style={styles.mediaSection}>
          <Text style={styles.sectionTitle}>Add Media</Text>
          <View style={styles.tilesRow}>
            <Pressable style={styles.tile} onPress={() => pickFromLibrary('image')} accessibilityLabel="Gallery">
              <Ionicons name="image-outline" size={24} color="#6B7280" />
              <Text style={styles.tileLabel}>Gallery</Text>
            </Pressable>
            <Animated.View style={animatedCameraStyle}>
              <Pressable style={[styles.tile, styles.primaryTile]} onPress={() => captureWithCamera('image')} accessibilityLabel="Camera">
                <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
                <Text style={[styles.tileLabel, styles.primaryTileLabel]}>Camera</Text>
              </Pressable>
            </Animated.View>
            <Pressable style={styles.tile} onPress={() => captureWithCamera('video')} accessibilityLabel="Video">
              <Ionicons name="videocam-outline" size={24} color="#6B7280" />
              <Text style={styles.tileLabel}>Video</Text>
            </Pressable>
          </View>
          
          {/* Add to Story Button */}
          <View style={styles.storyButtonContainer}>
            <StoryCameraButton
              onCapture={(uri, type) => {
                const mediaType = type === 'photo' ? 'image' : 'video';
                setPicked({ uri, type: mediaType, mime: type === 'video' ? 'video/mp4' : 'image/jpeg' });
                setGestureMode('camera');
                setReviewModalVisible(false);
              }}
              variant="button"
            />
            <Text style={styles.storyHint}>Quick 24-hour Stories open camera directly</Text>
          </View>
        </View>

        {/* Media Preview */}
        {picked?.uri ? (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewContainer}>
              {picked.type === 'image' ? (
                <RNImage source={{ uri: picked.uri }} style={styles.previewMedia} />
              ) : (
                <VideoPlayer uri={picked.uri} style={styles.previewMedia} />
              )}
              <Pressable style={styles.removeButton} onPress={() => setPicked(null)} accessibilityLabel="Remove media">
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Suggested Game/Event */}
        {suggestedGame && (
          <View style={styles.gameSection}>
            <Text style={styles.sectionTitle}>Attach to Event</Text>
            <Pressable 
              style={styles.gameSuggestionCard}
              onPress={() => {
                // Could show a modal to select different game
                Alert.alert(
                  'Event Selected',
                  `Post will be attached to: ${suggestedGame.title || `${suggestedGame.home_team} vs ${suggestedGame.away_team}`}`,
                  [
                    { text: 'Remove Event', style: 'destructive', onPress: () => { setSuggestedGame(null); setSelectedGameId(undefined); } },
                    { text: 'Keep Event', style: 'cancel' }
                  ]
                );
              }}
            >
              <View style={styles.gameIconContainer}>
                <Ionicons name="trophy" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameLabel}>Suggested Event (nearest)</Text>
                <Text style={styles.gameTitle}>
                  {suggestedGame.title || `${suggestedGame.home_team} vs ${suggestedGame.away_team}`}
                </Text>
                {suggestedGame.date && (
                  <Text style={styles.gameDate}>
                    {new Date(suggestedGame.date).toLocaleDateString()} at {new Date(suggestedGame.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#059669" />
            </Pressable>
            <Text style={styles.gameHint}>
              Tap to change or remove event attachment
            </Text>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.locRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.locLabel}>Share location</Text>
              <Text style={styles.settingDescription}>Help others discover local content</Text>
            </View>
            <Switch value={shareLocation} onValueChange={setShareLocation} />
          </View>
          {locGranted === false && shareLocation ? (
            <Text style={styles.muted}>Location permission denied. You can still post; we'll try to infer your country from your profile.</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <Pressable onPress={() => {}}>
            <Text style={styles.footerLink}>Respect all the players on the field.</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        onRequestClose={handleCloseReviewModal}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.reviewModalContainer}>
          <View style={styles.reviewModalHeader}>
            <Text style={styles.reviewModalTitle}>Review Content</Text>
            <Pressable onPress={handleCloseReviewModal} accessibilityLabel="Close review preview">
              <Ionicons name="close" size={24} color="#111827" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.reviewModalBody}>
            {picked?.uri ? (
              <View style={styles.reviewMediaCard}>
                {picked.type === 'image' ? (
                  <RNImage source={{ uri: picked.uri }} style={styles.reviewMedia} resizeMode="cover" />
                ) : (
                  <VideoPlayer uri={picked.uri} style={styles.reviewMedia} />
                )}
                <Text style={styles.reviewMediaLabel}>
                  {picked.type === 'image' ? 'Attached photo' : 'Attached video'}
                </Text>
              </View>
            ) : null}

            {content.trim().length ? (
              <View style={styles.reviewTextCard}>
                <Text style={styles.reviewTextLabel}>Caption</Text>
                <Text style={styles.reviewText}>{content.trim()}</Text>
              </View>
            ) : null}

            {!picked?.uri && !content.trim().length ? (
              <View style={styles.reviewEmpty}>
                <Ionicons name="albums-outline" size={32} color="#9CA3AF" />
                <Text style={styles.reviewEmptyTitle}>Nothing to review yet</Text>
                <Text style={styles.reviewEmptySubtitle}>
                  Capture new media or add a caption, then swipe down again.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20 
  },
  iconBtn: { 
    padding: 8, 
    borderRadius: 999, 
    backgroundColor: 'transparent' 
  },
  headerSpacer: {
    flex: 1
  },
  postButtonContainer: {
    minWidth: 80,
    alignItems: 'flex-end'
  },
  
  // Prompts Section
  promptsSection: {
    marginBottom: 20
  },
  
  // Composer Section
  composerSection: { 
    marginBottom: 24 
  },
  textarea: { 
    height: 120, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    padding: 16, 
    textAlignVertical: 'top', 
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 22
  },
  helper: { 
    color: '#6B7280', 
    fontSize: 14,
    fontStyle: 'italic'
  },
  
  // Swipe Section
  swipeSection: {
    marginBottom: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  swipeSectionCamera: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  swipeSectionReview: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  swipeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  swipeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 120,
    borderWidth: 1.5,
  },
  swipeOptionInactive: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderColor: 'rgba(17,24,39,0.08)',
  },
  swipeOptionActiveCamera: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  swipeOptionActiveReview: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  swipeOptionLabel: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  swipeOptionLabelActiveCamera: {
    color: '#FFFFFF',
  },
  swipeOptionLabelActiveReview: {
    color: '#FFFFFF',
  },
  swipeDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(17,24,39,0.08)',
  },
  swipeHint: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  swipeHintCamera: {
    color: '#1D4ED8',
  },
  swipeHintReview: {
    color: '#DC2626',
  },
  
  // Media Section
  mediaSection: { 
    marginBottom: 24 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 16,
    textAlign: 'center'
  },
  tilesRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 20 
  },
  tile: { 
    width: 100, 
    height: 100, 
    borderRadius: 20, 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1.5, 
    borderColor: '#E5E7EB', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 },
    elevation: 3 
  },
  primaryTile: { 
    backgroundColor: '#2563EB', 
    borderColor: '#2563EB' 
  },
  tileLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6B7280', 
    marginTop: 6 
  },
  primaryTileLabel: { 
    color: '#FFFFFF' 
  },
  storyButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8
  },
  storyHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  
  // Preview Section
  previewSection: { 
    marginBottom: 24 
  },
  previewContainer: { 
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  previewMedia: { 
    width: '100%', 
    height: 240, 
    backgroundColor: '#F9FAFB' 
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  // Game/Event Section
  gameSection: {
    marginBottom: 24,
  },
  gameSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 12,
  },
  gameIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  gameDate: {
    fontSize: 13,
    color: '#047857',
  },
  gameHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Settings Section
  settingsSection: { 
    marginBottom: 24 
  },
  locRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12
  },
  settingInfo: {
    flex: 1
  },
  locLabel: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#111827'
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2
  },
  muted: { 
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  
  // Footer Section
  footerSection: {
    alignItems: 'center',
    paddingTop: 12
  },
  footerLink: { 
    color: '#2563EB', 
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500'
  },
  error: { 
    color: '#DC2626', 
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500'
  },
  
  // Review Modal
  reviewModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  reviewModalBody: {
    padding: 20,
    gap: 20,
  },
  reviewMediaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  reviewMedia: {
    width: '100%',
    height: 240,
  },
  reviewMediaLabel: {
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  reviewTextCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  reviewTextLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  reviewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  reviewEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  reviewEmptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
