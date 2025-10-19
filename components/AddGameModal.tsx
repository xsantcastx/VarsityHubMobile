import AppearancePicker, { AppearancePreset } from '@/components/AppearancePicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
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
import MatchBanner from '../app/components/MatchBanner';
import { Team } from '../src/api/entities';
import ImageEditor from './ImageEditor';

interface AddGameModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (gameData: GameFormData) => void;
  currentTeamName?: string;
}

export interface GameFormData {
  currentTeam: string;
  opponent: string;
  date: Date;
  time: Date;
  location: string;
  type: 'home' | 'away' | 'neutral';
  notes?: string;
  banner_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  autoGeocode?: boolean;
  attendance?: number | null;
}

type TeamOption = {
  id: string;
  name: string;
  logo?: string;
};

export default function AddGameModal({ visible, onClose, onSave, currentTeamName }: AddGameModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  // Team state
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [showCurrentTeamPicker, setShowCurrentTeamPicker] = useState(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [opponentSearchQuery, setOpponentSearchQuery] = useState('');
  const [currentTeamSearchQuery, setCurrentTeamSearchQuery] = useState('');
  
  const [formData, setFormData] = useState<GameFormData>({
    currentTeam: currentTeamName || 'My Team', // Use prop or default
    opponent: '',
    date: new Date(),
    time: new Date(),
    location: '',
    type: 'home',
    notes: '',
    autoGeocode: true, // Auto-geocode by default
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [appearance, setAppearance] = useState<AppearancePreset>('classic');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingImageUri, setEditingImageUri] = useState<string | null>(null);

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
      
      // Add some default teams if none exist
      if (teamOptions.length === 0) {
        teamOptions.push(
          { id: 'my-team', name: 'My Team' },
          { id: 'varsity-team', name: 'Varsity Team' },
          { id: 'home-team', name: 'Home Team' }
        );
      }
      
      setTeams(teamOptions);
    } catch (error) {
      console.error('Error loading teams:', error);
      // Add default teams on error
      setTeams([
        { id: 'my-team', name: 'My Team' },
        { id: 'varsity-team', name: 'Varsity Team' },
        { id: 'home-team', name: 'Home Team' }
      ]);
    } finally {
      setLoadingTeams(false);
    }
  };

  // Filter teams based on search query
  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(opponentSearchQuery.toLowerCase())
  );

  const filteredCurrentTeams = teams.filter(team =>
    team.name.toLowerCase().includes(currentTeamSearchQuery.toLowerCase())
  );

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.currentTeam.trim()) {
      newErrors.currentTeam = 'Current team name is required';
    }
    
    if (!formData.opponent.trim()) {
      newErrors.opponent = 'Opponent name is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (formData.date < new Date(new Date().setHours(0, 0, 0, 0))) {
      newErrors.date = 'Game date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    const payload = { ...formData, appearance } as any;
    onSave(payload);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setFormData({
      currentTeam: currentTeamName || 'My Team',
      opponent: '',
      date: new Date(),
      time: new Date(),
      location: '',
      type: 'home',
      notes: '',
      autoGeocode: true,
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setFormData(prev => ({ ...prev, time: selectedTime }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
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
          
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Add Game</Text>
          
          <Pressable style={styles.headerButton} onPress={handleSave}>
            <Text style={[styles.headerButtonText, { color: Colors[colorScheme].tint }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            
            {/* Current Team */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Current Team *</Text>
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
                <Text style={[{ color: formData.currentTeam ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                  {formData.currentTeam || 'Select your team'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
              {errors.currentTeam && <Text style={styles.errorText}>{errors.currentTeam}</Text>}
            </View>

            {/* Opponent */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Opponent *</Text>
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
                <Text style={[{ color: formData.opponent ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                  {formData.opponent || 'Select opponent team'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
              {errors.opponent && <Text style={styles.errorText}>{errors.opponent}</Text>}
            </View>

            {/* Game Type */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Game Type</Text>
              <View style={styles.gameTypeContainer}>
                {(['home', 'away', 'neutral'] as const).map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.gameTypeButton,
                      {
                        backgroundColor: formData.type === type ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                        borderColor: formData.type === type ? Colors[colorScheme].tint : Colors[colorScheme].border,
                      }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, type }))}
                  >
                    <Text style={[
                      styles.gameTypeText,
                      { color: formData.type === type ? '#fff' : Colors[colorScheme].text }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Date and Time */}
            <View style={styles.formRow}>
              <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date *</Text>
                <Pressable
                  style={[styles.input, styles.dateTimeInput, { 
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: errors.date ? '#EF4444' : Colors[colorScheme].border,
                  }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                    {formatDate(formData.date)}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
                {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
              </View>

              <View style={[styles.formSection, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Time</Text>
                <Pressable
                  style={[styles.input, styles.dateTimeInput, { 
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.dateTimeText, { color: Colors[colorScheme].text }]}>
                    {formatTime(formData.time)}
                  </Text>
                  <Ionicons name="time-outline" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              </View>
            </View>

            {/* Location */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: errors.location ? '#EF4444' : Colors[colorScheme].border,
                  color: Colors[colorScheme].text
                }]}
                placeholder="Enter game location/venue"
                placeholderTextColor={Colors[colorScheme].mutedText}
                value={formData.location}
                onChangeText={(text) => {
                  setFormData(prev => ({ ...prev, location: text }));
                  if (errors.location) {
                    setErrors(prev => ({ ...prev, location: '' }));
                  }
                }}
              />
              {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
              
              {/* Auto-geocode toggle */}
              <View style={[styles.geocodeOption, { marginTop: 12 }]}>
                <Pressable
                  style={styles.geocodeToggle}
                  onPress={() => setFormData(prev => ({ ...prev, autoGeocode: !prev.autoGeocode }))}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: Colors[colorScheme].border },
                    formData.autoGeocode && { backgroundColor: Colors[colorScheme].tint, borderColor: Colors[colorScheme].tint }
                  ]}>
                    {formData.autoGeocode && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.geocodeLabel, { color: Colors[colorScheme].text }]}>
                      📍 Auto-find coordinates
                    </Text>
                    <Text style={[styles.geocodeHelp, { color: Colors[colorScheme].mutedText }]}>
                      Automatically add map coordinates using Google Maps
                    </Text>
                  </View>
                </Pressable>
              </View>
              
              {/* Manual coordinates (only show if auto-geocode is off) */}
              {!formData.autoGeocode && (
                <View style={styles.manualCoords}>
                  <Text style={[styles.geocodeHelp, { color: Colors[colorScheme].mutedText, marginBottom: 8 }]}>
                    Or enter coordinates manually:
                  </Text>
                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.label, { fontSize: 14, color: Colors[colorScheme].text }]}>Latitude</Text>
                      <TextInput
                        style={[styles.input, { 
                          backgroundColor: Colors[colorScheme].surface,
                          borderColor: Colors[colorScheme].border,
                          color: Colors[colorScheme].text
                        }]}
                        placeholder="40.7505"
                        placeholderTextColor={Colors[colorScheme].mutedText}
                        keyboardType="decimal-pad"
                        value={formData.latitude?.toString() || ''}
                        onChangeText={(text) => {
                          const num = parseFloat(text);
                          setFormData(prev => ({ ...prev, latitude: isNaN(num) ? null : num }));
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.label, { fontSize: 14, color: Colors[colorScheme].text }]}>Longitude</Text>
                      <TextInput
                        style={[styles.input, { 
                          backgroundColor: Colors[colorScheme].surface,
                          borderColor: Colors[colorScheme].border,
                          color: Colors[colorScheme].text
                        }]}
                        placeholder="-73.9934"
                        placeholderTextColor={Colors[colorScheme].mutedText}
                        keyboardType="decimal-pad"
                        value={formData.longitude?.toString() || ''}
                        onChangeText={(text) => {
                          const num = parseFloat(text);
                          setFormData(prev => ({ ...prev, longitude: isNaN(num) ? null : num }));
                        }}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { 
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                  color: Colors[colorScheme].text
                }]}
                placeholder="Optional notes about the game"
                placeholderTextColor={Colors[colorScheme].mutedText}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Attendance */}
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Attendance</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                  color: Colors[colorScheme].text
                }]}
                placeholder="Number of attendees (optional)"
                placeholderTextColor={Colors[colorScheme].mutedText}
                keyboardType="number-pad"
                value={formData.attendance?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  setFormData(prev => ({ ...prev, attendance: text === '' ? null : (isNaN(num) ? null : num) }));
                }}
              />
            </View>

            {/* Preview card */}
            <View style={[styles.previewCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.previewTitle, { color: Colors[colorScheme].text }]}>Game Preview</Text>
              <MatchBanner
                leftImage={(teams.find(t => t.name.toLowerCase() === String(formData.currentTeam).toLowerCase()) as any)?.logo}
                rightImage={(teams.find(t => t.name.toLowerCase() === String(formData.opponent).toLowerCase()) as any)?.logo}
                leftName={formData.currentTeam}
                rightName={formData.opponent}
                height={140}
                variant="compact"
                appearance={appearance}
              />
              <Pressable style={{ marginTop: 8, alignSelf: 'flex-end' }} onPress={() => {
                // Open editor with current preview (if team logos exist, we can't easily compose — open with left logo or null)
                const leftLogo = (teams.find(t => t.name.toLowerCase() === String(formData.currentTeam).toLowerCase()) as any)?.logo;
                setEditingImageUri(leftLogo || null);
                setEditorVisible(true);
              }}>
                <Text style={{ color: Colors[colorScheme].tint, fontWeight: '700' }}>Edit Preview</Text>
              </Pressable>
            </View>

            {/* Appearance picker */}
            <View style={styles.formSection}>
              <AppearancePicker value={appearance} onChange={setAppearance} />
            </View>

          </View>
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={formData.time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
      </View>
    </Modal>

    <ImageEditor visible={editorVisible} imageUri={editingImageUri} onClose={() => setEditorVisible(false)} onSave={async (uri) => {
      setEditorVisible(false);
      // Upload edited image and set as cover or banner in formData
      try {
        const base = (typeof process !== 'undefined' && process.env && (process.env.EXPO_PUBLIC_API_URL as any)) || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
        const uploaded = await (await import('@/api/upload')).uploadFile(base, uri, 'edited-banner.png', 'image/png');
        const url = uploaded?.url || uploaded?.path || null;
        if (url) {
          setFormData(prev => ({ ...prev, banner_url: url }));
        }
      } catch (e) {
        console.warn('Upload edited image failed', e);
      }
    }} />

    {/* Current Team Picker Modal */}
    <Modal
      visible={showCurrentTeamPicker}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowCurrentTeamPicker(false);
        setCurrentTeamSearchQuery('');
      }}
    >
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => {
              setShowCurrentTeamPicker(false);
              setCurrentTeamSearchQuery('');
            }}>
              <Text style={[styles.pickerHeaderButton, { color: Colors[colorScheme].text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>Select Your Team</Text>
            <View style={{ width: 50 }} />
          </View>
          
          {/* Search Input */}
          <View style={[styles.searchContainer, { borderBottomColor: Colors[colorScheme].border }]}>
            <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme].text }]}
              placeholder="Search teams..."
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={currentTeamSearchQuery}
              onChangeText={setCurrentTeamSearchQuery}
              autoFocus
            />
            {currentTeamSearchQuery.length > 0 && (
              <Pressable onPress={() => setCurrentTeamSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
            )}
          </View>
          
          <ScrollView style={styles.pickerList}>
            {filteredCurrentTeams.map((team) => (
              <Pressable
                key={team.id}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: Colors[colorScheme].border },
                  formData.currentTeam === team.name && { backgroundColor: Colors[colorScheme].surface }
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, currentTeam: team.name }));
                  if (errors.currentTeam) {
                    setErrors(prev => ({ ...prev, currentTeam: '' }));
                  }
                  setShowCurrentTeamPicker(false);
                  setCurrentTeamSearchQuery('');
                }}
              >
                <View style={styles.pickerItemContent}>
                  {team.logo && (
                    <View style={styles.teamLogoContainer}>
                      <Text style={styles.teamLogoText}>🏆</Text>
                    </View>
                  )}
                  <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                    {team.name}
                  </Text>
                </View>
                {formData.currentTeam === team.name && (
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
        setOpponentSearchQuery('');
      }}
    >
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => {
              setShowOpponentPicker(false);
              setOpponentSearchQuery('');
            }}>
              <Text style={[styles.pickerHeaderButton, { color: Colors[colorScheme].text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: Colors[colorScheme].text }]}>Select Opponent</Text>
            <View style={{ width: 50 }} />
          </View>
          
          {/* Search Input */}
          <View style={[styles.searchContainer, { borderBottomColor: Colors[colorScheme].border }]}>
            <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme].text }]}
              placeholder="Search or type opponent name..."
              placeholderTextColor={Colors[colorScheme].mutedText}
              value={opponentSearchQuery}
              onChangeText={setOpponentSearchQuery}
              autoFocus
            />
            {opponentSearchQuery.length > 0 && (
              <Pressable onPress={() => setOpponentSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors[colorScheme].mutedText} />
              </Pressable>
            )}
          </View>
          
          <ScrollView style={styles.pickerList}>
            {/* Allow manual entry if search query doesn't match any team */}
            {opponentSearchQuery.length > 0 && !filteredTeams.some(t => t.name.toLowerCase() === opponentSearchQuery.toLowerCase()) && (
              <Pressable
                style={[
                  styles.pickerItem,
                  { borderBottomColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].surface }
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, opponent: opponentSearchQuery }));
                  if (errors.opponent) {
                    setErrors(prev => ({ ...prev, opponent: '' }));
                  }
                  setShowOpponentPicker(false);
                  setOpponentSearchQuery('');
                }}
              >
                <View style={styles.pickerItemContent}>
                  <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                  <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text, marginLeft: 8 }]}>
                    Use "{opponentSearchQuery}"
                  </Text>
                </View>
              </Pressable>
            )}
            
            {filteredTeams.map((team) => (
              <Pressable
                key={team.id}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: Colors[colorScheme].border },
                  formData.opponent === team.name && { backgroundColor: Colors[colorScheme].surface }
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, opponent: team.name }));
                  if (errors.opponent) {
                    setErrors(prev => ({ ...prev, opponent: '' }));
                  }
                  setShowOpponentPicker(false);
                  setOpponentSearchQuery('');
                }}
              >
                <View style={styles.pickerItemContent}>
                  {team.logo && (
                    <View style={styles.teamLogoContainer}>
                      <Text style={styles.teamLogoText}>🏆</Text>
                    </View>
                  )}
                  <Text style={[styles.pickerItemText, { color: Colors[colorScheme].text }]}>
                    {team.name}
                  </Text>
                </View>
                {formData.opponent === team.name && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </Pressable>
            ))}
            
            {filteredTeams.length === 0 && opponentSearchQuery.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                  No teams found. Start typing to add a custom opponent.
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
  scrollContainer: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
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
  dateTimeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notesInput: {
    height: 80,
    paddingTop: 14,
  },
  gameTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  gameTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  gameTypeText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    marginVertical: 8,
    backgroundColor: '#f3f4f6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 0,
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
  geocodeOption: {
    marginTop: 8,
  },
  geocodeToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geocodeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  geocodeHelp: {
    fontSize: 13,
    marginTop: 2,
  },
  manualCoords: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
});