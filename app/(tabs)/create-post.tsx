import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Platform, Pressable, Image as RNImage, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Game, Post, User } from '@/api/entities';
import settings from '@/api/settings';
import { uploadFile } from '@/api/upload';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { PromptPresets } from '@/components/RotatingPrompts';
import { MentionInput } from '@/components/ui/MentionInput';

import VideoPlayer from '@/components/VideoPlayer';
import VideoTrimmer from '@/components/VideoTrimmer';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { pickerMediaTypeFor } from '@/utils/picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

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

import * as LegacyFileSystem from 'expo-file-system/legacy';

const getFileSizeFromUri = async (uri: string): Promise<number> => {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri, { size: true } as any);
    if (info && info.exists && typeof (info as any).size === 'number') return (info as any).size;
    return 0;
  } catch (error) {
    console.warn('Could not determine file size:', error);
    return 0;
  }
};

// Helper to detect sample events (IDs starting with "sample-")
const isSampleEvent = (id?: string | null): boolean => {
  if (!id) return false;
  return /^sample-/i.test(String(id).trim());
};

export default function CreatePostScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ gameId?: string; type?: string }>();
  const gameId = params?.gameId ? String(params.gameId) : undefined;
  const postType = params?.type === 'highlight' ? 'highlight' : 'post';
  const _isSample = isSampleEvent(gameId);
  const { location, loading: _locLoading, error: _locError, permissionGranted, requestPermission, needsPreciseAccuracy, openSettings } = useDeviceLocation();
  
  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video'; mime?: string; width?: number; height?: number } | null>(null);
  const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>(gameId);
  const [suggestedGame, setSuggestedGame] = useState<any>(null);
  const [nearbyGames, setNearbyGames] = useState<any[]>([]);
  const [rotatingPromptIndex, setRotatingPromptIndex] = useState(0);
  const [eventSelectorVisible, setEventSelectorVisible] = useState(false);
  const [hasAutoSuggested, setHasAutoSuggested] = useState(!!gameId); // If gameId from params, don't auto-suggest
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [precisionBannerDismissed, setPrecisionBannerDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [trimmedUri, setTrimmedUri] = useState<string | null>(null);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);
  // Celebration overlay animations
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const showPrecisionWarning = Platform.OS === 'android' && permissionGranted && needsPreciseAccuracy && !precisionBannerDismissed;
  const locationReady = typeof location?.latitude === 'number' && typeof location?.longitude === 'number';
  const [draftReady, setDraftReady] = useState(false);
  const draftLoadedRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset trim state when media changes
  useEffect(() => { setTrimmedUri(null); setVideoThumbnailUri(null); }, [picked?.uri]);

  // Reset form state when returning to this tab (handles stuck postSuccess)
  useFocusEffect(
    useCallback(() => {
      if (postSuccess) {
        setPostSuccess(false);
        setContent('');
        setPicked(null);
        setError(null);
        setSubmitting(false);
        setPreviewVisible(false);
        setSuggestedGame(null);
        setSelectedGameId(gameId);
        draftLoadedRef.current = false;
      }
    }, [postSuccess, gameId])
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      if (draftLoadedRef.current) return;
      const draft = await settings.getJson<any>(settings.SETTINGS_KEYS.POST_DRAFT, null);
      if (!active) return;
      draftLoadedRef.current = true;
      if (!draft || (!draft.content && !draft?.picked?.uri)) {
        setDraftReady(true);
        return;
      }
      if (draft.postType && draft.postType !== postType) {
        setDraftReady(true);
        return;
      }
      Alert.alert(
        'Restore draft?',
        'You have an unsent post draft. Do you want to restore it?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await settings.setJson(settings.SETTINGS_KEYS.POST_DRAFT, null);
              setDraftReady(true);
            },
          },
          {
            text: 'Restore',
            onPress: () => {
              setContent(String(draft.content || ''));
              if (draft.picked?.uri) {
                setPicked({
                  uri: String(draft.picked.uri),
                  type: draft.picked.type === 'video' ? 'video' : 'image',
                  mime: draft.picked.mime,
                  width: draft.picked.width,
                  height: draft.picked.height,
                });
              }
              if (draft.selectedGameId) {
                setSelectedGameId(String(draft.selectedGameId));
                setHasAutoSuggested(true);
              }
              setDraftReady(true);
            },
          },
        ]
      );
    })();
    return () => {
      active = false;
    };
  }, [postType]);

  // Get media dimensions when picked (for aspect ratio in preview)
  useEffect(() => {
    if (!picked || picked.type !== 'image') {
      setMediaDimensions(null);
      return;
    }

    void (async () => {
      try {
        const { Image: RNImageModule } = require('react-native');
        RNImageModule.getSize(
          picked.uri,
          (width: number, height: number) => {
            setMediaDimensions({ width, height });
          },
          () => {
            // Fallback if getSize fails
            setMediaDimensions({ width: 16, height: 9 });
          }
        );
      } catch (e) {
        console.warn('Failed to get image dimensions:', e);
        setMediaDimensions(null);
      }
    })();
  }, [picked]);

  // Rotate placeholder prompts
  useEffect(() => {
    const prompts = PromptPresets.posting;
    const timer = setInterval(() => {
      setRotatingPromptIndex((prev) => (prev + 1) % prompts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(async () => {
      if (submitting) return;
      const hasContent = Boolean(content.trim() || picked?.uri);
      if (!hasContent) {
        await settings.setJson(settings.SETTINGS_KEYS.POST_DRAFT, null);
        return;
      }
      const draft = {
        content: content,
        picked,
        selectedGameId: selectedGameId || null,
        postType,
        updated_at: new Date().toISOString(),
      };
      await settings.setJson(settings.SETTINGS_KEYS.POST_DRAFT, draft);
    }, 600);
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [content, picked, selectedGameId, postType, submitting, draftReady]);

  // Request location permission on mount
  useEffect(() => {
    if (!permissionGranted && !hasAutoSuggested && !gameId) {
      requestPermission().catch(() => {
        setLocationError('Unable to access device location. You can still post, but event suggestions won\'t be available.');
      });
    }
  }, [permissionGranted, hasAutoSuggested, gameId, requestPermission]);

  useEffect(() => {
    if (_locError) {
      setLocationError(_locError);
    }
  }, [_locError]);

  // Load game details if gameId is provided via params (from event page)
  useEffect(() => {
    if (__DEV__) console.warn('[CreatePost] useEffect gameId:', gameId);
    if (!gameId) return;

    // For sample events, create a mock game object - these don't exist in the database
    if (__DEV__) console.warn('[CreatePost] isSampleEvent check:', gameId, '->', isSampleEvent(gameId));
    if (isSampleEvent(gameId)) {
      // Parse sample event ID to extract team names (e.g., "sample-warriors-cavaliers")
      const parts = gameId.replace(/^sample-/i, '').split(/[-_]+/).filter(Boolean);
      const homeTeam = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Home Team';
      const awayTeam = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Away Team';
      
      const mockGame = {
        id: gameId,
        title: `${homeTeam} vs ${awayTeam}`,
        home_team: homeTeam,
        away_team: awayTeam,
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        location: 'Sample Arena',
        distance: null,
      };
      setSuggestedGame(mockGame);
      setSelectedGameId(gameId);
      setError(null);
      return;
    }
    
    void (async () => {
      try {
        const game = await Game.get(gameId);
        if (game) {
          setSuggestedGame(game);
          setSelectedGameId(String(game.id));
          setError(null); // Clear any previous errors
        }
      } catch (error) {
        console.warn('Failed to load game from params:', error);
        // If game not found (404), clear the selectedGameId so user can still post
        if ((error as any)?.status === 404) {
          setSelectedGameId(undefined);
          setSuggestedGame(null);
          // Don't set error - allow user to post without event
        } else {
          // For other errors (network, etc.), keep the gameId and let backend validate
          // User can still try to post - backend will handle validation
          console.warn('Game load failed but keeping gameId for backend validation:', error);
        }
      }
    })();
  }, [gameId]);

  // Auto-suggest nearest event based on time and location
  // Backend already filters by distance/date, limits to ~10 candidates for efficiency
  useEffect(() => {
    if (selectedGameId || hasAutoSuggested) return;

    // If we have permission but no coordinates yet, wait before attempting auto-suggest
    if (permissionGranted && !locationReady) return;
    
    void (async () => {
      try {
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // Backend-driven filtering: let API handle distance/date filters
        // Only include location if we have precise coordinates
        const options: Record<string, any> = {
          limit: 10,
          dateFrom: now.toISOString(),
          dateTo: sevenDaysLater.toISOString(),
        };
        if (locationReady && location?.latitude && location?.longitude) {
          options.lat = location.latitude;
          options.lng = location.longitude;
          options.distance = 50;
        }
        
        const games = await Game.list('-date', options);
        const gamesArray = Array.isArray(games) ? games : (games?.games || games?.items || []);
        if (!gamesArray.length) return;
        
        // Backend already provides distance; minimal client-side work
        const gamesWithDistance = gamesArray.map((g: any) => ({
          ...g,
          latitude: typeof g.latitude === 'number' ? g.latitude : (typeof g.lat === 'number' ? g.lat : null),
          longitude: typeof g.longitude === 'number' ? g.longitude : (typeof g.lng === 'number' ? g.lng : null),
          distance: typeof g.distance === 'number' ? g.distance : null,
        }));
        
        // Already sorted by distance on backend if location provided
        setNearbyGames(gamesWithDistance.slice(0, 5));
        const top = gamesWithDistance[0];
        if (top) {
          setSuggestedGame(top);
          setSelectedGameId(String(top.id));
        }
      } catch (error) {
        console.warn('Failed to fetch nearby games:', error);
      } finally {
        setHasAutoSuggested(true);
      }
    })();
  }, [locationReady, permissionGranted, selectedGameId, hasAutoSuggested, location?.latitude, location?.longitude]);

  const pickFromLibrary = async (media: 'image' | 'video') => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        ...(pickerMediaTypeFor(media)),
        allowsEditing: false, // Don't crop - preserve original photo
        quality: media === 'image' ? 0.85 : undefined,
        exif: false,
        videoMaxDuration: 30,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
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
          } catch (error: any) {
            if (__DEV__) {
              console.warn('[CreatePost] Image manipulation failed, using original:', error?.message || error);
            }
            // Continue with original URI if manipulation fails
          }
        }
        setPicked({ uri, type: media, mime: mimeType });
        // Generate thumbnail for video preview immediately
        if (media === 'video') {
          VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.7 })
            .then((thumb) => setVideoThumbnailUri(thumb.uri))
            .catch((e) => { if (__DEV__) console.warn('[CreatePost] Video thumbnail failed:', e); });
        }
      }
    } catch (error: any) {
      console.error('[CreatePost] Image picker error:', error);
      // Handle iOS PHPicker "public.png" error gracefully
      if (error?.message?.includes('public.png') || error?.message?.includes('Failed to read picked image')) {
        Alert.alert(
          'Image Selection Failed',
          'Unable to load this image. Please try selecting a different photo or take a new one with the camera.'
        );
      } else {
        Alert.alert('Error', 'Failed to select media. Please try again.');
      }
    }
  };

  const captureWithCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Camera permission is needed to capture media.');
        return;
      }
      // Version-safe mediaTypes: new SDK uses MediaType array, old SDK uses MediaTypeOptions
      const anyIP = ImagePicker as any;
      const cameraMediaTypes = anyIP?.MediaType
        ? [anyIP.MediaType.Images, anyIP.MediaType.Videos]
        : anyIP.MediaTypeOptions?.All;

      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: cameraMediaTypes,
        allowsEditing: false,
        quality: 0.85,
        exif: false,
        videoMaxDuration: 30,
        legacy: false,
      } as any);
      if (!r.canceled && r.assets && r.assets[0]) {
        const a = r.assets[0];
        
        // Auto-detect media type from asset
        const mimeType = a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
        const isVideo = a.type === 'video' || mimeType.startsWith('video/');
        const media: 'image' | 'video' = isVideo ? 'video' : 'image';
        
        // Validate file type
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
          } catch (error: any) {
            if (__DEV__) {
              console.warn('[CreatePost] Image manipulation failed, using original:', error?.message || error);
            }
            // Continue with original URI if manipulation fails
          }
        }
        setPicked({ uri, type: media, mime: mimeType });
        if (media === 'video') {
          VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.7 })
            .then((thumb) => setVideoThumbnailUri(thumb.uri))
            .catch((e) => { if (__DEV__) console.warn('[CreatePost] Video thumbnail failed:', e); });
        }
      }
    } catch (error: any) {
      console.error('[CreatePost] Camera error:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    }
  };

  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    // First, show preview
    const trimmedContent = content.trim();
    if (!trimmedContent && !picked?.uri) {
      setError('Add content or select a media file');
      return;
    }
    
    // Prepare preview data
    setPreviewData({
      content: trimmedContent,
      media: picked,
      game: suggestedGame,
      type: postType,
    });
    setPreviewVisible(true);
  };

  const confirmPost = async () => {
    if (__DEV__) console.warn('[CreatePost] confirmPost called');
    if (__DEV__) console.warn('[CreatePost] State - selectedGameId:', selectedGameId, '| suggestedGame:', suggestedGame?.id);
    setSubmitting(true);
    setError(null);
    setPreviewVisible(false);

    try {
      // Quick network connectivity check
      if (__DEV__) console.warn('[CreatePost] Checking network...');
      try {
        const { getApiBaseUrl } = await import('@/api/http');
        // Use AbortController instead of AbortSignal.timeout (not supported in React Native)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const healthCheck = await fetch(`${getApiBaseUrl()}/health`, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!healthCheck.ok) {
          throw new Error('Server unavailable');
        }
        if (__DEV__) console.warn('[CreatePost] Network OK');
      } catch (netErr: any) {
        console.error('[CreatePost] Network check failed:', netErr?.message);
        throw new Error('Unable to connect to server. Please check your internet connection and try again.');
      }

      // Ensure user is authenticated
      if (__DEV__) console.warn('[CreatePost] Checking authentication...');
      try { await User.me(); } catch { throw new Error('Please sign in to create a post.'); }
      if (__DEV__) console.warn('[CreatePost] Auth OK');

      let finalMediaUrl = '';
      let finalThumbnailUrl = '';
      if (picked?.uri) {
        if (__DEV__) console.warn('[CreatePost] Uploading media...');
        const { getApiBaseUrl } = await import('@/api/http');
        const base = getApiBaseUrl();
        const name = picked.type === 'image' ? 'image.jpg' : 'video.mp4';
        const mime = picked.mime || (picked.type === 'image' ? 'image/jpeg' : 'video/mp4');
        const uploadUri = (picked.type === 'video' && trimmedUri) ? trimmedUri : picked.uri;
        const res = await uploadFile(base, uploadUri, name, mime);
        finalMediaUrl = res?.url || res?.path;
        if (__DEV__) console.warn('[CreatePost] Upload complete:', finalMediaUrl);
        // Upload video thumbnail if available
        if (picked.type === 'video' && videoThumbnailUri) {
          try {
            const thumbRes = await uploadFile(base, videoThumbnailUri, 'thumbnail.jpg', 'image/jpeg');
            finalThumbnailUrl = thumbRes?.url || thumbRes?.path || '';
          } catch (e) {
            if (__DEV__) console.warn('[CreatePost] Thumbnail upload failed:', e);
          }
        }
      }
      const trimmedContent = content.trim();
      
      const locationPayload = location?.latitude && location?.longitude ? { lat: location.latitude, lng: location.longitude, source: 'device' as const } : {};
      const payload: Record<string, any> = {
        content: trimmedContent,
        media_url: finalMediaUrl || undefined,
        preview_url: finalThumbnailUrl || undefined,
        type: postType,
        location: locationPayload,
      };
      
      // Send game_id for both real and sample events
      // The server detects sample events by checking if game_id starts with "sample-"
      // For sample events, server stores game_id in title field to avoid foreign key constraint
      const isSelectedSample = isSampleEvent(selectedGameId);
      if (__DEV__) console.warn('[CreatePost] selectedGameId:', selectedGameId, '| isSample:', isSelectedSample);

      if (selectedGameId) {
        if (isSelectedSample) {
          setError('This is a sample game. Create a real game first to post here.');
          setSubmitting(false);
          return;
        }
        payload.game_id = selectedGameId;
      }
      
      if (__DEV__) console.warn('[CreatePost] Final payload keys:', Object.keys(payload).join(', '));
      
      // Require event link for highlight posts to ensure they surface on the event page
      // But allow sample events to bypass this requirement
      if (postType === 'highlight' && !payload.game_id && !isSelectedSample) {
        throw new Error('Please attach an event to share a highlight.');
      }
      
      if (__DEV__) console.warn('[CreatePost] Calling Post.create...');
      const created = await Post.create(payload);
      if (__DEV__) console.warn('[CreatePost] Post created successfully!');
      try {
        await settings.setJson(settings.SETTINGS_KEYS.POST_DRAFT, null);
      } catch (error) {
        // Non-critical: draft clearing failed, but post was created successfully
        if (__DEV__) console.warn('[CreatePost] Failed to clear draft:', error);
      }

      if (isSelectedSample && selectedGameId) {
        try {
          const me = await User.me().catch(() => null);
          const isVideo = picked?.type === 'video';
          const newPost = {
            id: created?.id ? String(created.id) : `local-${Date.now()}`,
            content: trimmedContent,
            caption: trimmedContent,
            media_url: finalMediaUrl || null,
            media_type: isVideo ? 'video' : (picked?.type === 'image' ? 'image' : null),
            preview_url: isVideo ? (finalThumbnailUrl || null) : null,
            created_at: new Date().toISOString(),
            upvotes_count: 0,
            comments_count: 0,
            author: me ? {
              id: String(me.id ?? 'me'),
              username: me.username ?? me.display_name ?? 'me',
              display_name: me.display_name ?? me.username ?? 'Me',
              avatar_url: me.avatar_url ?? null,
            } : null,
          };
          const cache = await settings.getJson<Record<string, any[]>>(settings.SETTINGS_KEYS.SAMPLE_EVENT_POSTS, {} as any);
          const existing = Array.isArray(cache[selectedGameId]) ? cache[selectedGameId] : [];
          cache[selectedGameId] = [newPost, ...existing].slice(0, 200);
          await settings.setJson(settings.SETTINGS_KEYS.SAMPLE_EVENT_POSTS, cache);
        } catch (cacheErr) {
          console.warn('[CreatePost] Failed to cache sample post:', cacheErr);
        }
      }
      
      // Show success message based on where post will appear
      const postDestination = (payload.game_id || isSelectedSample) ? 'event page' : 'profile';
      const successMessage = isSelectedSample
        ? (postType === 'highlight' 
            ? 'Your highlight has been shared to the sample event!' 
            : 'Your post has been created for the sample event!')
        : (postType === 'highlight' 
            ? (payload.game_id ? 'Your highlight has been shared to the event.' : 'Your highlight has been shared to your profile.') 
            : `Your post has been created and will appear on the ${postDestination}.`);
      
      setPostSuccess(true);

      // Full-screen celebration animation
      celebrationOpacity.setValue(0);
      celebrationScale.setValue(0.3);
      confettiAnim.setValue(0);

      Animated.parallel([
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(celebrationScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setPostSuccess(false);
        setContent('');
        setPicked(null);
        setError(null);
        router.replace('/(tabs)');
      }, 2200);
    } catch (e: any) {
      console.error('[CreatePost] Error creating post:', {
        message: e?.message,
        status: e?.status,
        data: e?.data,
        selectedGameId,
        isSample: isSampleEvent(selectedGameId),
      });
      const issues = (e?.data?.issues || []) as { message: string }[];
      if (issues.length) {
        setError(issues.map(i => i.message).join('\n'));
      } else {
        // Provide more helpful error messages
        if (e?.status === 404 && selectedGameId && !isSampleEvent(selectedGameId)) {
          setError('Event not found. Please remove the event attachment and try again, or select a different event.');
        } else if (e?.status === 403) {
          const code = e?.data?.error;
          if (code === 'Email verification required') {
            setError('You need to verify your email before posting.');
            Alert.alert(
              'Verify Your Email',
              'You need to verify your email before posting.',
              [
                { text: 'Later', style: 'cancel' },
                { text: 'Verify Now', onPress: () => router.push('/verify' as any) },
              ]
            );
          } else if (code === 'POSTING_WINDOW_CLOSED') {
            setError(`Not yet. ${e?.data?.message || 'Posting is not open for this event yet.'}`);
          } else if (code === 'TOO_FAR_FROM_VENUE') {
            setError(`You're too far from the venue. ${e?.data?.message || ''}`.trim());
          } else {
            setError(e?.data?.error || e?.data?.message || 'You do not have permission to post to this event.');
          }
        } else {
          setError(e?.message || 'Failed to create post. Please try again.');
        }
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border }]}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); }} accessibilityLabel="Close" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={Colors[colorScheme].text} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <View style={styles.postButtonContainer}>
          <Pressable
            onPress={onSubmit}
            disabled={!canPost || submitting || postSuccess}
            style={[styles.headerPostBtn, submitting && { backgroundColor: '#1B3A6B', opacity: 1 }, (!canPost || postSuccess) && !submitting && { opacity: 0.45 }]}
            accessibilityLabel={buttonLabel}
          >
            {submitting ? (
              <Text style={styles.headerPostBtnText}>Posting...</Text>
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.headerPostBtnText}>{postType === 'highlight' ? 'Share' : 'Post'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAwareScreen contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
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
            <Pressable style={[styles.tile, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => pickFromLibrary('image')} accessibilityLabel="Photo Gallery">
              <Ionicons name="image-outline" size={24} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.tileLabel, { color: Colors[colorScheme].text }]}>Photo</Text>
            </Pressable>
            <Pressable 
              style={[styles.tile, styles.primaryTile]} 
              onPress={() => captureWithCamera()} 
              accessibilityLabel="Camera"
            >
              <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
              <Text style={[styles.tileLabel, styles.primaryTileLabel]}>Camera</Text>
            </Pressable>
            <Pressable style={[styles.tile, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => pickFromLibrary('video')} accessibilityLabel="Video Gallery">
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
                <>
                  <VideoPlayer uri={trimmedUri ?? picked.uri} style={styles.previewMedia} />
                  <VideoTrimmer
                    uri={picked.uri}
                    onTrimComplete={(u) => setTrimmedUri(u)}
                    onTrimReset={() => setTrimmedUri(null)}
                  />
                  <Text style={[styles.cropHint, { color: Colors[colorScheme].mutedText }]}>
                    Video cropping coming soon.
                  </Text>
                </>
              )}
              <Pressable style={styles.removeButton} onPress={() => setPicked(null)} accessibilityLabel="Remove media">
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Nearby Games/Events Prompt */}
        {nearbyGames.length > 0 && !suggestedGame && (
          <View style={styles.gameSection}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              📍 Nearby games you can tag:
            </Text>
            <Text style={[styles.nearbyGamesHint, { color: Colors[colorScheme].mutedText }]}>
              Select a game to attach your post to
            </Text>
            {nearbyGames.slice(0, 3).map((game) => (
              <Pressable
                key={game.id}
                style={[styles.nearbyGameCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                onPress={() => {
                  setSuggestedGame(game);
                  setSelectedGameId(String(game.id));
                }}
              >
                <View style={styles.gameIconContainer}>
                  <Ionicons name="location" size={18} color={Colors[colorScheme].tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gameTitle, { color: Colors[colorScheme].text }]}>
                    {game.title || `${game.home_team} vs ${game.away_team}`}
                  </Text>
                  <View style={styles.gameMetaRow}>
                    {game.distance !== null && game.distance !== undefined && (
                      <Text style={[styles.gameDistance, { color: Colors[colorScheme].tint }]}>
                        {game.distance < 1 
                          ? `${Math.round(game.distance * 1000)}m away` 
                          : `${game.distance.toFixed(1)}km away`}
                      </Text>
                    )}
                    {game.date && (
                      <Text style={[styles.gameDate, { color: Colors[colorScheme].mutedText }]}>
                        {game.distance !== null && game.distance !== undefined && ' • '}
                        {new Date(game.date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
            ))}
            {nearbyGames.length > 3 && (
              <Pressable 
                style={[styles.viewMoreButton, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={() => setEventSelectorVisible(true)}
              >
                <Text style={[styles.viewMoreText, { color: Colors[colorScheme].tint }]}>
                  View all {nearbyGames.length} nearby games
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Selected Game/Event */}
        {suggestedGame && selectedGameId && (
          <View style={styles.gameSection}>
            <Pressable 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#000000',
                borderColor: '#A0A0A0',
                borderWidth: 1.5,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
              onPress={() => nearbyGames.length > 1 && !isSampleEvent(selectedGameId) ? setEventSelectorVisible(true) : null}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                  {suggestedGame.title || `${suggestedGame.home_team} vs ${suggestedGame.away_team}`}
                </Text>
                {!isSampleEvent(selectedGameId) && suggestedGame.date && (
                  <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 2 }}>
                    {new Date(suggestedGame.date).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(suggestedGame.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#A0A0A0" />
            </Pressable>
            
            <Pressable 
              style={{ alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 }}
              onPress={() => { setSuggestedGame(null); setSelectedGameId(undefined); }}
            >
              <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 13 }}>Remove</Text>
            </Pressable>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footerSection}>
          {/* TODO: Link to community guidelines page when available */}
          <Text style={[styles.footerLink, { color: Colors[colorScheme].tint }]}>Respect all the players on the field.</Text>
          {showPrecisionWarning ? (
            <View style={[styles.warningBanner, { 
              backgroundColor: colorScheme === 'dark' ? Colors[colorScheme].surface : '#FEF9C3', 
              borderColor: colorScheme === 'dark' ? Colors[colorScheme].border : '#FACC15', 
              marginTop: 12 
            }]}>
              <Ionicons name="navigate-outline" size={16} color={colorScheme === 'dark' ? Colors[colorScheme].tint : '#B45309'} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningText, { 
                  color: colorScheme === 'dark' ? Colors[colorScheme].text : '#92400E', 
                  marginBottom: 4 
                }]}>
                  Precise location is off. Nearby event suggestions may be less accurate on Android.
                </Text>
                <View style={styles.warningActionsRow}>
                  <Pressable onPress={() => setPrecisionBannerDismissed(true)}>
                    <Text style={[styles.warningActionLink, { 
                      color: colorScheme === 'dark' ? Colors[colorScheme].tint : '#92400E' 
                    }]}>Maybe later</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPrecisionBannerDismissed(true);
                      void openSettings();
                    }}
                  >
                    <Text style={[styles.warningActionLink, { color: Colors[colorScheme].tint, fontWeight: '700' }]}>
                      Open settings
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
          {locationError && (
            <View style={[styles.warningBanner, { backgroundColor: Colors[colorScheme].surface, borderColor: colorScheme === 'dark' ? Colors[colorScheme].destructive + '80' : '#FCA5A5' }]}>
              <Ionicons name="alert-circle" size={16} color={Colors[colorScheme].destructive} />
              <Text style={[styles.warningText, { color: Colors[colorScheme].destructive }]}>{locationError}</Text>
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAwareScreen>

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
                    <View style={[styles.eventOptionIcon, { backgroundColor: Colors[colorScheme].surface }]}>
                      <Ionicons 
                        name={index === 0 ? "star" : "trophy"}
                        size={20} 
                        color={index === 0 ? "#F59E0B" : "#059669"} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      {index === 0 && game.distance !== null && game.distance !== undefined && (
                        <Text style={[styles.eventOptionBadge, { color: '#F59E0B' }]}>Nearest Event</Text>
                      )}
                      <Text style={[styles.eventOptionTitle, { color: Colors[colorScheme].text }]}>
                        {game.title || `${game.home_team} vs ${game.away_team}`}
                      </Text>
                      {game.distance !== null && game.distance !== undefined && (
                        <Text style={[styles.gameDistance, { color: '#3B82F6', marginTop: 4 }]}>
                          📍 {game.distance < 1 
                            ? `${Math.round(game.distance * 1000)}m away` 
                            : `${game.distance.toFixed(1)}km away`}
                        </Text>
                      )}
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

      {/* Post Preview Modal */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={[styles.modalHeader, { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>Preview Post</Text>
            <Pressable onPress={() => setPreviewVisible(false)}>
              <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {/* Preview Card - Shows how post will look in feed */}
            <View style={[styles.previewCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.previewLabel, { color: Colors[colorScheme].mutedText }]}>
                This is how your post will appear in the feed:
              </Text>
              
              {/* Post Content */}
              {previewData?.content && (
                <Text style={[styles.previewContent, { color: Colors[colorScheme].text }]}>
                  {previewData.content}
                </Text>
              )}

              {/* Media Preview */}
              {previewData?.media && (
                <View style={[styles.previewMediaContainer, { backgroundColor: Colors[colorScheme].surface }]}>
                  {previewData.media.type === 'image' ? (
                    <RNImage 
                      source={{ uri: previewData.media.uri }} 
                    style={[
                      styles.previewMediaFull,
                      mediaDimensions ? { aspectRatio: mediaDimensions.width / mediaDimensions.height } : undefined,
                    ]}
                      resizeMode="contain"
                    />
                  ) : (
                    <VideoPlayer 
                      uri={previewData.media.uri} 
                    style={[
                      styles.previewMediaFull,
                      mediaDimensions ? { aspectRatio: mediaDimensions.width / mediaDimensions.height } : undefined,
                    ]}
                      autoPlay={false}
                    />
                  )}
                  {/* Retake/Replace Media Button */}
                  <Pressable
                    style={[styles.retakeButton, { backgroundColor: Colors[colorScheme].background }]}
                    onPress={() => {
                      setPreviewVisible(false);
                      setPicked(null);
                      Alert.alert(
                        'Replace Media',
                        'Choose how you want to replace your media:',
                        [
                          { text: 'Camera', onPress: () => captureWithCamera() },
                          { text: 'Gallery', onPress: () => pickFromLibrary(previewData.media.type) },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="camera" size={18} color={Colors[colorScheme].tint} />
                    <Text style={[styles.retakeButtonText, { color: Colors[colorScheme].tint }]}>
                      Retake / Replace
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Event Badge */}
              {previewData?.game && selectedGameId && (
                <View style={styles.previewEventBadge}>
                  <Ionicons name="trophy" size={16} color={Colors[colorScheme].tint} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.previewEventText, { color: Colors[colorScheme].text }]}>
                      {previewData.game.title || `${previewData.game.home_team} vs ${previewData.game.away_team}`}
                    </Text>
                  </View>
                </View>
              )}

              {/* Destination Info */}
              <View style={[styles.previewDestination, { backgroundColor: Colors[colorScheme].surface }]}>
                <Ionicons 
                  name={previewData?.game ? "trophy" : "person"}
                  size={16} 
                  color={Colors[colorScheme].mutedText} 
                />
                <Text style={[styles.previewDestinationText, { color: Colors[colorScheme].mutedText }]}>
                  {previewData?.game && selectedGameId 
                    ? "This post will appear on the event page" 
                    : "This post will appear on your profile"}
                </Text>
              </View>

              {/* Post Actions Preview */}
              <View style={styles.previewPostActions}>
                <View style={styles.previewActionButton}>
                  <Ionicons name="arrow-up-outline" size={18} color={Colors[colorScheme].tint} />
                  <Text style={[styles.previewActionText, { color: Colors[colorScheme].tint }]}>0</Text>
                </View>
                <View style={styles.previewActionButton}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.previewActionText, { color: Colors[colorScheme].mutedText }]}>0</Text>
                </View>
                <View style={styles.previewActionButton}>
                  <Ionicons name="bookmark-outline" size={18} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.previewActionText, { color: Colors[colorScheme].mutedText }]}>0</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.previewActions}>
              <Pressable
                style={[styles.previewButton, styles.editButton, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={() => setPreviewVisible(false)}
              >
                <Ionicons name="create-outline" size={20} color={Colors[colorScheme].text} />
                <Text style={[styles.previewButtonText, { color: Colors[colorScheme].text }]}>
                  Edit Post
                </Text>
              </Pressable>

              <Pressable
                style={[styles.previewButton, styles.confirmButton, { opacity: submitting ? 0.6 : 1 }]}
                onPress={confirmPost}
                disabled={submitting}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>
                  {submitting ? 'Posting...' : (picked?.uri ? 'Confirm & Upload' : 'Confirm & Post')}
                </Text>
              </Pressable>
            </View>

            {/* Helpful Tips */}
            <View style={[styles.previewTips, { backgroundColor: Colors[colorScheme].surface }]}>
              <Ionicons name="information-circle-outline" size={20} color={Colors[colorScheme].mutedText} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewTipsTitle, { color: Colors[colorScheme].text }]}>
                  Before you post:
                </Text>
                <Text style={[styles.previewTipsText, { color: Colors[colorScheme].mutedText }]}>
                  • Double-check your media looks good{'\n'}
                  • Make sure your caption is error-free{'\n'}
                  • Verify the event is correct (if attached)
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Full-screen celebration overlay */}
      {postSuccess && (
        <Animated.View style={[styles.celebrationOverlay, { opacity: celebrationOpacity }]}>
          <Animated.View style={[styles.celebrationContent, { transform: [{ scale: celebrationScale }] }]}>
            {/* Confetti particles */}
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const radius = 80;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.confettiDot,
                    {
                      backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'][i % 6],
                      transform: [
                        {
                          translateX: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.cos(angle) * radius],
                          }),
                        },
                        {
                          translateY: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.sin(angle) * radius + 40],
                          }),
                        },
                        {
                          scale: confettiAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 1.2, 0],
                          }),
                        },
                      ],
                      opacity: confettiAnim.interpolate({
                        inputRange: [0, 0.3, 0.8, 1],
                        outputRange: [0, 1, 1, 0],
                      }),
                    },
                  ]}
                />
              );
            })}
            <Animated.View style={{ transform: [{ scale: celebrationScale }] }}>
              <Ionicons name="checkmark-circle" size={96} color="#F59E0B" />
            </Animated.View>
            <Text style={styles.celebrationTitle}>Posted!</Text>
            <Text style={styles.celebrationSubtitle}>
              {postType === 'highlight' ? 'Your highlight is live' : 'Your post is live'}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
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
    // color: Uses dynamic color in JSX
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
    backgroundColor: '#1B3A6B',
    borderColor: '#1B3A6B'
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
  
  cropHint: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
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
  eventConfirmation: {
    fontSize: 12,
    fontWeight: '600',
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  warningActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
  },
  warningActionLink: {
    fontSize: 13,
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
    // backgroundColor: Uses dynamic color in JSX
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: Uses dynamic color in JSX
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    // color: Uses dynamic color in JSX
  },
  reviewModalBody: {
    padding: 20,
    gap: 20,
  },
  reviewMediaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor & backgroundColor: Uses dynamic colors in JSX
  },
  reviewMedia: {
    width: '100%',
    height: 240,
  },
  reviewMediaLabel: {
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    // color: Uses dynamic color in JSX
  },
  reviewTextCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor & backgroundColor: Uses dynamic colors in JSX
    padding: 16,
  },
  reviewTextLabel: {
    fontSize: 13,
    fontWeight: '700',
    // color: Uses dynamic color in JSX
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 15,
    // color: Uses dynamic color in JSX
    lineHeight: 22,
  },
  reviewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor & backgroundColor: Uses dynamic colors in JSX
    gap: 12,
  },
  reviewEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    // color: Uses dynamic color in JSX
  },
  reviewEmptySubtitle: {
    fontSize: 14,
    // color: Uses dynamic color in JSX
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
    // borderColor & backgroundColor: Uses dynamic colors in JSX
    borderStyle: 'dashed',
  },
  noEventText: {
    // color: Uses dynamic color in JSX
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
    // backgroundColor: Uses dynamic color in JSX
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    // borderBottomColor: Uses dynamic color in JSX
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    // color: Uses dynamic color in JSX
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
    // borderColor & backgroundColor: Uses dynamic colors in JSX
  },
  eventOptionCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  eventOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor: Uses dynamic color in JSX
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
    // color: Uses dynamic color in JSX
    marginBottom: 4,
  },
  eventOptionDate: {
    fontSize: 13,
    // color: Uses dynamic color in JSX
    marginBottom: 2,
  },
  eventOptionLocation: {
    fontSize: 12,
    // color: Uses dynamic color in JSX
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
  
  // Nearby games
  nearbyGamesHint: {
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  nearbyGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  gameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gameDistance: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewMoreButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Preview modal
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  previewContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  previewMediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  previewMediaFull: {
    width: '100%',
    minHeight: 300,
    backgroundColor: '#F3F4F6',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewEventBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewEventText: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewEventId: {
    fontSize: 13,
    marginTop: 4,
  },
  previewDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  previewDestinationText: {
    fontSize: 13,
    flex: 1,
  },
  previewPostActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: '#2563EB',
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  previewTips: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  previewTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  previewTipsText: {
    fontSize: 13,
    lineHeight: 20,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  celebrationContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationTitle: {
    color: '#F59E0B',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  celebrationSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  confettiDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  headerPostBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
