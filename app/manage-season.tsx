import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Game as GameAPI } from '@/api/entities';
import AddGameModal, { GameFormData } from '@/components/AddGameModal';
import BulkScheduleModal from '@/components/BulkScheduleModal';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';

interface Game {
  id: string;
  opponent: string; // Keep for backward compatibility
  homeTeam?: string;
  awayTeam?: string;
  date: string;
  time: string;
  location: string;
  type: 'home' | 'away' | 'neutral';
  status: 'upcoming' | 'completed' | 'cancelled';
  score?: {
    team: number;
    opponent: number;
  };
}

interface SeasonStats {
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  totalGames: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface StandingsTeam {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  streak: string;
  lastGame: string;
}

interface PlayoffMatchup {
  id: string;
  round: number;
  position: number;
  team1?: StandingsTeam;
  team2?: StandingsTeam;
  winner?: StandingsTeam;
  score1?: number;
  score2?: number;
  status: 'upcoming' | 'completed' | 'in-progress';
  gameDate?: string;
}

export default function ManageSeasonScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId?: string }>();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'schedule' | 'standings' | 'playoffs'>('schedule');
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [games, setGames] = useState<Game[]>([]);

  const loadGames = useCallback(async () => {
    try {
      setLoading(true);
      const backendGames = await GameAPI.list('-date');
      
      // Convert backend games to local Game format
      const convertedGames: Game[] = backendGames.map((game: any) => ({
        id: game.id,
        homeTeam: game.home_team || null,
        awayTeam: game.away_team || null,
        opponent: game.away_team || game.home_team || game.title?.replace('vs ', '') || 'TBD', // Keep for backward compatibility
        date: game.date ? new Date(game.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: game.date ? new Date(game.date).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) : '7:00 PM',
        location: game.location || 'TBD',
        type: game.home_team && game.home_team !== 'Away Team' ? 'home' : 'away',
        status: 'upcoming', // You could add logic to determine status based on date
      }));
      
      setGames(convertedGames);
    } catch (error) {
      console.error('Error loading games:', error);
      Alert.alert('Error', 'Failed to load games from server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load games on mount
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Mock data - Initialize games with existing mock data
  const seasonStats: SeasonStats = {
    wins: 8,
    losses: 3,
    ties: 1,
    gamesPlayed: 12,
    totalGames: 16,
    pointsFor: 245,
    pointsAgainst: 189,
  };

  // Mock standings data
  const standingsData: StandingsTeam[] = [
    {
      id: '1',
      name: 'Eagles',
      wins: 10,
      losses: 2,
      ties: 0,
      pointsFor: 312,
      pointsAgainst: 189,
      winPercentage: 0.833,
      streak: 'W5',
      lastGame: 'W 28-14'
    },
    {
      id: '2', 
      name: 'Our Team',
      wins: 8,
      losses: 3,
      ties: 1,
      pointsFor: 245,
      pointsAgainst: 189,
      winPercentage: 0.708,
      streak: 'W2',
      lastGame: 'W 24-17'
    },
    {
      id: '3',
      name: 'Warriors',
      wins: 7,
      losses: 4,
      ties: 1,
      pointsFor: 234,
      pointsAgainst: 201,
      winPercentage: 0.625,
      streak: 'L1',
      lastGame: 'L 17-21'
    },
    {
      id: '4',
      name: 'Lightning',
      wins: 6,
      losses: 5,
      ties: 1,
      pointsFor: 198,
      pointsAgainst: 215,
      winPercentage: 0.542,
      streak: 'W1',
      lastGame: 'W 28-10'
    },
    {
      id: '5',
      name: 'Thunder',
      wins: 4,
      losses: 7,
      ties: 1,
      pointsFor: 187,
      pointsAgainst: 243,
      winPercentage: 0.375,
      streak: 'L3',
      lastGame: 'L 14-31'
    },
    {
      id: '6',
      name: 'Rockets',
      wins: 2,
      losses: 9,
      ties: 1,
      pointsFor: 145,
      pointsAgainst: 289,
      winPercentage: 0.208,
      streak: 'L6',
      lastGame: 'L 7-42'
    },
  ].sort((a, b) => b.winPercentage - a.winPercentage);

  // Mock playoff bracket data (using top 4 teams from standings)
  const playoffTeams = standingsData.slice(0, 4);
  const playoffBracket: PlayoffMatchup[] = [
    // Semifinals
    {
      id: 'semi1',
      round: 1,
      position: 1,
      team1: playoffTeams[0], // 1st seed
      team2: playoffTeams[3], // 4th seed
      winner: playoffTeams[0],
      score1: 28,
      score2: 14,
      status: 'completed',
      gameDate: '2025-12-15'
    },
    {
      id: 'semi2', 
      round: 1,
      position: 2,
      team1: playoffTeams[1], // 2nd seed
      team2: playoffTeams[2], // 3rd seed
      winner: undefined,
      status: 'upcoming',
      gameDate: '2025-12-15'
    },
    // Championship
    {
      id: 'final',
      round: 2,
      position: 1,
      team1: playoffTeams[0], // Winner of semi1
      team2: undefined, // Winner of semi2
      status: 'upcoming',
      gameDate: '2025-12-22'
    }
  ];

  const upcomingGames: Game[] = games.filter(g => {
    const gameDate = new Date(g.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return gameDate >= today && g.status === 'upcoming';
  });

  const recentGames: Game[] = games.filter(g => {
    const gameDate = new Date(g.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return gameDate < today || g.status === 'completed';
  });

  // Load games on mount
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGames();
    } finally {
      setRefreshing(false);
    }
  }, [loadGames]);

  const handleAddGame = () => {
    Alert.alert('Add Game', 'Choose how to add a new game', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Manual Entry', onPress: () => setShowAddGameModal(true) },
      { text: 'Quick Add', onPress: () => setShowQuickAddModal(true) },
    ]);
  };

  const handleEditGame = (game: Game) => {
    Alert.alert(
      'Edit Game',
      `Edit ${game.opponent} game?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit Details', onPress: () => {
          // Open edit modal with pre-filled data
          console.log('Edit game:', game);
          Alert.alert('Edit Game', 'Edit functionality would open here with pre-filled game data.');
        }},
        { text: 'Change Status', onPress: () => handleChangeGameStatus(game) },
      ]
    );
  };

  const handleDeleteGame = (game: Game) => {
    Alert.alert(
      'Delete Game',
      `Are you sure you want to delete the game vs ${game.opponent}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            // Delete from backend API
            await GameAPI.delete(game.id);
            
            // Remove from local state
            setGames(prev => prev.filter(g => g.id !== game.id));
            Alert.alert('Success', 'Game deleted successfully!');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete game. Please try again.');
            console.error('Error deleting game:', error);
          }
        }},
      ]
    );
  };

  const handleChangeGameStatus = (game: Game) => {
    const statusOptions = [
      { label: 'Upcoming', value: 'upcoming' as const },
      { label: 'Completed', value: 'completed' as const },
      { label: 'Cancelled', value: 'cancelled' as const },
    ].filter(option => option.value !== game.status);

    Alert.alert(
      'Change Status',
      `Current status: ${game.status}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...statusOptions.map(option => ({
          text: option.label,
          onPress: () => {
            setGames(prev => prev.map(g => 
              g.id === game.id ? { ...g, status: option.value } : g
            ));
            Alert.alert('Success', `Game status changed to ${option.label.toLowerCase()}!`);
          }
        }))
      ]
    );
  };

  const handleGamePress = (game: Game) => {
    router.push({
      pathname: '/(tabs)/feed/game/[id]',
      params: { id: game.id }
    });
  };

  const handleGameLongPress = (game: Game) => {
    Alert.alert(
      'Game Options',
      `${game.opponent} - ${game.date}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => handleEditGame(game) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteGame(game) },
      ]
    );
  };

  const handleSaveQuickGame = async (gameData: QuickGameData & { banner_url?: string }) => {
    try {
      // Convert 12-hour time to 24-hour format for ISO string
      const convertTo24Hour = (time12h: string) => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');
        hours = hours.padStart(2, '0');
        
        if (hours === '12') {
          hours = modifier === 'AM' ? '00' : '12';
        } else if (modifier === 'PM') {
          hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
        }
        return `${hours}:${minutes || '00'}`;
      };

      // Create proper datetime for API - combine date and time properly
      const time24h = convertTo24Hour(gameData.time);
      const [year, month, day] = gameData.date.split('-');
      const [hours, minutes] = time24h.split(':');
      
      // Create date object more safely
      const gameDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      
      // Validate the date
      if (isNaN(gameDateTime.getTime())) {
        throw new Error('Invalid date/time combination');
      }
      
      // Create game data for API
      const gamePayload: any = {
        title: `${gameData.currentTeam} vs ${gameData.opponent}`,
        home_team: gameData.type === 'home' ? gameData.currentTeam : gameData.opponent,
        away_team: gameData.type === 'home' ? gameData.opponent : gameData.currentTeam,
        date: gameDateTime.toISOString(),
        location: gameData.type === 'home' ? 'Home Stadium' : 'Away Venue',
        description: `${gameData.type === 'home' ? 'Home' : 'Away'} game: ${gameData.currentTeam} vs ${gameData.opponent}`,
      };
      // Include banner URL if provided by the QuickAdd modal
      if ((gameData as any).banner_url) {
        gamePayload.banner_url = (gameData as any).banner_url;
      }
      // Include appearance preset if provided
      if ((gameData as any).appearance) {
        // Map to backend field - use `appearance` or `banner_style` depending on API
        gamePayload.appearance = (gameData as any).appearance;
      }

      // Save to backend API
      const savedGame = await GameAPI.create(gamePayload);
      
      // Create local game object for immediate UI update
      const newGame: Game = {
        id: savedGame.id || Date.now().toString(),
        homeTeam: gameData.type === 'home' ? gameData.currentTeam : gameData.opponent,
        awayTeam: gameData.type === 'home' ? gameData.opponent : gameData.currentTeam,
        opponent: gameData.opponent, // Keep for backward compatibility
        date: gameData.date,
        time: gameData.time,
        location: gameData.type === 'home' ? 'Home Stadium' : 'Away Venue',
        type: gameData.type,
        status: 'upcoming',
      };

      // Add to games state
      setGames(prev => [...prev, newGame]);
      
      // Show success message
      Alert.alert('Success', `Game "${gameData.currentTeam} vs ${gameData.opponent}" added successfully!`);
      
    } catch (error) {
      Alert.alert('Error', `Failed to add game: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error adding quick game:', error);
    }
  };

  const handleSaveGame = async (gameData: GameFormData) => {
    try {
      // Create game data for API
      const gamePayload = {
        title: `${gameData.currentTeam} vs ${gameData.opponent}`,
        home_team: gameData.type === 'home' ? gameData.currentTeam : gameData.opponent,
        away_team: gameData.type === 'home' ? gameData.opponent : gameData.currentTeam,
        date: gameData.date.toISOString(),
        location: gameData.location,
        description: `${gameData.type === 'home' ? 'Home' : gameData.type === 'away' ? 'Away' : 'Neutral'} game: ${gameData.currentTeam} vs ${gameData.opponent}`,
      };

      // Save to backend API
      const savedGame = await GameAPI.create(gamePayload);
      
      // Create local game object for immediate UI update
      const newGame: Game = {
        id: savedGame.id || Date.now().toString(),
        opponent: gameData.opponent,
        date: gameData.date.toISOString().split('T')[0],
        time: gameData.time.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        location: gameData.location,
        type: gameData.type,
        status: 'upcoming',
      };

      // Add to games state
      setGames(prev => [...prev, newGame]);
      
      // Show success message
      Alert.alert('Success', `Game "${gameData.currentTeam} vs ${gameData.opponent}" added successfully!`);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to add game. Please try again.');
      console.error('Error adding game:', error);
    }
  };

  const handleSaveBulkGames = async (bulkGames: any[]) => {
    try {
      const promises = bulkGames.map(async (gameData) => {
        // Convert 12-hour time to 24-hour format for ISO string
        const convertTo24Hour = (time12h: string) => {
          const [time, modifier] = time12h.split(' ');
          let [hours, minutes] = time.split(':');
          hours = hours.padStart(2, '0');
          
          if (hours === '12') {
            hours = modifier === 'AM' ? '00' : '12';
          } else if (modifier === 'PM') {
            hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
          }
          return `${hours}:${minutes || '00'}`;
        };

        // Create proper datetime for API
        const time24h = convertTo24Hour(gameData.time);
        const [year, month, day] = gameData.date.split('-');
        const [hours, minutes] = time24h.split(':');
        
        const gameDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
        
        if (isNaN(gameDateTime.getTime())) {
          throw new Error(`Invalid date/time for game vs ${gameData.opponent}`);
        }
        
        const gamePayload = {
          title: `My Team vs ${gameData.opponent}`,
          home_team: gameData.type === 'home' ? 'My Team' : gameData.opponent,
          away_team: gameData.type === 'home' ? gameData.opponent : 'My Team',
          date: gameDateTime.toISOString(),
          location: gameData.location,
          description: `${gameData.type === 'home' ? 'Home' : gameData.type === 'away' ? 'Away' : 'Neutral'} game: My Team vs ${gameData.opponent}`,
        };

        return GameAPI.create(gamePayload);
      });

      const savedGames = await Promise.all(promises);
      
      // Convert to local game format and add to state
      const newGames: Game[] = savedGames.map((savedGame, index) => {
        const originalData = bulkGames[index];
        return {
          id: savedGame.id || Date.now().toString() + index,
          homeTeam: originalData.type === 'home' ? 'My Team' : originalData.opponent,
          awayTeam: originalData.type === 'home' ? originalData.opponent : 'My Team',
          opponent: originalData.opponent,
          date: originalData.date,
          time: originalData.time,
          location: originalData.location,
          type: originalData.type,
          status: 'upcoming',
        };
      });

      setGames(prev => [...prev, ...newGames]);
      Alert.alert('Success!', `Successfully created ${savedGames.length} games!`);
      
    } catch (error) {
      Alert.alert('Error', `Failed to create bulk games: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error creating bulk games:', error);
    }
  };

  const getWinPercentage = () => {
    if (seasonStats.gamesPlayed === 0) return 0;
    return ((seasonStats.wins + seasonStats.ties * 0.5) / seasonStats.gamesPlayed * 100).toFixed(1);
  };

  const handlePlayoffMatchupPress = (matchup: PlayoffMatchup) => {
    if (matchup.status === 'completed') {
      Alert.alert(
        'Game Result',
        `${matchup.team1?.name} ${matchup.score1} - ${matchup.score2} ${matchup.team2?.name}`,
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Edit Result', onPress: () => handleEditPlayoffResult(matchup) },
        ]
      );
    } else if (matchup.status === 'upcoming' && matchup.team1 && matchup.team2) {
      Alert.alert(
        'Playoff Game',
        `${matchup.team1.name} vs ${matchup.team2.name}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enter Result', onPress: () => handleEditPlayoffResult(matchup) },
          { text: 'Schedule Game', onPress: () => handleSchedulePlayoffGame(matchup) },
        ]
      );
    }
  };

  const handleEditPlayoffResult = (matchup: PlayoffMatchup) => {
    if (!matchup.team1 || !matchup.team2) return;
    
    Alert.prompt(
      'Enter Game Result',
      `${matchup.team1.name} vs ${matchup.team2.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Save', 
          onPress: (input) => {
            if (input) {
              const scores = input.split('-').map(s => parseInt(s.trim()));
              if (scores.length === 2 && !isNaN(scores[0]) && !isNaN(scores[1])) {
                updatePlayoffResult(matchup.id, scores[0], scores[1]);
              } else {
                Alert.alert('Error', 'Please enter scores in format: 21-14');
              }
            }
          }
        }
      ],
      'plain-text',
      matchup.status === 'completed' ? `${matchup.score1}-${matchup.score2}` : ''
    );
  };

  const handleSchedulePlayoffGame = (matchup: PlayoffMatchup) => {
    Alert.prompt(
      'Schedule Game',
      'Enter game date (YYYY-MM-DD):',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Schedule', 
          onPress: (dateInput) => {
            if (dateInput) {
              // In a real app, you'd validate the date and save to backend
              Alert.alert('Success', `Game scheduled for ${dateInput}`);
            }
          }
        }
      ],
      'plain-text',
      new Date().toISOString().split('T')[0]
    );
  };

  const updatePlayoffResult = (matchupId: string, score1: number, score2: number) => {
    // In a real app, this would update the backend and refresh data
    Alert.alert(
      'Result Updated',
      `Score updated to ${score1}-${score2}. In a real implementation, this would update the playoff bracket and advance the winner to the next round.`
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Manage Season',
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
        }} 
      />

      {/* Header with Season Stats */}
      <View style={[styles.headerCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <LinearGradient
          colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + '80']}
          style={styles.statsGradient}
        >
          <View style={styles.seasonHeader}>
            <View style={styles.seasonInfo}>
              <Text style={styles.seasonTitle}>2024-25 Season</Text>
              <Text style={styles.seasonSubtitle}>Regular Season</Text>
            </View>
            <Pressable 
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{seasonStats.wins}-{seasonStats.losses}-{seasonStats.ties}</Text>
              <Text style={styles.statLabel}>Record</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getWinPercentage()}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{seasonStats.gamesPlayed}/{seasonStats.totalGames}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{seasonStats.pointsFor}-{seasonStats.pointsAgainst}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Quick Actions */}
      <View style={[styles.quickActionsCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
          <Pressable 
            style={[styles.quickActionButton, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={handleAddGame}
          >
            <Ionicons name="add-outline" size={20} color="#fff" />
            <Text style={styles.quickActionText}>Add Game</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.quickActionButton, { backgroundColor: '#10B981' }]}
            onPress={() => setShowBulkScheduleModal(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.quickActionText}>Bulk Schedule</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.quickActionButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => router.push('/season-stats')}
          >
            <Ionicons name="stats-chart-outline" size={20} color="#fff" />
            <Text style={styles.quickActionText}>View Stats</Text>
          </Pressable>

          <Pressable 
            style={[styles.quickActionButton, { backgroundColor: '#8B5CF6' }]}
            onPress={() => router.push('/archive-seasons')}
          >
            <Ionicons name="trophy-outline" size={20} color="#fff" />
            <Text style={styles.quickActionText}>Playoffs</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['schedule', 'standings', 'playoffs'] as const).map((tab) => (
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

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors[colorScheme].tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === 'schedule' && (
          <View style={styles.tabContent}>
            {/* Upcoming Games */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Upcoming Games</Text>
                <Pressable onPress={handleAddGame}>
                  <Ionicons name="add-circle-outline" size={24} color={Colors[colorScheme].tint} />
                </Pressable>
              </View>
              
              {upcomingGames.map((game) => (
                <Pressable 
                  key={game.id}
                  style={[styles.gameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                  onPress={() => handleGamePress(game)}
                  onLongPress={() => handleGameLongPress(game)}
                >
                  <View style={styles.gameInfo}>
                    <View style={styles.gameHeader}>
                      <Text style={[styles.opponent, { color: Colors[colorScheme].text }]}>
                        {game.homeTeam && game.awayTeam 
                          ? `${game.homeTeam} vs ${game.awayTeam}`
                          : `vs ${game.opponent}`
                        }
                      </Text>
                      <View style={[styles.gameType, { backgroundColor: game.type === 'home' ? '#10B981' : game.type === 'away' ? '#F59E0B' : '#6B7280' }]}>
                        <Text style={styles.gameTypeText}>
                          {game.type === 'home' ? 'HOME' : game.type === 'away' ? 'AWAY' : 'NEUTRAL'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.gameDetails, { color: Colors[colorScheme].mutedText }]}>
                      {game.date} • {game.time}
                    </Text>
                    <Text style={[styles.gameLocation, { color: Colors[colorScheme].mutedText }]}>
                      {game.location}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              ))}
            </View>

            {/* Recent Games */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Recent Games</Text>
              
              {recentGames.map((game) => (
                <Pressable 
                  key={game.id}
                  style={[styles.gameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                  onPress={() => handleGamePress(game)}
                  onLongPress={() => handleGameLongPress(game)}
                >
                  <View style={styles.gameInfo}>
                    <View style={styles.gameHeader}>
                      <Text style={[styles.opponent, { color: Colors[colorScheme].text }]}>
                        {game.homeTeam && game.awayTeam 
                          ? `${game.homeTeam} vs ${game.awayTeam}`
                          : `vs ${game.opponent}`
                        }
                      </Text>
                      {game.score && (
                        <View style={[styles.scoreContainer, { 
                          backgroundColor: game.score.team > game.score.opponent ? '#10B981' : '#EF4444' 
                        }]}>
                          <Text style={styles.scoreText}>
                            {game.score.team > game.score.opponent ? 'W' : 'L'} {game.score.team}-{game.score.opponent}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.gameDetails, { color: Colors[colorScheme].mutedText }]}>
                      {game.date} • {game.time}
                    </Text>
                    <Text style={[styles.gameLocation, { color: Colors[colorScheme].mutedText }]}>
                      {game.location}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'standings' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>League Standings</Text>
                <Pressable onPress={onRefresh}>
                  <Ionicons name="refresh-outline" size={20} color={Colors[colorScheme].tint} />
                </Pressable>
              </View>
              
              {/* Standings Table Header */}
              <View style={[styles.standingsHeader, { borderBottomColor: Colors[colorScheme].border }]}>
                <Text style={[styles.standingsHeaderText, styles.teamColumn, { color: Colors[colorScheme].mutedText }]}>TEAM</Text>
                <Text style={[styles.standingsHeaderText, styles.recordColumn, { color: Colors[colorScheme].mutedText }]}>W-L-T</Text>
                <Text style={[styles.standingsHeaderText, styles.pctColumn, { color: Colors[colorScheme].mutedText }]}>PCT</Text>
                <Text style={[styles.standingsHeaderText, styles.streakColumn, { color: Colors[colorScheme].mutedText }]}>STREAK</Text>
              </View>

              {/* Standings Rows */}
              {standingsData.map((team, index) => (
                <View 
                  key={team.id} 
                  style={[
                    styles.standingsRow, 
                    { 
                      backgroundColor: team.name === 'Our Team' ? Colors[colorScheme].tint + '10' : 'transparent',
                      borderBottomColor: Colors[colorScheme].border 
                    }
                  ]}
                >
                  <View style={styles.teamColumn}>
                    <View style={styles.teamInfo}>
                      <Text style={[styles.rankText, { color: Colors[colorScheme].mutedText }]}>
                        {index + 1}
                      </Text>
                      <Text style={[
                        styles.teamName, 
                        { 
                          color: team.name === 'Our Team' ? Colors[colorScheme].tint : Colors[colorScheme].text,
                          fontWeight: team.name === 'Our Team' ? '800' : '600'
                        }
                      ]}>
                        {team.name}
                        {team.name === 'Our Team' && <Text style={styles.ourTeamBadge}> (You)</Text>}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.recordColumn}>
                    <Text style={[styles.recordText, { color: Colors[colorScheme].text }]}>
                      {team.wins}-{team.losses}-{team.ties}
                    </Text>
                  </View>
                  
                  <View style={styles.pctColumn}>
                    <Text style={[styles.pctText, { color: Colors[colorScheme].text }]}>
                      {team.winPercentage.toFixed(3)}
                    </Text>
                  </View>
                  
                  <View style={styles.streakColumn}>
                    <View style={[
                      styles.streakBadge, 
                      { backgroundColor: team.streak.startsWith('W') ? '#10B981' : '#EF4444' }
                    ]}>
                      <Text style={styles.streakText}>{team.streak}</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* League Stats Summary */}
              <View style={[styles.leagueStats, { borderTopColor: Colors[colorScheme].border }]}>
                <Text style={[styles.leagueStatsTitle, { color: Colors[colorScheme].text }]}>League Averages</Text>
                <View style={styles.leagueStatsGrid}>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {Math.round(standingsData.reduce((sum, team) => sum + team.pointsFor, 0) / standingsData.length)}
                    </Text>
                    <Text style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}>PPG</Text>
                  </View>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {(standingsData.reduce((sum, team) => sum + team.winPercentage, 0) / standingsData.length).toFixed(3)}
                    </Text>
                    <Text style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}>Avg Win %</Text>
                  </View>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {standingsData.reduce((sum, team) => sum + team.wins + team.losses + team.ties, 0) / standingsData.length}
                    </Text>
                    <Text style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}>Games</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {selectedTab === 'playoffs' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Playoff Bracket</Text>
                <Pressable onPress={onRefresh}>
                  <Ionicons name="trophy-outline" size={20} color={Colors[colorScheme].tint} />
                </Pressable>
              </View>
              
              {/* Playoff Info */}
              <View style={[styles.playoffInfo, { backgroundColor: Colors[colorScheme].background }]}>
                <Ionicons name="information-circle-outline" size={16} color={Colors[colorScheme].tint} />
                <Text style={[styles.playoffInfoText, { color: Colors[colorScheme].mutedText }]}>
                  Top 4 teams qualify for playoffs. Single elimination format.
                </Text>
              </View>

              {/* Bracket Visualization */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bracketScroll}>
                <View style={styles.bracketContainer}>
                  
                  {/* Round 1: Semifinals */}
                  <View style={styles.bracketRound}>
                    <Text style={[styles.roundTitle, { color: Colors[colorScheme].text }]}>Semifinals</Text>
                    
                    {playoffBracket.filter(match => match.round === 1).map((match) => (
                      <Pressable 
                        key={match.id} 
                        style={[styles.matchupCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                        onPress={() => handlePlayoffMatchupPress(match)}
                      >
                        <View style={styles.matchupHeader}>
                          <Text style={[styles.matchupDate, { color: Colors[colorScheme].mutedText }]}>
                            {match.gameDate ? new Date(match.gameDate).toLocaleDateString() : 'TBD'}
                          </Text>
                          <View style={[
                            styles.matchupStatus,
                            { backgroundColor: match.status === 'completed' ? '#10B981' : match.status === 'in-progress' ? '#F59E0B' : '#6B7280' }
                          ]}>
                            <Text style={styles.matchupStatusText}>
                              {match.status === 'completed' ? 'FINAL' : match.status === 'in-progress' ? 'LIVE' : 'UPCOMING'}
                            </Text>
                          </View>
                        </View>

                        {/* Team 1 */}
                        <View style={[
                          styles.teamMatchupRow,
                          { backgroundColor: match.winner?.id === match.team1?.id ? Colors[colorScheme].tint + '20' : 'transparent' }
                        ]}>
                          <View style={styles.teamMatchupInfo}>
                            <Text style={[styles.seedNumber, { color: Colors[colorScheme].mutedText }]}>
                              {standingsData.findIndex(t => t.id === match.team1?.id) + 1}
                            </Text>
                            <Text style={[
                              styles.teamMatchupName, 
                              { 
                                color: match.winner?.id === match.team1?.id ? Colors[colorScheme].tint : Colors[colorScheme].text,
                                fontWeight: match.winner?.id === match.team1?.id ? '800' : '600'
                              }
                            ]}>
                              {match.team1?.name || 'TBD'}
                            </Text>
                          </View>
                          {match.status === 'completed' && (
                            <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                              {match.score1}
                            </Text>
                          )}
                        </View>

                        <View style={[styles.vsLine, { backgroundColor: Colors[colorScheme].border }]} />

                        {/* Team 2 */}
                        <View style={[
                          styles.teamMatchupRow,
                          { backgroundColor: match.winner?.id === match.team2?.id ? Colors[colorScheme].tint + '20' : 'transparent' }
                        ]}>
                          <View style={styles.teamMatchupInfo}>
                            <Text style={[styles.seedNumber, { color: Colors[colorScheme].mutedText }]}>
                              {match.team2 ? standingsData.findIndex(t => t.id === match.team2?.id) + 1 : ''}
                            </Text>
                            <Text style={[
                              styles.teamMatchupName, 
                              { 
                                color: match.winner?.id === match.team2?.id ? Colors[colorScheme].tint : Colors[colorScheme].text,
                                fontWeight: match.winner?.id === match.team2?.id ? '800' : '600'
                              }
                            ]}>
                              {match.team2?.name || 'TBD'}
                            </Text>
                          </View>
                          {match.status === 'completed' && (
                            <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                              {match.score2}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {/* Connector Lines */}
                  <View style={styles.bracketConnector}>
                    <View style={[styles.connectorLine, { backgroundColor: Colors[colorScheme].border }]} />
                  </View>

                  {/* Round 2: Championship */}
                  <View style={styles.bracketRound}>
                    <Text style={[styles.roundTitle, { color: Colors[colorScheme].text }]}>Championship</Text>
                    
                    {playoffBracket.filter(match => match.round === 2).map((match) => (
                      <Pressable 
                        key={match.id} 
                        style={[styles.matchupCard, styles.championshipCard, { backgroundColor: Colors[colorScheme].background, borderColor: '#F59E0B' }]}
                        onPress={() => handlePlayoffMatchupPress(match)}
                      >
                        <View style={styles.matchupHeader}>
                          <Ionicons name="trophy" size={16} color="#F59E0B" />
                          <Text style={[styles.matchupDate, { color: Colors[colorScheme].mutedText }]}>
                            {match.gameDate ? new Date(match.gameDate).toLocaleDateString() : 'TBD'}
                          </Text>
                          <View style={[
                            styles.matchupStatus,
                            { backgroundColor: match.status === 'completed' ? '#10B981' : match.status === 'in-progress' ? '#F59E0B' : '#6B7280' }
                          ]}>
                            <Text style={styles.matchupStatusText}>
                              {match.status === 'completed' ? 'FINAL' : match.status === 'in-progress' ? 'LIVE' : 'UPCOMING'}
                            </Text>
                          </View>
                        </View>

                        {/* Team 1 */}
                        <View style={[
                          styles.teamMatchupRow,
                          { backgroundColor: match.winner?.id === match.team1?.id ? '#F59E0B20' : 'transparent' }
                        ]}>
                          <View style={styles.teamMatchupInfo}>
                            <Text style={[styles.teamMatchupName, { color: Colors[colorScheme].text, fontWeight: '600' }]}>
                              {match.team1?.name || 'Winner of Semi 1'}
                            </Text>
                          </View>
                          {match.status === 'completed' && (
                            <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                              {match.score1}
                            </Text>
                          )}
                        </View>

                        <View style={[styles.vsLine, { backgroundColor: Colors[colorScheme].border }]} />

                        {/* Team 2 */}
                        <View style={[
                          styles.teamMatchupRow,
                          { backgroundColor: match.winner?.id === match.team2?.id ? '#F59E0B20' : 'transparent' }
                        ]}>
                          <View style={styles.teamMatchupInfo}>
                            <Text style={[styles.teamMatchupName, { color: Colors[colorScheme].text, fontWeight: '600' }]}>
                              {match.team2?.name || 'Winner of Semi 2'}
                            </Text>
                          </View>
                          {match.status === 'completed' && (
                            <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                              {match.score2}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Playoff Schedule */}
              <View style={styles.playoffSchedule}>
                <Text style={[styles.scheduleTitle, { color: Colors[colorScheme].text }]}>Upcoming Games</Text>
                {playoffBracket.filter(match => match.status === 'upcoming').map((match) => (
                  <View key={match.id} style={[styles.scheduleItem, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}>
                    <Text style={[styles.scheduleMatchup, { color: Colors[colorScheme].text }]}>
                      {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                    </Text>
                    <Text style={[styles.scheduleDate, { color: Colors[colorScheme].mutedText }]}>
                      {match.gameDate ? new Date(match.gameDate).toLocaleDateString() : 'Date TBD'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Game Modal */}
      <AddGameModal
        visible={showAddGameModal}
        onClose={() => setShowAddGameModal(false)}
        onSave={handleSaveGame}
      />

      {/* Quick Add Game Modal */}
      <QuickAddGameModal
        visible={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onSave={handleSaveQuickGame}
        currentTeamName="My Team" // You can replace this with actual team context
      />

      {/* Bulk Schedule Modal */}
      <BulkScheduleModal
        visible={showBulkScheduleModal}
        onClose={() => setShowBulkScheduleModal(false)}
        onSave={handleSaveBulkGames}
        currentTeamName="My Team"
        currentTeamId={params.teamId || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  statsGradient: {
    padding: 20,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  seasonInfo: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  seasonSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.8,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  quickActionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickActions: {
    gap: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  gameInfo: {
    flex: 1,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  opponent: {
    fontSize: 16,
    fontWeight: '700',
  },
  gameType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gameTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  scoreContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameDetails: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  gameLocation: {
    fontSize: 13,
    fontWeight: '500',
  },
  comingSoon: {
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  
  // Standings Table Styles
  standingsHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  standingsHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  standingsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 8,
  },
  teamColumn: {
    flex: 2,
    paddingRight: 8,
  },
  recordColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pctColumn: {
    flex: 1,
    alignItems: 'center',
  },
  streakColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 20,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
  },
  ourTeamBadge: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  recordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pctText: {
    fontSize: 14,
    fontWeight: '600',
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  streakText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  leagueStats: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leagueStatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  leagueStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  leagueStatItem: {
    alignItems: 'center',
  },
  leagueStatValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  leagueStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Playoff Bracket Styles
  playoffInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  playoffInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bracketScroll: {
    marginVertical: 16,
  },
  bracketContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 600,
  },
  bracketRound: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  matchupCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    minWidth: 180,
  },
  championshipCard: {
    borderWidth: 2,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  matchupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchupDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchupStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchupStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  teamMatchupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  teamMatchupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  seedNumber: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 16,
  },
  teamMatchupName: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamScore: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  vsLine: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  bracketConnector: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorLine: {
    width: 2,
    height: 60,
  },
  playoffSchedule: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  scheduleMatchup: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleDate: {
    fontSize: 12,
    fontWeight: '500',
  },
});

