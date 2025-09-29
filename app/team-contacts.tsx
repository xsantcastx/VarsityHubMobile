import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Clipboard, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatFileSize, uploadDocument, uploadImage, UploadResponse } from '../utils/uploadUtils';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

// Suppress expo-av deprecation warning for now - TODO: migrate to expo-audio
console.warn = ((originalWarn) => {
  return (...args: any[]) => {
    if (args[0]?.includes?.('Expo AV has been deprecated')) return;
    originalWarn(...args);
  };
})(console.warn);

interface ChatMessage {
  id: string;
  content: string;
  author: {
    id: string;
    display_name: string;
    avatar_url?: string;
    role?: string;
  };
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'voice' | 'announcement' | 'game_reminder';
  reactions?: {
    emoji: string;
    count: number;
    users: string[];
  }[];
  replyTo?: string;
  image?: {
    uri: string;
    width: number;
    height: number;
  };
  voice?: {
    uri: string;
    duration: number;
  };
  file?: {
    uri: string;
    name: string;
    size: string;
    type: string;
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface TeamMember {
  id: string;
  user?: {
    id: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
  };
  role: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export default function TeamChatScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState<'chat' | 'members' | 'files'>('chat');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioPosition, setAudioPosition] = useState<{ [key: string]: number }>({});
  const [soundObjects, setSoundObjects] = useState<{ [key: string]: Audio.Sound }>({});
  
  // Modal states for custom menus
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showImageOptionsMenu, setShowImageOptionsMenu] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastAnim = useRef(new Animated.Value(0)).current;
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<TextInput>(null);
  
