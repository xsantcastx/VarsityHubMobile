import CustomActionModal, { ActionModalOption } from '@/components/CustomActionModal';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { NavigationHistoryContext } from '@/context/NavigationHistoryContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, useUnstableGlobalHref } from 'expo-router';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { goBackToTrackedRoute } from '@/utils/navigation';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Game as GameAPI, Team as TeamAPI } from '@/api/entities';
import AddGameModal, { GameFormData } from '@/components/AddGameModal';
import BulkScheduleModal from '@/components/BulkScheduleModal';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';
import { EmptyState, GameCard, SectionHeader } from '@/components/ui';
import type { Game as GameCardGame } from '@/components/ui/GameCard';
import { captureBreadcrumb, captureException } from '@/utils/sentry';

type GameStatus = 'upcoming' | 'completed' | 'cancelled' | 'pending' | 'live' | 'in-progress';

interface Game extends GameCardGame {
  id: string;
  opponent?: string; // Keep for backward compatibility
  homeTeam?: string;
  awayTeam?: string;
  date: string;
  time: string;
  location: string;
  type: 'home' | 'away' | 'neutral';
  status: GameStatus;
  approval_status?: 'pending' | 'approved' | 'rejected';
  banner_url?: string; // Add banner URL support
  cover_image_url?: string; // Add cover image URL support
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

function ManageSeasonScreen() {
  const { user } = useAuth();
  const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ teamId?: string; from?: string; fallback?: string }>();
  const navHistory = useContext(NavigationHistoryContext);
  const href = useUnstableGlobalHref();
  const currentHref = typeof href === 'string' ? href : null;
  const backFallback =
    typeof params.fallback === 'string' && params.fallback.trim().startsWith('/')
      ? params.fallback.trim()
      : params.from === 'discover-quick-actions'
        ? '/(tabs)/discover'
        : undefined;
  const handleBack = useCallback(() => {
    goBackToTrackedRoute(router, currentHref, navHistory?.getFallbackRoute?.(), backFallback);
  }, [backFallback, currentHref, navHistory, router]);

