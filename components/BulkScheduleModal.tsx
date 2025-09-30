import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
// @ts-ignore
import { Team as TeamAPI } from '@/api/entities';

interface BulkGameData {
  opponent: string;
  date: string;
  time: string;
  location: string;
  type: 'home' | 'away' | 'neutral';
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface BulkScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (games: BulkGameData[]) => Promise<void>;
  currentTeamName: string;
  currentTeamId: string;
}

export default function BulkScheduleModal({
  visible,
  onClose,
  onSave,
  currentTeamName,
  currentTeamId,
}: BulkScheduleModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<{type: string, gameIndex?: number} | null>(null);
  const [games, setGames] = useState<BulkGameData[]>([
    {
      opponent: '',
      date: '',
      time: '7:00 PM',
      location: '',
      type: 'home',
    },
  ]);

  const [templateSettings, setTemplateSettings] = useState({
    useTemplate: false,
    defaultTime: '7:00 PM',
    defaultLocation: 'Home Stadium',
    alternateHomeAway: true,
  });

  const handleAddGame = () => {
    const newGame: BulkGameData = {
      opponent: '',
      date: '',
      time: templateSettings.defaultTime,
      location: templateSettings.defaultLocation,
      type: templateSettings.alternateHomeAway 
        ? (games.length % 2 === 0 ? 'home' : 'away')
        : 'home',
    };
    setGames([...games, newGame]);
  };

  const handleRemoveGame = (index: number) => {
    if (games.length > 1) {
      setGames(games.filter((_, i) => i !== index));
    }
  };

  const handleGameChange = (index: number, field: keyof BulkGameData, value: string | 'home' | 'away' | 'neutral') => {
    const updatedGames = games.map((game, i) =>
      i === index ? { ...game, [field]: value } : game
    );
    setGames(updatedGames);
  };

  // Load available teams (excluding current team)
  useEffect(() => {
    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        const teamList = await TeamAPI.list();
        const allTeams = Array.isArray(teamList) ? teamList : [];
        // Filter out current team from opponents
        const availableOpponents = allTeams.filter(team => team.id !== currentTeamId);
        setTeams(availableOpponents);
      } catch (error) {
        console.error('Failed to load teams:', error);
        // Fallback to hardcoded teams if API fails (excluding current team)
        const fallbackTeams = [
          { id: '1', name: 'Eagles' },
          { id: '2', name: 'Warriors' },
          { id: '3', name: 'Lightning' },
          { id: '4', name: 'Thunder' },
          { id: '5', name: 'Rockets' },
          { id: '6', name: 'Titans' },
          { id: '7', name: 'Phoenix' },
          { id: '8', name: 'Wildcats' },
        ].filter(team => team.id !== currentTeamId);
        setTeams(fallbackTeams);
      } finally {
        setLoadingTeams(false);
      }
    };

    if (visible) {
      loadTeams();
    }
  }, [visible, currentTeamId]);

  const generateTemplate = () => {
    const availableTeams = teams.length > 0 ? teams : [
      { id: '1', name: 'Eagles' },
      { id: '2', name: 'Warriors' },
      { id: '3', name: 'Lightning' },
      { id: '4', name: 'Thunder' },
      { id: '5', name: 'Rockets' },
      { id: '6', name: 'Titans' },
      { id: '7', name: 'Phoenix' },
      { id: '8', name: 'Wildcats' },
    ].filter(team => team.id !== currentTeamId);
    
    const startDate = new Date();
    const templateGames: BulkGameData[] = [];
    
    for (let i = 0; i < Math.min(8, availableTeams.length); i++) {
      const gameDate = new Date(startDate);
      gameDate.setDate(startDate.getDate() + (i * 7)); // Weekly games
      
      templateGames.push({
        opponent: availableTeams[i].name,
        date: gameDate.toISOString().split('T')[0],
        time: templateSettings.defaultTime,
        location: templateSettings.alternateHomeAway && i % 2 === 1 
          ? 'Away Venue' 
          : templateSettings.defaultLocation,
        type: templateSettings.alternateHomeAway && i % 2 === 1 ? 'away' : 'home',
      });
    }
    
    setGames(templateGames);
  };

  const handleSave = async () => {
    // Validate games
    const validGames = games.filter(game => 
      game.opponent.trim() && game.date && game.time && game.location.trim()
    );
    
    if (validGames.length === 0) {
      Alert.alert('Error', 'Please add at least one valid game with all fields filled.');
      return;
    }

    setLoading(true);
    try {
      await onSave(validGames);
      onClose();
      // Reset form
      setGames([{
        opponent: '',
        date: '',
        time: '7:00 PM',
        location: '',
        type: 'home',
      }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = [
    '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
    '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1 }} onTouchStart={() => setActiveDropdown(null)}>
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Bulk Schedule
          </Text>
          <Pressable 
            onPress={handleSave} 
            disabled={loading}
            style={[styles.saveButton, { backgroundColor: Colors[colorScheme].tint }]}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Creating...' : 'Create All'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Template Settings */}
          <View style={[styles.section, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              Template Settings
            </Text>
            
            <View style={styles.templateRow}>
              <Text style={[styles.templateLabel, { color: Colors[colorScheme].text }]}>
                Use Template
              </Text>
              <Switch
                value={templateSettings.useTemplate}
                onValueChange={(value) => setTemplateSettings(prev => ({ ...prev, useTemplate: value }))}
                trackColor={{ false: Colors[colorScheme].border, true: Colors[colorScheme].tint }}
              />
            </View>

            {templateSettings.useTemplate && (
              <>
                <View style={styles.templateRow}>
                  <Text style={[styles.templateLabel, { color: Colors[colorScheme].text }]}>
                    Default Time
                  </Text>
                  <Pressable 
                    style={[styles.templateSelect, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => {
                      Alert.alert(
                        'Select Default Time',
                        '',
                        timeOptions.map(time => ({
                          text: time,
                          onPress: () => setTemplateSettings(prev => ({ ...prev, defaultTime: time }))
                        }))
                      );
                    }}
                  >
                    <Text style={[styles.templateSelectText, { color: Colors[colorScheme].text }]}>
                      {templateSettings.defaultTime}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].mutedText} />
                  </Pressable>
                </View>

                <View style={styles.templateRow}>
                  <Text style={[styles.templateLabel, { color: Colors[colorScheme].text }]}>
                    Default Location
                  </Text>
                  <TextInput
                    value={templateSettings.defaultLocation}
                    onChangeText={(value) => setTemplateSettings(prev => ({ ...prev, defaultLocation: value }))}
                    style={[styles.templateInput, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                    placeholder="Home Stadium"
                    placeholderTextColor={Colors[colorScheme].mutedText}
                  />
                </View>

                <View style={styles.templateRow}>
                  <Text style={[styles.templateLabel, { color: Colors[colorScheme].text }]}>
                    Alternate Home/Away
                  </Text>
                  <Switch
                    value={templateSettings.alternateHomeAway}
                    onValueChange={(value) => setTemplateSettings(prev => ({ ...prev, alternateHomeAway: value }))}
                    trackColor={{ false: Colors[colorScheme].border, true: Colors[colorScheme].tint }}
                  />
                </View>

                <Pressable 
                  style={[styles.generateButton, { backgroundColor: Colors[colorScheme].tint }]}
                  onPress={generateTemplate}
                >
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate 8-Game Template</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Games List */}
          <View style={[styles.section, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Games ({games.length})
              </Text>
              <Pressable onPress={handleAddGame} style={styles.addButton}>
                <Ionicons name="add" size={20} color={Colors[colorScheme].tint} />
              </Pressable>
            </View>

            {games.map((game, index) => (
              <View key={index} style={[styles.gameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}>
                <View style={styles.gameHeader}>
                  <Text style={[styles.gameNumber, { color: Colors[colorScheme].text }]}>
                    Game {index + 1}
                  </Text>
                  {games.length > 1 && (
                    <Pressable onPress={() => handleRemoveGame(index)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  )}
                </View>

                {/* Opponent */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
                    Opponent *
                  </Text>
                  <Pressable 
                    style={[styles.input, styles.selectInput, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => {
                      if (loadingTeams) {
                        Alert.alert('Loading', 'Please wait while teams are being loaded...');
                        return;
                      }
                      setActiveDropdown({ type: 'opponent', gameIndex: index });
                    }}
                  >
                    <Text style={[styles.selectText, { color: game.opponent ? Colors[colorScheme].text : Colors[colorScheme].mutedText }]}>
                      {game.opponent || 'Select opponent team'}
                    </Text>
                    {loadingTeams ? (
                      <ActivityIndicator size="small" color={Colors[colorScheme].mutedText} />
                    ) : (
                      <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].mutedText} />
                    )}
                  </Pressable>
                  
                  {/* Beautiful Circular Dropdown */}
                  {activeDropdown?.type === 'opponent' && activeDropdown?.gameIndex === index && (
                    <View style={[styles.dropdown, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                      <ScrollView style={styles.dropdownContent} nestedScrollEnabled>
                        <Pressable
                          style={[styles.dropdownOption, styles.customOption]}
                          onPress={() => {
                            setActiveDropdown(null);
                            Alert.prompt(
                              'Custom Team Name',
                              'Enter opponent team name:',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Save', onPress: (teamName) => {
                                  if (teamName && teamName.trim()) {
                                    handleGameChange(index, 'opponent', teamName.trim());
                                  }
                                }}
                              ],
                              'plain-text',
                              game.opponent
                            );
                          }}
                        >
                          <View style={[styles.optionIcon, { backgroundColor: Colors[colorScheme].tint + '20' }]}>
                            <Ionicons name="create-outline" size={16} color={Colors[colorScheme].tint} />
                          </View>
                          <Text style={[styles.optionText, { color: Colors[colorScheme].tint }]}>
                            Custom Team Name
                          </Text>
                        </Pressable>
                        
                        {teams.map(team => (
                          <Pressable
                            key={team.id}
                            style={[
                              styles.dropdownOption,
                              game.opponent === team.name && styles.selectedOption
                            ]}
                            onPress={() => {
                              handleGameChange(index, 'opponent', team.name);
                              setActiveDropdown(null);
                            }}
                          >
                            <View style={[
                              styles.optionIcon,
                              { 
                                backgroundColor: game.opponent === team.name 
                                  ? Colors[colorScheme].tint 
                                  : Colors[colorScheme].background 
                              }
                            ]}>
                              <Text style={[
                                styles.optionInitial,
                                { 
                                  color: game.opponent === team.name 
                                    ? '#fff' 
                                    : Colors[colorScheme].text 
                                }
                              ]}>
                                {team.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[
                              styles.optionText,
                              { 
                                color: game.opponent === team.name 
                                  ? Colors[colorScheme].tint 
                                  : Colors[colorScheme].text 
                              }
                            ]}>
                              {team.name}
                            </Text>
                            {game.opponent === team.name && (
                              <Ionicons name="checkmark" size={16} color={Colors[colorScheme].tint} />
                            )}
                          </Pressable>
                        ))}
                        
                        {teams.length === 0 && !loadingTeams && (
                          <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                              No teams available
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Date and Time */}
                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
                      Date *
                    </Text>
                    <TextInput
                      value={game.date}
                      onChangeText={(value) => handleGameChange(index, 'date', value)}
                      style={[styles.input, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors[colorScheme].mutedText}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                    <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
                      Time *
                    </Text>
                    <Pressable 
                      style={[styles.input, styles.selectInput, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                      onPress={() => {
                        setActiveDropdown({ type: 'time', gameIndex: index });
                      }}
                    >
                      <Text style={[styles.selectText, { color: Colors[colorScheme].text }]}>
                        {game.time}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].mutedText} />
                    </Pressable>
                    
                    {/* Beautiful Time Dropdown */}
                    {activeDropdown?.type === 'time' && activeDropdown?.gameIndex === index && (
                      <View style={[styles.dropdown, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                        <ScrollView style={styles.dropdownContent} nestedScrollEnabled>
                          {timeOptions.map(time => (
                            <Pressable
                              key={time}
                              style={[
                                styles.dropdownOption,
                                game.time === time && styles.selectedOption
                              ]}
                              onPress={() => {
                                handleGameChange(index, 'time', time);
                                setActiveDropdown(null);
                              }}
                            >
                              <View style={[
                                styles.optionIcon,
                                { 
                                  backgroundColor: game.time === time 
                                    ? Colors[colorScheme].tint 
                                    : Colors[colorScheme].background 
                                }
                              ]}>
                                <Ionicons 
                                  name="time" 
                                  size={16} 
                                  color={game.time === time ? '#fff' : Colors[colorScheme].text} 
                                />
                              </View>
                              <Text style={[
                                styles.optionText,
                                { 
                                  color: game.time === time 
                                    ? Colors[colorScheme].tint 
                                    : Colors[colorScheme].text 
                                }
                              ]}>
                                {time}
                              </Text>
                              {game.time === time && (
                                <Ionicons name="checkmark" size={16} color={Colors[colorScheme].tint} />
                              )}
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                {/* Location */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
                    Location *
                  </Text>
                  <TextInput
                    value={game.location}
                    onChangeText={(value) => handleGameChange(index, 'location', value)}
                    style={[styles.input, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
                    placeholder="Stadium or venue"
                    placeholderTextColor={Colors[colorScheme].mutedText}
                  />
                </View>

                {/* Game Type */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
                    Game Type
                  </Text>
                  <Pressable
                    style={[styles.input, styles.selectInput, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => setActiveDropdown({ type: 'gameType', gameIndex: index })}
                  >
                    <Text style={[styles.selectText, { color: Colors[colorScheme].text }]}> 
                      {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].mutedText} />
                  </Pressable>
                  {/* Beautiful Game Type Dropdown */}
                  {activeDropdown?.type === 'gameType' && activeDropdown?.gameIndex === index && (
                    <View style={[styles.dropdown, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}> 
                      <ScrollView style={styles.dropdownContent} nestedScrollEnabled>
                        {(['home', 'away', 'neutral'] as const).map(type => (
                          <Pressable
                            key={type}
                            style={[
                              styles.dropdownOption,
                              game.type === type && styles.selectedOption
                            ]}
                            onPress={() => {
                              handleGameChange(index, 'type', type);
                              setActiveDropdown(null);
                            }}
                          >
                            <View style={[
                              styles.optionIcon,
                              { backgroundColor: game.type === type ? Colors[colorScheme].tint : Colors[colorScheme].background }
                            ]}>
                              <Ionicons 
                                name={type === 'home' ? 'home' : type === 'away' ? 'airplane' : 'earth'} 
                                size={16} 
                                color={game.type === type ? '#fff' : Colors[colorScheme].text} 
                              />
                            </View>
                            <Text style={[
                              styles.optionText,
                              { color: game.type === type ? Colors[colorScheme].tint : Colors[colorScheme].text }
                            ]}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                            {game.type === type && (
                              <Ionicons name="checkmark" size={16} color={Colors[colorScheme].tint} />
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      </View>
    </Modal>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  templateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  templateSelectText: {
    fontSize: 14,
  },
  templateInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    minWidth: 120,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gameCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gameNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Beautiful Dropdown Styles
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dropdownContent: {
    padding: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  customOption: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
    paddingBottom: 12,
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  optionInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});