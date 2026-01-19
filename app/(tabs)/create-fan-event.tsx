import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTeamOptions } from '@/hooks/useTeamOptions';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
import { Game } from '@/api/entities';

const EVENT_TYPES = [
  { value: 'game', label: 'Game/Match', icon: 'trophy' },
  { value: 'watch_party', label: 'Watch Party', icon: 'tv' },
  { value: 'fundraiser', label: 'Fundraiser', icon: 'cash' },
  { value: 'team_meeting', label: 'Pep Rally', icon: 'people' },
  { value: 'bbq', label: 'BBQ/Social', icon: 'restaurant' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function CreateFanEventScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { teams: rawTeams } = useTeamOptions(true);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('game'); // Default to game
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Default to next week
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Game-specific fields
  const [currentTeam, setCurrentTeam] = useState('My Team');
  const [currentTeamId, setCurrentTeamId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [opponentTeamId, setOpponentTeamId] = useState('');
  const [gameType, setGameType] = useState<'home' | 'away'>('home');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [opponentSearchText, setOpponentSearchText] = useState('');
  const [showManualOpponentInput, setShowManualOpponentInput] = useState(false);
  const [manualOpponentName, setManualOpponentName] = useState('');
  
  const teams = useMemo(() => {
    if (!Array.isArray(rawTeams) || rawTeams.length === 0) {
      return [{ id: 'my-team', name: 'My Team' }];
    }
    return rawTeams.map((team: any) => ({
      id: String(team.id),
      name: team.name,
      logo: team.logo_url || team.avatar_url,
    }));
  }, [rawTeams]);
  
  const getFilteredOpponentTeams = () => {
    return teams
      .filter(team => team.name !== currentTeam)
      .filter(team => 
        opponentSearchText === '' || 
        team.name.toLowerCase().includes(opponentSearchText.toLowerCase())
      );
  };
  
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (eventType === 'game') {
      // Games require team and opponent
      if (!currentTeam.trim()) {
        newErrors.currentTeam = 'Your team is required';
      }
      if (!opponent.trim()) {
        newErrors.opponent = 'Opponent team is required';
      }
    } else {
      // Other events require title
      if (!title.trim()) {
        newErrors.title = 'Event title is required';
      }
    }
    
    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (date < new Date()) {
      newErrors.date = 'Event date cannot be in the past';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Parse date and time to create ISO datetime
      const gameDateTime = new Date(date);
      
      if (eventType === 'game') {
        // Create game with opponent
        const homeTeamId = gameType === 'home' ? currentTeamId : opponentTeamId;
        const awayTeamId = gameType === 'home' ? opponentTeamId : currentTeamId;
        
        const gamePayload: Record<string, any> = {
          title: `${gameType === 'home' ? currentTeam : opponent} vs ${gameType === 'home' ? opponent : currentTeam}`,
          date: gameDateTime.toISOString(),
          location,
          description: description || undefined,
          event_type: 'game',
        };
        
        // Add team fields
        gamePayload.home_team = gameType === 'home' ? currentTeam : opponent;
        gamePayload.away_team = gameType === 'home' ? opponent : currentTeam;
        
        if (homeTeamId) gamePayload.home_team_id = homeTeamId;
        if (awayTeamId) {
          gamePayload.away_team_id = awayTeamId;
        } else if (gameType === 'home' ? opponent : currentTeam) {
          gamePayload.away_team_name = gameType === 'home' ? opponent : currentTeam;
        }
        
        await Game.create(gamePayload);
      } else {
        // Create regular event (non-game)
        const eventData = {
          title,
          description,
          event_type: eventType,
          location,
          date: gameDateTime.toISOString(),
        };
        
        // Use Game.create for consistency (it handles both games and events)
        await Game.create(eventData);
      }
      
      Alert.alert(
        'Event Submitted!',
        'Your event has been submitted for approval. You\'ll be notified when it\'s reviewed.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      const errorCode = e?.code || e?.data?.code;
      const errorMessage = e?.message || e?.data?.message;
      
      if (errorCode === 'EVENT_LIMIT_EXCEEDED') {
        Alert.alert(
          'Event Limit Reached',
          errorMessage || "You've reached your limit of 3 pending events. Upgrade to create more.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/billing') },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage || 'Failed to create event. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };
  
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setDate(newDate);
      if (Platform.OS === 'ios') {
        setShowTimePicker(false);
      }
    }
  };
  
  const isGameEvent = eventType === 'game';
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Create Event', headerShown: true }} />
      
      <KeyboardAwareScreen style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Create Community Event
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            Share local sports events, watch parties, fundraisers, and more with your community
          </Text>
        </View>
        
        {/* Event Type */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Type *</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeButton,
                  { 
                    backgroundColor: Colors[colorScheme].card,
                    borderColor: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  },
                  eventType === type.value && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setEventType(type.value);
                  if (type.value !== 'game') {
                    // Reset game-specific fields
                    setOpponent('');
                    setOpponentTeamId('');
                  }
                }}
              >
                <Ionicons 
                  name={type.icon as any} 
                  size={24} 
                  color={eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text} 
                />
                <Text 
                  style={[
                    styles.typeLabel, 
                    { color: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text }
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* Game-specific fields: Your Team */}
        {isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Your Team *</Text>
            <Pressable
              style={[
                styles.input,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.currentTeam ? '#DC2626' : Colors[colorScheme].border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
              onPress={() => setShowTeamPicker(true)}
            >
              <Text style={[{ color: currentTeam ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                {currentTeam}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
            {errors.currentTeam && <Text style={styles.errorText}>{errors.currentTeam}</Text>}
          </View>
        )}
        
        {/* Game-specific fields: Opponent */}
        {isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Opponent Team *</Text>
            <Pressable
              style={[
                styles.input,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.opponent ? '#DC2626' : Colors[colorScheme].border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
              onPress={() => setShowOpponentPicker(true)}
            >
              <Text style={[{ color: opponent ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                {opponent || 'Select opponent team'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
            {errors.opponent && <Text style={styles.errorText}>{errors.opponent}</Text>}
          </View>
        )}
        
        {/* Game Type (Home/Away) - Only for games */}
        {isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Game Type</Text>
            <View style={styles.gameTypeRow}>
              <Pressable
                style={[
                  styles.gameTypeButton,
                  {
                    backgroundColor: gameType === 'home' ? Colors[colorScheme].tint : Colors[colorScheme].card,
                    borderColor: gameType === 'home' ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  }
                ]}
                onPress={() => setGameType('home')}
              >
                <Ionicons name="home" size={20} color={gameType === 'home' ? '#fff' : Colors[colorScheme].text} />
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
                    backgroundColor: gameType === 'away' ? Colors[colorScheme].tint : Colors[colorScheme].card,
                    borderColor: gameType === 'away' ? Colors[colorScheme].tint : Colors[colorScheme].border,
                  }
                ]}
                onPress={() => setGameType('away')}
              >
                <Ionicons name="airplane" size={20} color={gameType === 'away' ? '#fff' : Colors[colorScheme].text} />
                <Text style={[
                  styles.gameTypeText,
                  { color: gameType === 'away' ? '#fff' : Colors[colorScheme].text }
                ]}>
                  Away Game
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        
        {/* Title - Only for non-game events */}
        {!isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Title *</Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.title ? '#DC2626' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              placeholder="e.g., Varsity Football Watch Party"
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={title}
              onChangeText={setTitle}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>
        )}
        
        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Description</Text>
          <TextInput
            style={[
              styles.textArea,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="Describe your event..."
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        
        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <Pressable
              style={[
                styles.dateTimeButton,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.date ? '#DC2626' : Colors[colorScheme].border,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                {date.toLocaleDateString()}
              </Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.dateTimeButton,
                { 
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
          {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
        </View>
        
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        
        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
        
        {/* Location */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: errors.location ? '#DC2626' : Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder="e.g., Campus Pub, Stamford CT"
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={location}
            onChangeText={setLocation}
          />
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>
        
        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="information-circle" size={20} color={Colors[colorScheme].tint} />
          <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>
            Fan-submitted events will be reviewed by coaches or admins before appearing publicly.
          </Text>
        </View>
        
        {/* Submit Button */}
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: Colors[colorScheme].tint },
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </Pressable>
        
        <View style={{ height: 40 }} />
      </KeyboardAwareScreen>
      
      {/* Team Picker Modal */}
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setShowTeamPicker(false)}>
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
                    setCurrentTeamId(team.id);
                    setShowTeamPicker(false);
                  }}
                >
                  <View style={styles.pickerItemContent}>
                    {team.logo && (
                      <Image source={{ uri: team.logo }} style={styles.teamLogo} />
                    )}
                    <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                      {team.name}
                    </Text>
                  </View>
                  {currentTeam === team.name && (
                    <Ionicons name="checkmark" size={20} color={Colors[colorScheme].tint} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Opponent Picker Modal */}
      <Modal
        visible={showOpponentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowOpponentPicker(false);
          setOpponentSearchText('');
          setShowManualOpponentInput(false);
          setManualOpponentName('');
        }}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => {
                setShowOpponentPicker(false);
                setOpponentSearchText('');
                setShowManualOpponentInput(false);
                setManualOpponentName('');
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
              {showManualOpponentInput ? (
                <View style={[styles.manualInputContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, margin: 16 }]}>
                  <Text style={[styles.manualInputLabel, { color: Colors[colorScheme].text }]}>Enter Opponent Team Name</Text>
                  <TextInput
                    style={[styles.manualInput, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                    placeholder="Team name"
                    placeholderTextColor={Colors[colorScheme].mutedText}
                    value={manualOpponentName || opponentSearchText}
                    onChangeText={(text) => {
                      setManualOpponentName(text);
                      setOpponentSearchText(text);
                    }}
                    autoCapitalize="words"
                    autoFocus
                  />
                  <View style={styles.manualInputActions}>
                    <Pressable
                      style={[styles.manualInputButton, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
                      onPress={() => {
                        setShowManualOpponentInput(false);
                        setManualOpponentName('');
                      }}
                    >
                      <Text style={[styles.manualInputButtonText, { color: Colors[colorScheme].text }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.manualInputButton, { backgroundColor: Colors[colorScheme].tint }]}
                      onPress={() => {
                        const finalName = (manualOpponentName || opponentSearchText).trim();
                        if (finalName) {
                          setOpponent(finalName);
                          setOpponentTeamId(''); // No team ID for manual entry
                          setOpponentSearchText('');
                          setShowManualOpponentInput(false);
                          setManualOpponentName('');
                          setShowOpponentPicker(false);
                        }
                      }}
                    >
                      <Text style={styles.manualInputButtonText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
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
                        setOpponentTeamId(team.id);
                        setOpponentSearchText('');
                        setShowOpponentPicker(false);
                        setShowManualOpponentInput(false);
                      }}
                    >
                      <View style={styles.pickerItemContent}>
                        {team.logo && (
                          <Image source={{ uri: team.logo }} style={styles.teamLogo} />
                        )}
                        <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                          {team.name}
                        </Text>
                      </View>
                      {opponent === team.name && (
                        <Ionicons name="checkmark" size={20} color={Colors[colorScheme].tint} />
                      )}
                    </Pressable>
                  ))}
                  {getFilteredOpponentTeams().length === 0 && opponentSearchText.length > 0 && (
                    <Pressable
                      style={[styles.pickerItem, { borderBottomColor: Colors[colorScheme].border }]}
                      onPress={() => {
                        setManualOpponentName(opponentSearchText);
                        setShowManualOpponentInput(true);
                      }}
                    >
                      <View style={styles.pickerItemContent}>
                        <Ionicons name="add-circle-outline" size={20} color={Colors[colorScheme].tint} />
                        <Text style={[styles.pickerItemText, { color: Colors[colorScheme].tint }]}>
                          Add "{opponentSearchText}" as opponent
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                    </Pressable>
                  )}
                  {getFilteredOpponentTeams().length === 0 && opponentSearchText.length === 0 && (
                    <View style={styles.noResultsContainer}>
                      <Text style={[styles.noResultsText, { color: Colors[colorScheme].mutedText }]}>
                        Search for a team or add manually
                      </Text>
                      <Pressable
                        style={[styles.pickerItem, { borderBottomColor: Colors[colorScheme].border, marginTop: 16 }]}
                        onPress={() => {
                          setShowManualOpponentInput(true);
                        }}
                      >
                        <View style={styles.pickerItemContent}>
                          <Ionicons name="add-circle-outline" size={20} color={Colors[colorScheme].tint} />
                          <Text style={[styles.pickerItemText, { color: Colors[colorScheme].tint }]}>
                            Add Opponent Manually
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  typeButtonActive: {
    borderWidth: 2,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateTimeText: {
    fontSize: 16,
    flex: 1,
  },
  gameTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gameTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  gameTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerHeaderButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  pickerItemText: {
    fontSize: 16,
  },
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  manualEntryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  manualInputContainer: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  manualInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  manualInputActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  manualInputButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  manualInputButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
