import { Colors } from '@/constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { useOnboardingOptional } from '@/context/OnboardingContext';
import { safeGoBack } from '@/utils/navigation';

interface PendingHostRequest {
  id: string;
  title?: string;
  event_type?: string;
  approval_status?: string;
}

interface UserMeResponse {
  email?: string;
  role?: string;
  display_name?: string;
  affiliation?: string;
  dob?: string | null;
  zip_code?: string;
  avatar_url?: string | null;
  bio?: string;
  preferences?: Record<string, unknown>;
  google_id?: string | null;
  apple_id?: string | null;
  has_password?: boolean;
}

type CommentPermission = 'everyone' | 'following' | 'none';

interface Preferences {
  notifications: {
    game_event_reminders: boolean;
    team_updates: boolean;
    comments_upvotes: boolean;
    follows_notifications: boolean;
    messages_notifications: boolean;
  };
  is_parent: boolean;
  zip_code: string | null;
  profile_private: boolean;
  comment_permission: CommentPermission;
}

// Inline components for settings
function SectionCard({
  title,
  initiallyOpen = false,
  children,
}: {
  title: string;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <Pressable
        style={styles.cardHeader}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`${title} section`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.chev, { color: palette.icon }, open && styles.chevOpen]}>›</Text>
      </Pressable>
      {open && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

function NavRow({
  title,
  subtitle,
  onPress,
  destructive,
  isLast,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={[
        styles.rowBetween,
        !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.rowTitle, { color: destructive ? palette.destructive : palette.text }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.mutedSmall, { color: palette.mutedText }]}>{subtitle}</Text>
        )}
      </View>
      <Text style={[styles.chev, { color: palette.icon }]}>›</Text>
    </Pressable>
  );
}

