import { Game, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { eachDayOfInterval, endOfMonth, format, isFuture, isPast, isSameDay, isToday, parseISO, startOfMonth } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type GameEvent = {
  id: string;
  title: string;
  date: string;
  homeTeam?: string;
  awayTeam?: string;
  location?: string;
  coverImageUrl?: string;
};

export default function EventsCalendarScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<GameEvent[]>([]);
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Load followed teams and their games
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // Get current user's followed teams
        const me = await User.me();
<<<<<<< HEAD
        const teams = await User.following(me?.id || '');
=======
        // Support both legacy and nested groups API shapes
        let teams: any[] = [];
        try {
          const groups: any = (Team as any).groups;
          if (groups && typeof groups.listFollowed === 'function') {
            teams = await groups.listFollowed();
          } else if (groups && typeof groups.list === 'function') {
            teams = await groups.list();
          } else if (typeof (Team as any).listFollowed === 'function') {
            teams = await (Team as any).listFollowed();
          } else if (typeof (Team as any).list === 'function') {
            teams = await (Team as any).list();
          }
        } catch {}
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
        const teamNames = Array.isArray(teams) ? teams.map((t: any) => t.name) : [];
        
        if (!mounted) return;
        setFollowedTeams(teamNames);

        // Load all games
        const allGames = await Game.list();
        const gamesList = Array.isArray(allGames) ? allGames : allGames?.items || [];
        
        // Filter games that include followed teams
        const filteredGames = gamesList
          .filter((game: any) => {
            const home = game.home_team || game.homeTeam;
            const away = game.away_team || game.awayTeam;
            return teamNames.some(team => 
              home?.toLowerCase().includes(team.toLowerCase()) || 
              away?.toLowerCase().includes(team.toLowerCase())
            );
          })
          .map((game: any) => ({
            id: String(game.id),
            title: game.title || `${game.home_team || game.homeTeam || 'TBD'} vs ${game.away_team || game.awayTeam || 'TBD'}`,
            date: game.date,
            homeTeam: game.home_team || game.homeTeam,
            awayTeam: game.away_team || game.awayTeam,
            location: game.location,
            coverImageUrl: game.cover_image_url || game.banner_url,
          }));

        if (!mounted) return;
        setGames(filteredGames);
      } catch (err) {
        console.error('Failed to load calendar data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();
    return () => { mounted = false; };
  }, []);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Map games to dates
  const gamesByDate = useMemo(() => {
    const map = new Map<string, GameEvent[]>();
    games.forEach(game => {
      if (!game.date) return;
      try {
        const dateKey = format(parseISO(game.date), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(game);
      } catch (error) {
        console.error('Invalid game date:', game.date, error);
      }
    });
    return map;
  }, [games]);

  // Get games for selected date
  const selectedDateGames = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return gamesByDate.get(dateKey) || [];
  }, [selectedDate, gamesByDate]);

  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleDatePress = useCallback((day: Date) => {
    setSelectedDate(day);
  }, []);

  const handleGamePress = useCallback((game: GameEvent) => {
    router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: game.id } });
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Calendar', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
            Loading your team calendar...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Team Calendar', headerShown: true }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        {followedTeams.length === 0 ? (
          <View style={[styles.infoBanner, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <Ionicons name="information-circle-outline" size={24} color={Colors[colorScheme].tint} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: Colors[colorScheme].text }]}>No Teams Followed</Text>
              <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>
                Follow teams to see their games and events in this calendar.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.infoBanner, { backgroundColor: Colors[colorScheme].surface }]}>
            <Ionicons name="calendar" size={20} color={Colors[colorScheme].tint} />
            <Text style={[styles.infoText, { color: Colors[colorScheme].mutedText }]}>
              Showing events for {followedTeams.length} followed {followedTeams.length === 1 ? 'team' : 'teams'}
            </Text>
          </View>
        )}

        {/* Month Navigation */}
        <View style={[styles.monthHeader, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          <Pressable onPress={handlePreviousMonth} style={styles.monthButton} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: Colors[colorScheme].text }]}>
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          <Pressable onPress={handleNextMonth} style={styles.monthButton} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme].text} />
          </Pressable>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarContainer, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          {/* Day Headers */}
          <View style={styles.dayHeadersRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, { color: Colors[colorScheme].mutedText }]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.daysGrid}>
            {/* Empty cells for days before month starts */}
            {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            
            {/* Actual days */}
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayGames = gamesByDate.get(dateKey) || [];
              const hasGames = dayGames.length > 0;
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isDayToday = isToday(day);
              const isDayPast = isPast(day) && !isDayToday;

              return (
                <Pressable
                  key={dateKey}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: Colors[colorScheme].tint },
                    isDayToday && !isSelected && { borderColor: Colors[colorScheme].tint, borderWidth: 2 },
                  ]}
                  onPress={() => handleDatePress(day)}
                  accessibilityLabel={`${format(day, 'MMMM d')}, ${dayGames.length} ${dayGames.length === 1 ? 'event' : 'events'}`}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: Colors[colorScheme].text },
                      isDayPast && !isSelected && { color: Colors[colorScheme].mutedText },
                      isSelected && { color: '#fff', fontWeight: '700' },
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {hasGames && (
                    <View style={styles.eventDots}>
                      {dayGames.slice(0, 3).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.eventDot,
                            { backgroundColor: isSelected ? '#fff' : Colors[colorScheme].tint },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected Date Events */}
        {selectedDate && (
          <View style={styles.eventsSection}>
            <Text style={[styles.eventsTitle, { color: Colors[colorScheme].text }]}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>
            
            {selectedDateGames.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: Colors[colorScheme].surface }]}>
                <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme].mutedText} />
                <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                  No events on this day
                </Text>
              </View>
            ) : (
              selectedDateGames.map(game => {
                const gameTime = game.date ? format(parseISO(game.date), 'h:mm a') : 'TBD';
                
                return (
                  <Pressable
                    key={game.id}
                    style={[styles.gameCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleGamePress(game)}
                  >
                    {game.coverImageUrl ? (
                      <Image
                        source={{ uri: game.coverImageUrl }}
                        style={styles.gameImage}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={['#1e293b', '#1d4ed8', '#38bdf8']}
                        style={styles.gameImage}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                    
                    <View style={styles.gameInfo}>
                      <Text style={[styles.gameTime, { color: Colors[colorScheme].tint }]}>
                        {gameTime}
                      </Text>
                      <Text style={[styles.gameTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
                        {game.title}
                      </Text>
                      {game.location && (
                        <View style={styles.locationRow}>
                          <Ionicons name="location" size={14} color={Colors[colorScheme].mutedText} />
                          <Text style={[styles.locationText, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>
                            {game.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* All Upcoming Events */}
        <View style={styles.upcomingSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
            All Upcoming Events
          </Text>
          
          {games.filter(g => g.date && isFuture(parseISO(g.date))).length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: Colors[colorScheme].surface }]}>
              <Ionicons name="calendar-outline" size={48} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.emptyStateText, { color: Colors[colorScheme].mutedText }]}>
                No upcoming events
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: Colors[colorScheme].mutedText }]}>
                Events from your followed teams will appear here
              </Text>
            </View>
          ) : (
            games
              .filter(g => g.date && isFuture(parseISO(g.date)))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 10)
              .map(game => {
                const gameDate = parseISO(game.date);
                const dateStr = format(gameDate, 'EEE, MMM d');
                const timeStr = format(gameDate, 'h:mm a');
                
                return (
                  <Pressable
                    key={game.id}
                    style={[styles.upcomingGameCard, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleGamePress(game)}
                  >
                    <View style={[styles.dateTag, { backgroundColor: Colors[colorScheme].tint }]}>
                      <Text style={styles.dateTagText}>{format(gameDate, 'MMM')}</Text>
                      <Text style={styles.dateTagDay}>{format(gameDate, 'd')}</Text>
                    </View>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upcomingGameTitle, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                        {game.title}
                      </Text>
                      <View style={styles.upcomingGameMeta}>
                        <Ionicons name="time-outline" size={14} color={Colors[colorScheme].mutedText} />
                        <Text style={[styles.upcomingGameTime, { color: Colors[colorScheme].mutedText }]}>
                          {dateStr} at {timeStr}
                        </Text>
                      </View>
                      {game.location && (
                        <View style={styles.upcomingGameMeta}>
                          <Ionicons name="location-outline" size={14} color={Colors[colorScheme].mutedText} />
                          <Text style={[styles.upcomingGameLocation, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>
                            {game.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                  </Pressable>
                );
              })
          )}
        </View>
      </ScrollView>
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  monthButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 14,
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsSection: {
    marginBottom: 24,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gameImage: {
    width: 80,
    height: 80,
  },
  gameInfo: {
    flex: 1,
    padding: 12,
  },
  gameTime: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
  },
  upcomingSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  upcomingGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dateTag: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  dateTagDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  upcomingGameTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  upcomingGameMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  upcomingGameTime: {
    fontSize: 13,
  },
  upcomingGameLocation: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});
