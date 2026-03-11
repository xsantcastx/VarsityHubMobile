import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
// @ts-ignore
import { Game, Team as TeamAPI, User } from '@/api/entities';
import { autocompleteLocations, PlaceSuggestion } from '@/api/geocoding';
import { httpGet } from '@/api/http';

const EVENT_TYPES = [
  { value: 'game', label: 'Game/Match', emoji: '🏈' },
  { value: 'watch_party', label: 'Watch Party', emoji: '📺' },
  { value: 'fundraiser', label: 'Fundraiser', emoji: '💰' },
  { value: 'team_meeting', label: 'Pep Rally', emoji: '📣' },
  { value: 'bbq', label: 'BBQ/Social', emoji: '🍔' },
  { value: 'team_meal', label: 'Team Meal', emoji: '🍽️' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export default function CreateFanEventScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  // Detect user role to differentiate Pitch Event (fan) vs Create Event (coach)
  const [userRole, setUserRole] = useState<string>('fan');
  useEffect(() => {
    User.me()
      .then((u: any) => {
        const role = u?.preferences?.role || 'fan';
        setUserRole(role);
        // Fans can't create game events — default to watch_party
        if (role !== 'coach') {
          setEventType('watch_party');
        }
      })
      .catch(() => {
        setEventType('watch_party');
      });
  }, []);
  const isCoach = userRole === 'coach';

  // Load followed teams
  const [rawTeams, setRawTeams] = useState<any[]>([]);
  const [_teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    const loadFollowedTeams = async () => {
      try {
        setTeamsLoading(true);
        const teams = await httpGet('/follows/teams?user_id=me');
        setRawTeams(Array.isArray(teams) ? teams : []);
      } catch (error: any) {
        if (__DEV__) console.warn('[CreateFanEvent] Failed to load followed teams:', error);
        setRawTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    };
    void loadFollowedTeams();
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('game');
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [locationQuerying, setLocationQuerying] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [date, setDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Game-specific fields (coach only)
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [opponentSuggestions, setOpponentSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const [opponentSearching, setOpponentSearching] = useState(false);
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameType, setGameType] = useState<'home' | 'away'>('home');
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const teams = useMemo(() => {
    if (!Array.isArray(rawTeams) || rawTeams.length === 0) return [];
    return rawTeams.map((team: any) => ({
      id: String(team.id),
      name: team.name || 'Unknown Team',
      logo: (team.logo_url || team.avatar_url || undefined) as string | undefined,
      venue_address: (team.venue_address || null) as string | null,
    }));
  }, [rawTeams]);

  // Google Maps location autocomplete
  const requestLocationSuggestions = useCallback((text: string) => {
    if (locationTimerRef.current) {
      clearTimeout(locationTimerRef.current);
      locationTimerRef.current = null;
    }

    if (text.length < 3) {
      setLocationSuggestions([]);
      setLocationQuerying(false);
      return;
    }

    setLocationQuerying(true);
    locationTimerRef.current = setTimeout(async () => {
      try {
        const suggestions = await autocompleteLocations(text, 6);
        setLocationSuggestions(suggestions);
      } catch (error) {
        if (__DEV__) console.warn('Location autocomplete failed:', error);
        setLocationSuggestions([]);
      } finally {
        setLocationQuerying(false);
      }
    }, 300);
  }, []);

  const handleLocationChange = useCallback((text: string) => {
    setLocation(text);
    setLocationTouched(true);
    setSelectedPlace(null);
    setErrors(prev => ({ ...prev, location: '' }));

    if (text.length >= 3) {
      requestLocationSuggestions(text);
    } else {
      setLocationSuggestions([]);
    }
  }, [requestLocationSuggestions]);

  const handleSelectLocation = useCallback((suggestion: PlaceSuggestion) => {
    setLocation(suggestion.description);
    setSelectedPlace(suggestion);
    setLocationSuggestions([]);
    setLocationQuerying(false);
    setLocationTouched(true);
    setErrors(prev => ({ ...prev, location: '' }));
  }, []);

  useEffect(() => {
    return () => {
      if (locationTimerRef.current) {
        clearTimeout(locationTimerRef.current);
      }
    };
  }, []);

  // Pre-fill venue when Home Game is selected and a team with a saved venue is chosen
  useEffect(() => {
    if (!selectedTeamId || eventType !== 'game') return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (gameType === 'home' && team?.venue_address) {
      if (!locationTouched) {
        setLocation(team.venue_address);
        setSelectedPlace(null);
      }
    } else if (gameType === 'away') {
      if (!locationTouched) {
        setLocation('');
        setSelectedPlace(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes locationTouched to avoid resetting location on every touch state change
  }, [gameType, selectedTeamId, teams, eventType]);

  // Opponent team search
  const handleOpponentChange = useCallback((text: string) => {
    setOpponent(text);
    setErrors(prev => ({ ...prev, opponent: '' }));
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    if (text.trim().length < 2) {
      setOpponentSuggestions([]);
      setOpponentSearching(false);
      return;
    }
    setOpponentSearching(true);
    opponentTimerRef.current = setTimeout(async () => {
      try {
        const results = await TeamAPI.list(text.trim(), false, { limit: 6 });
        const list = Array.isArray(results) ? results : (Array.isArray(results?.items) ? results.items : []);
        setOpponentSuggestions(list.map((t: any) => ({ id: String(t.id), name: String(t.name || '') })));
      } catch {
        setOpponentSuggestions([]);
      } finally {
        setOpponentSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => { if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current); };
  }, []);

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (isCoach && eventType === 'game') {
      if (!selectedTeam.trim()) {
        newErrors.selectedTeam = 'Team is required';
      }
      if (!opponent.trim()) {
        newErrors.opponent = 'Opponent is required';
      }
    } else {
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
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const gameDateTime = new Date(date);

      if (isCoach && eventType === 'game') {
        // Coach creating a game event — include team IDs
        const homeTeamName = gameType === 'home' ? selectedTeam : opponent;
        const awayTeamName = gameType === 'home' ? opponent : selectedTeam;

        const gamePayload: Record<string, any> = {
          title: `${homeTeamName} vs ${awayTeamName}`,
          date: gameDateTime.toISOString(),
          location: selectedPlace?.description || location,
          venue_address: selectedPlace?.description || location,
          venue_place_id: selectedPlace?.place_id,
          description: description || undefined,
          event_type: 'game',
        };

        gamePayload.home_team = homeTeamName;
        gamePayload.away_team = awayTeamName;

        if (gameType === 'home' && selectedTeamId) {
          gamePayload.home_team_id = selectedTeamId;
        } else if (gameType === 'away' && selectedTeamId) {
          gamePayload.away_team_id = selectedTeamId;
        }

        await Game.create(gamePayload);
      } else {
        // Non-game event or fan pitch
        const eventData: Record<string, any> = {
          title,
          description,
          event_type: eventType,
          location: selectedPlace?.description || location,
          venue_address: selectedPlace?.description || location,
          venue_place_id: selectedPlace?.place_id,
          date: gameDateTime.toISOString(),
        };

        await Game.create(eventData);
      }

      Alert.alert(
        isCoach ? 'Event Created!' : 'Event Pitched!',
        isCoach
          ? 'Your event has been submitted for review.'
          : 'Your event idea has been submitted! A coach or admin will review it and you\'ll be notified.',
        [{ text: 'OK', onPress: () => { if (router.canGoBack()) router.back(); } }]
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
        const detailedError = errorMessage || e?.data?.message || e?.message || 'Failed to create event. Please try again.';
        if (__DEV__) console.error('[CreateFanEvent] Create event error:', {
          error: e,
          errorMessage,
          errorCode,
          eventType,
        });
        Alert.alert('Error', detailedError);
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

  const isGameEvent = isCoach && eventType === 'game';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: isCoach ? 'Create Event' : 'Pitch Event',
          headerShown: true,
          headerBackTitle: 'Back',
          headerBackVisible: true,
        }}
      />

      <KeyboardAwareScreen style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            {isCoach ? 'Create Event' : 'Pitch an Event'}
          </Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            {isCoach
              ? 'Create a game, watch party, fundraiser, or other team event'
              : 'Suggest a community event — watch parties, fundraisers, socials, and more. A coach or admin will review your idea.'}
          </Text>
        </View>

        {/* Event Type */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Event Type *</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => {
              // Fans cannot create game events — only coaches can
              if (!isCoach && type.value === 'game') return null;
              return (
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
                      setOpponent('');
                    }
                  }}
                >
                  <Text style={styles.typeEmoji}>{type.emoji}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      { color: eventType === type.value ? Colors[colorScheme].tint : Colors[colorScheme].text }
                    ]}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Title — always required for fans, required for non-game coach events */}
        {(!isCoach || !isGameEvent) && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>
              {isCoach ? 'Event Title *' : 'Event Name *'}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.title ? '#DC2626' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              placeholder={isCoach ? 'e.g., Varsity Football Watch Party' : 'e.g., Homecoming Tailgate Party'}
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={title}
              onChangeText={setTitle}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>
        )}

        {/* Team — single dropdown from followed teams (coach game events only) */}
        {isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Team *</Text>
            <Pressable
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.selectedTeam ? '#DC2626' : Colors[colorScheme].border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
              onPress={() => setShowTeamPicker(true)}
            >
              <Text style={[{ color: selectedTeam ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                {selectedTeam || 'Select a team'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color={Colors[colorScheme].mutedText} />
            </Pressable>
            {errors.selectedTeam && <Text style={styles.errorText}>{errors.selectedTeam}</Text>}
          </View>
        )}

        {/* Opponent — autocomplete from database with manual fallback */}
        {isGameEvent && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Opponent *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.opponent ? '#DC2626' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              placeholder="Search for a team or type a name"
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={opponent}
              onChangeText={handleOpponentChange}
              autoCapitalize="words"
            />
            {opponentSearching && (
              <ActivityIndicator size="small" style={{ position: 'absolute', right: 28, top: 44 }} color={Colors[colorScheme].mutedText} />
            )}
            {opponentSuggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                {opponentSuggestions.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.suggestionItem, { borderBottomColor: Colors[colorScheme].border }]}
                    onPress={() => {
                      setOpponent(t.name);
                      setOpponentSuggestions([]);
                      setErrors(prev => ({ ...prev, opponent: '' }));
                    }}
                  >
                    <MaterialIcons name="group" size={16} color={Colors[colorScheme].mutedText} />
                    <Text style={[styles.suggestionText, { color: Colors[colorScheme].text }]}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {errors.opponent && <Text style={styles.errorText}>{errors.opponent}</Text>}
          </View>
        )}

        {/* Game Type (Home/Away) — coach game events only */}
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
                onPress={() => { setGameType('home'); setLocationTouched(false); }}
              >
                <MaterialIcons name="home" size={20} color={gameType === 'home' ? '#fff' : Colors[colorScheme].text} />
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
                onPress={() => { setGameType('away'); setLocationTouched(false); }}
              >
                <MaterialIcons name="flight" size={20} color={gameType === 'away' ? '#fff' : Colors[colorScheme].text} />
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

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>
            {isCoach ? 'Description' : 'Tell us about your idea'}
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text,
              },
            ]}
            placeholder={isCoach ? 'Describe your event...' : 'What\'s the event about? Who should come? Any details a reviewer should know?'}
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
              <MaterialIcons name="event" size={20} color={Colors[colorScheme].mutedText} />
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
              <MaterialIcons name="access-time" size={20} color={Colors[colorScheme].mutedText} />
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

        {/* Location with Google Maps Autocomplete */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
          <View style={styles.locationFieldWrapper}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: errors.location ? '#DC2626' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              placeholder="Start typing an address, venue, or city"
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={location}
              onChangeText={handleLocationChange}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {locationQuerying && (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={styles.locationSpinner} />
            )}
            {locationSuggestions.length > 0 && (
              <View style={[styles.locationSuggestionList, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                {locationSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion.place_id}
                    style={[
                      styles.locationSuggestionItem,
                      { borderBottomColor: Colors[colorScheme].border },
                      index === locationSuggestions.length - 1 && styles.locationSuggestionItemLast,
                    ]}
                    onPress={() => handleSelectLocation(suggestion)}
                  >
                    <MaterialIcons name="location-on" size={16} color={Colors[colorScheme].tint} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.locationSuggestionMain, { color: Colors[colorScheme].text }]}>
                        {suggestion.structured_formatting?.main_text || suggestion.description}
                      </Text>
                      {suggestion.structured_formatting?.secondary_text && (
                        <Text style={[styles.locationSuggestionSecondary, { color: Colors[colorScheme].mutedText }]}>
                          {suggestion.structured_formatting.secondary_text}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
          {!selectedPlace && locationTouched && location.length >= 3 && locationSuggestions.length === 0 && !locationQuerying && (
            <Text style={[styles.inputHelperText, { color: Colors[colorScheme].mutedText }]}>
              Tip: Select a suggested location for better accuracy, or continue typing to enter manually
            </Text>
          )}
        </View>

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <MaterialIcons name="info" size={20} color={Colors[colorScheme].tint} />
          <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>
            {isCoach
              ? 'Your event will be reviewed before appearing publicly.'
              : 'Event pitches are reviewed by coaches or admins. You\'ll be notified once it\'s approved.'}
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
            <Text style={styles.submitButtonText}>
              {isCoach ? 'Create Event' : 'Submit Pitch'}
            </Text>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </KeyboardAwareScreen>

      {/* Team Picker Modal — single dropdown of followed teams */}
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
              <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>Select Team</Text>
              <View style={{ width: 50 }} />
            </View>
            <ScrollView style={styles.pickerList}>
              {teams.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsText, { color: Colors[colorScheme].mutedText }]}>
                    No followed teams found. Follow a team first.
                  </Text>
                </View>
              )}
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: Colors[colorScheme].border },
                    selectedTeam === team.name && { backgroundColor: Colors[colorScheme].surface }
                  ]}
                  onPress={() => {
                    setSelectedTeam(team.name);
                    setSelectedTeamId(team.id);
                    setShowTeamPicker(false);
                    setLocationTouched(false);
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
                  {selectedTeam === team.name && (
                    <MaterialIcons name="check" size={20} color={Colors[colorScheme].tint} />
                  )}
                </Pressable>
              ))}
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
  typeEmoji: {
    fontSize: 28,
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
  locationFieldWrapper: {
    position: 'relative',
  },
  locationSpinner: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  locationSuggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationSuggestionItemLast: {
    borderBottomWidth: 0,
  },
  locationSuggestionMain: {
    fontSize: 15,
    fontWeight: '500',
  },
  locationSuggestionSecondary: {
    fontSize: 13,
    marginTop: 2,
  },
  inputHelperText: {
    fontSize: 12,
    marginTop: 4,
  },
  suggestionsBox: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
