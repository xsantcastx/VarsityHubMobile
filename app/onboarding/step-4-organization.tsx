import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/Colors';
import { Input } from '@/shared/components';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
// @ts-ignore
import { Organization, Team } from '@/api/entities';
import { autocompleteLocations, PlaceSuggestion } from '@/api/geocoding';
import { httpPost } from '@/api/http';
import { useOnboarding } from '@/context/OnboardingContext';
import { useOrganizationSearch } from '@/hooks/useOrganizationSearch';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step4Organization() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  
  // Form state
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [orgType, setOrgType] = useState<'school' | 'club' | 'league' | 'tournament' | 'university' | 'college' | 'professional' | null>(null);
  const [saving, setSaving] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [existingTeam, setExistingTeam] = useState<any>(null);
  const [existingOrg, setExistingOrg] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  
  // Search/Join state
  const [showSearch, setShowSearch] = useState(false);
  const [searchZip, setSearchZip] = useState(ob.zip || '');
  const { organizations: nearbyOrgs, loading: searching, search: searchOrganizations, clear: clearOrganizations } = useOrganizationSearch(false);
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [selectedPlaceZip, setSelectedPlaceZip] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [locationQuerying, setLocationQuerying] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const locationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Check email verification status
  useEffect(() => {
    void (async () => {
      try {
        const me: any = await (await import('@/api/entities')).User.me();
        setEmailVerified(me?.email_verified ?? null);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Check if user already has a team or organization in the database
  useEffect(() => {
    void (async () => {
      setChecking(true);
      try {
        const e2e = String(process.env.EXPO_PUBLIC_E2E || '').trim() === '1';
        // Check for existing managed teams
        const teams = await Team.managed().catch((err: any) => {
          // Gracefully ignore unauthenticated errors so search still works
          if (err?.status === 401 || err?.message === 'Authentication required') return [];
          throw err;
        });
        if (teams && teams.length > 0) {
          const firstTeam = teams[0];
          setExistingTeam(firstTeam);
          setAlreadyExists(true);
          // Update onboarding state with existing team
          setOB((prev) => ({ 
            ...prev, 
            team_id: firstTeam.id, 
            team_name: firstTeam.name 
          }));
          
          // Auto-skip this step if team already exists
          if (!e2e) {
            setProgress(5); // step-6
            if (returnToConfirmation) {
              router.replace('/onboarding/step-10-confirmation');
            } else {
              router.replace('/onboarding/step-6-authorized-users');
            }
            return;
          }
        } else if (ob.plan === 'veteran' || ob.plan === 'legend') {
          // Check for existing organizations that the user can manage
          const orgs = await Organization.mine().catch((err: any) => {
            if (err?.status === 401 || err?.message === 'Authentication required') return [];
            throw err;
          });
          if (orgs && orgs.length > 0) {
            const firstOrg = orgs[0];
            setExistingOrg(firstOrg);
            setOrgName(firstOrg.name || '');
            setAlreadyExists(true);
            // Update onboarding state with existing org
            setOB((prev) => ({ 
              ...prev, 
              organization_id: firstOrg.id, 
              organization_name: firstOrg.name 
            }));
            
            // Auto-skip this step if org already exists
            if (!e2e) {
              setProgress(5); // step-6
              if (returnToConfirmation) {
                router.replace('/onboarding/step-10-confirmation');
              } else {
                router.replace('/onboarding/step-6-authorized-users');
              }
              return;
          }
          }
        }
      } catch (err: any) {
        // Only surface non-auth errors; auth errors are expected when user is not signed in yet
        if (err?.status !== 401 && err?.message !== 'Authentication required') {
          Alert.alert('Error', 'Unable to check existing organizations. Please try again.');
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [ob.plan, returnToConfirmation, router, setOB, setProgress]);

  useEffect(() => {
    if (ob.organization_name && !existingOrg) setOrgName(ob.organization_name);
    if ((ob.affiliation as string) === 'school') setOrgType('school');
    else if ((ob.affiliation as string) === 'club') setOrgType('club');
    else if ((ob.affiliation as string) === 'league') setOrgType('league');
    else if ((ob.affiliation as string) === 'tournament') setOrgType('tournament');
    
    // Check if team or organization already exists in onboarding state
    if (!alreadyExists && (ob.team_id || ob.organization_id)) {
      setAlreadyExists(true);
    }
  }, [alreadyExists, existingOrg, ob.affiliation, ob.organization_id, ob.team_id, ob.organization_name]);

  // Determine what type of page to create based on plan
  const pageConfig = useMemo(() => {
    if (alreadyExists) {
      const displayName = existingTeam?.name || existingOrg?.name || ob.team_name || ob.organization_name;
      return {
        type: existingTeam || ob.team_id ? 'team' : 'organization',
        title: existingTeam || ob.team_id ? 'Team Already Created' : 'Organization Already Created',
        subtitle: existingTeam || ob.team_id
          ? `Your team "${displayName}" is ready to go!` 
          : `Organization "${displayName}" is ready to go!`,
        description: existingTeam || ob.team_id
          ? 'Team page has been created. Continue to add authorized users and complete your setup.'
          : 'Organization page has been created. Continue to add authorized users and complete your setup.',
        alreadyExists: true
      };
    }
    
    // All coaches get organization search/create flow
    return {
      type: 'organization',
      title: 'Connect to Organization',
      subtitle: 'Find and join a school or club, or create a new organization',
      description: 'Search for an organization to join existing teams, or create a new organization page.',
      alreadyExists: false
    };
  }, [alreadyExists, existingOrg, existingTeam, ob.organization_name, ob.team_id, ob.team_name]);

  const canContinue = useMemo(() => {
    if (saving) return false;
    
    // If team/org already exists, user can continue immediately
    if (alreadyExists) return true;
    
    // All coaches need organization fields
    // Allow proceeding with a manually typed location if no autocomplete selection was made
    const hasNameAndType = orgName.trim().length > 0 && !!orgType;
    const hasLocation = !!selectedPlace || (locationTouched && location.trim().length >= 3);
    return hasNameAndType && hasLocation;
  }, [orgName, orgType, saving, alreadyExists, selectedPlace, locationTouched, location]);

  // Format organization type for display (capitalize & friendly term mapping)
  const formatOrgType = (raw?: string) => {
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    const map: Record<string,string> = {
      school: 'School',
      club: 'Club',
      league: 'League',
      tournament: 'Tournament',
      university: 'University',
      college: 'College',
      pro: 'Professional',
      professional: 'Professional'
    };
    return map[normalized] || (normalized.charAt(0).toUpperCase() + normalized.slice(1));
  };

  // Search for nearby organizations (auto-invoked as user types)
  const executeNearbySearch = useCallback((query?: string) => {
    const term = (query ?? searchZip).trim();
    if (!term) {
      clearOrganizations();
      return;
    }
    searchOrganizations({ query: term, limit: 20, mode: 'nearby', orgType: orgType || undefined }).catch((err: any) => {
      console.error('[Step4] Organization search failed:', { query: term, error: err?.message || err });
    });
  }, [clearOrganizations, orgType, searchOrganizations, searchZip]);

  const requestLocationSuggestions = useCallback((text: string) => {
    if (locationTimerRef.current) {
      clearTimeout(locationTimerRef.current);
    }
    if (text.trim().length < 3) {
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
        console.warn('Location autocomplete failed:', error);
      } finally {
        setLocationQuerying(false);
      }
    }, 350);
  }, []);

  const handleSearchInput = useCallback((text: string) => {
    setSearchZip(text);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (text.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        void executeNearbySearch(text);
      }, 400);
    } else {
      clearOrganizations();
    }
  }, [clearOrganizations, executeNearbySearch]);

  const handleLocationChange = useCallback((text: string) => {
    setLocation(text);
    setLocationTouched(true);
    setSelectedPlace(null);
    setSelectedPlaceZip(null);
    requestLocationSuggestions(text);
  }, [requestLocationSuggestions]);

  const handleSelectLocation = useCallback((suggestion: PlaceSuggestion) => {
    setSelectedPlace(suggestion);
    setLocation(suggestion.description);
    setLocationSuggestions([]);
    setLocationQuerying(false);
    setLocationTouched(true);
    const zipMatch = suggestion.description.match(/\b\d{5}(?:-\d{4})?\b/);
    if (zipMatch && zipMatch[0]) {
      const normalizedZip = zipMatch[0].slice(0, 5);
      setSelectedPlaceZip(normalizedZip);
      setSearchZip(normalizedZip);
    }
    // Check for duplicates by place_id
    void (async () => {
      try {
        const res = await httpPost('/organizations/check-duplicate', {
          place_id: suggestion.place_id,
          name: orgName.trim(),
        });
        if (res && (res as any).exists) {
          setDuplicateWarning(`An organization at "${suggestion.description}" already exists. Use Search to find it.`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    })();
  }, [setSearchZip, orgName]);

  // Cleanup search timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (locationTimerRef.current) {
        clearTimeout(locationTimerRef.current);
        locationTimerRef.current = null;
      }
    };
  }, []);

  // Request to join an organization
  const requestToJoin = async (org: any) => {
    setSelectedOrg(org);
    setRequestingJoin(true);
  };

  const submitJoinRequest = async () => {
    if (!selectedOrg) return;
    
    setSaving(true);
    try {
      await httpPost('/organizations/join-requests', {
        organization_id: selectedOrg.id,
        message: joinMessage.trim() || undefined
      });
      
      Alert.alert(
        'Request Sent!',
        `Your request to join "${selectedOrg.name}" has been sent to the organization administrator. You'll receive an email notification when it's reviewed.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Save pending status and continue
              setOB((prev) => ({
                ...prev,
                organization_id: selectedOrg.id,
                organization_name: selectedOrg.name,
                join_request_pending: true
              }));
              
              if (returnToConfirmation) {
                setProgress(7);
                router.replace('/onboarding/step-10-confirmation');
              } else {
                setProgress(5);
                router.push('/onboarding/step-6-authorized-users');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Request Failed', error?.data?.error || error?.message || 'Failed to send join request');
    } finally {
      setSaving(false);
      setRequestingJoin(false);
      setJoinMessage('');
      setSelectedOrg(null);
    }
  };

  const onContinue = async () => {
    // SECURITY: Prevent double submission
    if (!canContinue || saving) return;
    
    // Guard: require email verification before creating org
    if (emailVerified === false && !alreadyExists) {
      Alert.alert(
        'Email Verification Required',
        'Please verify your email address before creating an organization.',
        [
          { text: 'Verify Now', onPress: () => router.push('/verify-email') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    
    setSaving(true);
    try {
      // If team/org already exists, just navigate to next step
      if (alreadyExists) {
        if (returnToConfirmation) {
          setProgress(7);
          router.replace('/onboarding/step-10-confirmation');
        } else {
          setProgress(5); // step-6
          router.push('/onboarding/step-6-authorized-users');
        }
        return;
      }
      
      // All coaches create organization page
      const locationLabel = selectedPlace?.description || location.trim();
      const desc = `${orgType === 'school' ? 'School' : 'Organization'}` + (locationLabel ? ` in ${locationLabel}` : '');
      // Create an organization using the dedicated API
      const payload: any = {
        name: orgName.trim(),
        description: desc,
        org_type: orgType,
        location: locationLabel,
        formatted_address: selectedPlace?.description,
        place_id: selectedPlace?.place_id,
        zip_code: (selectedPlaceZip || searchZip.trim()) || undefined,
      };
      // include plan if present in onboarding state
      if (ob.plan) payload.plan = ob.plan;

      const org = await Organization.createOrganization(payload);
      setOB((prev) => ({ 
        ...prev, 
        organization_id: org?.id, 
        organization_name: orgName.trim(),
        organization_place_id: selectedPlace?.place_id ?? null,
        organization_location: locationLabel || null,
      }));
      
      // Show success toast
      Alert.alert(
        'Organization Created!',
        `"${orgName.trim()}" has been created successfully.`,
        [{ text: 'Continue', onPress: () => {
          // If onboarding indicates payment is pending, persist that to server preferences
          void (async () => {
            try {
              if (ob.payment_pending) {
                await (await import('@/api/entities')).User.updatePreferences({ payment_pending: true });
              }
            } catch (e) {
              console.warn('Failed to persist payment_pending flag:', (e as any)?.message || e);
            }
            
            // Navigate to next step
            if (returnToConfirmation) {
              setProgress(7);
              router.replace('/onboarding/step-10-confirmation');
            } else {
              setProgress(5); // step-6
              router.push('/onboarding/step-6-authorized-users');
            }
          })();
        }}]
      );
    } catch (e: any) { 
      // Check if duplicate organization error
      if (e?.message?.includes('DUPLICATE_ORGANIZATION') || e?.message?.toLowerCase().includes('duplicate')) {
        Alert.alert(
          'Organization Already Exists',
          'This organization may already be on VarsityHub.\n\nPlease use the Search button above to find and join it instead.',
          [{ text: 'OK' }]
        );
      } else if (e?.message?.toLowerCase().includes('unauthorized') || e?.status === 401 || e?.status === 403) {
        Alert.alert(
          'Authentication Required',
          'Please verify your email address or log in again to continue.',
          [
            { text: 'Verify Email', onPress: () => router.push('/verify-email') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Failed to create page', e?.message || 'Please verify your email and try again');
      }
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={4}
      title={pageConfig.title}
      subtitle={pageConfig.subtitle}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {alreadyExists ? (
        // Show success message if team/org already exists
        <>
          <View style={styles.successBox}>
            <Ionicons 
              name="checkmark-circle" 
              size={48} 
              color={colorScheme === 'dark' ? '#4ade80' : '#16A34A'} 
              style={{ marginBottom: 16 }} 
            />
            <Text style={styles.successTitle}>
              {pageConfig.type === 'team' ? 'Team Already Created' : 'Organization Already Created'}
            </Text>
            <Text style={styles.successText}>
              {pageConfig.type === 'team' 
                ? `Your team "${existingTeam?.name || ob.team_name}" has already been set up. You can continue to the next step.`
                : `Organization "${existingOrg?.name || ob.organization_name}" has already been set up. You can continue to the next step.`
              }
            </Text>
          </View>
          
          <PrimaryButton 
            label={checking ? 'Checking...' : 'Continue'} 
            onPress={onContinue} 
            disabled={!canContinue || checking} 
            loading={saving || checking}
          />
        </>
      ) : checking ? (
        // Show loading state while checking
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={{ ...Type.body, color: Colors[colorScheme].mutedText }}>
            Checking for existing teams...
          </Text>
        </View>
      ) : (
        // Show creation form
        <>
          <View style={styles.howItWorksCard} accessibilityRole="summary">
            <View style={styles.howItWorksHeaderRow}>
              <Ionicons name="grid-outline" size={22} color={colorScheme === 'dark' ? '#1D4ED8' : '#1D4ED8'} style={{ marginRight: 10 }} />
              <Text style={styles.howItWorksTitle}>How It Works</Text>
            </View>
            <View style={styles.howItWorksTreeBox}>
              <Text style={styles.howItWorksTreeLine}>🏫 Stamford HS (Organization Page)</Text>
              <Text style={styles.howItWorksTreeLine}> └🏈 Varsity Football (Team Page)</Text>
              <Text style={styles.howItWorksTreeLine}> └🏀 JV Basketball (Team Page)</Text>
              <Text style={styles.howItWorksTreeLine}> └⚽ Girls Soccer (Team Page)</Text>
            </View>
            <Text style={styles.howItWorksDescLine}><Text style={styles.howItWorksDescStrong}>Organization Page:</Text> Managed by administrator, displays all programs</Text>
            <Text style={styles.howItWorksDescLine}><Text style={styles.howItWorksDescStrong}>Team Pages:</Text> Managed by Authorized Users you assign</Text>
          </View>

        {/* Organization creation/search form - for all coaches */}
        {!showSearch ? (
          <>
            {/* Bracket Toggle: Search vs Create */}
            <View style={styles.modeToggleWrapper}>
              <View style={styles.modeToggleBracket}>
                <Pressable
                  style={[styles.modeToggleOption, showSearch && styles.modeToggleOptionActive]}
                  onPress={() => setShowSearch(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Search for existing organization"
                >
                  <Ionicons name="search" size={16} color={showSearch ? '#fff' : (isDark ? '#E2E8F0' : '#0F172A')} />
                  <Text style={[styles.modeToggleText, showSearch && styles.modeToggleTextActive]}>Search</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeToggleOption, !showSearch && styles.modeToggleOptionActive]}
                  onPress={() => { setShowSearch(false); clearOrganizations(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new organization"
                >
                  <Ionicons name="add" size={16} color={!showSearch ? '#fff' : (isDark ? '#E2E8F0' : '#0F172A')} />
                  <Text style={[styles.modeToggleText, !showSearch && styles.modeToggleTextActive]}>Create New</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.label}>Organization Name</Text>
            <Input 
              value={orgName} 
              onChangeText={setOrgName} 
              placeholder="Westhill High School" 
              style={{ marginBottom: 12 }} 
            />
            
            <Text style={styles.label}>Organization Type</Text>
            <Pressable
              style={[
                styles.selectField,
                { borderColor: isDark ? '#374151' : '#E2E8F0', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }
              ]}
              onPress={() => setShowTypePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select organization type"
            >
              <Text style={styles.selectFieldText}>
                {orgType ? formatOrgType(orgType) : 'Select organization type'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={isDark ? '#CBD5E1' : '#475569'} />
            </Pressable>
            <View style={{ height: 12 }} />
          </>
        ) : (
          <>
            {/* Search interface */}
                <View style={styles.searchBox}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setShowSearch(false);
                      clearOrganizations();
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color={Colors[colorScheme].tint} />
                    <Text style={styles.backButtonText}>Create New Instead</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Search by Name or Zip Code</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <Input 
                      value={searchZip} 
                      onChangeText={handleSearchInput} 
                      placeholder="e.g., Westhill or 06902" 
                      style={{ flex: 1 }} 
                    />
                    <TouchableOpacity
                      style={styles.searchActionButton}
                      onPress={() => executeNearbySearch()}
                      disabled={searching || !searchZip.trim()}
                    >
                      {searching ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {nearbyOrgs.length > 0 && (
                    <ScrollView style={styles.orgList} showsVerticalScrollIndicator={false}>
                      <Text style={styles.resultsHeader}>
                        {nearbyOrgs.length} organization{nearbyOrgs.length !== 1 ? 's' : ''} found
                      </Text>
                      {nearbyOrgs.map((org) => (
                        <View key={org.id} style={styles.orgCard}>
                          <View style={styles.orgCardContent}>
                            <Text style={styles.orgCardName}>{org.name}</Text>
                            {org.location && (
                              <Text style={styles.orgCardLocation}>
                                <Ionicons name="location-outline" size={14} /> {org.location}
                              </Text>
                            )}
                            {(org.org_type || org.type) && (
                              <Text style={styles.orgCardSport}>{formatOrgType(org.org_type || org.type)}</Text>
                            )}
                            <Text style={styles.orgCardMeta}>
                              {org._count.teams} team{org._count.teams !== 1 ? 's' : ''} • {org._count.memberships} member{org._count.memberships !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.joinButton}
                            onPress={() => requestToJoin(org)}
                          >
                            <Text style={styles.joinButtonText}>Request to Join</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  {searchZip.trim().length >= 2 && !searching && nearbyOrgs.length === 0 && (
                    <View style={{ paddingVertical: 16, paddingHorizontal: 12, backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 8, marginTop: 8 }}>
                      <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 14, textAlign: 'center' }}>
                        No organizations found matching "{searchZip}". Try searching by a different name or zip code, or use the Create New button instead.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

        {!showSearch && (
          <>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationFieldWrapper}>
              <Input 
                value={location} 
                onChangeText={handleLocationChange} 
                placeholder="Start typing an address, school, or city" 
                autoCapitalize="words"
                autoCorrect={false}
              />
              {locationQuerying && (
                <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={styles.locationSpinner} />
              )}
              {locationSuggestions.length > 0 && (
                <ScrollView 
                  style={styles.locationSuggestionList}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                >
                  {locationSuggestions.map((suggestion, index) => (
                    <Pressable
                      key={suggestion.place_id}
                      style={[
                        styles.locationSuggestionItem,
                        index === locationSuggestions.length - 1 && styles.locationSuggestionItemLast,
                      ]}
                      onPress={() => handleSelectLocation(suggestion)}
                    >
                      <Text style={styles.locationSuggestionMain}>
                        {suggestion.structured_formatting?.main_text || suggestion.description}
                      </Text>
                      {suggestion.structured_formatting?.secondary_text ? (
                        <Text style={styles.locationSuggestionSecondary}>
                          {suggestion.structured_formatting.secondary_text}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            {!selectedPlace && locationTouched && (
              <Text style={styles.inputHelperText}>Selecting a suggested location is recommended for accuracy, but you can continue with a manual location.</Text>
            )}
            {duplicateWarning && (
              <View style={styles.duplicateWarningBox}>
                <Ionicons name="warning" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={styles.duplicateWarningText}>{duplicateWarning}</Text>
              </View>
            )}
          </>
        )}

        {/* Join Request Modal */}
        {requestingJoin && selectedOrg && (
          <View style={styles.enhancedModalOverlay} accessibilityViewIsModal>
            <View style={styles.enhancedModalCard}>
              <View style={styles.enhancedModalHeader}>
                <View style={styles.enhancedModalIconCircle}>
                  <Ionicons name="school" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.enhancedModalTitle}>Request to Join</Text>
                  <Text style={styles.enhancedModalOrg}>{selectedOrg.name}</Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Close join request"
                  onPress={() => { setRequestingJoin(false); setSelectedOrg(null); setJoinMessage(''); }}
                  style={styles.closeTouch}
                >
                  <Ionicons name="close" size={20} color={Colors[colorScheme].mutedText} />
                </TouchableOpacity>
              </View>

              <Text style={styles.enhancedModalLabel}>Message (Optional)</Text>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  value={joinMessage}
                  onChangeText={setJoinMessage}
                  placeholder="Introduce yourself to the administrator..."
                  multiline
                  style={styles.textArea}
                  maxLength={300}
                  accessibilityLabel="Optional message to organization administrator"
                />
                <View style={styles.charCountRow}>
                  <Text style={styles.charCountText}>{joinMessage.length}/300</Text>
                  {joinMessage.length > 280 && (
                    <Text style={styles.charLimitWarning}>Consider keeping it concise (under 280 characters).</Text>
                  )}
                </View>
              </View>

              <View style={styles.enhancedActionsRow}>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => { setRequestingJoin(false); setSelectedOrg(null); setJoinMessage(''); }}
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-back" size={16} color={Colors[colorScheme].tint} />
                  <Text style={styles.secondaryActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryAction, (saving || joinMessage.length > 300) && { opacity: 0.5 }]}
                  onPress={submitJoinRequest}
                  disabled={saving || joinMessage.length > 300}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryActionText}>Send Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.helperInfo}>
                <Ionicons name="information-circle-outline" size={16} color={Colors[colorScheme].mutedText} />
                <Text style={styles.helperInfoText}>
                  The administrator will review your request. You’ll get an email when it’s approved.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Compact Accessible Organization Type Modal */}
        {showTypePicker && (
          <View style={styles.typeModalOverlay} accessibilityViewIsModal>
            <View style={styles.typeModalCard}>
              <Text style={styles.typeModalTitle}>Organization Type</Text>
              {['school','club','league','tournament','university','college','professional'].map(t => (
                <Pressable
                  key={t}
                  onPress={() => setOrgType(t as any)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: orgType === t }}
                  style={[styles.typeOption, orgType === t && styles.typeOptionActive]}
                >
                  <Ionicons name={orgType === t ? 'radio-button-on' : 'radio-button-off'} size={18} color={orgType === t ? (isDark ? '#3B82F6' : '#1D4ED8') : (isDark ? '#94A3B8' : '#64748B')} />
                  <Text style={styles.typeOptionText}>{formatOrgType(t)}</Text>
                </Pressable>
              ))}
              <View style={styles.typeModalActions}>
                <Pressable onPress={() => { setShowTypePicker(false); setOrgType(null); }} style={styles.typeCancel} accessibilityRole="button">
                  <Text style={styles.typeCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowTypePicker(false)}
                  disabled={!orgType}
                  style={[styles.typeConfirm, !orgType && { opacity: 0.4 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.typeConfirmText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        
        {/* Plan Benefits Reminder - only show if not searching */}
        {!showSearch && (
          ob.plan === 'rookie' ? (
            <LinearGradient
              // Deeper metallic silver (cooler dark edges -> bright center -> soft falloff)
              colors={colorScheme === 'dark'
                ? ['#3F4751','#707B85','#3F4751']
                : ['#9FA2A5','#ECEEEF','#9FA2A5']}
              locations={[0,0.52,1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.planReminderRookie}
            >
              {/* Top reflective highlight */}
              <View style={styles.metalHighlight} pointerEvents="none" />
              {/* Edge darkening & subtle bottom shadow */}
              <LinearGradient
                colors={colorScheme === 'dark'
                  ? ['rgba(0,0,0,0.35)','transparent','rgba(0,0,0,0.28)']
                  : ['rgba(0,0,0,0.12)','transparent','rgba(0,0,0,0.10)']}
                locations={[0,0.5,1]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.metalEdgeShadow}
                pointerEvents="none"
              />
              <View style={styles.planReminderRookieInner}>
                <View style={styles.planReminderHeaderRow}>
                  <View style={styles.planBadge}><Ionicons name="sparkles" size={16} color={colorScheme === 'dark' ? '#F3F4F6' : '#374151'} /></View>
                  <Text style={[styles.planReminderTitle, styles.rookieTitle]}>Rookie Plan Benefits</Text>
                </View>
                <View style={styles.benefitsList}>
                  <View style={styles.benefitRow}><Ionicons name="sparkles" size={16} color={colorScheme === 'dark' ? '#E5E7EB' : '#374151'} /><Text style={[styles.benefitItem, styles.rookieBenefitItem]}>First two teams free</Text></View>
                  <View style={styles.benefitRow}><Ionicons name="people" size={16} color={colorScheme === 'dark' ? '#E5E7EB' : '#374151'} /><Text style={[styles.benefitItem, styles.rookieBenefitItem]}>Invite athletes</Text></View>
                  <View style={styles.benefitRow}><Ionicons name="shield-checkmark" size={16} color={colorScheme === 'dark' ? '#E5E7EB' : '#374151'} /><Text style={[styles.benefitItem, styles.rookieBenefitItem]}>One administrator per team</Text></View>
                </View>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.planReminder}>
              <Text style={styles.planReminderTitle}>
                {ob.plan === 'veteran' ? 'Veteran Plan Benefits' : 'Legend Plan Benefits'}
              </Text>
              <View style={styles.benefitsList}>
                {(ob.plan === 'veteran') && (
                  <>
                    <View style={styles.benefitRow}><Ionicons name="cash" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>$1.50/month per team</Text></View>
                    <View style={styles.benefitRow}><Ionicons name="people-circle" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>Up to 12 authorized users</Text></View>
                    <View style={styles.benefitRow}><Ionicons name="settings" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>Advanced features</Text></View>
                  </>
                )}
                {(ob.plan === 'legend') && (
                  <>
                    <View style={styles.benefitRow}><Ionicons name="trophy" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>$19.99/year unlimited teams</Text></View>
                    <View style={styles.benefitRow}><Ionicons name="infinite" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>Unlimited authorized users</Text></View>
                    <View style={styles.benefitRow}><Ionicons name="star" size={14} color={colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A'} /><Text style={styles.benefitItem}>Premium features</Text></View>
                  </>
                )}
              </View>
            </View>
          )
        )}
        
        {!showSearch && (
          <PrimaryButton 
            label={saving ? 'Creating...' : 'Continue'} 
            onPress={onContinue} 
            disabled={!canContinue} 
            loading={saving}
          />
        )}
      </>
      )}
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors[colorScheme].background 
  },
  title: { 
    ...(Type.h1 as any), 
    color: Colors[colorScheme].text,
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: Colors[colorScheme].mutedText, 
    marginBottom: 16, 
    textAlign: 'center', 
    fontSize: 16 
  },
  label: { 
    fontWeight: '700', 
    color: Colors[colorScheme].text,
    marginBottom: 4 
  },
  locationFieldWrapper: {
    position: 'relative',
    marginBottom: 8,
    zIndex: 100,
  },
  locationSpinner: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
  },
  locationSuggestionList: {
    position: 'absolute',
    top: 44 + 6, // input height + marginTop
    left: 0,
    right: 0,
    marginTop: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors[colorScheme].border,
    borderRadius: 12,
    backgroundColor: Colors[colorScheme].surface,
    overflow: 'hidden',
    zIndex: 1000,
    maxHeight: 250,
  },
  locationSuggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors[colorScheme].border,
  },
  locationSuggestionItemLast: {
    borderBottomWidth: 0,
  },
  locationSuggestionMain: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors[colorScheme].text,
  },
  locationSuggestionSecondary: {
    fontSize: 13,
    color: Colors[colorScheme].mutedText,
    marginTop: 2,
  },
  inputHelperText: {
    fontSize: 12,
    color: Colors[colorScheme].mutedText,
    marginBottom: 24,
  },
  // Legacy modal styles (kept for reference) replaced by enhanced modal
  enhancedModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 60,
  },
  enhancedModalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 12,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#1E293B' : '#E2E8F0'
  },
  enhancedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  enhancedModalIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colorScheme === 'dark' ? '#0369A1' : '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#0284C7',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  enhancedModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#F8FAFC' : '#0F172A',
    letterSpacing: 0.5,
  },
  enhancedModalOrg: {
    fontSize: 16,
    fontWeight: '500',
    color: colorScheme === 'dark' ? '#94A3B8' : '#475569',
    marginTop: 2,
  },
  closeTouch: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 8,
  },
  enhancedModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: colorScheme === 'dark' ? '#94A3B8' : '#64748B',
    letterSpacing: 0.5,
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#334155' : '#CBD5E1',
    borderRadius: 16,
    backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    fontSize: 15,
    lineHeight: 20,
    color: colorScheme === 'dark' ? '#F1F5F9' : '#0F172A',
    textAlignVertical: 'top',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  charCountText: {
    fontSize: 12,
    color: colorScheme === 'dark' ? '#64748B' : '#64748B',
  },
  charLimitWarning: {
    fontSize: 12,
    color: colorScheme === 'dark' ? '#F59E0B' : '#B45309',
  },
  enhancedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#334155' : '#E2E8F0',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colorScheme === 'dark' ? '#38BDF8' : '#0369A1',
    marginLeft: 6,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorScheme === 'dark' ? '#0284C7' : '#0369A1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  helperInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  helperInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colorScheme === 'dark' ? '#64748B' : '#64748B',
  },
  successBox: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.1)' : '#ECFDF5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.3)' : '#6EE7B7'
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#34D399' : '#065F46',
    marginBottom: 8
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colorScheme === 'dark' ? '#D1FAE5' : '#065F46'
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.08)' : '#EFF6FF',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
    marginBottom: 24
  },
  orgPageCard: {
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#1E3A8A' : '#93C5FD',
    backgroundColor: colorScheme === 'dark' ? 'rgba(30,64,175,0.18)' : '#EFF6FF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  howItWorksCard: {
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#1E3A8A' : '#93C5FD',
    backgroundColor: colorScheme === 'dark' ? 'rgba(30,64,175,0.15)' : '#F1F8FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  howItWorksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#1D4ED8' : '#1D4ED8'
  },
  howItWorksTreeBox: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(29,78,216,0.25)' : '#DBEAFE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  howItWorksTreeLine: {
    fontSize: 13,
    fontFamily: 'Courier',
    color: colorScheme === 'dark' ? '#BFDBFE' : '#1E3A8A',
  },
  howItWorksDescLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colorScheme === 'dark' ? '#BFDBFE' : '#1E3A8A',
    marginBottom: 4,
  },
  howItWorksDescStrong: {
    fontWeight: '700',
  },
  orgPageHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  orgPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#1D4ED8' : '#0F172A'
  },
  orgPageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colorScheme === 'dark' ? '#CBD5E1' : '#475569'
  },
  infoIcon: { marginRight: 16 },
  infoContent: { flex: 1 },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 4
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors[colorScheme].mutedText
  },
  planReminder: {
    marginTop: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: colorScheme === 'dark' ? 'rgba(30,64,175,0.18)' : '#DBEAFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(96,165,250,0.3)' : '#93C5FD'
  },
  planReminderRookie: {
    marginTop: 24,
    marginBottom: 24,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  planReminderRookieInner: {
    padding: 20,
  },
  metalHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  metalEdgeShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  rookieTitle: {
    color: colorScheme === 'dark' ? '#F3F4F6' : '#374151'
  },
  rookieBenefitItem: {
    color: colorScheme === 'dark' ? '#E5E7EB' : '#374151'
  },
  planReminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  planReminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#93C5FD' : '#1E3A8A',
    marginBottom: 12
  },
  benefitsList: { marginTop: 4 },
  benefitItem: {
    fontSize: 14,
    lineHeight: 20,
    color: colorScheme === 'dark' ? '#BFDBFE' : '#1E3A8A',
    marginBottom: 4
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectFieldText: {
    fontSize: 15,
    fontWeight: '500',
    color: colorScheme === 'dark' ? '#E2E8F0' : '#0F172A'
  },
  typeModalOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 70,
    padding: 24,
  },
  typeModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#1E293B' : '#E2E8F0'
  },
  typeModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    color: colorScheme === 'dark' ? '#F1F5F9' : '#0F172A'
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F8FAFC',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#334155' : '#E2E8F0'
  },
  typeOptionActive: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.25)' : '#DBEAFE',
    borderColor: colorScheme === 'dark' ? '#3B82F6' : '#3B82F6'
  },
  typeOptionText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
    color: colorScheme === 'dark' ? '#E2E8F0' : '#0F172A'
  },
  typeModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  typeCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colorScheme === 'dark' ? '#334155' : '#F1F5F9'
  },
  typeCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colorScheme === 'dark' ? '#E2E8F0' : '#0F172A'
  },
  typeConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: colorScheme === 'dark' ? '#0284C7' : '#0369A1'
  },
  typeConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff'
  },
  searchPrompt: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  modeToggleWrapper: {
    marginBottom: 20,
    alignItems: 'center',
  },
  modeToggleBracket: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? '#1E3A8A' : '#93C5FD',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colorScheme === 'dark' ? 'rgba(30,64,175,0.25)' : '#DBEAFE',
  },
  modeToggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    gap: 6,
  },
  modeToggleOptionActive: {
    backgroundColor: colorScheme === 'dark' ? '#1D4ED8' : '#1D4ED8',
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colorScheme === 'dark' ? '#E2E8F0' : '#0F172A',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  searchPromptText: {
    color: Colors[colorScheme].text,
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors[colorScheme].tint,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  dividerText: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  searchBox: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: Colors[colorScheme].tint,
    fontSize: 15,
    fontWeight: '600',
  },
  searchActionButton: {
    backgroundColor: Colors[colorScheme].tint,
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgList: {
    maxHeight: 400,
  },
  resultsHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors[colorScheme].text,
    marginBottom: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  picker: {
    height: 50,
  },
  orgCard: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
  },
  orgCardContent: {
    marginBottom: 12,
  },
  orgCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 4,
  },
  orgCardLocation: {
    fontSize: 14,
    color: Colors[colorScheme].mutedText,
    marginBottom: 4,
  },
  orgCardSport: {
    fontSize: 14,
    color: Colors[colorScheme].mutedText,
    marginBottom: 4,
  },
  orgCardMeta: {
    fontSize: 13,
    color: Colors[colorScheme].mutedText,
  },
  joinButton: {
    backgroundColor: Colors.light.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: Colors[colorScheme].background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: Colors[colorScheme].mutedText,
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
  },
  modalButtonSubmit: {
    backgroundColor: Colors[colorScheme].tint,
  },
  modalButtonTextCancel: {
    color: Colors[colorScheme].text,
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonTextSubmit: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  duplicateWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
  },
  duplicateWarningText: {
    flex: 1,
    fontSize: 13,
    color: colorScheme === 'dark' ? '#FCD34D' : '#92400E',
    lineHeight: 18,
  },
});
