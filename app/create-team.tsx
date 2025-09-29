import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Team, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { Platform } from 'react-native';

export default function CreateTeamScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [season, setSeason] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Tennis', 'Volleyball', 'Swimming', 'Track & Field', 'Other'];
  const seasons = ['Spring 2025', 'Summer 2025', 'Fall 2025', 'Winter 2025/26'];

  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a team logo.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow camera access to take a team logo photo.');
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Team Logo',
      'Choose how to add your team logo',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Take Photo', onPress: takePhoto },
      ]
    );
  };

  const onSubmit = async () => {
    if (!name.trim()) { 
      Alert.alert('Team name required', 'Please enter a team name to continue.');
      return; 
    }
    
    setSubmitting(true);
    try {
      try { 
        await User.me(); 
      } catch { 
        Alert.alert('Sign in required', 'Please sign in to create a team.'); 
        setSubmitting(false); 
        return; 
      }
      
      let logoUrl = null;
      
      // Upload logo if one was selected
      if (logoUri) {
        try {
          const base = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) ||
            (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
          const uploaded = await uploadFile(base, logoUri, 'team-logo.jpg', 'image/jpeg');
          logoUrl = uploaded?.url || uploaded?.path;
          console.log('Logo uploaded:', logoUrl);
        } catch (error) {
          console.error('Logo upload failed:', error);
          Alert.alert('Warning', 'Team created but logo upload failed. You can add a logo later.');
        }
      }
      
      const teamData = {
        name: name.trim(),
        description: description.trim() || undefined,
        sport: sport || undefined,
        season: season || undefined,
        logo_url: logoUrl || undefined, // Use uploaded URL
      };
      
      const team = await Team.create(teamData);
      Alert.alert('Success!', 'Your team has been created successfully.', [
        { text: 'View Team', onPress: () => router.replace(`/team-profile?id=${team.id}`) }
      ]);
    } catch (e: any) {
      console.error('Team creation error:', e);
      Alert.alert('Error', e?.message || 'Failed to create team. Please try again.');
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Create Team', headerShown: false }} />
      
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
          <Pressable 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Create Team</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <LinearGradient colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + 'CC']} style={styles.introIcon}>
            <Ionicons name="people" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.introTitle, { color: Colors[colorScheme].text }]}>
            Start Your Team
          </Text>
          <Text style={[styles.introSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Create a team to organize players, schedule games, and manage your season.
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Team Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
              Team Name <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Ionicons name="trophy-outline" size={20} color={Colors[colorScheme].mutedText} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Springfield Eagles"
                placeholderTextColor={Colors[colorScheme].mutedText}
                style={[styles.textInput, { color: Colors[colorScheme].text }]}
              />
            </View>
          </View>

          {/* Team Logo */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Team Logo</Text>
            <View style={styles.logoSection}>
              <Pressable 
                style={[styles.logoContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
                onPress={showImagePicker}
              >
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImage} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color={Colors[colorScheme].mutedText} />
                    <Text style={[styles.logoPlaceholderText, { color: Colors[colorScheme].mutedText }]}>
                      Add Logo
                    </Text>
                  </>
                )}
              </Pressable>
              <View style={styles.logoActions}>
                <Pressable 
                  style={[styles.logoActionButton, { backgroundColor: Colors[colorScheme].tint }]}
                  onPress={showImagePicker}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.logoActionText}>
                    {logoUri ? 'Change' : 'Add Logo'}
                  </Text>
                </Pressable>
                {logoUri && (
                  <Pressable 
                    style={[styles.logoActionButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => setLogoUri(null)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.logoActionText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
              Upload a square logo (PNG or JPG) for your team. This will be displayed on games and team profiles.
            </Text>
          </View>

          {/* Sport Selection */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
              {sports.map((sportOption) => (
                <Pressable
                  key={sportOption}
                  style={[
                    styles.chipButton,
                    { 
                      backgroundColor: sport === sportOption ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                      borderColor: sport === sportOption ? Colors[colorScheme].tint : Colors[colorScheme].border
                    }
                  ]}
                  onPress={() => setSport(sport === sportOption ? '' : sportOption)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: sport === sportOption ? '#fff' : Colors[colorScheme].text }
                  ]}>
                    {sportOption}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Season Selection */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Season</Text>
            <View style={styles.seasonGrid}>
              {seasons.map((seasonOption) => (
                <Pressable
                  key={seasonOption}
                  style={[
                    styles.seasonButton,
                    { 
                      backgroundColor: season === seasonOption ? Colors[colorScheme].tint + '15' : Colors[colorScheme].surface,
                      borderColor: season === seasonOption ? Colors[colorScheme].tint : Colors[colorScheme].border
                    }
                  ]}
                  onPress={() => setSeason(season === seasonOption ? '' : seasonOption)}
                >
                  <Ionicons 
                    name="calendar-outline" 
                    size={16} 
                    color={season === seasonOption ? Colors[colorScheme].tint : Colors[colorScheme].mutedText} 
                  />
                  <Text style={[
                    styles.seasonButtonText,
                    { color: season === seasonOption ? Colors[colorScheme].tint : Colors[colorScheme].text }
                  ]}>
                    {seasonOption}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Description</Text>
            <View style={[styles.textAreaContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell players what this team is about..."
                placeholderTextColor={Colors[colorScheme].mutedText}
                style={[styles.textArea, { color: Colors[colorScheme].text }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {/* Create Button */}
        <View style={styles.actionSection}>
          <Pressable
            style={[
              styles.createButton,
              { 
                backgroundColor: submitting ? Colors[colorScheme].mutedText : Colors[colorScheme].tint,
                opacity: submitting ? 0.6 : 1
              }
            ]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#fff" />
            )}
            <Text style={styles.createButtonText}>
              {submitting ? 'Creating Team...' : 'Create Team'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  // Intro Card
  introCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Form
  formSection: {
    paddingHorizontal: 16,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  // Sport chips
  chipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Season grid
  seasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minWidth: '47%',
  },
  seasonButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Description
  textAreaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 100,
  },
  textArea: {
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  // Action
  actionSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Logo styles
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  logoPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  logoActions: {
    flex: 1,
    gap: 8,
  },
  logoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  logoActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
