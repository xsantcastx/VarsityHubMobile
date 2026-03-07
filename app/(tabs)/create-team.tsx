import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView as RNScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Subscriptions, Team, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import KeyboardAwareScreen from '@/components/KeyboardAwareScreen';
// @ts-ignore
import { httpPost } from '@/api/http';
import { getApiBaseUrl } from '@/api/http';

type TeamLimitSummary = {
  owned_teams: number;
  max_teams: number | null;
  can_create_more: boolean;
  remaining?: number;
  subscription_tier?: string;
  upgrade_required?: boolean;
};

const normalizePlanTier = (tier?: string | null) => {
  const value = String(tier ?? 'rookie').toLowerCase();
  if (value === 'free') return 'rookie';
  if (['rookie', 'veteran', 'legend'].includes(value)) return value;
  return value;
};

const formatPlanBadge = (tier?: string | null) => normalizePlanTier(tier).toUpperCase();
const formatPlanDisplay = (tier?: string | null) => {
  const normalized = normalizePlanTier(tier);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function CreateTeamScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [customSport, setCustomSport] = useState('');
  const [clubType, setClubType] = useState<'sport' | 'extracurricular'>('sport');
  const [extracurricularCategory, setExtracurricularCategory] = useState('');
  const [seasonType, setSeasonType] = useState(''); // Fall, Spring, Summer, Winter
  const [seasonYear, setSeasonYear] = useState(''); // Year editable by user
  const [teamColor, setTeamColor] = useState(''); // Team primary color
  const [organizationName, setOrganizationName] = useState(''); // School/organization name
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [teamLimits, setTeamLimits] = useState<TeamLimitSummary | null>(null);
  const [limitsError, setLimitsError] = useState<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const limitReached = !!teamLimits && teamLimits.can_create_more === false;
  const planBadgeText = formatPlanBadge(teamLimits?.subscription_tier);
  const planDisplayName = formatPlanDisplay(teamLimits?.subscription_tier);
  const maxTeamsLabel =
    teamLimits && typeof teamLimits.max_teams === 'number' && Number.isFinite(teamLimits.max_teams)
      ? teamLimits.max_teams
      : '∞';
  const remainingCount =
    teamLimits && typeof teamLimits.remaining === 'number'
      ? Math.max(teamLimits.remaining, 0)
      : null;

  const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Tennis', 'Volleyball', 'Swimming', 'Track & Field', 'Other'];
  
  // Predefined team colors
  const teamColors = [
    { name: 'Red', value: '#DC2626' },
    { name: 'Blue', value: '#2563EB' },
    { name: 'Green', value: '#16A34A' },
    { name: 'Purple', value: '#9333EA' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Navy', value: '#1E3A8A' },
    { name: 'Maroon', value: '#7F1D1D' },
    { name: 'Black', value: '#0F172A' },
    { name: 'Gold', value: '#F59E0B' },
  ];
  
  // Auto-suggest year based on season selection
  const getSuggestedYear = (seasonName: string) => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    switch (seasonName) {
      case 'Fall':
        // Fall typically starts Aug-Sept, suggest current year if before Dec, else next year
        return currentMonth < 11 ? currentYear : currentYear + 1;
      case 'Winter':
        // Winter starts Dec-Jan, suggest current year if in Nov-Dec, else current year (for Jan-Mar)
        return currentMonth >= 10 ? currentYear : currentYear;
      case 'Spring':
        // Spring starts Mar-Apr, suggest current year if before Sept, else next year
        return currentMonth < 8 ? currentYear : currentYear + 1;
      case 'Summer':
        // Summer starts Jun-Jul, suggest current year if before Dec, else next year
        return currentMonth < 11 ? currentYear : currentYear + 1;
      default:
        return currentYear;
    }
  };

  // Handle season type selection
  const handleSeasonTypeSelect = (type: string) => {
    setSeasonType(type);
    const suggestedYear = getSuggestedYear(type);
    setSeasonYear(suggestedYear.toString());
  };

  // Combined season string for API
  const season = seasonType && seasonYear ? `${seasonType} ${seasonYear}` : '';

  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a team logo.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
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
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
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

  useEffect(() => {
    let mounted = true;
    const loadLimits = async () => {
      setLimitsLoading(true);
      setLimitsError(null);
      try {
        const summary: TeamLimitSummary = await Team.limits();
        if (!mounted) return;
        setTeamLimits(summary);
      } catch (err: any) {
        if (!mounted) return;
        setTeamLimits(null);
        const status = err?.status ?? err?.response?.status;
        const message =
          status === 401
            ? 'Sign in with a coach account to view your plan limits.'
            : err?.message || 'Unable to load plan limits.';
        setLimitsError(message);
      } finally {
        if (mounted) setLimitsLoading(false);
      }
    };
    void loadLimits();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    if (!name.trim()) { 
      Alert.alert('Team name required', 'Please enter a team name to continue.');
      return; 
    }
    
    if (!teamColor) {
      Alert.alert('Team color required', 'Please select a team color to continue.');
      return;
    }
    
    setSubmitting(true);
    try {
      let user;
      try { 
        user = await User.me(); 
      } catch { 
        Alert.alert('Sign in required', 'Please sign in to create a team.'); 
        setSubmitting(false); 
        return; 
      }
      // Guard: Only coaches may create teams
      const role = user?.preferences?.role;
      if (role !== 'coach') {
        Alert.alert('Access Restricted', 'Only coach accounts can create teams.');
        setSubmitting(false);
        return;
      }
      
      // Check plan tier limits
      const userRole = user?.preferences?.role; // Already guaranteed coach above
      const userPlan = user?.preferences?.plan || 'rookie'; // Default to rookie if not set

      let latestLimits: TeamLimitSummary | null = teamLimits;
      try {
        const refreshedLimits: TeamLimitSummary = await Team.limits();
        latestLimits = refreshedLimits;
        setTeamLimits(latestLimits);
      } catch {
        // non-blocking
      }
      const teamCount = latestLimits?.owned_teams ?? user?._count?.teams ?? 0;
      const canCreateMore = latestLimits?.can_create_more ?? true;
      
      // Only enforce limits for coaches
      if (userRole === 'coach') {
        if (!canCreateMore) {
          if (Platform.OS === 'ios') {
            Alert.alert(
              'Limit Reached',
              "You've reached the maximum number of teams.",
              [{ text: 'OK', onPress: () => setSubmitting(false) }]
            );
          } else {
            Alert.alert(
              'Limit Reached',
              `Your ${userPlan === 'rookie' ? 'Rookie' : userPlan === 'veteran' ? 'Veteran' : 'current'} plan has reached its team limit. Upgrade to add more teams.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => setSubmitting(false) },
                { text: 'View Plans', onPress: () => { setSubmitting(false); router.push('/subscription-paywall'); } }
              ]
            );
          }
          return;
        }

        if (userPlan === 'rookie' && teamCount >= 2) {
          if (Platform.OS === 'ios') {
            Alert.alert(
              'Limit Reached',
              "You've reached the maximum number of teams.",
              [{ text: 'OK', onPress: () => setSubmitting(false) }]
            );
            return;
          }
          const newTeamCount = teamCount + 1;
          Alert.alert(
            'Upgrade Required',
            `First two teams are free on the Rookie plan. Adding this team requires upgrading to the Veteran plan at $${(newTeamCount * 1.0).toFixed(2)}/month (${newTeamCount} teams × $1.00).`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setSubmitting(false) },
              {
                text: 'Upgrade & Continue',
                onPress: async () => {
                  try {
                    // Use in-app PaymentSheet instead of leaving the app
                    const res: any = await httpPost('/payments/create-payment-sheet', { plan: 'veteran', team_count: newTeamCount });
                    if (res?.paymentIntent) {
                      const { error: initError } = await initPaymentSheet({
                        paymentIntentClientSecret: res.paymentIntent,
                        customerEphemeralKeySecret: res.ephemeralKey,
                        customerId: res.customer,
                        merchantDisplayName: 'Varsity Hub',
                      });
                      if (initError) {
                        Alert.alert('Error', initError.message);
                        setSubmitting(false);
                        return;
                      }
                      const { error } = await presentPaymentSheet();
                      if (error) {
                        if (error.code !== 'Canceled') Alert.alert('Payment Failed', error.message);
                        setSubmitting(false);
                        return;
                      }
                      // Payment succeeded — check if plan updated
                      try {
                        const me: any = await User.me();
                        const updatedPlan = me?.preferences?.plan ?? 'rookie';
                        if (updatedPlan === 'veteran') {
                          await proceedWithTeamCreation(me);
                          return;
                        }
                      } catch {
                        // ignore retry errors
                      }
                      Alert.alert(
                        'Payment Processing',
                        'Your payment was submitted. Please try creating your team again in a moment.'
                      );
                      setSubmitting(false);
                    } else {
                      Alert.alert('Error', 'Unable to start checkout. Please try again.');
                      setSubmitting(false);
                    }
                  } catch (err: any) {
                    console.error('Upgrade to Veteran failed:', err);
                    const rawMsg = (err?.data?.error || err?.message || '') as string;
                    const safeMsg = /prod_|price_/i.test(rawMsg)
                      ? 'Failed to start upgrade. Please try again or contact support.'
                      : (rawMsg || 'Failed to start upgrade checkout. Please try again.');
                    Alert.alert('Error', safeMsg);
                    setSubmitting(false);
                  }
                }
              }
            ]
          );
          return;
        }
        
        if (userPlan === 'veteran') {
          // Veteran plan: Per-team monthly charge - update subscription quantity
          const newTeamCount = teamCount + 1;
          Alert.alert(
            'Add Team',
            `Adding this team will increase your monthly charge to $${(newTeamCount * 1.0).toFixed(2)}/month (${newTeamCount} teams × $1.00). Your subscription will be updated automatically.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setSubmitting(false) },
              { 
                text: 'Continue', 
                onPress: async () => {
                  try {
                    // Update subscription quantity before creating the team
                    await Subscriptions.updateQuantity(newTeamCount);
                    await proceedWithTeamCreation(user);
                  } catch (err: any) {
                    console.error('Failed to update subscription:', err);
                    Alert.alert('Error', err?.message || 'Failed to update subscription. Please try again or contact support.');
                    setSubmitting(false);
                  }
                }
              }
            ]
          );
          return; // Wait for user confirmation
        }
        
        // Legend plan: unlimited teams, proceed
      }
      
      // For non-coaches or Legend plan, proceed directly
      await proceedWithTeamCreation(user);
      
    } catch (e: any) {
      console.error('Team creation error:', e);
      Alert.alert('Error', e?.message || 'Failed to create team. Please try again.');
      setSubmitting(false);
    }
  };
  
  const proceedWithTeamCreation = async (_user?: any) => {
    try {
      let logoUrl = null;
      
      // Upload logo if one was selected
      if (logoUri) {
        try {
          const uploaded = await uploadFile(getApiBaseUrl(), logoUri, 'team-logo.jpg', 'image/jpeg');
          logoUrl = uploaded?.path || uploaded?.url;
        } catch (error) {
          console.error('Logo upload failed:', error);
          Alert.alert('Warning', 'Team created but logo upload failed. You can add a logo later.');
        }
      }
      // Let /teams/create handle org lookup + creation atomically.
      // This avoids extra /organizations requests and timeout chains.

      const teamData = {
        name: name.trim(),
        description: description.trim() || undefined,
        sport: clubType === 'sport' ? (sport === 'Other' ? (customSport.trim() || 'Other') : (sport || undefined)) : undefined,
        club_type: clubType,
        extracurricular_category: clubType === 'extracurricular' ? (extracurricularCategory.trim() || undefined) : undefined,
        season: season || undefined,
        primary_color: teamColor || undefined,
        organization_name: organizationName.trim() || undefined,
        logo_url: logoUrl || undefined, // Use uploaded URL
      };
      
      const team = await Team.create(teamData);
      Alert.alert('Success!', 'Your team has been created successfully.', [
        { text: 'View Team', onPress: () => router.replace(`/team-profile?id=${team.id}`) }
      ]);
    } catch (e: any) {
      console.error('Team creation error in proceedWithTeamCreation:', e);
      Alert.alert('Error', e?.message || 'Failed to create team. Please try again.');
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Create Team', headerShown: false }} />
      
      <KeyboardAwareScreen 
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
            <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Create Team</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <LinearGradient colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + 'CC']} style={styles.introIcon}>
            <MaterialIcons name="group" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.introTitle, { color: Colors[colorScheme].text }]}>
            Start Your Team
          </Text>
          <Text style={[styles.introSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Create a team to organize players, schedule games, and manage your season.
          </Text>
        </View>

        {/* Plan Limit Summary */}
        {!limitsLoading && (teamLimits || limitsError) && (
          <View
            style={[
              styles.limitCard,
              { 
                borderColor: limitReached ? '#F97316' : Colors[colorScheme].border,
                backgroundColor: limitReached ? '#FEF3C7' : Colors[colorScheme].surface
              }
            ]}
          >
            <View style={styles.limitHeader}>
              <Text style={[styles.limitBadge, { backgroundColor: Colors[colorScheme].tint + '15', color: Colors[colorScheme].tint }]}>
                {planBadgeText}
              </Text>
              {limitReached && Platform.OS !== 'ios' && (
                <Pressable onPress={() => router.push('/subscription-paywall')} style={styles.limitUpgradeLink}>
                  <MaterialIcons name="arrow-circle-right" size={18} color={Colors[colorScheme].tint} />
                  <Text style={[styles.limitUpgradeText, { color: Colors[colorScheme].tint }]}>View plans</Text>
                </Pressable>
              )}
            </View>
            {teamLimits ? (
              <>
                <Text style={[styles.limitTitle, { color: Colors[colorScheme].text }]}>
                  {limitReached
                    ? 'Team limit reached'
                    : `You have created ${teamLimits.owned_teams ?? 0} of ${maxTeamsLabel} teams`}
                </Text>
                <Text style={[styles.limitDescription, { color: Colors[colorScheme].mutedText }]}>
                  {limitReached
                    ? (Platform.OS === 'ios' ? "You've reached the maximum number of teams." : 'Upgrade your plan to add more teams and authorized staff.')
                    : remainingCount === null
                      ? 'Unlimited teams on this plan.'
                      : `${remainingCount} team${remainingCount === 1 ? '' : 's'} remaining on your plan.`}
                </Text>
              </>
            ) : (
              <Text style={[styles.limitDescription, { color: Colors[colorScheme].mutedText }]}>
                {limitsError}
              </Text>
            )}
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Team Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
              Team Name <Text style={{ color: Colors[colorScheme].destructive }}>*</Text>
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <MaterialIcons name="emoji-events" size={20} color={Colors[colorScheme].mutedText} />
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
                    <MaterialIcons name="camera-alt" size={32} color={Colors[colorScheme].mutedText} />
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
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.logoActionText}>
                    {logoUri ? 'Change' : 'Add Logo'}
                  </Text>
                </Pressable>
                {logoUri && (
                  <Pressable 
                    style={[styles.logoActionButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => setLogoUri(null)}
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#fff" />
                    <Text style={styles.logoActionText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
              Upload a square logo (PNG or JPG) for your team. This will be displayed on games and team profiles.
            </Text>
          </View>

          {/* Club Type Selection */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Team Type</Text>
            <View style={styles.clubTypeContainer}>
              <Pressable
                style={[
                  styles.clubTypeButton,
                  { 
                    backgroundColor: clubType === 'sport' ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                    borderColor: clubType === 'sport' ? Colors[colorScheme].tint : Colors[colorScheme].border
                  }
                ]}
                onPress={() => {
                  setClubType('sport');
                  setExtracurricularCategory('');
                }}
              >
                <MaterialIcons name="sports-football" size={20} color={clubType === 'sport' ? '#fff' : Colors[colorScheme].text} />
                <Text style={[
                  styles.clubTypeText,
                  { color: clubType === 'sport' ? '#fff' : Colors[colorScheme].text }
                ]}>
                  Sport Team
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.clubTypeButton,
                  { 
                    backgroundColor: clubType === 'extracurricular' ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                    borderColor: clubType === 'extracurricular' ? Colors[colorScheme].tint : Colors[colorScheme].border,
                    opacity: (teamLimits?.subscription_tier || 'rookie').toLowerCase() === 'legend' ? 1 : 0.5
                  }
                ]}
                onPress={async () => {
                  const userPlan = (teamLimits?.subscription_tier || 'rookie').toLowerCase();
                  if (userPlan !== 'legend') {
                    if (Platform.OS === 'ios') {
                      Alert.alert(
                        'Not Available',
                        'Extracurricular clubs are not available on your current plan.'
                      );
                    } else {
                      Alert.alert(
                        'Legend Plan Required',
                        'Extracurricular clubs (Theater, Chess, Debate, etc.) require the Legend plan ($19.99/year). Upgrade to create clubs beyond sports teams.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'View Plans',
                            onPress: () => router.push('/subscription-paywall'),
                            style: 'default'
                          }
                        ]
                      );
                    }
                    return;
                  }
                  setClubType('extracurricular');
                  setSport('');
                }}
              >
                <MaterialIcons name="school" size={20} color={clubType === 'extracurricular' ? '#fff' : Colors[colorScheme].text} />
                <Text style={[
                  styles.clubTypeText,
                  { color: clubType === 'extracurricular' ? '#fff' : Colors[colorScheme].text }
                ]}>
                  Extracurricular Club
                </Text>
                {(teamLimits?.subscription_tier || 'rookie').toLowerCase() !== 'legend' && (
                  <View style={styles.legendBadge}>
                    <Text style={styles.legendBadgeText}>LEGEND</Text>
                  </View>
                )}
              </Pressable>
            </View>
            {clubType === 'extracurricular' && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Club Category</Text>
                <View style={[styles.inputContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                  <MaterialIcons name="local-library" size={20} color={Colors[colorScheme].mutedText} />
                  <TextInput
                    value={extracurricularCategory}
                    onChangeText={setExtracurricularCategory}
                    placeholder="e.g. Theater, Chess, Debate, Robotics"
                    placeholderTextColor={Colors[colorScheme].mutedText}
                    style={[styles.textInput, { color: Colors[colorScheme].text }]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Sport Selection (only for sport teams) */}
          {clubType === 'sport' && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Sport</Text>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
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
              </RNScrollView>
              {sport === 'Other' && (
                <TextInput
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                    color: Colors[colorScheme].text,
                  }}
                  value={customSport}
                  onChangeText={setCustomSport}
                  placeholder="Enter your sport name"
                  placeholderTextColor={Colors[colorScheme].mutedText}
                />
              )}
            </View>
          )}

          {/* Season Selection */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Season</Text>
            
            {/* Season Type Picker */}
            <View style={styles.seasonGrid}>
              {['Fall', 'Winter', 'Spring', 'Summer'].map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.seasonButton,
                    { 
                      backgroundColor: seasonType === type ? Colors[colorScheme].tint + '15' : Colors[colorScheme].surface,
                      borderColor: seasonType === type ? Colors[colorScheme].tint : Colors[colorScheme].border
                    }
                  ]}
                  onPress={() => handleSeasonTypeSelect(type)}
                >
                  <MaterialIcons 
                    name="event" 
                    size={16} 
                    color={seasonType === type ? Colors[colorScheme].tint : Colors[colorScheme].mutedText} 
                  />
                  <Text style={[
                    styles.seasonButtonText,
                    { color: seasonType === type ? Colors[colorScheme].tint : Colors[colorScheme].text }
                  ]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Year Input (editable) */}
            {seasonType && (
              <View style={[styles.yearInputContainer, { marginTop: 12 }]}>
                <Text style={[styles.fieldLabelSmall, { color: Colors[colorScheme].mutedText }]}>Year</Text>
                <View style={[styles.yearInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                  <TextInput
                    value={seasonYear}
                    onChangeText={setSeasonYear}
                    placeholder="2025"
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholderTextColor={Colors[colorScheme].mutedText}
                    style={[styles.yearInputText, { color: Colors[colorScheme].text }]}
                  />
                </View>
                {season && (
                  <Text style={[styles.seasonPreview, { color: Colors[colorScheme].mutedText }]}>
                    Season: {season}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Team Color Picker */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>
              Team Color <Text style={{ color: Colors[colorScheme].destructive }}>*</Text>
            </Text>
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText, marginBottom: 12 }]}>
              Select your team's primary color for branding
            </Text>
            <View style={styles.colorGrid}>
              {teamColors.map((color) => (
                <Pressable
                  key={color.value}
                  style={[
                    styles.colorButton,
                    { 
                      backgroundColor: color.value,
                      borderWidth: teamColor === color.value ? 3 : 0,
                      borderColor: teamColor === color.value ? Colors[colorScheme].text : 'transparent',
                    }
                  ]}
                  onPress={() => setTeamColor(color.value)}
                >
                  {teamColor === color.value && (
                    <MaterialIcons name="check" size={20} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>
            {teamColor && (
              <Text style={[styles.colorPreview, { color: Colors[colorScheme].mutedText }]}>
                Selected: {teamColors.find(c => c.value === teamColor)?.name}
              </Text>
            )}
          </View>

          {/* Organization/School Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>School / Organization</Text>
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText, marginBottom: 8 }]}>
              Enter your school or organization name (optional)
            </Text>
            <TextInput
              value={organizationName}
              onChangeText={setOrganizationName}
              placeholder="e.g., Lincoln High School"
              placeholderTextColor={Colors[colorScheme].mutedText}
              style={[styles.textInput, { 
                backgroundColor: Colors[colorScheme].surface, 
                borderColor: Colors[colorScheme].border,
                color: Colors[colorScheme].text 
              }]}
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: Colors[colorScheme].text }]}>Description</Text>
              <Text style={[styles.charCount, { color: description.length > 500 ? Colors[colorScheme].destructive : Colors[colorScheme].mutedText }]}>
                {description.length}/500
              </Text>
            </View>
            <View style={[styles.textAreaContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: description.length > 500 ? '#DC2626' : Colors[colorScheme].border }]}>
              <TextInput
                value={description}
                onChangeText={(text) => {
                  if (text.length <= 500) {
                    setDescription(text);
                  }
                }}
                placeholder="Tell players what this team is about..."
                placeholderTextColor={Colors[colorScheme].mutedText}
                style={[styles.textArea, { color: Colors[colorScheme].text }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>
        </View>

        {/* Create Button */}
        <View style={styles.actionSection}>
          {limitReached && (
            <View style={styles.limitWarning}>
              <MaterialIcons name="error" size={18} color={colorScheme === 'dark' ? Colors[colorScheme].tint : '#B45309'} />
              <Text style={styles.limitWarningText}>
                {Platform.OS === 'ios'
                  ? "You've reached the maximum number of teams."
                  : `You've reached the ${planDisplayName} plan limit. Upgrade to create more teams.`}
              </Text>
            </View>
          )}
          <Pressable
            style={[
              styles.createButton,
              { 
                backgroundColor: submitting || limitReached ? Colors[colorScheme].mutedText : Colors[colorScheme].tint,
                opacity: submitting || limitReached ? 0.5 : 1
              }
            ]}
            onPress={onSubmit}
            disabled={submitting || limitReached}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialIcons name="check" size={20} color="#fff" />
            )}
            <Text style={styles.createButtonText}>
              {submitting ? 'Creating Team...' : 'Create Team'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScreen>
    </SafeAreaView>
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
  limitCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  limitBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  limitUpgradeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  limitUpgradeText: {
    fontWeight: '600',
  },
  limitTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  limitDescription: {
    fontSize: 14,
    lineHeight: 20,
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
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  charCount: {
    fontSize: 13,
    fontWeight: '500',
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
  clubTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  clubTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    position: 'relative',
  },
  clubTypeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  legendBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  legendBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
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
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: 'transparent', // Will be overridden with theme color
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
  // Year input styles
  yearInputContainer: {
    gap: 8,
  },
  fieldLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yearInput: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  yearInputText: {
    fontSize: 16,
    fontWeight: '600',
  },
  seasonPreview: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  colorPreview: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});