  // Modal state for universal action modal
  const [actionModal, setActionModal] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    options: ActionModalOption[];
  }>({ visible: false, options: [] });

  // Prompt modal state (for Alert.prompt replacement)
  const [promptModal, setPromptModal] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    defaultValue?: string;
    onSubmit?: (value: string) => void;
  }>({ visible: false });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, _setSelectedTab] = useState<'schedule' | 'standings' | 'playoffs'>(
    'schedule'
  );
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [currentTeam, setCurrentTeam] = useState<{ id: string; name: string } | null>(null);
  const [managedTeams, setManagedTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [teamSelectorOpen, setTeamSelectorOpen] = useState<boolean>(false);

  const reportSeasonFailure = useCallback((task: string, error: unknown) => {
    if (__DEV__) console.warn(`[manage-season] ${task} failed:`, error);
    captureBreadcrumb('Manage season deferred task failed', 'manage_season.screen', { task }, 'warning');
    captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { context: 'manage-season', task },
    });
  }, []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      if (params.teamId) {
        const teamData = await TeamAPI.get(params.teamId);
        setCurrentTeam({ id: String(teamData.id), name: String(teamData.name) });
        return;
      }
      // No teamId provided: fetch managed teams and prompt selection
      const teams = await TeamAPI.managed();
      const arr = Array.isArray(teams)
        ? teams
        : Array.isArray((teams as any)?.items)
          ? (teams as any).items
          : [];
      const normalized = arr.map((t: any) => ({
        id: String(t.id),
        name: String(t.name || t.display_name || 'Team'),
      }));
      setManagedTeams(normalized);
      if (normalized.length > 0) {
        setTeamSelectorOpen(true);
      } else {
          setActionModal({
            visible: true,
            title: 'No Managed Teams',
            message: "You don't manage any teams yet. Create one to continue.",
            options: [
              {
                label: 'Create Team',
                onPress: () =>
                  router.push({
                    pathname: '/create-team',
                    params: {
                      fallback: backFallback ?? '/organization?tab=teams',
                    },
                  } as any),
              },
              { label: 'Close', onPress: () => {} },
            ],
          });
      }
    } catch (error) {
      if (handleCoachAccessError(router, error, 'managing your season', user)) {
        return;
      }
      if (__DEV__) console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  }, [backFallback, params.teamId, router, user]);

  const loadGames = useCallback(async () => {
    try {
      setLoading(true);
      if (!currentTeam?.id) {
        setGames([]);
        return;
      }
      const response = await GameAPI.list('-date', {
        showPending: true,
        teamId: currentTeam.id,
        limit: 100,
      });
      const backendGames = response?.games ?? (Array.isArray(response) ? response : []);
      const relevantGames: any[] = Array.isArray(backendGames) ? backendGames : [];

      // Convert backend games to local Game format
      const convertedGames = relevantGames.map((game: any) => {
        const converted: Game = {
          id: game.id,
          homeTeam: game.home_team || null,
          awayTeam: game.away_team || null,
          opponent: game.away_team || game.home_team || game.title?.replace('vs ', '') || 'TBD',
          date: game.date
            ? new Date(game.date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          time: game.date
            ? new Date(game.date).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })
            : '7:00 PM',
          location: game.location || 'TBD',
          type: game.home_team && game.home_team !== 'Away Team' ? 'home' : 'away',
          status: game.winner
            ? 'completed'
            : game.approval_status === 'rejected'
              ? 'cancelled'
              : game.approval_status === 'pending'
                ? 'pending'
                : 'upcoming',
          banner_url: game.banner_url || undefined, // Include banner URL from backend
          cover_image_url: game.cover_image_url || undefined, // Include cover image URL from backend
        };
        return converted;
      });

      setGames(convertedGames);
    } catch (error) {
      if (handleCoachAccessError(router, error, 'managing your season', user)) {
        return;
      }
      if (__DEV__) console.error('Error loading games:', error);
      const errorMessage =
        error instanceof Error && error.message.includes('Too many requests')
          ? 'Server is busy, please try again in a moment'
          : 'Failed to load games from server';

      setActionModal({
        visible: true,
        title: 'Error',
        message: errorMessage,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } finally {
      setLoading(false);
    }
  }, [currentTeam?.id, router, user]);

  // Load team and then games
  useEffect(() => {
    void loadTeam().catch((error) => {
      reportSeasonFailure('load_team', error);
    });
  }, [loadTeam, reportSeasonFailure]);

  useEffect(() => {
    if (currentTeam?.id) {
      void loadGames().catch((error) => {
        reportSeasonFailure('load_games_for_team', error);
      });
    }
  }, [currentTeam?.id, loadGames, reportSeasonFailure]);

  // Compute season stats from real game data
  const _seasonStats: SeasonStats = (() => {
    const teamId = currentTeam?.id;
    if (!teamId)
      return {
        wins: 0,
        losses: 0,
        ties: 0,
        gamesPlayed: 0,
        totalGames: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    const completed = games.filter(g => g.status === 'completed' || (g as any).winner);
    let wins = 0,
      losses = 0,
      ties = 0,
      pointsFor = 0,
      pointsAgainst = 0;
    for (const g of completed) {
      const raw = g as any;
      const isHome = String(raw.home_team_id) === teamId;
      const hs = typeof raw.home_score === 'number' ? raw.home_score : 0;
      const as_ = typeof raw.away_score === 'number' ? raw.away_score : 0;
      pointsFor += isHome ? hs : as_;
      pointsAgainst += isHome ? as_ : hs;
      if (raw.winner === 'tie') {
        ties++;
      } else if ((raw.winner === 'home' && isHome) || (raw.winner === 'away' && !isHome)) {
        wins++;
      } else if (raw.winner) {
        losses++;
      }
    }
    return {
      wins,
      losses,
      ties,
      gamesPlayed: completed.length,
      totalGames: games.length,
      pointsFor,
      pointsAgainst,
    };
  })();

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
      lastGame: 'W 28-14',
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
      lastGame: 'W 24-17',
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
      lastGame: 'L 17-21',
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
      lastGame: 'W 28-10',
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
      lastGame: 'L 14-31',
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
      lastGame: 'L 7-42',
    },
  ].sort((a, b) => b.winPercentage - a.winPercentage);

  // Mock playoff bracket data (using top 4 teams from standings)
  const playoffTeams = (standingsData ?? []).slice(0, 4);
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
      gameDate: '2025-12-15',
    },
    {
      id: 'semi2',
      round: 1,
      position: 2,
      team1: playoffTeams[1], // 2nd seed
      team2: playoffTeams[2], // 3rd seed
      winner: undefined,
      status: 'upcoming',
      gameDate: '2025-12-15',
    },
    // Championship
    {
      id: 'final',
      round: 2,
      position: 1,
      team1: playoffTeams[0], // Winner of semi1
      team2: undefined, // Winner of semi2
      status: 'upcoming',
      gameDate: '2025-12-22',
    },
  ];

  const pendingGames: Game[] = (games ?? []).filter(
    g => g.approval_status === 'pending' || g.status === 'pending'
  );

  const upcomingGames: Game[] = (games ?? []).filter(g => {
    if (g.approval_status === 'pending' || g.approval_status === 'rejected') return false;
    if (g.status === 'completed' || g.status === 'cancelled') return false;
    const gameDate = new Date(g.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return gameDate >= today;
  });

  const recentGames: Game[] = (games ?? []).filter(g => {
    if (g.approval_status === 'pending') return false;
    const gameDate = new Date(g.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return gameDate < today || g.status === 'completed' || g.status === 'cancelled';
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGames();
    } finally {
      setRefreshing(false);
    }
  }, [loadGames]);

  const handleAddGame = () => {
    // Directly open Quick Add modal (simplified for boomer-friendly UX)
    setShowQuickAddModal(true);
  };

  const handleEditGame = (game: GameCardGame) => {
    const localGame = games.find(g => g.id === game.id);
    if (localGame) {
      setEditingGame(localGame);
      setShowQuickAddModal(true);
    }
  };

  const handleDeleteGame = (game: GameCardGame) => {
    setActionModal({
      visible: true,
      title: 'Delete Game',
      message: `Are you sure you want to delete the game vs ${game.opponent || game.opponent_name || 'opponent'}?`,
      options: [
        { label: 'Cancel', onPress: () => {}, color: undefined },
        {
          label: 'Delete',
          isDestructive: true,
          onPress: async () => {
            try {
              await GameAPI.delete(game.id);
              setGames(prev => prev.filter(g => g.id !== game.id));
              setActionModal({
                visible: true,
                title: 'Success',
                message: 'Game deleted successfully!',
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
            } catch (error) {
              if (handleCoachAccessError(router, error, 'deleting games', user)) {
                return;
              }
              setActionModal({
                visible: true,
                title: 'Error',
                message: 'Failed to delete game. Please try again.',
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
              if (__DEV__) console.error('Error deleting game:', error);
            }
          },
        },
      ],
    });
  };

  const handleChangeGameStatus = (game: GameCardGame) => {
    const localGame = games.find(g => g.id === game.id);
    if (!localGame) return;
    const statusOptions = [
      { label: 'Upcoming', value: 'upcoming' as const },
      { label: 'Completed', value: 'completed' as const },
      { label: 'Cancelled', value: 'cancelled' as const },
    ].filter(option => option.value !== localGame.status);
    setActionModal({
      visible: true,
      title: 'Change Status',
      message: `Current status: ${localGame.status}`,
      options: [
        { label: 'Cancel', onPress: () => {}, color: undefined },
        ...statusOptions.map(option => ({
          label: option.label,
          onPress: async () => {
            try {
              await GameAPI.update(game.id, { status: option.value });
              setGames(prev =>
                prev.map(g => (g.id === game.id ? { ...g, status: option.value } : g))
              );
              setActionModal({
                visible: true,
                title: 'Success',
                message: `Game status changed to ${option.label.toLowerCase()}!`,
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
            } catch (err: any) {
              if (handleCoachAccessError(router, err, 'updating game status', user)) {
                return;
              }
              setActionModal({
                visible: true,
                title: 'Error',
                message: err?.message || 'Failed to update game status',
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
            }
          },
        })),
      ],
    });
  };

  const handleGamePress = (game: GameCardGame) => {
    router.push({
      pathname: '/game/[id]',
      params: { id: game.id },
    });
  };

  const handleEnterScore = (game: GameCardGame) => {
    const localGame = games.find(g => g.id === game.id);
    setPromptModal({
      visible: true,
      title: 'Home Team Score',
      message: `Enter score for ${localGame?.homeTeam || 'Home Team'}`,
      defaultValue: String(localGame?.score?.team ?? ''),
      onSubmit: homeScoreStr => {
        const homeScore = parseInt(homeScoreStr.trim(), 10);
        if (isNaN(homeScore)) {
          setActionModal({
            visible: true,
            title: 'Invalid Score',
            message: 'Please enter a valid number for the home team score.',
            options: [{ label: 'OK', onPress: () => {}, color: undefined }],
          });
          return;
        }
        setTimeout(() => {
          setPromptModal({
            visible: true,
            title: 'Away Team Score',
            message: `Enter score for ${localGame?.awayTeam || 'Away Team'}`,
            defaultValue: String(localGame?.score?.opponent ?? ''),
            onSubmit: async awayScoreStr => {
              const awayScore = parseInt(awayScoreStr.trim(), 10);
              if (isNaN(awayScore)) {
                setActionModal({
                  visible: true,
                  title: 'Invalid Score',
                  message: 'Please enter a valid number for the away team score.',
                  options: [{ label: 'OK', onPress: () => {}, color: undefined }],
                });
                return;
              }
              try {
                const winner =
                  homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie';
                await GameAPI.setResult(game.id, {
                  home_score: homeScore,
                  away_score: awayScore,
                  winner,
                });
                setGames(prevGames =>
                  prevGames.map(g =>
                    g.id === game.id
                      ? {
                          ...g,
                          score: { team: homeScore, opponent: awayScore },
                          status: 'completed' as GameStatus,
                        }
                      : g
                  )
                );
                setActionModal({
                  visible: true,
                  title: 'Score Saved',
                  message: `Final score: ${homeScore} - ${awayScore}`,
                  options: [{ label: 'OK', onPress: () => {}, color: undefined }],
                });
              } catch (error: any) {
                if (handleCoachAccessError(router, error, 'saving game scores', user)) {
                  return;
                }
                setActionModal({
                  visible: true,
                  title: 'Error',
                  message: error?.message || 'Failed to save score. Please try again.',
                  options: [{ label: 'OK', onPress: () => {}, color: undefined }],
                });
              }
            },
          });
        }, 200);
      },
    });
  };

  const handleGameLongPress = (game: GameCardGame) => {
    const _localGame = games.find(g => g.id === game.id);
    setActionModal({
      visible: true,
      title: 'Game Options',
      message: `${game.opponent || game.opponent_name || 'Game'} - ${game.date || game.scheduled_date || ''}`,
      options: [
        { label: 'Cancel', onPress: () => {}, color: undefined },
        { label: 'Edit', onPress: () => handleEditGame(game) },
        { label: 'Change Status', onPress: () => handleChangeGameStatus(game) },
        { label: 'Enter Score', onPress: () => handleEnterScore(game) },
        { label: 'Delete', isDestructive: true, onPress: () => handleDeleteGame(game) },
      ],
    });
  };

  const handleApproveGame = async (game: Game) => {
    try {
      await GameAPI.setApprovalStatus(game.id, 'approved');
      setGames(prevGames =>
        prevGames.map(g =>
          g.id === game.id ? { ...g, approval_status: 'approved', status: 'upcoming' } : g
        )
      );

      setActionModal({
        visible: true,
        title: '✅ Game Approved',
        message: `${game.opponent || 'Game'} has been approved and will appear in upcoming games.`,
        options: [{ label: 'OK', onPress: () => {} }],
      });
    } catch (error: any) {
      if (handleCoachAccessError(router, error, 'approving games', user)) {
        return;
      }
      if (__DEV__) console.error('Error approving game:', error);
      setActionModal({
        visible: true,
        title: 'Approval Failed',
        message: error?.message || 'We could not approve this game. Please try again.',
        options: [{ label: 'OK', onPress: () => {} }],
      });
    }
  };

  const handleRejectGame = async (game: Game) => {
    setActionModal({
      visible: true,
      title: 'Reject Game',
      message: `Are you sure you want to reject "${game.opponent || 'this game'}"? This action cannot be undone.`,
      options: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: 'Reject',
          isDestructive: true,
          onPress: async () => {
            try {
              await GameAPI.setApprovalStatus(game.id, 'rejected');
              setGames(prevGames => prevGames.filter(g => g.id !== game.id));

              setActionModal({
                visible: true,
                title: 'Game Rejected',
                message: 'The game has been rejected and removed.',
                options: [{ label: 'OK', onPress: () => {} }],
              });
            } catch (error: any) {
              if (handleCoachAccessError(router, error, 'rejecting games', user)) {
                return;
              }
              if (__DEV__) console.error('Error rejecting game:', error);
              setActionModal({
                visible: true,
                title: 'Rejection Failed',
                message: error?.message || 'We could not reject this game. Please try again.',
                options: [{ label: 'OK', onPress: () => {} }],
              });
            }
          },
        },
      ],
    });
  };

  const handlePendingGameAction = (game: Game) => {
    setActionModal({
      visible: true,
      title: 'Pending Game',
      message: `${game.opponent} - ${game.date}`,
      options: [
        { label: 'Cancel', onPress: () => {} },
        { label: '✅ Approve', onPress: () => handleApproveGame(game) },
        { label: 'Edit', onPress: () => handleEditGame(game) },
        { label: '❌ Reject', isDestructive: true, onPress: () => handleRejectGame(game) },
      ],
    });
  };

  const sanitizeTeamId = (value?: string) => {
    const trimmed = (value || '').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const parseDateParts = (date: string) => {
    const [yearStr, monthStr, dayStr] = (date || '').split('-');
    const year = parseInt(yearStr || '', 10);
    const month = parseInt(monthStr || '', 10);
    const day = parseInt(dayStr || '', 10);
    return { year, month, day };
  };

  const parseMeridiemTime = (time: string) => {
    const normalized = (time || '').replace(/\u202f/g, ' ').trim();
    const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?$/i);
    if (!match) {
      throw new Error('Invalid time format');
    }
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] ?? '0', 10);
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  };

  const handleSaveQuickGame = async (gameData: QuickGameData) => {
    const isEditing = !!gameData.id;
    try {
      const { year, month, day } = parseDateParts(gameData.date);
      const { hours, minutes } = parseMeridiemTime(gameData.time);

      if ([year, month, day, hours, minutes].some(val => Number.isNaN(val))) {
        throw new Error('Invalid date/time combination');
      }

      // Create the timestamp in UTC so the intended date/time is preserved server-side
      const gameDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));

      // Validate the date
      if (isNaN(gameDateTime.getTime())) {
        throw new Error('Invalid date/time combination');
      }

      const homeTeamId = sanitizeTeamId(
        gameData.type === 'home' ? gameData.currentTeamId : gameData.opponentTeamId
      );
      const awayTeamId = sanitizeTeamId(
        gameData.type === 'home' ? gameData.opponentTeamId : gameData.currentTeamId
      );

      // Create game data for API
      const gamePayload: Record<string, any> = {
        title: gameData.isCompetitive
          ? `${gameData.currentTeam} vs ${gameData.opponent}`
          : `${gameData.currentTeam} Event`,
        date: gameDateTime.toISOString(),
        description: gameData.isCompetitive
          ? `${gameData.type === 'home' ? 'Home' : 'Away'} game: ${gameData.currentTeam} vs ${gameData.opponent}`
          : `Event for ${gameData.currentTeam}`,
      };

      // Only add team fields if this is a competitive game
      if (gameData.isCompetitive) {
        gamePayload.home_team = gameData.type === 'home' ? gameData.currentTeam : gameData.opponent;
        gamePayload.away_team = gameData.type === 'home' ? gameData.opponent : gameData.currentTeam;

        if (homeTeamId) gamePayload.home_team_id = homeTeamId;
        if (awayTeamId) {
          gamePayload.away_team_id = awayTeamId;
        } else if (gameData.opponent) {
          gamePayload.away_team_name = gameData.opponent;
        }
      } else {
        // For non-competitive events, still send home_team_id for approval workflow
        if (gameData.currentTeamId) {
          gamePayload.home_team_id = gameData.currentTeamId;
        }
      }

      // Add expected attendance if provided
      if (gameData.expectedAttendance) {
        gamePayload.expected_attendance = gameData.expectedAttendance;
      }

      // Add event type
      if (gameData.eventType) {
        gamePayload.event_type = gameData.eventType;
      }

      // Add event type-specific fields
      if (gameData.donationGoal) {
        gamePayload.donation_goal = gameData.donationGoal;
      }
      if (gameData.watchLocation) {
        gamePayload.watch_location = gameData.watchLocation;
        if (gameData.watchLocationLat) gamePayload.watch_location_lat = gameData.watchLocationLat;
        if (gameData.watchLocationLng) gamePayload.watch_location_lng = gameData.watchLocationLng;
        if (gameData.watchLocationPlaceId)
          gamePayload.watch_location_place_id = gameData.watchLocationPlaceId;
      }
      if (gameData.destination) {
        gamePayload.destination = gameData.destination;
      }

      // Add game venue location — always ensure location is set (server requires it)
      const venue = gameData.type === 'home' ? gameData.homeVenue : gameData.awayVenue;
      const venueLat = gameData.type === 'home' ? gameData.homeVenueLat : gameData.awayVenueLat;
      const venueLng = gameData.type === 'home' ? gameData.homeVenueLng : gameData.awayVenueLng;
      if (venue) {
        gamePayload.location = venue;
        if (venueLat) gamePayload.latitude = venueLat;
        if (venueLng) gamePayload.longitude = venueLng;
      } else {
        // Fallback for non-competitive events: use watch location, destination, or a default
        gamePayload.location = gameData.watchLocation || gameData.destination || 'TBD';
      }

      // Include banner URL if provided by the QuickAdd modal
      if (gameData.banner_url) {
        gamePayload.banner_url = gameData.banner_url;
        gamePayload.cover_image_url = gameData.banner_url; // Also set cover_image_url to the same value
      } else if (gameData.cover_image_url) {
        gamePayload.cover_image_url = gameData.cover_image_url;
      }
      // Include appearance preset if provided
      if (gameData.appearance) {
        // Map to backend field - use `appearance` or `banner_style` depending on API
        gamePayload.appearance = gameData.appearance;
      }

      // Save to backend API (create or update)
      const savedGame = isEditing
        ? await GameAPI.update(gameData.id!, gamePayload)
        : await GameAPI.create(gamePayload);

      // Create local game object for immediate UI update
      const updatedGame: Game = {
        id: savedGame.id || gameData.id || Date.now().toString(),
        homeTeam: gameData.type === 'home' ? gameData.currentTeam : gameData.opponent,
        awayTeam: gameData.type === 'home' ? gameData.opponent : gameData.currentTeam,
        opponent: gameData.opponent, // Keep for backward compatibility
        date: gameData.date,
        time: gameData.time,
        location:
          gameData.homeVenue ||
          gameData.awayVenue ||
          (gameData.type === 'home' ? 'Home Stadium' : 'Away Venue'),
        type: gameData.type,
        status: 'upcoming',
        // TEMP FIX: Prioritize the banner_url we sent over the null response from backend
        banner_url: gameData.banner_url || savedGame.banner_url || undefined,
        cover_image_url:
          gameData.banner_url || gameData.cover_image_url || savedGame.cover_image_url || undefined,
      };

      // Update games state
      if (isEditing) {
        setGames(prev => prev.map(g => (g.id === gameData.id ? updatedGame : g)));
      } else {
        setGames(prev => [...prev, updatedGame]);
      }

      // Show success message
      setActionModal({
        visible: true,
        title: 'Success',
        message: isEditing
          ? `Game "${gameData.currentTeam} vs ${gameData.opponent}" updated successfully!`
          : `Game "${gameData.currentTeam} vs ${gameData.opponent}" added successfully!`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });

      // Close modal and clear editing state
      setShowQuickAddModal(false);
      setEditingGame(null);
    } catch (error: any) {
      if (handleCoachAccessError(router, error, isEditing ? 'updating games' : 'creating games', user)) {
        return;
      }
      if (__DEV__) console.error('Error adding quick game:', error);
      if (__DEV__) console.error('Error status:', error?.status);
      if (__DEV__) console.error('Error data:', error?.data);
      if (__DEV__) console.error('Error message:', error?.message);
      const details = error?.data?.issues ? `\nDetails: ${JSON.stringify(error.data.issues)}` : '';
      const rawMsg =
        (typeof error?.data === 'object' ? error.data?.error || error.data?.message : null) ||
        error?.message ||
        'Unknown error';
      const errorMsg =
        typeof rawMsg === 'string' && (rawMsg.includes('<') || rawMsg.startsWith('Cannot '))
          ? 'Server error. Please try again.'
          : rawMsg;
      setActionModal({
        visible: true,
        title: 'Error',
        message: `Failed to save event: ${errorMsg}${details}`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
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
          hour12: true,
        }),
        location: gameData.location,
        type: gameData.type,
        status: 'upcoming',
        banner_url: gameData.banner_url || undefined, // Include banner URL
      };

      // Add to games state
      setGames(prev => [...prev, newGame]);

      // Show success message
      setActionModal({
        visible: true,
        title: 'Success',
        message: `Game "${gameData.currentTeam} vs ${gameData.opponent}" added successfully!`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } catch (error) {
      if (handleCoachAccessError(router, error, 'creating games', user)) {
        return;
      }
      setActionModal({
        visible: true,
        title: 'Error',
        message: 'Failed to add event. Please try again.',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      if (__DEV__) console.error('Error adding game:', error);
    }
  };

  const handleSaveBulkGames = async (bulkGames: any[]) => {
    try {
      // v1.0.2: use atomic /games/bulk endpoint instead of Promise.all over individual creates.
      // Server rolls back the whole batch if any single game fails to save.
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
      const teamName = currentTeam?.name || 'Team';
      const payloads = bulkGames.map(gameData => {
        const time24h = convertTo24Hour(gameData.time);
        const [year, month, day] = gameData.date.split('-');
        const [hours, minutes] = time24h.split(':');
        const gameDateTime = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes)
        );
        if (isNaN(gameDateTime.getTime())) {
          throw new Error(`Invalid date/time for game vs ${gameData.opponent}`);
        }
        return {
          title: `${teamName} vs ${gameData.opponent}`,
          home_team: gameData.type === 'home' ? teamName : gameData.opponent,
          away_team: gameData.type === 'home' ? gameData.opponent : teamName,
          date: gameDateTime.toISOString(),
          location: gameData.location,
          description: `${gameData.type === 'home' ? 'Home' : gameData.type === 'away' ? 'Away' : 'Neutral'} game: ${teamName} vs ${gameData.opponent}`,
        };
      });
      const result: any = await GameAPI.bulkCreate(payloads);
      const savedGames = Array.isArray(result?.games) ? result.games : [];

      // Convert to local game format and add to state (teamName already in scope from above)
      const newGames: Game[] = savedGames.map((savedGame: any, index: number) => {
        const originalData = bulkGames[index];
        return {
          id: savedGame.id || Date.now().toString() + index,
          homeTeam: originalData.type === 'home' ? teamName : originalData.opponent,
          awayTeam: originalData.type === 'home' ? originalData.opponent : teamName,
          opponent: originalData.opponent,
          date: originalData.date,
          time: originalData.time,
          location: originalData.location,
          type: originalData.type,
          status: 'upcoming',
          banner_url: savedGame.banner_url || undefined, // Include banner URL from saved game
        };
      });

      setGames(prev => [...prev, ...newGames]);
      setActionModal({
        visible: true,
        title: 'Success!',
        message: `Successfully created ${savedGames.length} games!`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } catch (error) {
      if (handleCoachAccessError(router, error, 'creating games', user)) {
        return;
      }
      setActionModal({
        visible: true,
        title: 'Error',
        message: `Failed to create bulk games: ${error instanceof Error ? error.message : 'Unknown error'}`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      if (__DEV__) console.error('Error creating bulk games:', error);
    }
  };

  const handlePlayoffMatchupPress = (matchup: PlayoffMatchup) => {
    if (matchup.status === 'completed') {
      setActionModal({
        visible: true,
        title: 'Game Result',
        message: `${matchup.team1?.name} ${matchup.score1} - ${matchup.score2} ${matchup.team2?.name}`,
        options: [
          { label: 'OK', onPress: () => {}, color: undefined },
          { label: 'Edit Result', onPress: () => handleEditPlayoffResult(matchup) },
        ],
      });
    } else if (matchup.status === 'upcoming' && matchup.team1 && matchup.team2) {
      setActionModal({
        visible: true,
        title: 'Playoff Game',
        message: `${matchup.team1.name} vs ${matchup.team2.name}`,
        options: [
          { label: 'Cancel', onPress: () => {}, color: undefined },
          { label: 'Enter Result', onPress: () => handleEditPlayoffResult(matchup) },
          { label: 'Schedule Game', onPress: () => handleSchedulePlayoffGame(matchup) },
        ],
      });
    }
  };

  const handleEditPlayoffResult = (matchup: PlayoffMatchup) => {
    if (!matchup.team1 || !matchup.team2) return;

    setPromptModal({
      visible: true,
      title: 'Enter Game Result',
      message: `${matchup.team1.name} vs ${matchup.team2.name}`,
      defaultValue: matchup.status === 'completed' ? `${matchup.score1}-${matchup.score2}` : '',
      onSubmit: input => {
        if (input) {
          const scores = input.split('-').map(s => parseInt(s.trim()));
          if (scores.length === 2 && !isNaN(scores[0]) && !isNaN(scores[1])) {
            updatePlayoffResult(matchup.id, scores[0], scores[1]);
          } else {
            setActionModal({
              visible: true,
              title: 'Error',
              message: 'Please enter scores in format: 21-14',
              options: [{ label: 'OK', onPress: () => {}, color: undefined }],
            });
          }
        }
      },
    });
  };

  const handleSchedulePlayoffGame = (matchup: PlayoffMatchup) => {
    const matchupLabel =
      matchup.team1 && matchup.team2
        ? `${matchup.team1.name} vs ${matchup.team2.name}`
        : 'Enter playoff matchup details';
    setPromptModal({
      visible: true,
      title: 'Schedule Game',
      message: `${matchupLabel}\nEnter game date (YYYY-MM-DD):`,
      defaultValue: new Date().toISOString().split('T')[0],
      onSubmit: dateInput => {
        if (dateInput) {
          setActionModal({
            visible: true,
            title: 'Success',
            message: `Game scheduled for ${dateInput}`,
            options: [{ label: 'OK', onPress: () => {}, color: undefined }],
          });
        }
      },
    });
  };

  const updatePlayoffResult = (matchupId: string, score1: number, score2: number) => {
    // In a real app, this would update the backend and refresh data
    setActionModal({
      visible: true,
      title: 'Result Updated',
      message: `Score updated to ${score1}-${score2}. In a real implementation, this would update the playoff bracket and advance the winner to the next round.`,
      options: [{ label: 'OK', onPress: () => {}, color: undefined }],
    });
  };

  // Prompt input state
  const [promptValue, setPromptValue] = useState('');

  // When promptModal opens, set default value
  useEffect(() => {
    if (promptModal.visible) {
      setPromptValue(promptModal.defaultValue || '');
    }
  }, [promptModal.visible, promptModal.defaultValue]);

  if (coachLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors[colorScheme].tint} />
      </SafeAreaView>
    );
  }

  if (!canAccessCoachTools) {
    return (
      <CoachAccessRedirecting
        backgroundColor={Colors[colorScheme].background}
        spinnerColor={Colors[colorScheme].tint}
        textColor={Colors[colorScheme].mutedText}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'bottom']}
    >
      {/* Universal Action Modal */}
      <CustomActionModal
        visible={actionModal.visible}
        title={actionModal.title}
        message={actionModal.message}
        options={actionModal.options.map(opt => {
          // Validate onPress is a function to prevent code injection
          const handler = typeof opt.onPress === 'function' ? opt.onPress : () => {};
          return {
            ...opt,
            onPress: () => {
              setActionModal(a => ({ ...a, visible: false }));
              // Safe execution with 150ms delay
              setTimeout(() => handler(), 150);
            },
          };
        })}
        onClose={() => setActionModal(a => ({ ...a, visible: false }))}
      />

      {/* Prompt Modal (for Alert.prompt replacement) */}
      <CustomActionModal
        visible={promptModal.visible}
        title={promptModal.title}
        message={promptModal.message}
        options={[
          {
            label: 'Cancel',
            onPress: () => setPromptModal(p => ({ ...p, visible: false })),
            color: undefined,
          },
          {
            label: 'OK',
            onPress: () => {
              setPromptModal(p => ({ ...p, visible: false }));
              promptModal.onSubmit?.(promptValue);
            },
          },
        ]}
        onClose={() => setPromptModal(p => ({ ...p, visible: false }))}
      >
        {/* Input field for prompt */}
        <View style={{ marginVertical: 12 }}>
          <Text style={{ fontSize: 16, marginBottom: 6 }}>Input:</Text>
          <View style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 }}>
            <TextInput
              style={{ fontSize: 16 }}
              value={promptValue}
              onChangeText={setPromptValue}
              placeholder="Enter value..."
              autoFocus
            />
          </View>
        </View>
      </CustomActionModal>

      {/* Team selector modal */}
      <CustomActionModal
        visible={teamSelectorOpen}
        title="Select a Team"
        message={
          managedTeams.length
            ? 'Choose which roster you would like to manage.'
            : 'You do not manage any teams yet.'
        }
        options={
          managedTeams.length
            ? [{ label: 'Close', onPress: () => setTeamSelectorOpen(false), color: undefined }]
            : [
                { label: 'Cancel', onPress: () => setTeamSelectorOpen(false), color: undefined },
                {
                  label: 'Create Team',
                  onPress: () => {
                    void router.push({
                      pathname: '/create-team',
                      params: {
                        fallback: backFallback ?? '/organization?tab=teams',
                      },
                    } as any);
                  },
                  color: Colors[colorScheme].tint,
                },
              ]
        }
        onClose={() => setTeamSelectorOpen(false)}
      >
        {managedTeams.length > 0 ? (
          <View style={{ width: '100%', gap: 12 }}>
            {managedTeams.map(team => (
              <Pressable
                key={team.id}
                style={[
                  styles.teamOptionButton,
                  {
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                  },
                ]}
                onPress={() => {
                  setCurrentTeam(team);
                  setTeamSelectorOpen(false);
                }}
              >
                <Ionicons name="shield-outline" size={18} color={Colors[colorScheme].tint} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 16, fontWeight: '700', color: Colors[colorScheme].text }}
                  >
                    {team.name}
                  </Text>
                  <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 13 }}>
                    Tap to switch to this team
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ textAlign: 'center', color: Colors[colorScheme].mutedText }}>
            Create a team to unlock the season dashboard.
          </Text>
        )}
      </CustomActionModal>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* SIMPLIFIED HEADER - Team Name with Back Button */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
            padding: 20,
          },
        ]}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Pressable onPress={handleBack} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Pressable onPress={() => setTeamSelectorOpen(true)} style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                textAlign: 'center',
                color: Colors[colorScheme].text,
              }}
            >
              {currentTeam?.name || 'Select Team'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (currentTeam?.id) router.push(`/season-stats?teamId=${currentTeam.id}`);
            }}
            style={{ padding: 8 }}
          >
            <Ionicons
              name="stats-chart"
              size={22}
              color={currentTeam?.id ? Colors[colorScheme].tint : Colors[colorScheme].border}
            />
          </Pressable>
        </View>
      </View>

      {loading && (
        <View
          style={[
            styles.loadingState,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}
        >
          <ActivityIndicator color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
            Refreshing season data...
          </Text>
        </View>
      )}

      {/* Quick Actions - SIMPLIFIED: Add Event Only */}
      <View
        style={[
          styles.quickActionsCard,
          { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border },
        ]}
      >
        <Pressable
          style={[styles.quickActionButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={handleAddGame}
        >
          <Ionicons name="add-outline" size={20} color="#fff" />
          <Text style={styles.quickActionText}>Add Event</Text>
        </Pressable>
      </View>

      {/* Tab controls removed — only Schedule content is shown */}

      {/* Main Content - No Tabs, Just Schedule */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
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
            {!currentTeam?.id ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
              >
                <SectionHeader title="Select a Team to Manage" style={{ paddingHorizontal: 0 }} />
                {managedTeams.length > 0 ? (
                  managedTeams.map(t => (
                    <Pressable
                      key={t.id}
                      style={[styles.gameCard, { borderColor: Colors[colorScheme].border }]}
                      onPress={() => {
                        setCurrentTeam(t);
                        setTeamSelectorOpen(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="shield" size={18} color={Colors[colorScheme].tint} />
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: Colors[colorScheme].text,
                          }}
                        >
                          {t.name}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <EmptyState
                    icon="people-outline"
                    title="No Teams"
                    subtitle="Create a team to manage your season."
                  />
                )}
              </View>
            ) : null}
            {/* Pending Approval Queue */}
            {pendingGames.length > 0 && (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: '#F59E0B',
                    borderWidth: 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.approvalHeader,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#78350F' : '#FEF3C7',
                      borderColor: '#F59E0B',
                    },
                  ]}
                >
                  <Ionicons name="time" size={24} color="#F59E0B" />
                  <Text
                    style={[
                      styles.approvalTitle,
                      { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' },
                    ]}
                  >
                    📋 Approval Queue ({pendingGames.length})
                  </Text>
                </View>
                <Text style={[styles.approvalSubtitle, { color: Colors[colorScheme].mutedText }]}>
                  Games waiting for approval before appearing publicly
                </Text>
                {pendingGames.map(game => (
                  <View
                    key={game.id}
                    style={[
                      styles.pendingGameCard,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
                        borderColor: Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <GameCard
                      game={{
                        ...game,
                        opponent_name:
                          game.homeTeam && game.awayTeam
                            ? `${game.homeTeam} vs ${game.awayTeam}`
                            : game.opponent,
                        scheduled_date: game.date,
                        scheduled_time: game.time,
                        game_type: game.type,
                      }}
                      onPress={() => handlePendingGameAction(game)}
                      showActions={false}
                      style={{ marginBottom: 0 }}
                    />
                    <View style={styles.pendingActions}>
                      <Pressable
                        style={[styles.approveButton, { backgroundColor: '#10B981' }]}
                        onPress={() => handleApproveGame(game)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.rejectButton,
                          { backgroundColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB' },
                        ]}
                        onPress={() => handleRejectGame(game)}
                      >
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                        <Text
                          style={[
                            styles.rejectButtonText,
                            { color: colorScheme === 'dark' ? '#FCA5A5' : '#DC2626' },
                          ]}
                        >
                          Reject
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Upcoming Games */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
            >
              <SectionHeader
                title="📅 Upcoming Games"
                action={
                  <Pressable onPress={handleAddGame}>
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={Colors[colorScheme].tint}
                    />
                  </Pressable>
                }
                style={{ paddingHorizontal: 0 }}
              />

              {upcomingGames.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="No Upcoming Games"
                  subtitle="Add your first game to get started"
                  style={{ paddingVertical: 40 }}
                />
              ) : (
                upcomingGames.map(game => (
                  <GameCard
                    key={game.id}
                    game={{
                      ...game,
                      opponent_name:
                        game.homeTeam && game.awayTeam
                          ? `${game.homeTeam} vs ${game.awayTeam}`
                          : game.opponent,
                      scheduled_date: game.date,
                      scheduled_time: game.time,
                      game_type: game.type,
                    }}
                    onPress={handleGamePress}
                    onEdit={handleGameLongPress}
                    onDelete={handleDeleteGame}
                    showActions={true}
                    style={{ marginBottom: 12 }}
                  />
                ))
              )}
            </View>

            {/* Recent Games */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
            >
              <SectionHeader title="🏆 Recent Games" style={{ paddingHorizontal: 0 }} />

              {recentGames.length === 0 ? (
                <EmptyState
                  icon="time-outline"
                  title="No Recent Games"
                  subtitle="Past games will appear here"
                  style={{ paddingVertical: 40 }}
                />
              ) : (
                recentGames.map(game => (
                  <GameCard
                    key={game.id}
                    game={{
                      ...game,
                      opponent_name:
                        game.homeTeam && game.awayTeam
                          ? `${game.homeTeam} vs ${game.awayTeam}`
                          : game.opponent,
                      scheduled_date: game.date,
                      scheduled_time: game.time,
                      game_type: game.type,
                      home_score: game.score?.team,
                      away_score: game.score?.opponent,
                    }}
                    onPress={handleGamePress}
                    onEdit={handleGameLongPress}
                    onDelete={handleDeleteGame}
                    showActions={true}
                    style={{ marginBottom: 12 }}
                  />
                ))
              )}
            </View>
          </View>
        )}

        {selectedTab === 'standings' && (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  League Standings
                </Text>
                <Pressable onPress={onRefresh}>
                  <Ionicons name="refresh-outline" size={20} color={Colors[colorScheme].tint} />
                </Pressable>
              </View>

              {/* Standings Table Header */}
              <View
                style={[styles.standingsHeader, { borderBottomColor: Colors[colorScheme].border }]}
              >
                <Text
                  style={[
                    styles.standingsHeaderText,
                    styles.teamColumn,
                    { color: Colors[colorScheme].mutedText },
                  ]}
                >
                  TEAM
                </Text>
                <Text
                  style={[
                    styles.standingsHeaderText,
                    styles.recordColumn,
                    { color: Colors[colorScheme].mutedText },
                  ]}
                >
                  W-L-T
                </Text>
                <Text
                  style={[
                    styles.standingsHeaderText,
                    styles.pctColumn,
                    { color: Colors[colorScheme].mutedText },
                  ]}
                >
                  PCT
                </Text>
                <Text
                  style={[
                    styles.standingsHeaderText,
                    styles.streakColumn,
                    { color: Colors[colorScheme].mutedText },
                  ]}
                >
                  STREAK
                </Text>
              </View>

              {/* Standings Rows */}
              {standingsData.map((team, index) => (
                <View
                  key={team.id}
                  style={[
                    styles.standingsRow,
                    {
                      backgroundColor:
                        team.name === 'Our Team' ? Colors[colorScheme].tint + '10' : 'transparent',
                      borderBottomColor: Colors[colorScheme].border,
                    },
                  ]}
                >
                  <View style={styles.teamColumn}>
                    <View style={styles.teamInfo}>
                      <Text style={[styles.rankText, { color: Colors[colorScheme].mutedText }]}>
                        {index + 1}
                      </Text>
                      <Text
                        style={[
                          styles.teamName,
                          {
                            color:
                              team.name === 'Our Team'
                                ? Colors[colorScheme].tint
                                : Colors[colorScheme].text,
                            fontWeight: team.name === 'Our Team' ? '800' : '600',
                          },
                        ]}
                      >
                        {team.name}
                        {team.name === 'Our Team' && (
                          <Text style={styles.ourTeamBadge}> (You)</Text>
                        )}
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
                    <View
                      style={[
                        styles.streakBadge,
                        { backgroundColor: team.streak.startsWith('W') ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      <Text style={styles.streakText}>{team.streak}</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* League Stats Summary */}
              <View style={[styles.leagueStats, { borderTopColor: Colors[colorScheme].border }]}>
                <Text style={[styles.leagueStatsTitle, { color: Colors[colorScheme].text }]}>
                  League Averages
                </Text>
                <View style={styles.leagueStatsGrid}>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {standingsData && standingsData.length > 0
                        ? Math.round(
                            standingsData.reduce((sum, team) => sum + team.pointsFor, 0) /
                              standingsData.length
                          )
                        : 0}
                    </Text>
                    <Text
                      style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}
                    >
                      PPG
                    </Text>
                  </View>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {standingsData && standingsData.length > 0
                        ? (
                            standingsData.reduce((sum, team) => sum + team.winPercentage, 0) /
                            standingsData.length
                          ).toFixed(3)
                        : '0.000'}
                    </Text>
                    <Text
                      style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}
                    >
                      Avg Win %
                    </Text>
                  </View>
                  <View style={styles.leagueStatItem}>
                    <Text style={[styles.leagueStatValue, { color: Colors[colorScheme].text }]}>
                      {standingsData && standingsData.length > 0
                        ? standingsData.reduce(
                            (sum, team) => sum + team.wins + team.losses + team.ties,
                            0
                          ) / standingsData.length
                        : 0}
                    </Text>
                    <Text
                      style={[styles.leagueStatLabel, { color: Colors[colorScheme].mutedText }]}
                    >
                      Games
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {selectedTab === 'playoffs' && (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  Playoff Bracket
                </Text>
                <Pressable onPress={onRefresh}>
                  <Ionicons name="trophy-outline" size={20} color={Colors[colorScheme].tint} />
                </Pressable>
              </View>

              {/* Playoff Info */}
              <View
                style={[styles.playoffInfo, { backgroundColor: Colors[colorScheme].background }]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={Colors[colorScheme].tint}
                />
                <Text style={[styles.playoffInfoText, { color: Colors[colorScheme].mutedText }]}>
                  Top 4 teams qualify for playoffs. Single elimination format.
                </Text>
              </View>

              {/* Bracket Visualization */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bracketScroll}
              >
                <View style={styles.bracketContainer}>
                  {/* Round 1: Semifinals */}
                  <View style={styles.bracketRound}>
                    <Text style={[styles.roundTitle, { color: Colors[colorScheme].text }]}>
                      Semifinals
                    </Text>

                    {playoffBracket
                      .filter(match => match.round === 1)
                      .map(match => (
                        <Pressable
                          key={match.id}
                          style={[
                            styles.matchupCard,
                            {
                              backgroundColor: Colors[colorScheme].background,
                              borderColor: Colors[colorScheme].border,
                            },
                          ]}
                          onPress={() => handlePlayoffMatchupPress(match)}
                        >
                          <View style={styles.matchupHeader}>
                            <Text
                              style={[styles.matchupDate, { color: Colors[colorScheme].mutedText }]}
                            >
                              {match.gameDate
                                ? new Date(match.gameDate).toLocaleDateString()
                                : 'TBD'}
                            </Text>
                            <View
                              style={[
                                styles.matchupStatus,
                                {
                                  backgroundColor:
                                    match.status === 'completed'
                                      ? '#10B981'
                                      : match.status === 'in-progress'
                                        ? '#F59E0B'
                                        : '#6B7280',
                                },
                              ]}
                            >
                              <Text style={styles.matchupStatusText}>
                                {match.status === 'completed'
                                  ? 'FINAL'
                                  : match.status === 'in-progress'
                                    ? 'LIVE'
                                    : 'UPCOMING'}
                              </Text>
                            </View>
                          </View>

                          {/* Team 1 */}
                          <View
                            style={[
                              styles.teamMatchupRow,
                              {
                                backgroundColor:
                                  match.winner?.id === match.team1?.id
                                    ? Colors[colorScheme].tint + '20'
                                    : 'transparent',
                              },
                            ]}
                          >
                            <View style={styles.teamMatchupInfo}>
                              <Text
                                style={[
                                  styles.seedNumber,
                                  { color: Colors[colorScheme].mutedText },
                                ]}
                              >
                                {standingsData.findIndex(t => t.id === match.team1?.id) + 1}
                              </Text>
                              <Text
                                style={[
                                  styles.teamMatchupName,
                                  {
                                    color:
                                      match.winner?.id === match.team1?.id
                                        ? Colors[colorScheme].tint
                                        : Colors[colorScheme].text,
                                    fontWeight:
                                      match.winner?.id === match.team1?.id ? '800' : '600',
                                  },
                                ]}
                              >
                                {match.team1?.name || 'TBD'}
                              </Text>
                            </View>
                            {match.status === 'completed' && (
                              <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                                {match.score1}
                              </Text>
                            )}
                          </View>

                          <View
                            style={[styles.vsLine, { backgroundColor: Colors[colorScheme].border }]}
                          />

                          {/* Team 2 */}
                          <View
                            style={[
                              styles.teamMatchupRow,
                              {
                                backgroundColor:
                                  match.winner?.id === match.team2?.id
                                    ? Colors[colorScheme].tint + '20'
                                    : 'transparent',
                              },
                            ]}
                          >
                            <View style={styles.teamMatchupInfo}>
                              <Text
                                style={[
                                  styles.seedNumber,
                                  { color: Colors[colorScheme].mutedText },
                                ]}
                              >
                                {match.team2
                                  ? standingsData.findIndex(t => t.id === match.team2?.id) + 1
                                  : ''}
                              </Text>
                              <Text
                                style={[
                                  styles.teamMatchupName,
                                  {
                                    color:
                                      match.winner?.id === match.team2?.id
                                        ? Colors[colorScheme].tint
                                        : Colors[colorScheme].text,
                                    fontWeight:
                                      match.winner?.id === match.team2?.id ? '800' : '600',
                                  },
                                ]}
                              >
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
                    <View
                      style={[
                        styles.connectorLine,
                        { backgroundColor: Colors[colorScheme].border },
                      ]}
                    />
                  </View>

                  {/* Round 2: Championship */}
                  <View style={styles.bracketRound}>
                    <Text style={[styles.roundTitle, { color: Colors[colorScheme].text }]}>
                      Championship
                    </Text>

                    {playoffBracket
                      .filter(match => match.round === 2)
                      .map(match => (
                        <Pressable
                          key={match.id}
                          style={[
                            styles.matchupCard,
                            styles.championshipCard,
                            {
                              backgroundColor: Colors[colorScheme].background,
                              borderColor: '#F59E0B',
                            },
                          ]}
                          onPress={() => handlePlayoffMatchupPress(match)}
                        >
                          <View style={styles.matchupHeader}>
                            <Ionicons name="trophy" size={16} color="#F59E0B" />
                            <Text
                              style={[styles.matchupDate, { color: Colors[colorScheme].mutedText }]}
                            >
                              {match.gameDate
                                ? new Date(match.gameDate).toLocaleDateString()
                                : 'TBD'}
                            </Text>
                            <View
                              style={[
                                styles.matchupStatus,
                                {
                                  backgroundColor:
                                    match.status === 'completed'
                                      ? '#10B981'
                                      : match.status === 'in-progress'
                                        ? '#F59E0B'
                                        : '#6B7280',
                                },
                              ]}
                            >
                              <Text style={styles.matchupStatusText}>
                                {match.status === 'completed'
                                  ? 'FINAL'
                                  : match.status === 'in-progress'
                                    ? 'LIVE'
                                    : 'UPCOMING'}
                              </Text>
                            </View>
                          </View>

                          {/* Team 1 */}
                          <View
                            style={[
                              styles.teamMatchupRow,
                              {
                                backgroundColor:
                                  match.winner?.id === match.team1?.id
                                    ? '#F59E0B20'
                                    : 'transparent',
                              },
                            ]}
                          >
                            <View style={styles.teamMatchupInfo}>
                              <Text
                                style={[
                                  styles.teamMatchupName,
                                  { color: Colors[colorScheme].text, fontWeight: '600' },
                                ]}
                              >
                                {match.team1?.name || 'Winner of Semi 1'}
                              </Text>
                            </View>
                            {match.status === 'completed' && (
                              <Text style={[styles.teamScore, { color: Colors[colorScheme].text }]}>
                                {match.score1}
                              </Text>
                            )}
                          </View>

                          <View
                            style={[styles.vsLine, { backgroundColor: Colors[colorScheme].border }]}
                          />

                          {/* Team 2 */}
                          <View
                            style={[
                              styles.teamMatchupRow,
                              {
                                backgroundColor:
                                  match.winner?.id === match.team2?.id
                                    ? '#F59E0B20'
                                    : 'transparent',
                              },
                            ]}
                          >
                            <View style={styles.teamMatchupInfo}>
                              <Text
                                style={[
                                  styles.teamMatchupName,
                                  { color: Colors[colorScheme].text, fontWeight: '600' },
                                ]}
                              >
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
                <Text style={[styles.scheduleTitle, { color: Colors[colorScheme].text }]}>
                  Upcoming Games
                </Text>
                {playoffBracket
                  .filter(match => match.status === 'upcoming')
                  .map(match => (
                    <View
                      key={match.id}
                      style={[
                        styles.scheduleItem,
                        {
                          backgroundColor: Colors[colorScheme].background,
                          borderColor: Colors[colorScheme].border,
                        },
                      ]}
                    >
                      <Text style={[styles.scheduleMatchup, { color: Colors[colorScheme].text }]}>
                        {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                      </Text>
                      <Text style={[styles.scheduleDate, { color: Colors[colorScheme].mutedText }]}>
                        {match.gameDate
                          ? new Date(match.gameDate).toLocaleDateString()
                          : 'Date TBD'}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Event Modal */}
      <AddGameModal
        visible={showAddGameModal}
        onClose={() => setShowAddGameModal(false)}
        onSave={handleSaveGame}
        currentTeamName={currentTeam?.name || 'My Team'}
      />

      {/* Quick Add Event Modal */}
      <QuickAddGameModal
        visible={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false);
          setEditingGame(null);
        }}
        onSave={handleSaveQuickGame}
        currentTeamName={currentTeam?.name || 'My Team'}
        currentTeamId={currentTeam?.id || params.teamId || ''}
        userRole="coach"
        initialData={
          editingGame
            ? {
                id: editingGame.id,
                opponent: editingGame.opponent || '',
                date: editingGame.date,
                time: editingGame.time,
                type: editingGame.type === 'neutral' ? 'home' : editingGame.type, // Convert neutral to home for editing
                banner_url: editingGame.banner_url,
                status: editingGame.status,
                location: editingGame.location,
              }
            : undefined
        }
      />

      {/* Bulk Schedule Modal */}
      <BulkScheduleModal
        visible={showBulkScheduleModal}
        onClose={() => setShowBulkScheduleModal(false)}
        onSave={handleSaveBulkGames}
        currentTeamName={currentTeam?.name || 'My Team'}
        currentTeamId={params.teamId || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statsGradient: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
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
    flexWrap: 'wrap',
    rowGap: 12,
  },
  statItem: {
    width: '48%',
    alignItems: 'flex-start',
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
    borderWidth: 1,
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
  loadingState: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#D1D5DB',
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderBottomWidth: 1,
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
    borderBottomWidth: 1,
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
    borderTopWidth: 1,
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
    borderWidth: 1,
    marginBottom: 16,
    minWidth: 180,
  },
  championshipCard: {
    borderWidth: 2,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(245, 158, 11, 0.25)' }
      : {
          shadowColor: '#F59E0B',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }),
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
    height: 1,
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
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
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
    borderWidth: 1,
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
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  approvalTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  approvalSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pendingGameCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ManageSeasonScreen;