  // Animated values for typing dots
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.4)).current;
  const dot3Anim = useRef(new Animated.Value(0.4)).current;
  
  // Animation refs for messages
  const messageAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Message persistence functions
  const STORAGE_KEY = `team_messages_${id}`;
  
  const saveMessages = useCallback(async (messages: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, [STORAGE_KEY]);

  const loadMessages = useCallback(async (): Promise<ChatMessage[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  }, [STORAGE_KEY]);

  const saveFiles = useCallback(async (filesList: any[]) => {
    try {
      const filesKey = `team-${id}-files`;
      await AsyncStorage.setItem(filesKey, JSON.stringify(filesList));
    } catch (error) {
      console.error('Failed to save files:', error);
    }
  }, [id]);

  const loadFiles = useCallback(async (): Promise<any[]> => {
    try {
      const filesKey = `team-${id}-files`;
      const stored = await AsyncStorage.getItem(filesKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load files:', error);
      return [];
    }
  }, [id]);

  // Available emojis for reactions
  const availableEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '👏', '🙏'];

  // Animated typing dots
  const startTypingAnimation = useCallback(() => {
    const animateDot = (animValue: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        { iterations: -1 }
      ).start();
    };

    // Start animations with staggered delays
    setTimeout(() => animateDot(dot1Anim, 0), 0);
    setTimeout(() => animateDot(dot2Anim, 200), 200);
    setTimeout(() => animateDot(dot3Anim, 400), 400);
  }, [dot1Anim, dot2Anim, dot3Anim]);

  const stopTypingAnimation = useCallback(() => {
    dot1Anim.stopAnimation();
    dot2Anim.stopAnimation();
    dot3Anim.stopAnimation();
    dot1Anim.setValue(0.4);
    dot2Anim.setValue(0.4);
    dot3Anim.setValue(0.4);
  }, [dot1Anim, dot2Anim, dot3Anim]);

  // Message animation functions
  const animateNewMessage = useCallback((messageId: string) => {
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.8);
    messageAnimations.set(messageId, fadeAnim);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [messageAnimations]);

  const animateReaction = useCallback((reactionRef: Animated.Value) => {
    Animated.sequence([
      Animated.spring(reactionRef, {
        toValue: 1.3,
        tension: 300,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(reactionRef, {
        toValue: 1,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Mock files data
  const mockFiles = [
    {
      id: '1',
      name: 'Team_Roster_2024.pdf',
      size: '2.5 MB',
      type: 'pdf',
      uploadedBy: 'Coach Johnson',
      uploadedAt: '2025-09-20T14:30:00Z',
      url: 'https://example.com/roster.pdf',
    },
    {
      id: '2',
      name: 'Practice_Schedule.xlsx',
      size: '1.2 MB',
      type: 'excel',
      uploadedBy: 'Alex Wilson',
      uploadedAt: '2025-09-22T09:15:00Z',
      url: 'https://example.com/schedule.xlsx',
    },
    {
      id: '3',
      name: 'Team_Photo_Sept.jpg',
      size: '5.8 MB',
      type: 'image',
      uploadedBy: 'Sarah Johnson',
      uploadedAt: '2025-09-23T11:45:00Z',
      url: 'https://example.com/photo.jpg',
    },
  ];

  // Mock messages data
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      content: "Great practice today everyone! Don't forget we have the game against Warriors this Saturday at 7 PM.",
      author: {
        id: 'coach1',
        display_name: 'Coach Johnson',
        role: 'Head Coach',
      },
      timestamp: '2025-09-23T10:30:00Z',
      type: 'announcement',
      reactions: [
        { emoji: '👍', count: 8, users: ['1', '2', '3'] },
        { emoji: '🔥', count: 3, users: ['4', '5'] },
      ],
    },
    {
      id: '2',
      content: 'I will be there early to help set up the equipment.',
      author: {
        id: 'player1',
        display_name: 'Alex Wilson',
        role: 'Team Captain',
      },
      timestamp: '2025-09-23T10:35:00Z',
      type: 'text',
      replyTo: '1',
    },
    {
      id: '3',
      content: 'Can someone pick me up? My car is in the shop.',
      author: {
        id: 'player2',
        display_name: 'Sarah Johnson',
        role: 'Player',
      },
      timestamp: '2025-09-23T11:15:00Z',
      type: 'text',
    },
    {
      id: '4',
      content: 'I can give you a ride Sarah! I pass by your area.',
      author: {
        id: 'player3',
        display_name: 'Mike Davis',
        role: 'Player',
      },
      timestamp: '2025-09-23T11:20:00Z',
      type: 'text',
      replyTo: '3',
      reactions: [
        { emoji: '🙏', count: 2, users: ['2', '5'] },
      ],
    },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) { setError('Missing team id'); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const membersData = await TeamApi.members(String(id));
        if (!mounted) return;
        
        const formattedMembers: TeamMember[] = Array.isArray(membersData) ? membersData.map((m: any) => ({
          id: String(m.id),
          user: m.user ? {
            id: String(m.user.id),
            display_name: m.user.display_name || m.user.name,
            email: m.user.email,
            avatar_url: m.user.avatar_url,
          } : undefined,
          role: m.role || 'player',
          status: (Math.random() > 0.5 ? 'online' : 'offline') as 'online' | 'offline' | 'away',
          lastSeen: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        })) : [];
        
        setMembers(formattedMembers);
        
        // Load persisted messages first, then fallback to mock data
        const savedMessages = await loadMessages();
        if (savedMessages.length > 0) {
          setMessages(savedMessages);
        } else {
          setMessages(mockMessages);
          await saveMessages(mockMessages);
        }
        
        // Load persisted files
        const savedFiles = await loadFiles();
        setFiles(savedFiles);
        
        // Initialize with empty files list - files will be added as they're uploaded
        // setFiles(mockFiles);
        
        // Mock typing users for demo
        setTimeout(() => {
          setTypingUsers(['Mike Davis']);
          setTimeout(() => setTypingUsers([]), 3000);
        }, 2000);
      } catch (e: any) {
        if (!mounted) return; 
        setError('Failed to load team chat');
      } finally { 
        if (mounted) setLoading(false); 
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Start/stop typing animations based on typing users
  useEffect(() => {
    if (typingUsers.length > 0) {
      startTypingAnimation();
    } else {
      stopTypingAnimation();
    }
  }, [typingUsers.length, startTypingAnimation, stopTypingAnimation]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const message: ChatMessage = {
        id: Date.now().toString(),
        content: newMessage.trim(),
        author: {
          id: 'current_user',
          display_name: 'You',
          role: 'Player',
        },
        timestamp: new Date().toISOString(),
        type: 'text',
        replyTo: replyingTo?.id,
        status: 'sending',
      };
      
      setMessages(prev => {
        const updated = [...prev, message];
        saveMessages(updated);
        return updated;
      });
      setNewMessage('');
      setReplyingTo(null);
      
      // Animate new message
      animateNewMessage(message.id);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Simulate message status progression
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'sent' } : msg
        ));
      }, 500);
      
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'delivered' } : msg
        ));
      }, 1000);
      
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'read' } : msg
        ));
      }, 2000);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, replyingTo]);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    setMessages(prev => prev.map(message => {
      if (message.id === messageId) {
        const existingReactions = message.reactions || [];
        const reactionIndex = existingReactions.findIndex(r => r.emoji === emoji);
        
        if (reactionIndex >= 0) {
          // Toggle reaction if user already reacted
          const reaction = existingReactions[reactionIndex];
          const hasUserReacted = reaction.users.includes('current_user');
          
          if (hasUserReacted) {
            // Remove user's reaction
            const updatedUsers = reaction.users.filter(id => id !== 'current_user');
            if (updatedUsers.length === 0) {
              // Remove reaction entirely if no users left
              return {
                ...message,
                reactions: existingReactions.filter((_, idx) => idx !== reactionIndex)
              };
            } else {
              // Update reaction count
              const updatedReactions = [...existingReactions];
              updatedReactions[reactionIndex] = {
                ...reaction,
                count: updatedUsers.length,
                users: updatedUsers
              };
              return { ...message, reactions: updatedReactions };
            }
          } else {
            // Add user's reaction
            const updatedReactions = [...existingReactions];
            updatedReactions[reactionIndex] = {
              ...reaction,
              count: reaction.count + 1,
              users: [...reaction.users, 'current_user']
            };
            return { ...message, reactions: updatedReactions };
          }
        } else {
          // Add new reaction
          return {
            ...message,
            reactions: [
              ...existingReactions,
              { emoji, count: 1, users: ['current_user'] }
            ]
          };
        }
      }
      return message;
    }));
    setShowEmojiPicker(null);
  }, []);

  const replyToMessage = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
    setShowEmojiPicker(null);
    // Focus the text input after a short delay
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  }, [toastAnim]);

  const uploadFile = useCallback(async () => {
    setShowAttachmentMenu(true);
  }, []);

  const getFileIcon = (type: string) => {
    const mimeType = type.toLowerCase();
    if (mimeType.includes('pdf')) return 'document-text';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('video')) return 'videocam';
    if (mimeType.includes('audio')) return 'musical-notes';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    if (mimeType.includes('text')) return 'document-text';
    return 'document-attach';
  };

  const getFileIconColor = (type: string) => {
    const mimeType = type.toLowerCase();
    if (mimeType.includes('pdf')) return '#F44336';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#4CAF50';
    if (mimeType.includes('word') || mimeType.includes('document')) return '#2196F3';
    if (mimeType.includes('image')) return '#FF9800';
    if (mimeType.includes('video')) return '#9C27B0';
    if (mimeType.includes('audio')) return '#E91E63';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '#795548';
    if (mimeType.includes('text')) return '#607D8B';
    return '#757575';
  };

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await sendImageMessage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await sendImageMessage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  const sendImageMessage = useCallback(async (imageAsset: ImagePicker.ImagePickerAsset) => {
    try {
      const message: ChatMessage = {
        id: Date.now().toString(),
        content: 'Uploading image...',
        author: {
          id: 'current_user',
          display_name: 'You',
          role: 'Player',
        },
        timestamp: new Date().toISOString(),
        type: 'image',
        image: {
          uri: imageAsset.uri,
          width: imageAsset.width,
          height: imageAsset.height,
        },
        replyTo: replyingTo?.id,
        status: 'sending',
      };
      
      setMessages(prev => {
        const updated = [...prev, message];
        saveMessages(updated);
        return updated;
      });
      setReplyingTo(null);
      
      // Animate new message
      animateNewMessage(message.id);
      
      // Upload image to server
      const fileToUpload = {
        uri: imageAsset.uri,
        name: `image_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: imageAsset.fileSize,
      };
      
      const uploadResponse = await uploadImage(fileToUpload);

      // Update message with server URL and success status
      const updatedMessage: ChatMessage = {
        ...message,
        content: '',
        image: {
          ...message.image!,
          uri: uploadResponse.url, // Use server URL
        },
        status: 'sent',
      };

      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === message.id ? updatedMessage : msg
        );
        saveMessages(updated);
        return updated;
      });
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Add image to files tab list
      const newFile = {
        id: Date.now().toString(),
        name: fileToUpload.name,
        size: formatFileSize(fileToUpload.size || 0),
        type: mapMimeTypeToFileType(fileToUpload.type || 'image/jpeg'),
        uploadedBy: 'You',
        uploadedAt: new Date().toISOString(),
        url: uploadResponse.url,
      };
      
      setFiles(prev => {
        const updated = [newFile, ...prev];
        saveFiles(updated);
        return updated;
      });
      
      showToast('Image uploaded successfully!');
    } catch (error) {
      console.error('Image upload failed:', error);
      
      // Update message to show error
      setMessages(prev => {
        const updated = prev.map(msg => {
          if (msg.status === 'sending' && msg.type === 'image') {
            return {
              ...msg,
              content: '❌ Failed to upload image',
              status: 'sent' as const,
            };
          }
          return msg;
        });
        saveMessages(updated);
        return updated;
      });
      
      Alert.alert('Error', 'Failed to upload image to server');
    }
  }, [replyingTo, animateNewMessage, saveMessages]);

  const showImageOptions = useCallback(() => {
    setShowImageOptionsMenu(true);
  }, []);

  const saveImageToGallery = useCallback(async (imageUri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save images to your gallery');
        return;
      }
      
      await MediaLibrary.saveToLibraryAsync(imageUri);
      showToast('Image saved to gallery!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save image to gallery');
    }
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerVisible(false);
    setSelectedImage(null);
  }, []);

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission to record voice messages');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration timer
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Store timer reference for cleanup
      (recording as any).timer = timer;
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      // Clear timer
      if ((recording as any).timer) {
        clearInterval((recording as any).timer);
      }
      
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        setRecordingUri(uri);
        const status = await recording.getStatusAsync();
        await sendVoiceMessage(uri, status.durationMillis || 0);
      }
      
      setRecording(null);
      setRecordingDuration(0);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  }, [recording]);

  const sendVoiceMessage = useCallback(async (uri: string, duration: number) => {
    try {
      const message: ChatMessage = {
        id: Date.now().toString(),
        content: '',
        author: {
          id: 'current_user',
          display_name: 'You',
          role: 'Player',
        },
        timestamp: new Date().toISOString(),
        type: 'voice',
        voice: {
          uri,
          duration: Math.round(duration / 1000), // Convert to seconds
        },
        replyTo: replyingTo?.id,
        status: 'sending',
      };
      
      setMessages(prev => {
        const updated = [...prev, message];
        saveMessages(updated); // Save to storage
        return updated;
      });
      setReplyingTo(null);
      
      // Animate new message
      animateNewMessage(message.id);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Simulate message status progression
      setTimeout(() => {
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg.id === message.id ? { ...msg, status: 'sent' as const } : msg
          );
          saveMessages(updated);
          return updated;
        });
      }, 800);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to send voice message');
    }
  }, [replyingTo, animateNewMessage, saveMessages]);

  // Voice playback functions
  const playVoiceMessage = useCallback(async (messageId: string, uri: string) => {
    try {
      // Stop any currently playing audio
      if (playingAudio && playingAudio !== messageId) {
        const currentSound = soundObjects[playingAudio];
        if (currentSound) {
          await currentSound.stopAsync();
        }
      }

      // If this message is already playing, pause it
      if (playingAudio === messageId) {
        const sound = soundObjects[messageId];
        if (sound) {
          await sound.pauseAsync();
          setPlayingAudio(null);
        }
        return;
      }

      // Create new sound object if it doesn't exist
      let sound = soundObjects[messageId];
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );
        sound = newSound;
        setSoundObjects(prev => ({ ...prev, [messageId]: sound }));
        
        // Set up playback status update
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.positionMillis !== undefined && status.durationMillis) {
              setAudioPosition(prev => ({
                ...prev,
                [messageId]: status.positionMillis / status.durationMillis
              }));
            }
            
            if (status.didJustFinish) {
              setPlayingAudio(null);
              setAudioPosition(prev => ({ ...prev, [messageId]: 0 }));
            }
          }
        });
      }

      // Play the sound
      await sound.playAsync();
      setPlayingAudio(messageId);
    } catch (error) {
      Alert.alert('Error', 'Failed to play voice message');
    }
  }, [playingAudio, soundObjects]);

  const formatDuration = useCallback((milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Document picking functions
  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await sendFileMessage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  }, []);

  const sendFileMessage = useCallback(async (fileAsset: any) => {
    try {
      // Create initial message with uploading status
      const message: ChatMessage = {
        id: Date.now().toString(),
        content: `Uploading file: ${fileAsset.name}...`,
        author: {
          id: 'current_user',
          display_name: 'You',
          role: 'Player',
        },
        timestamp: new Date().toISOString(),
        type: 'file',
        file: {
          uri: fileAsset.uri,
          name: fileAsset.name,
          size: formatFileSize(fileAsset.size || 0),
          type: fileAsset.mimeType || 'application/octet-stream',
        },
        replyTo: replyingTo?.id,
        status: 'sending',
      };
      
      setMessages(prev => {
        const updated = [...prev, message];
        saveMessages(updated);
        return updated;
      });
      setReplyingTo(null);
      
      // Animate new message
      animateNewMessage(message.id);
      
      // Upload file to server
      const fileToUpload = {
        uri: fileAsset.uri,
        name: fileAsset.name,
        type: fileAsset.mimeType,
        size: fileAsset.size,
      };
      
      let uploadResponse: UploadResponse;
      
      if (fileAsset.mimeType?.startsWith('image/')) {
        uploadResponse = await uploadImage(fileToUpload);
      } else {
        uploadResponse = await uploadDocument(fileToUpload);
      }

      // Update message with server URL and success status
      const updatedMessage: ChatMessage = {
        ...message,
        content: `Shared a file: ${fileAsset.name}`,
        file: {
          ...message.file!,
          uri: uploadResponse.url, // Use server URL
        },
        status: 'sent',
      };

      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === message.id ? updatedMessage : msg
        );
        saveMessages(updated);
        return updated;
      });
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Add file to files tab list
      const newFile = {
        id: Date.now().toString(),
        name: fileAsset.name,
        size: formatFileSize(fileAsset.size || 0),
        type: mapMimeTypeToFileType(fileAsset.mimeType || 'application/octet-stream'),
        uploadedBy: 'You',
        uploadedAt: new Date().toISOString(),
        url: uploadResponse.url,
      };
      
      setFiles(prev => {
        const updated = [newFile, ...prev];
        saveFiles(updated);
        return updated;
      });
      
      showToast('File uploaded successfully!');
    } catch (error) {
      console.error('File upload failed:', error);
      
      // Update message to show error - use a new variable since message is not in scope
      const messageId = Date.now().toString();
      setMessages(prev => {
        const updated = prev.map(msg => {
          if (msg.status === 'sending' && msg.type === 'file' && msg.file?.name === fileAsset.name) {
            return {
              ...msg,
              content: `❌ Failed to upload: ${fileAsset.name}`,
              status: 'sent' as const, // Use valid status
            };
          }
          return msg;
        });
        saveMessages(updated);
        return updated;
      });
      
      Alert.alert('Error', 'Failed to upload file to server');
    }
  }, [replyingTo, animateNewMessage, saveMessages]);

  const handleFileUpload = useCallback(async (type: 'media' | 'document') => {
    try {
      setIsUploadingFile(true);
      
      if (type === 'media') {
        // Use image picker for media
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: false,
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          if (result.assets[0].type === 'image') {
            await sendImageMessage(result.assets[0]);
          } else {
            // Handle video files
            await sendFileMessage({
              uri: result.assets[0].uri,
              name: `video_${Date.now()}.mp4`,
              size: result.assets[0].fileSize || 0,
              mimeType: 'video/mp4',
            });
          }
        }
      } else {
        // Use document picker for documents
        await pickDocument();
      }
    } catch (error) {
      showToast('Failed to upload file', 'error');
    } finally {
      setIsUploadingFile(false);
    }
  }, [sendImageMessage, sendFileMessage, pickDocument, showToast]);

  const getFileColor = (type: string) => {
    switch (type) {
      case 'pdf': return '#EF4444';
      case 'excel': return '#10B981';
      case 'image': return '#8B5CF6';
      case 'video': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const mapMimeTypeToFileType = (mimeType: string): string => {
    const mime = mimeType.toLowerCase();
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('ms-excel')) return 'excel';
    if (mime.includes('image')) return 'image';
    if (mime.includes('video')) return 'video';
    return 'document';
  };

  const handleTextChange = useCallback((text: string) => {
    setNewMessage(text);
    
    // Handle typing indicator
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      // Mock: Send typing start to server
      
      // Simulate others typing occasionally
      if (Math.random() > 0.7) {
        const simulatedUsers = ['John Doe', 'Sarah Wilson', 'Mike Johnson'];
        const randomUser = simulatedUsers[Math.floor(Math.random() * simulatedUsers.length)];
        setTypingUsers(prev => prev.includes(randomUser) ? prev : [...prev, randomUser]);
        
        // Stop simulated typing after a bit
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(user => user !== randomUser));
        }, 2000 + Math.random() * 3000);
      }
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Mock: Send typing stop to server
    }, 1000);
  }, [isTyping]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup audio players
  useEffect(() => {
    return () => {
      // Stop and unload all sound objects
      Object.values(soundObjects).forEach(async (sound) => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    };
  }, [soundObjects]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleFilePress = useCallback(async (file: { uri: string; name: string; type: string }) => {
    try {
      // Try to open the file using the device's default app
      const supported = await Linking.canOpenURL(file.uri);
      
      if (supported) {
        await Linking.openURL(file.uri);
      } else {
        // If can't open directly, show options
        Alert.alert(
          'Open File',
          `Would you like to download "${file.name}"?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Download',
              onPress: async () => {
                try {
                  // For web files, we can try to download
                  if (file.uri.startsWith('http')) {
                    await Linking.openURL(file.uri);
                    showToast('Opening file in browser...');
                  } else {
                    showToast('Unable to open this file type');
                  }
                } catch (error) {
                  console.error('Error downloading file:', error);
                  Alert.alert('Error', 'Unable to download file');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Unable to open file');
    }
  }, [showToast]);

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isAnnouncement = item.type === 'announcement';
    const isCurrentUser = item.author.id === 'current_user';
    const showAvatar = index === 0 || messages[index - 1].author.id !== item.author.id;
    const replyMessage = item.replyTo ? messages.find(m => m.id === item.replyTo) : null;
    
    // Get or create animation value for this message
    const messageAnim = messageAnimations.get(item.id) || new Animated.Value(1);
    if (!messageAnimations.has(item.id)) {
      messageAnimations.set(item.id, messageAnim);
    }
    
    const handleLongPress = () => {
      // Copy to clipboard immediately
      Clipboard.setString(item.content);
      Alert.alert('Copied', 'Message copied to clipboard');
    };

    const handleQuickReaction = () => {
      // Quick reaction with most common emoji
      addReaction(item.id, '👍');
    };

    const handleDoubleTap = () => {
      // Quick love reaction on double tap
      addReaction(item.id, '❤️');
    };
    
    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isCurrentUser && styles.currentUserMessage,
          isAnnouncement && styles.announcementMessage,
          {
            opacity: messageAnim,
            transform: [{ scale: messageAnim }],
          },
        ]}
      >
        {showAvatar && !isCurrentUser && (
          <View style={[styles.avatar, { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={styles.avatarText}>
              {item.author.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageContent,
          isCurrentUser && styles.currentUserContent,
          isAnnouncement && styles.announcementContent,
          !showAvatar && !isCurrentUser && styles.messageContentWithoutAvatar,
        ]}>
          {showAvatar && !isCurrentUser && (
            <View style={styles.messageHeader}>
              <Text style={[styles.authorName, { color: Colors[colorScheme].text }]}>
                {item.author.display_name}
              </Text>
              <Text style={[styles.authorRole, { color: Colors[colorScheme].mutedText }]}>
                {item.author.role}
              </Text>
              <Text style={[styles.timestamp, { color: Colors[colorScheme].mutedText }]}>
                {formatTime(item.timestamp)}
              </Text>
            </View>
          )}
          
          {replyMessage && (
            <View style={[styles.replyContainer, { borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.replyAuthor, { color: Colors[colorScheme].tint }]}>
                {replyMessage.author.display_name}
              </Text>
              <Text style={[styles.replyText, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>
                {replyMessage.content}
              </Text>
            </View>
          )}
          
          <Pressable 
            onPress={handleQuickReaction}
            onLongPress={handleLongPress}
            style={[
              styles.messageBubble,
              {
                backgroundColor: isCurrentUser ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                borderTopLeftRadius: isCurrentUser ? 20 : 6,
                borderTopRightRadius: isCurrentUser ? 6 : 20,
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
              },
              isAnnouncement && { 
                backgroundColor: '#FEF3C7',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              },
            ]}
          >
            {isAnnouncement && (
              <View style={styles.announcementIcon}>
                <Ionicons name="megaphone" size={16} color="#F59E0B" />
              </View>
            )}
            
            {item.image && (
              <Pressable style={styles.imageContainer} onPress={() => {
                setSelectedImage(item.image!);
                setImageViewerVisible(true);
              }}>
                <Image 
                  source={{ uri: item.image.uri }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </Pressable>
            )}

            {item.voice && (
              <View style={[styles.voiceMessageContainer, { 
                backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.1)' : Colors[colorScheme].background 
              }]}>
                <Pressable 
                  style={[styles.voicePlayButton, { 
                    backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.2)' : Colors[colorScheme].tint 
                  }]}
                  onPress={() => playVoiceMessage(item.id, item.voice!.uri)}
                >
                  <Ionicons 
                    name={playingAudio === item.id ? "pause" : "play"} 
                    size={16} 
                    color={isCurrentUser ? '#fff' : '#fff'} 
                  />
                </Pressable>
                
                <View style={styles.voiceWaveform}>
                  <View style={[styles.voiceProgress, { 
                    width: `${(audioPosition[item.id] || 0) * 100}%`,
                    backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.5)' : Colors[colorScheme].tint + '80'
                  }]} />
                  <View style={styles.voiceWaves}>
                    {[...Array(20)].map((_, i) => (
                      <View 
                        key={i} 
                        style={[
                          styles.voiceWave, 
                          { 
                            height: Math.random() * 20 + 8,
                            backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.3)' : Colors[colorScheme].mutedText + '60'
                          }
                        ]} 
                      />
                    ))}
                  </View>
                </View>
                
                <Text style={[styles.voiceDuration, { 
                  color: isCurrentUser ? 'rgba(255,255,255,0.8)' : Colors[colorScheme].mutedText 
                }]}>
                  {formatDuration(item.voice.duration)}
                </Text>
              </View>
            )}
            
            {item.file && (
              <Pressable 
                style={[styles.fileMessageContainer, { 
                  backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.1)' : Colors[colorScheme].background 
                }]}
                onPress={() => handleFilePress(item.file!)}
              >
                <View style={[styles.fileIcon, { backgroundColor: getFileIconColor(item.file.type) }]}>
                  <Ionicons 
                    name={getFileIcon(item.file.type) as any} 
                    size={24} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { 
                    color: isCurrentUser ? '#fff' : Colors[colorScheme].text 
                  }]}>
                    {item.file.name}
                  </Text>
                  <Text style={[styles.fileDetails, { 
                    color: isCurrentUser ? 'rgba(255,255,255,0.8)' : Colors[colorScheme].mutedText 
                  }]}>
                    {item.file.size}
                  </Text>
                </View>
                <Ionicons 
                  name="download-outline" 
                  size={20} 
                  color={isCurrentUser ? 'rgba(255,255,255,0.8)' : Colors[colorScheme].mutedText} 
                />
              </Pressable>
            )}
            
            {item.content ? (
              <Text style={[
                styles.messageText,
                { color: isCurrentUser ? '#fff' : Colors[colorScheme].text },
                isAnnouncement && { color: '#92400E' },
                item.image && styles.messageTextWithImage,
              ]}>
                {item.content}
              </Text>
            ) : null}
            
            {/* Message Status - only show for current user's messages */}
            {isCurrentUser && item.status && (
              <View style={styles.messageStatus}>
                <Text style={[styles.statusTime, { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : Colors[colorScheme].mutedText }]}>
                  {formatTime(item.timestamp)}
                </Text>
                <View style={styles.statusIcons}>
                  {item.status === 'sending' && (
                    <Ionicons name="time-outline" size={12} color={isCurrentUser ? 'rgba(255,255,255,0.7)' : Colors[colorScheme].mutedText} />
                  )}
                  {item.status === 'sent' && (
                    <Ionicons name="checkmark" size={12} color={isCurrentUser ? 'rgba(255,255,255,0.7)' : Colors[colorScheme].mutedText} />
                  )}
                  {item.status === 'delivered' && (
                    <View style={styles.doubleCheck}>
                      <Ionicons name="checkmark" size={12} color={isCurrentUser ? 'rgba(255,255,255,0.7)' : Colors[colorScheme].mutedText} style={styles.checkmark1} />
                      <Ionicons name="checkmark" size={12} color={isCurrentUser ? 'rgba(255,255,255,0.7)' : Colors[colorScheme].mutedText} style={styles.checkmark2} />
                    </View>
                  )}
                  {item.status === 'read' && (
                    <View style={styles.doubleCheck}>
                      <Ionicons name="checkmark" size={12} color="#00BFA5" style={styles.checkmark1} />
                      <Ionicons name="checkmark" size={12} color="#00BFA5" style={styles.checkmark2} />
                    </View>
                  )}
                </View>
              </View>
            )}
          </Pressable>
          
          {item.reactions && item.reactions.length > 0 && (
            <View style={styles.reactionsContainer}>
              {item.reactions.map((reaction, idx) => {
                const hasUserReacted = reaction.users.includes('current_user');
                return (
                  <Pressable 
                    key={idx} 
                    style={[
                      styles.reaction, 
                      { 
                        backgroundColor: hasUserReacted ? Colors[colorScheme].tint + '20' : Colors[colorScheme].surface,
                        borderColor: hasUserReacted ? Colors[colorScheme].tint : 'transparent',
                        borderWidth: hasUserReacted ? 1 : 0,
                      }
                    ]}
                    onPress={() => addReaction(item.id, reaction.emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    <Text style={[styles.reactionCount, { color: Colors[colorScheme].text }]}>
                      {reaction.count}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable 
                style={[styles.reaction, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={() => setShowEmojiPicker(item.id)}
              >
                <Text style={styles.reactionEmoji}>+</Text>
              </Pressable>
            </View>
          )}

          {/* Quick Action Buttons */}
          <View style={[styles.quickActions, isCurrentUser && styles.quickActionsRight]}>
            <Pressable 
              style={[styles.quickActionButton, { backgroundColor: Colors[colorScheme].surface }]}
              onPress={() => replyToMessage(item)}
            >
              <Ionicons name="arrow-undo-outline" size={14} color={Colors[colorScheme].text} />
            </Pressable>
            <Pressable 
              style={[styles.quickActionButton, { backgroundColor: Colors[colorScheme].surface }]}
              onPress={() => setShowEmojiPicker(item.id)}
            >
              <Ionicons name="happy-outline" size={14} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
          
          {/* Emoji Picker */}
          {showEmojiPicker === item.id && (
            <View style={[styles.emojiPicker, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              {availableEmojis.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.emojiOption}
                  onPress={() => addReaction(item.id, emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <Pressable style={[styles.memberCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
      <View style={styles.memberInfo}>
        <View style={[styles.memberAvatar, { backgroundColor: Colors[colorScheme].tint }]}>
          <Text style={styles.memberInitials}>
            {(item.user?.display_name || 'M').charAt(0).toUpperCase()}
          </Text>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: item.status === 'online' ? '#10B981' : '#6B7280' }
          ]} />
        </View>
        <View style={styles.memberDetails}>
          <Text style={[styles.memberName, { color: Colors[colorScheme].text }]}>
            {item.user?.display_name || 'Team Member'}
          </Text>
          <Text style={[styles.memberRole, { color: Colors[colorScheme].mutedText }]}>
            {item.role}
          </Text>
          {item.status === 'offline' && item.lastSeen && (
            <Text style={[styles.lastSeen, { color: Colors[colorScheme].mutedText }]}>
              Last seen {formatTime(item.lastSeen)}
            </Text>
          )}
        </View>
      </View>
      <Pressable style={styles.messageButton}>
        <Ionicons name="chatbubble-outline" size={20} color={Colors[colorScheme].tint} />
      </Pressable>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading team chat...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{ 
          title: 'Team Chat',
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
          headerRight: () => (
            <Pressable onPress={() => Alert.alert('Chat Settings', 'Chat settings coming soon!')}>
              <Ionicons name="settings-outline" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          ),
        }} 
      />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['chat', 'members', 'files'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              { backgroundColor: selectedTab === tab ? Colors[colorScheme].tint : 'transparent' }
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === tab ? '#fff' : Colors[colorScheme].text }
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedTab === 'chat' && (
        <View style={{ flex: 1 }}>
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={Keyboard.dismiss}
            />
          </Pressable>
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <View style={[styles.typingIndicator, { backgroundColor: Colors[colorScheme].surface }]}>
              <View style={styles.typingDots}>
                <Animated.View style={[
                  styles.typingDot, 
                  { 
                    backgroundColor: Colors[colorScheme].mutedText,
                    opacity: dot1Anim,
                    transform: [{ scale: dot1Anim }]
                  }
                ]} />
                <Animated.View style={[
                  styles.typingDot, 
                  { 
                    backgroundColor: Colors[colorScheme].mutedText,
                    opacity: dot2Anim,
                    transform: [{ scale: dot2Anim }]
                  }
                ]} />
                <Animated.View style={[
                  styles.typingDot, 
                  { 
                    backgroundColor: Colors[colorScheme].mutedText,
                    opacity: dot3Anim,
                    transform: [{ scale: dot3Anim }]
                  }
                ]} />
              </View>
              <Text style={[styles.typingText, { color: Colors[colorScheme].mutedText }]}>
                {typingUsers.length === 1 
                  ? `${typingUsers[0]} is typing...`
                  : `${typingUsers.length} people are typing...`
                }
              </Text>
            </View>
          )}
          
          {/* Recording Indicator */}
          {isRecording && (
            <View style={[styles.recordingIndicator, { backgroundColor: '#EF4444' }]}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording voice message...</Text>
              <Text style={styles.recordingTime}>
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          
          {/* Message Input */}
          <View style={[
            styles.inputContainer, 
            { 
              backgroundColor: Colors[colorScheme].surface, 
              borderColor: Colors[colorScheme].border,
              borderTopWidth: replyingTo ? 0 : 1,
            }
          ]}>
            {replyingTo && (
              <View style={[styles.replyingToContainer, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}>
                <View style={styles.replyingToContent}>
                  <Text style={[styles.replyingToLabel, { color: Colors[colorScheme].tint }]}>
                    Replying to {replyingTo.author.display_name}
                  </Text>
                  <Text style={[styles.replyingToText, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>
                    {replyingTo.content}
                  </Text>
                </View>
                <Pressable style={styles.cancelReplyButton} onPress={cancelReply}>
                  <Ionicons name="close" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              </View>
            )}
            
            <View style={styles.inputRow}>
              <View style={[styles.textInputContainer, { backgroundColor: Colors[colorScheme].background }]}>
                <Pressable 
                  style={styles.inputIconButton} 
                  onPress={() => setShowAttachmentMenu(true)}
                >
                  <Ionicons name="attach" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
                
                <TextInput
                  ref={textInputRef}
                  style={[styles.messageInput, { color: Colors[colorScheme].text }]}
                  value={newMessage}
                  onChangeText={handleTextChange}
                  placeholder={replyingTo ? `Reply to ${replyingTo.author.display_name}...` : "Type a message..."}
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  multiline
                  maxLength={500}
                  blurOnSubmit={false}
                  returnKeyType="send"
                  onSubmitEditing={sendMessage}
                />
                
                <Pressable 
                  style={styles.inputIconButton}
                  onPress={showImageOptions}
                >
                  <Ionicons name="camera" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              </View>
              
              {newMessage.trim() ? (
                <Pressable 
                  style={[styles.sendButton, { backgroundColor: Colors[colorScheme].tint }]}
                  onPress={sendMessage}
                  disabled={sending}
                >
                  <Ionicons 
                    name={sending ? "hourglass" : "send"} 
                    size={18} 
                    color="#fff"
                  />
                </Pressable>
              ) : (
                <Pressable 
                  style={[styles.micButton, { 
                    backgroundColor: isRecording ? '#EF4444' : Colors[colorScheme].tint 
                  }]}
                  onPress={isRecording ? stopRecording : startRecording}
                  onLongPress={!isRecording ? startRecording : undefined}
                >
                  <Ionicons 
                    name={isRecording ? "stop" : "mic"} 
                    size={18} 
                    color="#fff" 
                  />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {selectedTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          style={styles.membersList}
          contentContainerStyle={styles.membersContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedTab === 'files' && (
        <View style={styles.filesList}>
          {/* Upload Button */}
          <Pressable 
            style={[styles.uploadButton, { borderColor: Colors[colorScheme].border }]}
            onPress={uploadFile}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={Colors[colorScheme].tint} />
            <Text style={[styles.uploadText, { color: Colors[colorScheme].tint }]}>
              Upload File
            </Text>
          </Pressable>

          {files.length > 0 ? (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable 
                  style={[styles.fileItem, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
                  onPress={() => handleFilePress({ uri: item.url, name: item.name, type: item.type })}
                >
                  <View style={[styles.fileIcon, { backgroundColor: getFileColor(item.type) + '20' }]}>
                    <Ionicons 
                      name={getFileIcon(item.type) as any} 
                      size={24} 
                      color={getFileColor(item.type)} 
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: Colors[colorScheme].text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.fileDetails, { color: Colors[colorScheme].mutedText }]}>
                      {item.size} • Uploaded by {item.uploadedBy}
                    </Text>
                    <Text style={[styles.fileDetails, { color: Colors[colorScheme].mutedText }]}>
                      {formatTime(item.uploadedAt)}
                    </Text>
                  </View>
                  <Pressable 
                    style={styles.fileDownloadButton}
                    onPress={() => handleFilePress({ uri: item.url, name: item.name, type: item.type })}
                  >
                    <Ionicons name="download-outline" size={20} color={Colors[colorScheme].tint} />
                  </Pressable>
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.centerContent}>
              <Ionicons name="folder-outline" size={48} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                No files shared yet
              </Text>
              <Text style={[styles.emptySubtext, { color: Colors[colorScheme].mutedText }]}>
                Upload files to share with your team
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* Full Screen Image Viewer */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <Pressable style={styles.imageViewerOverlay} onPress={closeImageViewer} />
          
          <View style={styles.imageViewerContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
            
            <View style={styles.imageViewerActions}>
              <Pressable
                style={[styles.imageActionButton, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={closeImageViewer}
              >
                <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
              </Pressable>
              
              <Pressable
                style={[styles.imageActionButton, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={() => {
                  if (selectedImage) {
                    saveImageToGallery(selectedImage.uri);
                  }
                }}
              >
                <Ionicons name="download" size={24} color={Colors[colorScheme].text} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Attachment Menu */}
      <Modal
        visible={showAttachmentMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAttachmentMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowAttachmentMenu(false)}
        >
          <View style={[styles.customMenu, { backgroundColor: Colors[colorScheme].surface }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: Colors[colorScheme].text }]}>
                Attach File
              </Text>
              <Text style={[styles.menuSubtitle, { color: Colors[colorScheme].mutedText }]}>
                Choose what to attach
              </Text>
            </View>
            
            <View style={styles.menuOptions}>
              <Pressable 
                style={[
                  styles.menuOption, 
                  { 
                    backgroundColor: Colors[colorScheme].background,
                    opacity: isUploadingFile ? 0.6 : 1
                  }
                ]}
                onPress={() => {
                  if (!isUploadingFile) {
                    setShowAttachmentMenu(false);
                    handleFileUpload('media');
                  }
                }}
                disabled={isUploadingFile}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: '#E3F2FD' }]}>
                  {isUploadingFile ? (
                    <Ionicons name="hourglass" size={24} color="#1976D2" />
                  ) : (
                    <Ionicons name="images" size={24} color="#1976D2" />
                  )}
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[styles.menuOptionTitle, { color: Colors[colorScheme].text }]}>
                    Photo & Video
                  </Text>
                  <Text style={[styles.menuOptionSubtitle, { color: Colors[colorScheme].mutedText }]}>
                    {isUploadingFile ? 'Processing...' : 'Share photos and videos'}
                  </Text>
                </View>
              </Pressable>
              
              <Pressable 
                style={[
                  styles.menuOption, 
                  { 
                    backgroundColor: Colors[colorScheme].background,
                    opacity: isUploadingFile ? 0.6 : 1
                  }
                ]}
                onPress={() => {
                  if (!isUploadingFile) {
                    setShowAttachmentMenu(false);
                    handleFileUpload('document');
                  }
                }}
                disabled={isUploadingFile}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: '#F3E5F5' }]}>
                  {isUploadingFile ? (
                    <Ionicons name="hourglass" size={24} color="#7B1FA2" />
                  ) : (
                    <Ionicons name="document-text" size={24} color="#7B1FA2" />
                  )}
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[styles.menuOptionTitle, { color: Colors[colorScheme].text }]}>
                    Document
                  </Text>
                  <Text style={[styles.menuOptionSubtitle, { color: Colors[colorScheme].mutedText }]}>
                    {isUploadingFile ? 'Processing...' : 'Share files and documents'}
                  </Text>
                </View>
              </Pressable>
            </View>
            
            <Pressable 
              style={[styles.menuCancelButton, { backgroundColor: Colors[colorScheme].border }]}
              onPress={() => setShowAttachmentMenu(false)}
            >
              <Text style={[styles.menuCancelText, { color: Colors[colorScheme].text }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Custom Image Options Menu */}
      <Modal
        visible={showImageOptionsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageOptionsMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowImageOptionsMenu(false)}
        >
          <View style={[styles.customMenu, { backgroundColor: Colors[colorScheme].surface }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: Colors[colorScheme].text }]}>
                Add Image
              </Text>
              <Text style={[styles.menuSubtitle, { color: Colors[colorScheme].mutedText }]}>
                Choose how to add your image
              </Text>
            </View>
            
            <View style={styles.menuOptions}>
              <Pressable 
                style={[styles.menuOption, { backgroundColor: Colors[colorScheme].background }]}
                onPress={() => {
                  setShowImageOptionsMenu(false);
                  takePhoto();
                }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: '#E8F5E8' }]}>
                  <Ionicons name="camera" size={24} color="#2E7D32" />
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[styles.menuOptionTitle, { color: Colors[colorScheme].text }]}>
                    Camera
                  </Text>
                  <Text style={[styles.menuOptionSubtitle, { color: Colors[colorScheme].mutedText }]}>
                    Take a new photo
                  </Text>
                </View>
              </Pressable>
              
              <Pressable 
                style={[styles.menuOption, { backgroundColor: Colors[colorScheme].background }]}
                onPress={() => {
                  setShowImageOptionsMenu(false);
                  pickImage();
                }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="images" size={24} color="#F57C00" />
                </View>
                <View style={styles.menuOptionText}>
                  <Text style={[styles.menuOptionTitle, { color: Colors[colorScheme].text }]}>
                    Photo Library
                  </Text>
                  <Text style={[styles.menuOptionSubtitle, { color: Colors[colorScheme].mutedText }]}>
                    Choose from gallery
                  </Text>
                </View>
              </Pressable>
            </View>
            
            <Pressable 
              style={[styles.menuCancelButton, { backgroundColor: Colors[colorScheme].border }]}
              onPress={() => setShowImageOptionsMenu(false)}
            >
              <Text style={[styles.menuCancelText, { color: Colors[colorScheme].text }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View 
          style={[
            styles.toast,
            {
              backgroundColor: toastType === 'success' ? '#4CAF50' : '#F44336',
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons 
            name={toastType === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={20} 
            color="#fff" 
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
      
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  muted: {
    fontSize: 14,
    opacity: 0.7,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    opacity: 0.7,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  currentUserMessage: {
    flexDirection: 'row-reverse',
  },
  announcementMessage: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 16,
    padding: 12,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  messageContent: {
    flex: 1,
    maxWidth: '75%',
  },
  currentUserContent: {
    alignItems: 'flex-end',
  },
  announcementContent: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 12,
    padding: 8,
  },
  messageContentWithoutAvatar: {
    marginLeft: 40,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  authorRole: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  replyContainer: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 6,
    opacity: 0.8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  replyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  announcementIcon: {
    marginRight: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginHorizontal: 4,
  },
  reaction: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  inputContainer: {
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120,
    marginVertical: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  memberStatus: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  lastSeen: {
    fontSize: 11,
    opacity: 0.6,
  },
  filesList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  memberDetails: {
    flex: 1,
    marginLeft: 12,
  },
  messageButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messagesContent: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  membersContent: {
    paddingBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emojiOption: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  emojiText: {
    fontSize: 22,
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  replyingToContent: {
    flex: 1,
  },
  replyingToLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  replyingToText: {
    fontSize: 14,
    lineHeight: 18,
  },
  cancelReplyButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileDownloadButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    opacity: 0.7,
  },
  quickActionsRight: {
    alignSelf: 'flex-end',
  },
  quickActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  messageImage: {
    borderRadius: 12,
    width: 200,
    height: 150,
    minWidth: 150,
    minHeight: 100,
  },
  messageTextWithImage: {
    marginTop: 8,
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
    maxWidth: 400,
    maxHeight: 600,
  },
  imageViewerActions: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  imageActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  statusTime: {
    fontSize: 11,
    opacity: 0.8,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  checkmark1: {
    position: 'absolute',
    left: 0,
  },
  checkmark2: {
    marginLeft: 6,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 16,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  recordingTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  voiceWaveform: {
    flex: 1,
    height: 32,
    position: 'relative',
    justifyContent: 'center',
    marginRight: 8,
  },
  voiceProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 16,
  },
  voiceWaves: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    paddingHorizontal: 4,
  },
  voiceWave: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  // Custom Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  customMenu: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuHeader: {
    padding: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  menuOptions: {
    paddingHorizontal: 16,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuOptionText: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuOptionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  menuCancelButton: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Toast Styles
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
});