function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <View
      style={[
        styles.rowBetween,
        !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.mutedSmall, { color: palette.mutedText }]}>{subtitle}</Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { checkAuth, markOnboardingIncompleteLocally, signOut, isAdmin } = useAuth();
  const obCtx = useOnboardingOptional();
  const setOB = obCtx?.setState;

  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [_email, setEmail] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Preferences>({
    notifications: {
      game_event_reminders: false,
      team_updates: false,
      comments_upvotes: false,
      follows_notifications: true,
      messages_notifications: true,
    },
    is_parent: false,
    zip_code: null,
    profile_private: false,
    comment_permission: 'everyone',
  });
  const [plan, setPlan] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [_pendingHostRequests, setPendingHostRequests] = useState<PendingHostRequest[]>([]);
  const [_pendingLoading, setPendingLoading] = useState(false);
  const [_pendingError, setPendingError] = useState<string | null>(null);
  const [deleteWarningVisible, setDeleteWarningVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteRequiresPassword, setDeleteRequiresPassword] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [upgradingToCoach, setUpgradingToCoach] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Clear all debounce timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  // Debounced PATCH updater for preferences
  // Only sends the specific fields being changed to avoid overwriting other preferences (e.g. role)
  type PrefsPatch = Omit<Partial<Preferences>, 'notifications'> & {
    notifications?: Partial<Preferences['notifications']>;
  };
  // Single debounce timer to batch all preference changes together
  const pendingPatch = useRef<PrefsPatch>({});
  const patchPrefs = (patch: PrefsPatch) => {
    // Clear any existing timer — we'll send one merged patch
    if (timers.current['__prefs__']) clearTimeout(timers.current['__prefs__']);

    // Accumulate patches
    pendingPatch.current = {
      ...pendingPatch.current,
      ...patch,
      notifications: {
        ...(pendingPatch.current.notifications || {}),
        ...(patch.notifications || {}),
      },
    };

    // Use functional update to get the latest state
    setPrefs(cur => {
      const newPrefs = {
        ...cur,
        ...patch,
        notifications: {
          ...cur.notifications,
          ...(patch.notifications || {}),
        },
      };

      // Debounce: send the accumulated patch after 300ms of inactivity
      const merged = pendingPatch.current;
      timers.current['__prefs__'] = setTimeout(async () => {
        const patchToSend = merged.notifications
          ? { ...merged, notifications: { ...newPrefs.notifications } }
          : { ...merged };
        // Clear accumulated patch
        pendingPatch.current = {};
        try {
          await User.updatePreferences(patchToSend);
        } catch (e: any) {
          if (__DEV__) console.error('[settings] Failed to update preferences:', e);
          Alert.alert('Update failed', 'Could not save your preference. Please try again.');
        }
      }, 300);

      return newPrefs;
    });
  };

  const _restartOnboarding = async () => {
    try {
      const me = (await User.me()) as UserMeResponse;
      const prefsFromServer = (me?.preferences || {}) as Record<string, unknown>;
      const preload: Record<string, unknown> = {
        role: prefsFromServer.role || (me?.role === 'admin' ? 'admin' : null) || 'fan',
        display_name: prefsFromServer.display_name ?? me?.display_name ?? '',
        affiliation: prefsFromServer.affiliation ?? me?.affiliation ?? '',
        dob: prefsFromServer.dob ?? me?.dob ?? null,
        zip_code: prefsFromServer.zip_code ?? me?.zip_code ?? '',
        plan: prefsFromServer.plan ?? null,
        avatar_url: me?.avatar_url ?? prefsFromServer.avatar_url ?? null,
        bio: me?.bio ?? prefsFromServer.bio ?? '',
        sports_interests: prefsFromServer.sports_interests ?? prefsFromServer.sports ?? [],
        primary_intents: prefsFromServer.primary_intents ?? [],
        authorized_users: prefsFromServer.authorized_users ?? prefsFromServer.authorized ?? [],
      };

      // Previously we attempted to record onboarding history here, but the context no longer exposes that API.
      try {
        void (await User.updatePreferences({ onboarding_completed: false }));
        // Also clear local AsyncStorage flag so next launch doesn't skip onboarding
        await markOnboardingIncompleteLocally();
      } catch (error: any) {
        if (__DEV__) console.warn('[settings] Failed to reset onboarding_completed flag:', error);
        // Continue anyway - user will be redirected to onboarding
      }
      if (setOB) void setOB(preload);
      router.replace('/onboarding/step-1-role');
    } catch (e: any) {
      // Error in onboarding restart - try fallback
      if (__DEV__) console.error('[settings] Failed to restart onboarding:', e);
      try {
        void (await User.updatePreferences({ onboarding_completed: false }));
        await markOnboardingIncompleteLocally();
      } catch (error: any) {
        if (__DEV__) console.warn('[settings] Failed to reset onboarding status:', error);
        // Continue anyway - user will be redirected to onboarding
      }
      router.replace('/onboarding');
    }
  };

  const performSignOut = async () => {
    try {
      void obCtx?.clearOnboarding?.();
    } catch (error: any) {
      if (__DEV__) console.warn('[settings] Failed to clear onboarding:', error);
    }

    try {
      await signOut();
    } catch (error: any) {
      if (__DEV__) console.warn('[settings] Sign out via AuthProvider failed:', error);
      router.replace('/sign-in');
    }
  };

  const performDeleteAccount = async () => {
    if (deletingAccount) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE to confirm account deletion.');
      return;
    }
    const pwd = deletePassword.trim();
    if (deleteRequiresPassword && !pwd) {
      Alert.alert('Password required', 'Enter your password to confirm account deletion.');
      return;
    }
    setDeletingAccount(true);
    try {
      if (deleteRequiresPassword) {
        await User.deleteAccount({ password: pwd });
      } else {
        await User.deleteAccount({ delete_confirmation: 'DELETE' });
      }
    } catch (error: any) {
      if (__DEV__) console.error('[settings] Account deletion failed:', error);
      const msg = error?.data?.message || error?.message || 'Could not delete your account.';
      Alert.alert('Delete failed', msg);
      setDeletingAccount(false);
      return;
    }

    setDeleteModalVisible(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeletingAccount(false);
    await performSignOut();
  };

  const confirmDeleteAccount = () => {
    setDeleteWarningVisible(true);
  };

  const proceedToDeleteConfirm = () => {
    setDeleteWarningVisible(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeleteModalVisible(true);
  };

  // Move the async logic into useEffect
  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = (await User.me()) as UserMeResponse;
        if (!mounted) return;
        setEmail(me?.email || null);
        // Admin status comes from useAuth().isAdmin (user.role / user.is_admin from backend)
        const serverPrefs = ((me && me.preferences) || {}) as Record<string, any>;
        setPrefs({
          notifications: {
            game_event_reminders: !!serverPrefs?.notifications?.game_event_reminders,
            team_updates: !!serverPrefs?.notifications?.team_updates,
            comments_upvotes: !!serverPrefs?.notifications?.comments_upvotes,
            follows_notifications: serverPrefs?.notifications?.follows_notifications !== false,
            messages_notifications: serverPrefs?.notifications?.messages_notifications !== false,
          },
          is_parent: !!serverPrefs?.is_parent,
          zip_code: serverPrefs?.zip_code ?? null,
          profile_private: !!serverPrefs?.profile_private,
          comment_permission:
            serverPrefs?.comment_permission === 'following' ||
            serverPrefs?.comment_permission === 'none'
              ? serverPrefs.comment_permission
              : 'everyone',
        });
        setPlan(serverPrefs?.plan ?? null);
        const effectiveRole = (serverPrefs?.role || (me?.role === 'admin' ? 'admin' : null)) as
          | string
          | null;
        setRole(effectiveRole);
        const hasOauthProvider = !!(me?.google_id || me?.apple_id);
        const hasPassword =
          typeof me?.has_password === 'boolean' ? me.has_password : !hasOauthProvider;
        setDeleteRequiresPassword(hasPassword);

        // Fetch pending host event requests for coaches
        if (effectiveRole === 'coach') {
          setPendingLoading(true);
          setPendingError(null);
          try {
            const events = (await Event.filter({
              event_type: 'host_request',
              approval_status: 'pending',
            })) as PendingHostRequest[] | { items?: PendingHostRequest[] };
            if (mounted)
              setPendingHostRequests(
                Array.isArray(events)
                  ? events
                  : (events as { items?: PendingHostRequest[] })?.items || []
              );
          } catch (e: any) {
            if (mounted) setPendingError(e?.message || 'Failed to load event requests');
          } finally {
            if (mounted) setPendingLoading(false);
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        // Handle authentication errors gracefully - don't show "Unauthorized" to user
        // AuthProvider will handle redirecting to sign-in
        const isAuthError =
          e?.status === 401 ||
          e?.status === 403 ||
          (typeof e?.message === 'string' &&
            (e.message.toLowerCase().includes('unauthorized') ||
              e.message.toLowerCase().includes('forbidden')));
        if (isAuthError) {
          if (__DEV__) console.warn('[settings] Authentication error - refreshing auth state');
          // Trigger auth check to let AuthProvider handle redirect
          try {
            await checkAuth();
          } catch (authErr) {
            if (__DEV__) console.warn('[settings] Auth check failed:', authErr);
          }
          // Don't set error - let AuthProvider redirect to sign-in
          // The error state will be cleared when user is redirected
          return;
        }
        // Only show non-auth errors to the user
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerBackTitle: 'Back',
          headerLeft: () => (
            <Pressable
              onPress={() => {
                safeGoBack(router, '/(tabs)');
              }}
              hitSlop={12}
              style={{ marginRight: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color={Colors[colorScheme ?? 'light'].tint} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
        edges={['bottom']}
      >
        <ScrollView>
          {/* Account */}
          <SectionCard title="Account" initiallyOpen>
            <NavRow
              title="Edit Username"
              onPress={() => void router.push('/settings/edit-username')}
            />
            <NavRow
              title="Reset Password"
              onPress={() => void router.push('/settings/reset-password')}
            />
            <NavRow
              title="RSVP History"
              onPress={() => void router.push('/settings/rsvp-history')}
            />
            <NavRow
              title="Followed Teams"
              isLast
              onPress={() => void router.push('/settings/followed-teams')}
            />
          </SectionCard>

          {/* Notifications */}
          <SectionCard title="Notifications" initiallyOpen>
            <SwitchRow
              title="Game/Event Reminders"
              value={!!prefs.notifications.game_event_reminders}
              onValueChange={v => patchPrefs({ notifications: { game_event_reminders: v } })}
            />
            <SwitchRow
              title="Team Updates"
              value={!!prefs.notifications.team_updates}
              onValueChange={v => patchPrefs({ notifications: { team_updates: v } })}
            />
            <SwitchRow
              title="Comments & Upvotes"
              value={!!prefs.notifications.comments_upvotes}
              onValueChange={v => patchPrefs({ notifications: { comments_upvotes: v } })}
            />
            <SwitchRow
              title="New Followers"
              subtitle="When someone follows you"
              value={!!prefs.notifications.follows_notifications}
              onValueChange={v => patchPrefs({ notifications: { follows_notifications: v } })}
            />
            <SwitchRow
              title="Direct Messages"
              subtitle="When someone sends you a DM"
              value={!!prefs.notifications.messages_notifications}
              onValueChange={v => patchPrefs({ notifications: { messages_notifications: v } })}
              isLast
            />
          </SectionCard>

          {/* Privacy */}
          <SectionCard title="Privacy">
            <SwitchRow
              title="Private Profile"
              subtitle="Only followers can see your posts, bio, and follower counts"
              value={!!prefs.profile_private}
              onValueChange={v => patchPrefs({ profile_private: v })}
            />
            <View
              style={[
                styles.rowBetween,
                { borderBottomWidth: 1, borderBottomColor: Colors[colorScheme ?? 'light'].border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Comment Permissions
                </Text>
                <Text
                  style={[styles.mutedSmall, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  {prefs.comment_permission === 'everyone'
                    ? 'Everyone'
                    : prefs.comment_permission === 'following'
                      ? 'People I Follow'
                      : 'Nobody'}
                </Text>
              </View>
              <Pressable
                style={[styles.commentPermRow]}
                onPress={() => {
                  Alert.alert('Who can comment on your posts?', undefined, [
                    {
                      text: 'Everyone',
                      onPress: () => {
                        setPrefs(p => ({ ...p, comment_permission: 'everyone' }));
                        User.updatePreferences({ comment_permission: 'everyone' }).catch(() => {
                          setPrefs(p => ({ ...p, comment_permission: prefs.comment_permission }));
                          Alert.alert('Error', 'Failed to save preference. Please try again.');
                        });
                      },
                    },
                    {
                      text: 'People I Follow',
                      onPress: () => {
                        setPrefs(p => ({ ...p, comment_permission: 'following' }));
                        User.updatePreferences({ comment_permission: 'following' }).catch(() => {
                          setPrefs(p => ({ ...p, comment_permission: prefs.comment_permission }));
                          Alert.alert('Error', 'Failed to save preference. Please try again.');
                        });
                      },
                    },
                    {
                      text: 'Nobody',
                      onPress: () => {
                        setPrefs(p => ({ ...p, comment_permission: 'none' }));
                        User.updatePreferences({ comment_permission: 'none' }).catch(() => {
                          setPrefs(p => ({ ...p, comment_permission: prefs.comment_permission }));
                          Alert.alert('Error', 'Failed to save preference. Please try again.');
                        });
                      },
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                accessibilityLabel="Comment permissions"
                accessibilityRole="button"
              >
                <Text style={[styles.chev, { color: Colors[colorScheme ?? 'light'].icon }]}>›</Text>
              </Pressable>
            </View>
            <NavRow
              title="Manage Blocked Users"
              onPress={() => void router.push('/settings/blocked-users')}
            />
            <SwitchRow
              title="I am a parent"
              subtitle="Disclose your parent status to coaches."
              value={!!prefs.is_parent}
              onValueChange={v => patchPrefs({ is_parent: v })}
              isLast
            />
          </SectionCard>

          {/* My Content */}
          <SectionCard title="My Content">
            <NavRow
              title="View Favorites"
              subtitle="Posts you've saved"
              onPress={() => void router.push('/settings/favorites')}
            />
            <NavRow
              title="Reserve Ad Space"
              subtitle="Promote your program, fundraiser, or business"
              onPress={() => void router.navigate('/submit-ad')}
            />
            <NavRow
              title="My Ads"
              subtitle="Manage your advertisements"
              isLast
              onPress={() => void router.navigate('/my-ads')}
            />
          </SectionCard>

          {/* Billing (coaches only) */}
          {role === 'coach' && (
            <SectionCard title="Billing">
              <NavRow
                title="Manage Subscription"
                isLast
                subtitle={
                  plan
                    ? `Plan: ${String(plan).charAt(0).toUpperCase() + String(plan).slice(1)}`
                    : 'No subscription'
                }
                onPress={() => void router.push('/settings/manage-subscription')}
              />
            </SectionCard>
          )}

          {/* Contact VarsityHub */}
          <SectionCard title="Contact VarsityHub Team">
            <NavRow title="Leave Feedback" onPress={() => void router.push('/settings/feedback')} />
            <NavRow
              title="Report Abuse"
              isLast
              onPress={() => void router.navigate('/report-abuse')}
            />
          </SectionCard>

          {/* Legal */}
          <SectionCard title="Legal">
            <NavRow
              title="Download My Data"
              subtitle="Request and download a privacy export archive"
              onPress={() => void router.push('/settings/data-export' as any)}
            />
            <NavRow
              title="Privacy Policy"
              onPress={() => void router.push('/settings/privacy-policy')}
            />
            <NavRow
              title="Terms of Service"
              onPress={() => void router.push('/settings/terms-of-service')}
            />
            <NavRow title="DMCA Policy" onPress={() => void router.push('/settings/dmca')} />
            <NavRow
              title="Contact Us"
              isLast
              onPress={() => void router.push('/settings/contact')}
            />
          </SectionCard>

          {/* Admin Panel - Only visible to admins */}
          {isAdmin && (
            <SectionCard title="🛡️ Admin Panel" initiallyOpen>
              <NavRow
                title="Admin Dashboard"
                subtitle="Overview and analytics"
                onPress={() => void router.navigate('/admin-dashboard')}
              />
              <NavRow
                title="Activity Log"
                subtitle="Track all admin actions"
                onPress={() => void router.navigate('/admin-activity-log')}
              />
              <NavRow
                title="Manage Users"
                subtitle="View all users, ban/unban"
                onPress={() => void router.navigate('/admin-users')}
              />
              <NavRow
                title="Manage Teams"
                subtitle="View and moderate all teams"
                onPress={() => void router.navigate('/admin-teams')}
              />
              <NavRow
                title="Manage Ads"
                subtitle="Review and moderate advertisements"
                onPress={() => void router.navigate('/admin-ads')}
              />
              <NavRow
                title="View Messages"
                subtitle="Content moderation"
                onPress={() => void router.navigate('/admin-messages')}
              />
              <NavRow
                title="Transactions"
                subtitle="Payment history and analytics"
                onPress={() => void router.navigate('/admin-transactions' as any)}
              />
              <NavRow
                title="Platform Metrics"
                subtitle="Growth trends and analytics"
                onPress={() => void router.navigate('/admin-metrics' as any)}
              />
              <NavRow
                title="Reports"
                subtitle="Review abuse reports"
                onPress={() => void router.navigate('/admin-reports' as any)}
              />
              <NavRow
                title="Create Event"
                subtitle="Create platform-wide events"
                isLast
                onPress={() => void router.navigate('/admin-create-event' as any)}
              />
            </SectionCard>
          )}

          <SectionCard title="Events">
            <NavRow
              title="Request to Host Event"
              subtitle="Submit a community event for review"
              isLast
              onPress={() => void router.push('/settings/request-host-event')}
            />
          </SectionCard>

          {/* Session */}
          <SectionCard title="Session">
            <NavRow
              title="Log Out"
              destructive
              onPress={() => {
                Alert.alert('Log out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: () => {
                      void performSignOut();
                    },
                  },
                ]);
              }}
            />
            <NavRow
              title="Delete Account"
              destructive
              isLast={role === 'coach'}
              onPress={confirmDeleteAccount}
            />
            {role !== 'coach' && role !== null && (
              <NavRow
                title="Upgrade to Coach Account"
                isLast
                onPress={() => {
                  Alert.alert(
                    'Upgrade to Coach Account',
                    "Your account will be upgraded to a coach account. You'll complete the coach setup steps next.",
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        onPress: async () => {
                          const routeCoachOnboarding = async (freshUser?: any) => {
                            try {
                              const fresh = freshUser ?? ((await User.refresh().catch(() => null)) as any);
                              const prefs = fresh?.preferences || {};
                              const hasUsername = !!(
                                fresh?.username && String(fresh.username).trim()
                              );
                              const dob = prefs.dob || prefs.date_of_birth || fresh?.dob;
                              const zip = prefs.zip_code || prefs.zip || fresh?.zip_code;
                              const hasDob = !!dob && String(dob).trim().length > 0;
                              const hasZip = !!zip && String(zip).trim().length > 0;
                              const hasCompletedBasicStep = hasUsername && hasDob && hasZip;
                              if (setOB) {
                                setOB(prev => ({
                                  ...prev,
                                  role: 'coach',
                                  plan: (prefs.plan as any) || 'rookie',
                                  username: fresh?.username ?? prev?.username,
                                  dob: (dob as string | undefined) ?? prev?.dob,
                                  zip: (zip as string | undefined) ?? prev?.zip,
                                  zip_code: (zip as string | undefined) ?? prev?.zip_code ?? null,
                                  step_2_visited: hasCompletedBasicStep,
                                  step_3_visited: false,
                                }));
                              }
                              setPlan((prefs.plan as string | null) ?? 'rookie');
                              if (hasUsername && hasDob && hasZip) {
                                router.push('/onboarding/step-3-league');
                              } else {
                                router.push('/onboarding/step-2-basic');
                              }
                            } catch {
                              router.push('/onboarding/step-2-basic');
                            }
                          };
                          try {
                            setUpgradingToCoach(true);
                            await User.upgradeToCoach('rookie');
                            const fresh = (await User.refresh().catch(() => null)) as any;
                            setRole('coach');
                            setPlan('rookie');
                            await markOnboardingIncompleteLocally();
                            await checkAuth().catch(() => {});
                            await routeCoachOnboarding(fresh);
                          } catch (e: any) {
                            const msg = e?.data?.error || e?.message || '';
                            if (msg.toLowerCase().includes('already a coach')) {
                              setRole('coach');
                              setPlan('rookie');
                              await checkAuth().catch(() => {});
                              await routeCoachOnboarding();
                              return;
                            }
                            Alert.alert('Error', msg || 'Failed to upgrade. Please try again.');
                          } finally {
                            setUpgradingToCoach(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            )}
            {upgradingToCoach && (
              <View style={[styles.rowBetween, { opacity: 0.75 }]}>
                <Text style={[styles.mutedSmall, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                  Upgrading your account...
                </Text>
              </View>
            )}
          </SectionCard>

          {/* Copyright Footer */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 12,
                color: Colors[colorScheme ?? 'light'].mutedText,
                textAlign: 'center',
              }}
            >
              © 2025 LIME PRODUCTIONS. All rights reserved.
            </Text>
          </View>
        </ScrollView>
        <Modal
          visible={deleteWarningVisible}
          animationType="slide"
          onRequestClose={() => setDeleteWarningVisible(false)}
        >
          <View
            style={[
              styles.deleteWarningPage,
              { backgroundColor: Colors[colorScheme ?? 'light'].background },
            ]}
          >
            <View style={styles.deleteWarningContent}>
              <Text
                style={[styles.deleteWarningTitle, { color: Colors[colorScheme ?? 'light'].text }]}
              >
                Are you sure?
              </Text>
              <Text
                style={[
                  styles.deleteWarningBody,
                  { color: Colors[colorScheme ?? 'light'].mutedText },
                ]}
              >
                This will permanently delete your account and all your posts and media.
              </Text>
            </View>
            <View style={styles.deleteWarningActions}>
              <Pressable
                style={[
                  styles.deleteWarningBtn,
                  { backgroundColor: Colors[colorScheme ?? 'light'].border },
                ]}
                onPress={() => setDeleteWarningVisible(false)}
              >
                <Text
                  style={[
                    styles.deleteWarningBtnText,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.deleteWarningBtn, { backgroundColor: '#DC2626' }]}
                onPress={proceedToDeleteConfirm}
              >
                <Text style={[styles.deleteWarningBtnText, { color: '#FFFFFF' }]}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!deletingAccount) setDeleteModalVisible(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <View style={styles.deleteModalBackdrop}>
              <View
                style={[
                  styles.deleteModalCard,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                  },
                ]}
              >
                <Text
                  style={[styles.deleteModalTitle, { color: Colors[colorScheme ?? 'light'].text }]}
                >
                  Delete Account
                </Text>
                <Text
                  style={[
                    styles.deleteModalBody,
                    { color: Colors[colorScheme ?? 'light'].mutedText },
                  ]}
                >
                  {deleteRequiresPassword
                    ? 'This permanently deletes your account. Type DELETE and enter your password to confirm.'
                    : 'This permanently deletes your account. Type DELETE to confirm.'}
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!deletingAccount}
                  placeholder="DELETE"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].mutedText}
                  style={[
                    styles.deleteInput,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      borderColor: Colors[colorScheme ?? 'light'].border,
                    },
                  ]}
                />
                {deleteRequiresPassword && (
                  <TextInput
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    editable={!deletingAccount}
                    placeholder="Password"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].mutedText}
                    secureTextEntry
                    style={[
                      styles.deleteInput,
                      {
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].border,
                        marginTop: 8,
                      },
                    ]}
                  />
                )}
                <View style={styles.deleteModalActions}>
                  <Pressable
                    style={[styles.deleteActionBtn, styles.deleteCancelBtn]}
                    onPress={() => {
                      if (!deletingAccount) setDeleteModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.deleteActionText,
                        { color: Colors[colorScheme ?? 'light'].text },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.deleteActionBtn,
                      styles.deleteConfirmBtn,
                      (deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                        (deleteRequiresPassword && !deletePassword.trim()) ||
                        deletingAccount) &&
                        styles.deleteConfirmBtnDisabled,
                    ]}
                    disabled={
                      deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                      (deleteRequiresPassword && !deletePassword.trim()) ||
                      deletingAccount
                    }
                    onPress={() => {
                      void performDeleteAccount();
                    }}
                  >
                    <Text style={styles.deleteConfirmText}>
                      {deletingAccount ? 'Deleting…' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
  error: { marginHorizontal: 16, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 6, borderRadius: 12, borderWidth: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardBody: { paddingHorizontal: 12, paddingBottom: 4 },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowTitle: { fontWeight: '600' },
  mutedSmall: { fontSize: 12 },
  chev: { fontSize: 20, transform: [{ rotate: '0deg' }] },
  chevOpen: { transform: [{ rotate: '90deg' }] },
  commentPermRow: { padding: 8 },
  destructive: { color: '#DC2626' },
  selectedValue: { fontSize: 14 },
  themeOptions: { marginTop: 8, gap: 8 },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  themeOptionSelected: {
    backgroundColor: '#f3f4f6',
  },
  themeOptionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  themeOptionIndicatorSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea4',
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  themeOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  themeOptionSubtext: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  deleteWarningPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deleteWarningContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  deleteWarningTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteWarningBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  deleteWarningActions: {
    width: '100%',
    gap: 12,
  },
  deleteWarningBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteWarningBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  deleteModalBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 0.8,
  },
  deleteModalActions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  deleteActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteCancelBtn: {
    backgroundColor: '#D1D5DB',
  },
  deleteConfirmBtn: {
    backgroundColor: '#DC2626',
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.5,
  },
  deleteActionText: {
    fontWeight: '600',
  },
  deleteConfirmText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
