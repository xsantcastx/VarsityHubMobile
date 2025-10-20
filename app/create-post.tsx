import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Image as RNImage, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Game, Post, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { PromptPresets } from '@/components/RotatingPrompts';
import { MentionInput } from '@/components/ui/MentionInput';
import VideoPlayer from '@/components/VideoPlayer';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
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
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
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
  const [rotatingPromptIndex, setRotatingPromptIndex] = useState(0);
  const [eventSelectorVisible, setEventSelectorVisible] = useState(false);
  const [hasAutoSuggested, setHasAutoSuggested] = useState(!!gameId); // If gameId from params, don't auto-suggest

  // Rotate placeholder prompts
  useEffect(() => {
    const prompts = PromptPresets.posting;
    const timer = setInterval(() => {
      setRotatingPromptIndex((prev) => (prev + 1) % prompts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

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
    // Only auto-suggest once, and don't override if already selected via params
    if (hasAutoSuggested || selectedGameId) return;
    
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
        
        // Auto-select the nearest game only on first load
        const nearest = upcomingGames[0];
        setSuggestedGame(nearest);
        setSelectedGameId(String(nearest.id));
        setHasAutoSuggested(true); // Mark that we've done the auto-suggestion
      } catch (error) {
        console.warn('Failed to fetch nearby games:', error);
      }
    })();
  }, []); // Empty dependency - only run once on mount

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
    }
  };

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
  const topPadding = useMemo(() => Math.max(insets.top + 8, 20), [insets.top]);
  const bottomPadding = useMemo(() => Math.max(insets.bottom + 12, 24), [insets.bottom]);
  const buttonLabel = submitting
    ? (postType === 'highlight' ? 'Posting highlight...' : 'Posting...')
    : (postType === 'highlight' ? 'Share Highlight' : 'Post');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={Colors[colorScheme].text} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <View style={styles.postButtonContainer}>
          <PrimaryButton label={buttonLabel} onPress={onSubmit} disabled={!canPost || submitting} loading={submitting} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Composer Section with Rotating Tips */}
        <View style={styles.composerSection}>
          <MentionInput
            value={content}
            onChangeText={setContent}
            placeholder={PromptPresets.posting[rotatingPromptIndex].text}
            placeholderTextColor={Colors[colorScheme].mutedText}
            multiline
            style={[
              styles.textarea, 
              { 
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text
              }
            ]}
            maxLength={500}
          />
          <Text style={[styles.helper, { color: Colors[colorScheme].mutedText }]}>Use # to tag teams and @ to mention players</Text>
        </View>

        {/* Media Actions */}
        <View style={styles.mediaSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Add Media</Text>
          <View style={styles.tilesRow}>
            <Pressable style={[styles.tile, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => pickFromLibrary('image')} accessibilityLabel="Gallery">
              <Ionicons name="image-outline" size={24} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.tileLabel, { color: Colors[colorScheme].text }]}>Gallery</Text>
            </Pressable>
            <Pressable style={[styles.tile, styles.primaryTile]} onPress={() => captureWithCamera('image')} accessibilityLabel="Camera">
              <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
              <Text style={[styles.tileLabel, styles.primaryTileLabel]}>Camera</Text>
            </Pressable>
            <Pressable style={[styles.tile, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => captureWithCamera('video')} accessibilityLabel="Video">
              <Ionicons name="videocam-outline" size={24} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.tileLabel, { color: Colors[colorScheme].text }]}>Video</Text>
            </Pressable>
          </View>
        </View>

        {/* Media Preview */}
        {picked?.uri ? (
          <View style={styles.previewSection}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Preview</Text>
            <View style={styles.previewContainer}>
              {picked.type === 'image' ? (
                <RNImage source={{ uri: picked.uri }} style={[styles.previewMedia, { backgroundColor: Colors[colorScheme].surface }]} />
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
        {(suggestedGame || nearbyGames.length > 0) && (
          <View style={styles.gameSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Attach to Event</Text>
              {nearbyGames.length > 1 && (
                <Pressable onPress={() => setEventSelectorVisible(true)}>
                  <Text style={[styles.changeEventButton, { color: Colors[colorScheme].tint }]}>Change</Text>
                </Pressable>
              )}
            </View>
            
            {suggestedGame ? (
              <Pressable 
                style={[styles.gameSuggestionCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                onPress={() => nearbyGames.length > 1 ? setEventSelectorVisible(true) : null}
              >
                <View style={styles.gameIconContainer}>
                  <Ionicons name="trophy" size={20} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gameLabel, { color: Colors[colorScheme].mutedText }]}>
                    {suggestedGame.id === nearbyGames[0]?.id ? 'Suggested Event (nearest)' : 'Selected Event'}
                  </Text>
                  <Text style={[styles.gameTitle, { color: Colors[colorScheme].text }]}>
                    {suggestedGame.title || `${suggestedGame.home_team} vs ${suggestedGame.away_team}`}
                  </Text>
                  {suggestedGame.date && (
                    <Text style={[styles.gameDate, { color: Colors[colorScheme].mutedText }]}>
                      {new Date(suggestedGame.date).toLocaleDateString()} at {new Date(suggestedGame.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
              </Pressable>
            ) : (
              <Pressable 
                style={[styles.noEventCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                onPress={() => setEventSelectorVisible(true)}
              >
                <Ionicons name="add-circle-outline" size={24} color={Colors[colorScheme].mutedText} />
                <Text style={[styles.noEventText, { color: Colors[colorScheme].mutedText }]}>Select an event to attach</Text>
              </Pressable>
            )}
            
            <View style={styles.eventActions}>
              {suggestedGame && (
                <Pressable onPress={() => { setSuggestedGame(null); setSelectedGameId(undefined); }}>
                  <Text style={[styles.removeEventButton, { color: '#EF4444' }]}>Remove Event</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Settings</Text>
          <View style={[styles.locRow, { backgroundColor: Colors[colorScheme].surface }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.locLabel, { color: Colors[colorScheme].text }]}>Share location</Text>
              <Text style={[styles.settingDescription, { color: Colors[colorScheme].mutedText }]}>Help others discover local content</Text>
            </View>
            <Switch value={shareLocation} onValueChange={setShareLocation} />
          </View>
          {locGranted === false && shareLocation ? (
            <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>Location permission denied. You can still post; we'll try to infer your country from your profile.</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <Pressable onPress={() => {}}>
            <Text style={[styles.footerLink, { color: Colors[colorScheme].tint }]}>Respect all the players on the field.</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      {/* Event Selector Modal */}
      <Modal
        visible={eventSelectorVisible}
        animationType="slide"
        onRequestClose={() => setEventSelectorVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={[styles.modalHeader, { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>Select Event</Text>
            <Pressable onPress={() => setEventSelectorVisible(false)}>
              <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalBody}>
            {nearbyGames.length > 0 ? (
              <>
                {nearbyGames.map((game, index) => (
                  <Pressable
                    key={game.id}
                    style={[
                      styles.eventOptionCard,
                      { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border },
                      selectedGameId === String(game.id) && { borderColor: '#059669', borderWidth: 2 }
                    ]}
                    onPress={() => {
                      setSuggestedGame(game);
                      setSelectedGameId(String(game.id));
                      setEventSelectorVisible(false);
                    }}
                  >
                    <View style={styles.eventOptionIcon}>
                      <Ionicons 
                        name={index === 0 ? "star" : "trophy"} 
                        size={20} 
                        color={index === 0 ? "#F59E0B" : "#059669"} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      {index === 0 && (
                        <Text style={[styles.eventOptionBadge, { color: '#F59E0B' }]}>Nearest Event</Text>
                      )}
                      <Text style={[styles.eventOptionTitle, { color: Colors[colorScheme].text }]}>
                        {game.title || `${game.home_team} vs ${game.away_team}`}
                      </Text>
                      {game.date && (
                        <Text style={[styles.eventOptionDate, { color: Colors[colorScheme].mutedText }]}>
                          {new Date(game.date).toLocaleDateString()} at {new Date(game.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                      {game.location && (
                        <Text style={[styles.eventOptionLocation, { color: Colors[colorScheme].mutedText }]}>
                          📍 {game.location}
                        </Text>
                      )}
                    </View>
                    {selectedGameId === String(game.id) && (
                      <Ionicons name="checkmark-circle" size={24} color="#059669" />
                    )}
                  </Pressable>
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme].mutedText} />
                <Text style={[styles.emptyStateTitle, { color: Colors[colorScheme].text }]}>No Events Found</Text>
                <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                  There are no upcoming events in the next 7 days.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1
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
    // borderColor: Uses dynamic color in JSX
    padding: 16, 
    textAlignVertical: 'top', 
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 22
    // backgroundColor & color: Uses dynamic colors in JSX
  },
  helper: { 
    fontSize: 14,
    fontStyle: 'italic'
    // color: Uses dynamic color in JSX
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
    // color: Uses dynamic color in JSX
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
    // backgroundColor & borderColor: Uses dynamic colors in JSX
    borderWidth: 1.5, 
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
    // color: Uses dynamic color in JSX
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
    // color: Uses dynamic color in JSX
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
    // backgroundColor: Uses dynamic color in JSX
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
    // backgroundColor: Uses dynamic color in JSX
    borderRadius: 12
  },
  settingInfo: {
    flex: 1
  },
  locLabel: { 
    fontWeight: '600',
    fontSize: 16,
    // color: Uses dynamic color in JSX
  },
  settingDescription: {
    fontSize: 14,
    // color: Uses dynamic color in JSX
    marginTop: 2
  },
  muted: { 
    // color: Uses dynamic color in JSX
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
  
  // Event selection styles
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  changeEventButton: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  noEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  noEventText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  removeEventButton: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Event selector modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  eventOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  eventOptionCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  eventOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventOptionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  eventOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  eventOptionDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  eventOptionLocation: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
