import { uploadFile } from '@/api/upload';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import MatchBanner from '../app/components/MatchBanner';
import { Team } from '../src/api/entities';
import AppearancePicker, { AppearancePreset } from './AppearancePicker';
import ImageEditor from './ImageEditor';

interface QuickAddGameModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (gameData: QuickGameData) => void;
  currentTeamName?: string; // Optional current team context
  initialData?: {
    id?: string;
    opponent: string;
    date: string;
    time: string;
    type: 'home' | 'away';
    banner_url?: string;
    appearance?: string;
  };
}

export interface QuickGameData {
  id?: string; // Add id for editing
  currentTeam: string;
  opponent: string;
  date: string; // Will be today + some days
  time: string; // Selected time
  type: 'home' | 'away';
  banner_url?: string; // Add banner URL support
  cover_image_url?: string; // Add cover image URL support
  appearance?: string; // Add appearance support
}

type TeamOption = {
  id: string;
  name: string;
  logo?: string;
};

export default function QuickAddGameModal({ visible, onClose, onSave, currentTeamName, initialData }: QuickAddGameModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  // Team state
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [showCurrentTeamPicker, setShowCurrentTeamPicker] = useState(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  
  const [currentTeam, setCurrentTeam] = useState(currentTeamName || 'My Team');
  const [opponent, setOpponent] = useState('');
  const [opponentSearchText, setOpponentSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default to next week
  const [selectedTime, setSelectedTime] = useState(new Date(new Date().setHours(19, 0, 0, 0))); // Default to 7:00 PM
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [gameType, setGameType] = useState<'home' | 'away'>('home');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const viewShotRef = useRef<any>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [editingImageUri, setEditingImageUri] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [uploadingCustomBanner, setUploadingCustomBanner] = useState(false);
  const [appearance, setAppearance] = useState<AppearancePreset>('classic');

  // Update current team when prop changes
  useEffect(() => {
    if (currentTeamName) {
      setCurrentTeam(currentTeamName);
    }
  }, [currentTeamName]);

  // Populate form when editing (initialData provided)
  useEffect(() => {
    if (initialData && visible) {
      setOpponent(initialData.opponent || '');
      setGameType(initialData.type || 'home');
      setBannerUrl(initialData.banner_url || null);
      setAppearance((initialData.appearance as AppearancePreset) || 'classic');
      
      // Parse date
      if (initialData.date) {
        const dateParts = initialData.date.split('/');
        if (dateParts.length === 3) {
          const [month, day, year] = dateParts;
          setSelectedDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
        }
      }
      
      // Parse time
      if (initialData.time) {
        const timeMatch = initialData.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const period = timeMatch[3].toUpperCase();
          
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          const timeDate = new Date();
          timeDate.setHours(hours, minutes, 0, 0);
          setSelectedTime(timeDate);
        }
      }
    } else if (!visible) {
      // Reset form when modal closes
      setOpponent('');
      setGameType('home');
      setBannerUrl(null);
      setAppearance('classic');
      setSelectedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setSelectedTime(new Date(new Date().setHours(19, 0, 0, 0)));
      setErrors({});
    }
  }, [initialData, visible]);

  // Load teams when modal opens
  useEffect(() => {
    if (visible && teams.length === 0) {
      loadTeams();
    }
  }, [visible]);

  const loadTeams = async () => {
    try {
      setLoadingTeams(true);
      const teamsData = await Team.list();
      const teamOptions: TeamOption[] = teamsData.map((team: any) => ({
        id: team.id,
        name: team.name,
        logo: team.logo_url || team.avatar_url,
      }));
      
      console.log('Loaded teams:', teamOptions.map(t => ({ name: t.name, hasLogo: !!t.logo })));
      
      // Add some default teams if none exist
      if (teamOptions.length === 0) {
        console.log('No teams found, adding defaults with sample logos');
        teamOptions.push(
          { id: 'my-team', name: currentTeamName || 'My Team', logo: 'https://via.placeholder.com/100/FF0000/FFFFFF?text=MT' },
          { id: 'varsity-team', name: 'Varsity Team', logo: 'https://via.placeholder.com/100/0000FF/FFFFFF?text=VT' },
          { id: 'home-team', name: 'Home Team', logo: 'https://via.placeholder.com/100/00FF00/FFFFFF?text=HT' },
          { id: 'eagles', name: 'Eagles', logo: 'https://via.placeholder.com/100/FFA500/FFFFFF?text=E' },
          { id: 'warriors', name: 'Warriors', logo: 'https://via.placeholder.com/100/800080/FFFFFF?text=W' },
          { id: 'lions', name: 'Lions', logo: 'https://via.placeholder.com/100/FFD700/000000?text=L' },
          { id: 'tigers', name: 'Tigers', logo: 'https://via.placeholder.com/100/FF8C00/FFFFFF?text=T' },
          { id: 'bulldogs', name: 'Bulldogs', logo: 'https://via.placeholder.com/100/8B4513/FFFFFF?text=B' },
        );
      }
      
      setTeams(teamOptions);
    } catch (error) {
      console.error('Error loading teams:', error);
      // Add default teams on error
      setTeams([
        { id: 'my-team', name: currentTeamName || 'My Team' },
        { id: 'varsity-team', name: 'Varsity Team' },
        { id: 'home-team', name: 'Home Team' },
        { id: 'eagles', name: 'Eagles' },
        { id: 'warriors', name: 'Warriors' },
        { id: 'lions', name: 'Lions' },
        { id: 'tigers', name: 'Tigers' },
        { id: 'bulldogs', name: 'Bulldogs' },
      ]);
    } finally {
      setLoadingTeams(false);
    }
  };

  // Filter teams for opponent selection (exclude current team and filter by search)
  const getFilteredOpponentTeams = () => {
    return teams
      .filter(team => team.name !== currentTeam) // Don't show current team as opponent
      .filter(team => 
        opponentSearchText === '' || 
        team.name.toLowerCase().includes(opponentSearchText.toLowerCase())
      );
  };

  // Get team logo by team name
  const getTeamLogo = (teamName: string) => {
    const team = teams.find(t => t.name === teamName);
    return team?.logo || null;
  };

  // Get the home and away teams based on game type
  const getHomeAwayTeams = () => {
    if (gameType === 'home') {
      return { homeTeam: currentTeam, awayTeam: opponent };
    } else {
      return { homeTeam: opponent, awayTeam: currentTeam };
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!currentTeam.trim()) {
      newErrors.currentTeam = 'Current team name is required';
    }
    
    if (!opponent.trim()) {
      newErrors.opponent = 'Opponent name is required';
    }
    
    if (selectedDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      newErrors.date = 'Game date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    
    const baseGameData: QuickGameData = {
      id: initialData?.id, // Include id when editing
      currentTeam: currentTeam.trim(),
      opponent: opponent.trim(),
      date: selectedDate.toISOString().split('T')[0],
      time: selectedTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      type: gameType,
    };

    // If we already have a banner uploaded, include it. Otherwise attempt to capture & upload.
    const doSave = async () => {
      let finalData: QuickGameData = { 
        ...baseGameData,
        appearance: appearance,
      };
      
      // Priority: custom uploaded banner > auto-generated banner
      if (bannerUrl) {
        // User has uploaded a custom banner, use it directly
        finalData.banner_url = bannerUrl;
        finalData.cover_image_url = bannerUrl; // Also set cover_image_url to the same value
      } else if (getHomeAwayTeams().homeTeam && getHomeAwayTeams().awayTeam) {
        // No custom banner, try to capture the auto-generated preview and upload
        if (viewShotRef.current) {
          try {
            setUploadingBanner(true);
            const uri = await captureRef(viewShotRef, { format: 'png', quality: 0.9 });
            const base = (typeof process !== 'undefined' && process.env && (process.env.EXPO_PUBLIC_API_URL as any)) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
            const uploaded = await uploadFile(base, uri, 'match-banner.png', 'image/png');
            const url = uploaded?.url || uploaded?.path || null;
            if (url) {
              finalData.banner_url = url;
              finalData.cover_image_url = url; // Also set cover_image_url to the same value
            }
          } catch (e) {
            console.warn('Banner capture/upload failed, continuing without banner', e);
          } finally {
            setUploadingBanner(false);
          }
        }
      }

      console.log('About to call onSave with finalData:', finalData);
      onSave(finalData);
      resetForm();
      onClose();
    };

    // run save (async allowed)
    void doSave();
  };

  const resetForm = () => {
    setCurrentTeam(currentTeamName || 'My Team');
    setOpponent('');
    setOpponentSearchText('');
    setSelectedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setSelectedTime(new Date(new Date().setHours(19, 0, 0, 0)));
    setGameType('home');
    setErrors({});
    setBannerUrl(null);
    setEditingImageUri(null);
    setUploadingCustomBanner(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickCustomBanner = async () => {
    try {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (result.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a banner.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
        exif: false,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        await uploadCustomBanner(pickerResult.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takeCustomBannerPhoto = async () => {
    try {
      const result = await ImagePicker.requestCameraPermissionsAsync();
      if (result.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera access to take a banner photo.');
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
        exif: false,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        await uploadCustomBanner(pickerResult.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadCustomBanner = async (uri: string) => {
    setUploadingCustomBanner(true);
    try {
      // Use the production Railway API URL directly
      const base = 'https://api-production-8ac3.up.railway.app';
      
      const uploaded = await uploadFile(base, uri, 'custom-banner.jpg', 'image/jpeg');
      
      const url = uploaded?.url || uploaded?.path;
      
      if (url) {
        setBannerUrl(url);
      } else {
        throw new Error('Upload failed - no URL returned');
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Failed to upload banner. Please try again.');
    } finally {
      setUploadingCustomBanner(false);
    }
  };

  const showCustomBannerOptions = () => {
    Alert.alert(
      'Upload Custom Banner',
      'Choose how you want to add your game banner',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: pickCustomBanner },
        { text: 'Take Photo', onPress: takeCustomBannerPhoto },
      ]
    );
  };

  const removeCustomBanner = () => {
    Alert.alert(
      'Remove Custom Banner',
      'This will remove your custom banner and use the auto-generated one instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setBannerUrl(null) },
      ]
    );
  };

  const formatPreviewDate = () => {
    if (!selectedDate) return '';
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: Colors[colorScheme].background,
          borderBottomColor: Colors[colorScheme].border,
          paddingTop: insets.top 
        }]}>
          <Pressable style={styles.headerButton} onPress={handleClose}>
            <Text style={[styles.headerButtonText, { color: Colors[colorScheme].text }]}>Cancel</Text>
          </Pressable>
          
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>
            {initialData ? 'Edit Game' : 'Quick Add Game'}
          </Text>
          
          <Pressable style={styles.headerButton} onPress={handleSave}>
            <Text style={[styles.headerButtonText, { color: Colors[colorScheme].tint }]}>
              {initialData ? 'Save' : 'Add'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.helpCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <Ionicons name="flash-outline" size={20} color={Colors[colorScheme].tint} />
            <Text style={[styles.helpText, { color: Colors[colorScheme].mutedText }]}>
              Quick add with smart defaults. For more options, use Manual Entry.
            </Text>
          </View>

          {/* Current Team */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Your Team</Text>
            <Pressable
              style={[styles.input, { 
                backgroundColor: Colors[colorScheme].surface,
                borderColor: errors.currentTeam ? '#EF4444' : Colors[colorScheme].border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }]}
              onPress={() => setShowCurrentTeamPicker(true)}
            >
              <Text style={[{ color: currentTeam ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                {currentTeam || 'Select your team'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
            {errors.currentTeam && <Text style={styles.errorText}>{errors.currentTeam}</Text>}
          </View>

          {/* Opponent Team */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Opponent Team</Text>
            <Pressable
              style={[styles.input, { 
                backgroundColor: Colors[colorScheme].surface,
                borderColor: errors.opponent ? '#EF4444' : Colors[colorScheme].border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }]}
              onPress={() => setShowOpponentPicker(true)}
            >
              <Text style={[{ color: opponent ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                {opponent || 'Select opponent team'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
            {errors.opponent && <Text style={styles.errorText}>{errors.opponent}</Text>}
          </View>

          {/* Date and Time Selection */}
          <View style={{ flexDirection: 'row', marginBottom: 24 }}>
            <View style={[styles.formSection, { flex: 1, marginRight: 8, marginBottom: 0 }]}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Game Date</Text>
              <Pressable
                style={[styles.input, { 
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: errors.date ? '#EF4444' : Colors[colorScheme].border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[{ color: Colors[colorScheme].text }]}>
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            <View style={[styles.formSection, { flex: 1, marginLeft: 8, marginBottom: 0 }]}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Game Time</Text>
              <Pressable
                style={[styles.input, { 
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={[{ color: Colors[colorScheme].text }]}>
                  {selectedTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
                <Ionicons name="time-outline" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
            </View>
          </View>

          {/* Game Type */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Game Type</Text>
            <View style={styles.gameTypeContainer}>
              <Pressable
                style={[
                  styles.gameTypeButton,
                  {
                    backgroundColor: gameType === 'home' ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                    borderColor: gameType === 'home' ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  }
                ]}
                onPress={() => setGameType('home')}
              >
                <Ionicons 
                  name="home-outline" 
                  size={16} 
                  color={gameType === 'home' ? '#fff' : Colors[colorScheme].text} 
                />
                <Text style={[
                  styles.gameTypeText,
                  { color: gameType === 'home' ? '#fff' : Colors[colorScheme].text }
                ]}>
                  Home Game
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.gameTypeButton,
                  {
                    backgroundColor: gameType === 'away' ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                    borderColor: gameType === 'away' ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  }
                ]}
                onPress={() => setGameType('away')}
              >
                <Ionicons 
                  name="airplane-outline" 
                  size={16} 
                  color={gameType === 'away' ? '#fff' : Colors[colorScheme].text} 
                />
                <Text style={[
                  styles.gameTypeText,
                  { color: gameType === 'away' ? '#fff' : Colors[colorScheme].text }
                ]}>
                  Away Game
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Enhanced Game Preview */}
          {currentTeam.trim() && opponent.trim() && !errors.currentTeam && !errors.opponent && !errors.date && (
            <View style={[styles.previewCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.previewTitle, { color: Colors[colorScheme].text }]}>Game Preview</Text>
              
              {/* Custom Banner Upload Section */}
              <View style={styles.bannerUploadSection}>
                <Text style={[styles.bannerUploadLabel, { color: Colors[colorScheme].text }]}>Game Banner</Text>
                
                {bannerUrl ? (
                  // Show custom uploaded banner
                  <View style={styles.customBannerContainer}>
                    <Image source={{ uri: bannerUrl }} style={styles.customBannerImage} />
                    <View style={styles.customBannerActions}>
                      <Pressable 
                        style={[styles.bannerActionButton, { backgroundColor: Colors[colorScheme].tint }]}
                        onPress={showCustomBannerOptions}
                        disabled={uploadingCustomBanner}
                      >
                        <Ionicons name="camera-outline" size={16} color="#fff" />
                        <Text style={styles.bannerActionText}>
                          {uploadingCustomBanner ? 'Uploading...' : 'Change'}
                        </Text>
                      </Pressable>
                      <Pressable 
                        style={[styles.bannerActionButton, { backgroundColor: '#EF4444' }]}
                        onPress={removeCustomBanner}
                        disabled={uploadingCustomBanner}
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                        <Text style={styles.bannerActionText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  // Show auto-generated banner with upload option
                  <View>
                    <View style={styles.matchupContainer}>
                      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ width: '100%' }}>
                        {/* Render MatchBanner so appearance and images are visible in the preview */}
                        <MatchBanner
                          leftImage={getTeamLogo(getHomeAwayTeams().homeTeam) || undefined}
                          rightImage={getTeamLogo(getHomeAwayTeams().awayTeam) || undefined}
                          leftName={getHomeAwayTeams().homeTeam}
                          rightName={getHomeAwayTeams().awayTeam}
                          height={120}
                          variant="compact"
                          leftColor={(teams.find(t => t.name === getHomeAwayTeams().homeTeam) as any)?.color}
                          rightColor={(teams.find(t => t.name === getHomeAwayTeams().awayTeam) as any)?.color}
                          appearance={appearance}
                        />
                      </ViewShot>
                    </View>
                    
                    <View style={styles.bannerOptionsRow}>
                      <Pressable 
                        style={[styles.bannerOptionButton, { backgroundColor: Colors[colorScheme].tint }]}
                        onPress={showCustomBannerOptions}
                        disabled={uploadingCustomBanner}
                      >
                        <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                        <Text style={styles.bannerOptionText}>
                          {uploadingCustomBanner ? 'Uploading...' : 'Upload Custom'}
                        </Text>
                      </Pressable>
                      
                      <Pressable 
                        style={[styles.bannerOptionButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors[colorScheme].tint }]}
                        onPress={() => {
                          // Open editor with the current captured banner (if already uploaded use that, else capture)
                          const openEditorWithCurrent = async () => {
                            if (bannerUrl) {
                              setEditingImageUri(bannerUrl);
                              setEditorVisible(true);
                              return;
                            }
                            if (viewShotRef.current) {
                              try {
                                const uri = await captureRef(viewShotRef, { format: 'png', quality: 0.9 });
                                setEditingImageUri(uri as any);
                                setEditorVisible(true);
                              } catch (e) {
                                console.warn('Capture failed', e);
                              }
                            }
                          };
                          void openEditorWithCurrent();
                        }}
                      >
                        <Ionicons name="brush-outline" size={16} color={Colors[colorScheme].tint} />
                        <Text style={[styles.bannerOptionText, { color: Colors[colorScheme].tint }]}>Edit Generated</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {/* Game Details */}
              <View style={[styles.gameDetails, { borderTopColor: Colors[colorScheme].border }]}>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>
                    {gameType === 'home' ? 'Home Stadium' : 'Away Venue'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.detailText, { color: Colors[colorScheme].mutedText }]}>
                    {gameType === 'home' ? 'Home Game' : 'Away Game'}
                  </Text>
                </View>
              </View>
              {/* Appearance Picker (coach choices) - only applies to auto-generated banners */}
              {!bannerUrl && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.bannerUploadLabel, { color: Colors[colorScheme].mutedText, fontSize: 12 }]}>
                    Auto-Generated Banner Style
                  </Text>
                  <AppearancePicker value={appearance} onChange={setAppearance} />
                </View>
              )}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) {
                setSelectedDate(date);
                if (errors.date) {
                  setErrors(prev => ({ ...prev, date: '' }));
                }
              }
            }}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, time) => {
              setShowTimePicker(false);
              if (time) {
                setSelectedTime(time);
              }
            }}
          />
        )}
      </View>
    </Modal>

    <ImageEditor visible={editorVisible} imageUri={editingImageUri} onClose={() => setEditorVisible(false)} onSave={async (uri) => {
      // upload edited image and set as bannerUrl
      setEditorVisible(false);
      setUploadingBanner(true);
      try {
        const base = (typeof process !== 'undefined' && process.env && (process.env.EXPO_PUBLIC_API_URL as any)) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
        const uploaded = await uploadFile(base, uri, 'edited-banner.png', 'image/png');
        const url = uploaded?.url || uploaded?.path || null;
        if (url) setBannerUrl(url);
      } catch (e) {
        console.warn('Upload edited image failed', e);
      } finally {
        setUploadingBanner(false);
      }
    }} />

    {/* Current Team Picker Modal */}
    <Modal
      visible={showCurrentTeamPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCurrentTeamPicker(false)}
    >
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowCurrentTeamPicker(false)}>
              <Text style={[styles.pickerHeaderButton, { color: Colors[colorScheme].text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>Select Your Team</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.pickerList}>
            {teams.map((team) => (
              <Pressable
                key={team.id}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: Colors[colorScheme].border },
                  currentTeam === team.name && { backgroundColor: Colors[colorScheme].surface }
                ]}
                onPress={() => {
                  setCurrentTeam(team.name);
                  if (errors.currentTeam) {
                    setErrors(prev => ({ ...prev, currentTeam: '' }));
                  }
                  setShowCurrentTeamPicker(false);
                }}
              >
                <View style={styles.pickerItemContent}>
                  <View style={styles.teamLogoContainer}>
                    {team.logo ? (
                      <Image 
                        source={{ uri: team.logo }} 
                        style={styles.teamLogoImage}
                      />
                    ) : (
                      <Text style={styles.teamLogoText}>🏆</Text>
                    )}
                  </View>
                  <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                    {team.name}
                  </Text>
                </View>
                {currentTeam === team.name && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Opponent Team Picker Modal */}
    <Modal
      visible={showOpponentPicker}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowOpponentPicker(false);
        setOpponentSearchText('');
      }}
    >
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => {
              setShowOpponentPicker(false);
              setOpponentSearchText('');
            }}>
              <Text style={[styles.pickerHeaderButton, { color: Colors[colorScheme].text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>Select Opponent</Text>
            <View style={{ width: 50 }} />
          </View>
          
          {/* Search Bar */}
          <View style={[styles.searchContainer, { borderBottomColor: Colors[colorScheme].border }]}>
            <Ionicons name="search-outline" size={20} color={Colors[colorScheme].mutedText} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme].text }]}
              placeholder="Search teams..."
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={opponentSearchText}
              onChangeText={setOpponentSearchText}
              autoCapitalize="words"
            />
            {opponentSearchText.length > 0 && (
              <Pressable onPress={() => setOpponentSearchText('')}>
                <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
            )}
          </View>
          
          <ScrollView style={styles.pickerList}>
            {getFilteredOpponentTeams().map((team) => (
              <Pressable
                key={team.id}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: Colors[colorScheme].border },
                  opponent === team.name && { backgroundColor: Colors[colorScheme].surface }
                ]}
                onPress={() => {
                  setOpponent(team.name);
                  if (errors.opponent) {
                    setErrors(prev => ({ ...prev, opponent: '' }));
                  }
                  setOpponentSearchText('');
                  setShowOpponentPicker(false);
                }}
              >
                <View style={styles.pickerItemContent}>
                  <View style={styles.teamLogoContainer}>
                    {team.logo ? (
                      <Image 
                        source={{ uri: team.logo }} 
                        style={styles.teamLogoImage}
                      />
                    ) : (
                      <Text style={styles.teamLogoText}>🏆</Text>
                    )}
                  </View>
                  <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                    {team.name}
                  </Text>
                </View>
                {opponent === team.name && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </Pressable>
            ))}
            {getFilteredOpponentTeams().length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={[styles.noResultsText, { color: Colors[colorScheme].mutedText }]}>
                  No teams found matching "{opponentSearchText}"
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    gap: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  gameTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  gameTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  gameTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  previewCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  previewSummary: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewLocation: {
    fontSize: 13,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerHeaderButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamLogoContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teamLogoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 8,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  // Enhanced preview styles
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  teamLogoPlaceholder: {
    fontSize: 24,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  vsDivider: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  vsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  gameInfo: {
    fontSize: 12,
    textAlign: 'center',
  },
  gameTime: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  gameDetails: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bannerUploadSection: {
    marginBottom: 16,
  },
  bannerUploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  customBannerContainer: {
    position: 'relative',
  },
  customBannerImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  customBannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  bannerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  bannerActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  bannerOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  bannerOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});